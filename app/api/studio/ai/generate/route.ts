// POST /api/studio/ai/generate
// SSE streaming endpoint: Firebase auth → Qdrant (optional) → Tavily (optional) → OpenAI GPT-4o → stream
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/firebase/server";
import { buildSystemPrompt, type ContentFormat, type KnowledgeSource } from "@/lib/studio/prompts";
import {
  MAX_VARIATIONS,
  type QdrantSource,
  type TavilySource,
} from "@/lib/studio/generate-shared";
import { buildKbCoreHeaders, getKbCoreUrl } from "@/lib/studio/kb-core";

export const runtime = "nodejs";

// ─── env helpers ──────────────────────────────────────────────────────────────

function getOpenAiKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY não configurada.");
  return key;
}

function getTavilyKey(): string | null {
  return process.env.TAVILY_API_KEY || null;
}

/** Safely normalize an org/scope slug — cap length first to avoid ReDoS. */
function normalizeSlug(value: string): string {
  const capped = value.trim().slice(0, 200).toLowerCase();
  let result = "";
  let prevDash = true; // treat start as dash to skip leading dashes
  for (let i = 0; i < capped.length; i++) {
    const ch = capped[i];
    if (/[a-z0-9]/.test(ch)) {
      result += ch;
      prevDash = false;
    } else if (!prevDash) {
      result += "-";
      prevDash = true;
    }
  }
  // strip trailing dash
  return result.endsWith("-") ? result.slice(0, -1) : result;
}

// ─── auth ─────────────────────────────────────────────────────────────────────

function getBearerToken(request: NextRequest): string {
  const header = request.headers.get("authorization") || "";
  if (!header.startsWith("Bearer ")) return "";
  return header.slice("Bearer ".length).trim();
}

// ─── types ────────────────────────────────────────────────────────────────────

interface GenerateRequestBody {
  prompt?: string;
  source?: KnowledgeSource;
  format?: ContentFormat;
  tone?: string;
  audience?: string;
  language?: string;
  includeSources?: boolean;
  variations?: number;
  orgId?: string;
  state?: string;
  city?: string;
  neighborhood?: string;
  linkedProjectId?: string;
}

// ─── Qdrant retrieval ─────────────────────────────────────────────────────────

type KbRetrieveResult = {
  id?: string;
  score?: number | null;
  snippet?: string;
  text?: string;
  payload?: Record<string, unknown>;
};

type KbContextRequest = {
  query: string;
  orgId: string;
  kbDomain: "market" | "brand" | "project";
  scopeId: string;
  limit: number;
  scoreThreshold?: number;
  filters?: {
    state?: string;
    city?: string;
    neighborhood?: string;
    linkedProjectId?: string;
  };
};

async function fetchKbContext(
  request: KbContextRequest,
): Promise<{ context: string; sources: QdrantSource[] }> {
  const response = await fetch(getKbCoreUrl("/kb/retrieve"), {
    method: "POST",
    headers: buildKbCoreHeaders({
      "Content-Type": "application/json",
      Accept: "application/json",
    }),
    body: JSON.stringify(request),
    cache: "no-store",
  });

  if (!response.ok) {
    console.warn(
      `[generate] KB retrieve failed for ${request.kbDomain}:`,
      response.status,
    );
    return { context: "", sources: [] };
  }

  const payload = (await response.json()) as { results?: KbRetrieveResult[] };
  const results: KbRetrieveResult[] = Array.isArray(payload?.results)
    ? payload.results
    : [];

  const sources: QdrantSource[] = results.map((result) => {
    const sourcePayload = result.payload || {};
    return {
      id: String(result.id ?? ""),
      score: typeof result.score === "number" ? result.score : null,
      snippet: String(
        result.snippet ?? result.text ?? sourcePayload.snippet ?? sourcePayload.text ?? "",
      ).slice(0, 400),
      storagePath: String(sourcePayload.storagePath ?? ""),
      sectionKind: String(sourcePayload.sectionKind ?? ""),
      kbDomain: String(sourcePayload.kbDomain ?? request.kbDomain),
      documentType: String(sourcePayload.documentType ?? ""),
    };
  });

  const title =
    request.kbDomain === "brand"
      ? "Conhecimento de Marca"
      : request.kbDomain === "project"
        ? "Conhecimento de Projeto"
        : "Conhecimento de Mercado";

  const context = sources
    .filter((source) => source.snippet)
    .map((source, index) => `[${title} ${index + 1}]: ${source.snippet}`)
    .join("\n\n");

  return { context, sources };
}

// ─── Tavily web search ────────────────────────────────────────────────────────

async function fetchTavilyContext(
  query: string
): Promise<{ context: string; sources: TavilySource[] }> {
  const apiKey = getTavilyKey();
  if (!apiKey) {
    console.warn("[generate] TAVILY_API_KEY not set, skipping web search.");
    return { context: "", sources: [] };
  }

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: "advanced",
      include_answer: true,
      max_results: 5,
      include_domains: [],
      exclude_domains: [],
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    console.warn("[generate] Tavily search failed:", response.status);
    return { context: "", sources: [] };
  }

  type TavilyResult = {
    title?: string;
    url?: string;
    content?: string;
  };

  const payload = (await response.json()) as {
    answer?: string;
    results?: TavilyResult[];
  };

  const results: TavilyResult[] = Array.isArray(payload?.results)
    ? payload.results
    : [];

  const sources: TavilySource[] = results.map((r) => ({
    title: String(r.title ?? ""),
    url: String(r.url ?? ""),
    snippet: String(r.content ?? "").slice(0, 400),
  }));

  const answerLine = payload?.answer
    ? `[Resposta web]: ${payload.answer}\n\n`
    : "";

  const context =
    answerLine +
    sources
      .filter((s) => s.snippet)
      .map((s, i) => `[Web ${i + 1} — ${s.title}]: ${s.snippet}`)
      .join("\n\n");

  return { context, sources };
}

// ─── OpenAI streaming ─────────────────────────────────────────────────────────

async function streamOpenAI(
  systemPrompt: string,
  userMessage: string,
  onDelta: (text: string) => void
): Promise<void> {
  const apiKey = getOpenAiKey();

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      stream: true,
      temperature: 0.7,
      max_tokens: 4096,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`OpenAI error ${response.status}: ${errorText}`);
  }

  if (!response.body) throw new Error("OpenAI response body is null.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data: ")) continue;
      const data = trimmed.slice("data: ".length);
      if (data === "[DONE]") continue;

      try {
        const parsed = JSON.parse(data) as {
          choices?: Array<{ delta?: { content?: string } }>;
        };
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) onDelta(delta);
      } catch {
        // ignore malformed lines
      }
    }
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // 1. Auth check before stream
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const decoded = await auth.verifyIdToken(token);
    if (!decoded.admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "Token inválido." }, { status: 401 });
  }

  // 2. Parse body
  let body: GenerateRequestBody;
  try {
    body = (await request.json()) as GenerateRequestBody;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const prompt = String(body.prompt ?? "").trim();
  if (!prompt) {
    return NextResponse.json(
      { error: "O campo 'prompt' é obrigatório." },
      { status: 400 }
    );
  }

  const source: KnowledgeSource =
    body.source === "qdrant" || body.source === "tavily" || body.source === "both"
      ? body.source
      : "both";

  const format: ContentFormat = body.format ?? "blog";
  const tone = String(body.tone ?? "sofisticado").trim() || "sofisticado";
  const audience = String(body.audience ?? "investidor").trim() || "investidor";
  const language = String(body.language ?? "pt-BR").trim();
  const includeSources = body.includeSources !== false;
  const variations = Math.min(Math.max(Number(body.variations ?? 1), 1), MAX_VARIATIONS);
  const orgId = normalizeSlug(String(body.orgId ?? "inlevor")) || "inlevor";
  const state = normalizeSlug(String(body.state ?? ""));
  const city = normalizeSlug(String(body.city ?? ""));
  const neighborhood = normalizeSlug(String(body.neighborhood ?? ""));
  const linkedProjectId = normalizeSlug(String(body.linkedProjectId ?? ""));

  // 3. SSE stream
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          // controller already closed
        }
      };

      try {
        // 3a. Fetch knowledge context
        let qdrantSources: QdrantSource[] = [];
        let tavilySources: TavilySource[] = [];
        let combinedContext = "";

        if (source === "qdrant" || source === "both") {
          send({ type: "status", message: "Consultando cérebro (Qdrant)..." });
          const [marketContext, brandContext, projectContext] = await Promise.all([
            fetchKbContext({
              query: prompt,
              orgId,
              kbDomain: "market",
              scopeId: "market__br",
              limit: 6,
              scoreThreshold: 0.35,
              filters: {
                ...(state ? { state } : {}),
                ...(city ? { city } : {}),
                ...(neighborhood ? { neighborhood } : {}),
              },
            }),
            fetchKbContext({
              query: prompt,
              orgId,
              kbDomain: "brand",
              scopeId: "brand__inlevor",
              limit: 4,
              scoreThreshold: 0.3,
            }),
            linkedProjectId
              ? fetchKbContext({
                  query: prompt,
                  orgId,
                  kbDomain: "project",
                  scopeId: linkedProjectId,
                  limit: 5,
                  scoreThreshold: 0.3,
                  filters: { linkedProjectId },
                })
              : Promise.resolve({ context: "", sources: [] }),
          ]);
          qdrantSources = [
            ...brandContext.sources,
            ...marketContext.sources,
            ...projectContext.sources,
          ];
          if (brandContext.context) {
            combinedContext += `## Conhecimento de Marca\n${brandContext.context}\n\n`;
          }
          if (marketContext.context) {
            combinedContext += `## Conhecimento de Mercado\n${marketContext.context}\n\n`;
          }
          if (projectContext.context) {
            combinedContext += `## Conhecimento de Projeto\n${projectContext.context}\n\n`;
          }
        }

        if (source === "tavily" || source === "both") {
          send({ type: "status", message: "Pesquisando na internet (Tavily)..." });
          const { context, sources } = await fetchTavilyContext(prompt);
          tavilySources = sources;
          if (context) combinedContext += `## Pesquisa Web\n${context}\n\n`;
        }

        // 3b. Build prompts
        const systemPrompt = buildSystemPrompt(
          format,
          tone,
          audience,
          language,
          includeSources,
          variations
        );

        const userMessage = combinedContext
          ? `${combinedContext}\n---\n\nSolicitação do usuário:\n${prompt}`
          : prompt;

        // 3c. Stream OpenAI response
        send({ type: "status", message: "Gerando conteúdo com IA..." });

        await streamOpenAI(systemPrompt, userMessage, (text) => {
          send({ type: "delta", text });
        });

        // 3d. Send sources metadata
        send({
          type: "sources",
          qdrant: qdrantSources,
          tavily: tavilySources,
        });

        send({ type: "done" });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Erro interno ao gerar conteúdo.";
        console.error("[studio/ai/generate] error:", err);
        send({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
