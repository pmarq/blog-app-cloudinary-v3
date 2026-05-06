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
  return (
    process.env.TAVILY_API_KEY ||
    process.env.TAVILY_KEY ||
    process.env.TAVILY_TOKEN ||
    null
  );
}

function getTavilySearchUrl(): string {
  return process.env.TAVILY_SEARCH_URL || "https://api.tavily.com/search";
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

function normalizeIdentifier(value: unknown): string {
  return String(value ?? "").trim().slice(0, 200);
}

function normalizeSearchText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const SEARCH_STOPWORDS = new Set([
  "a",
  "o",
  "e",
  "de",
  "da",
  "do",
  "das",
  "dos",
  "em",
  "na",
  "no",
  "nas",
  "nos",
  "um",
  "uma",
  "sobre",
  "para",
  "com",
  "sem",
  "por",
  "que",
  "higienopolis",
  "sao",
  "paulo",
  "projeto",
  "empreendimento",
]);

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

type KbProjectFactsPayload = {
  ok?: boolean;
  projectFacts?: Record<string, unknown> | null;
};

type KbSourceListItem = {
  id?: string;
  label?: string;
  scopeId?: string;
  storagePath?: string;
  kbDomain?: string;
  sourceProject?: string;
  isActive?: boolean;
};

type KbSourceListPayload = {
  ok?: boolean;
  sources?: KbSourceListItem[];
};

type ResolvedProjectMatch = {
  scopeId: string;
  sourceId: string;
  label: string;
  score: number;
};

function getStorageBasename(path: string): string {
  const chunks = String(path || "").split("/");
  const file = chunks[chunks.length - 1] || "";
  return file.replace(/\.[a-z0-9]+$/i, "");
}

function buildProjectAliases(item: KbSourceListItem): string[] {
  const aliases = [
    normalizeSearchText(item.label || ""),
    normalizeSearchText(getStorageBasename(String(item.storagePath || ""))),
  ]
    .map((value) =>
      value
        .replace(/\b(book|brochura|catalogo|catalog|pdf|docling|prepared)\b/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean);

  return Array.from(new Set(aliases));
}

function buildSearchTokens(text: string): Set<string> {
  const tokens = normalizeSearchText(text)
    .split(" ")
    .filter((token) => token && token.length > 2 && !SEARCH_STOPWORDS.has(token));
  return new Set(tokens);
}

function scoreProjectMatch(
  promptNormalized: string,
  promptTokens: Set<string>,
  candidate: KbSourceListItem,
): number {
  const aliases = buildProjectAliases(candidate);
  if (!aliases.length) return 0;

  let bestScore = 0;
  for (const alias of aliases) {
    const aliasTokens = alias
      .split(" ")
      .filter((token) => token && token.length > 2 && !SEARCH_STOPWORDS.has(token));
    if (!aliasTokens.length) continue;

    let score = 0;
    if (alias.length >= 6 && promptNormalized.includes(alias)) {
      score += 6;
    }
    let overlap = 0;
    for (const token of aliasTokens) {
      if (promptTokens.has(token)) overlap += 1;
    }
    score += overlap * 1.5;
    if (aliasTokens.length >= 2 && overlap === aliasTokens.length) {
      score += 2;
    }
    if (score > bestScore) bestScore = score;
  }

  return bestScore;
}

async function fetchProjectSourceCandidates(orgId: string): Promise<KbSourceListItem[]> {
  const query = new URLSearchParams({
    orgId,
    sourceProject: "inlevor-app",
    kbDomain: "project",
    isActive: "true",
    limit: "100",
  });

  const response = await fetch(`${getKbCoreUrl("/kb/sources")}?${query.toString()}`, {
    method: "GET",
    headers: buildKbCoreHeaders({ Accept: "application/json" }),
    cache: "no-store",
  });

  if (!response.ok) return [];

  const payload = (await response.json()) as KbSourceListPayload;
  return Array.isArray(payload?.sources) ? payload.sources : [];
}

async function resolveLinkedProjectIdFromPrompt(params: {
  orgId: string;
  prompt: string;
}): Promise<ResolvedProjectMatch | null> {
  const promptNormalized = normalizeSearchText(params.prompt);
  if (!promptNormalized) return null;

  const promptTokens = buildSearchTokens(promptNormalized);
  if (!promptTokens.size) return null;

  const candidates = await fetchProjectSourceCandidates(params.orgId);
  if (!candidates.length) return null;

  const scored = candidates
    .map((candidate) => {
      const score = scoreProjectMatch(promptNormalized, promptTokens, candidate);
      return {
        scopeId: normalizeIdentifier(candidate.scopeId),
        sourceId: normalizeIdentifier(candidate.id),
        label:
          normalizeIdentifier(candidate.label) ||
          normalizeIdentifier(getStorageBasename(String(candidate.storagePath || ""))),
        score,
      };
    })
    .filter((item) => item.scopeId && item.score > 0)
    .sort((a, b) => b.score - a.score);

  if (!scored.length) return null;
  const top = scored[0];
  const runnerUp = scored[1];

  if (top.score < 4) return null;
  if (runnerUp && top.score < runnerUp.score + 1) return null;

  return top;
}

async function fetchProjectFactsContext(params: {
  orgId: string;
  scopeId: string;
}): Promise<string> {
  const orgId = normalizeSlug(params.orgId || "");
  const scopeId = normalizeIdentifier(params.scopeId || "");
  if (!orgId || !scopeId) return "";

  const response = await fetch(
    `${getKbCoreUrl(`/kb/projects/${encodeURIComponent(scopeId)}/facts`)}?${new URLSearchParams({ orgId }).toString()}`,
    {
      method: "GET",
      headers: buildKbCoreHeaders({ Accept: "application/json" }),
      cache: "no-store",
    },
  );

  if (!response.ok) return "";

  const payload = (await response.json()) as KbProjectFactsPayload;
  if (!payload?.ok || !payload?.projectFacts) return "";

  const facts =
    payload.projectFacts && typeof payload.projectFacts === "object"
      ? payload.projectFacts
      : null;
  if (!facts) return "";

  const summary =
    facts.latestFactsSummary && typeof facts.latestFactsSummary === "object"
      ? (facts.latestFactsSummary as Record<string, unknown>)
      : null;

  const location =
    facts.location && typeof facts.location === "object"
      ? (facts.location as Record<string, unknown>)
      : null;

  const building =
    facts.building && typeof facts.building === "object"
      ? (facts.building as Record<string, unknown>)
      : null;

  const lines: string[] = [];
  if (summary) lines.push(`Resumo: ${JSON.stringify(summary).slice(0, 900)}`);
  if (location) lines.push(`Localização: ${JSON.stringify(location).slice(0, 900)}`);
  if (building) lines.push(`Edificação: ${JSON.stringify(building).slice(0, 900)}`);

  return lines.length ? lines.join("\n") : "";
}

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
): Promise<{ context: string; sources: TavilySource[]; warning?: string }> {
  const apiKey = getTavilyKey();
  if (!apiKey) {
    console.warn("[generate] TAVILY_API_KEY not set, skipping web search.");
    return {
      context: "",
      sources: [],
      warning: "Tavily indisponível: TAVILY_API_KEY não configurada.",
    };
  }

  const response = await fetch(getTavilySearchUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
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
    const raw = await response.text().catch(() => "");
    console.warn("[generate] Tavily search failed:", response.status, raw);
    const isAuthError = response.status === 401 || response.status === 403;
    return {
      context: "",
      sources: [],
      warning: isAuthError
        ? "Tavily rejeitou a credencial (401/403). Verifique TAVILY_API_KEY."
        : `Tavily falhou com status ${response.status}.`,
    };
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

  if (!sources.length) {
    return {
      context,
      sources,
      warning: "Tavily não retornou resultados para este prompt.",
    };
  }

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
  const linkedProjectId = normalizeIdentifier(String(body.linkedProjectId ?? ""));

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
        let effectiveLinkedProjectId = linkedProjectId;

        if (!effectiveLinkedProjectId && (source === "qdrant" || source === "both")) {
          send({ type: "status", message: "Identificando projeto automaticamente..." });
          const resolvedProject = await resolveLinkedProjectIdFromPrompt({ orgId, prompt });
          if (resolvedProject?.scopeId) {
            effectiveLinkedProjectId = resolvedProject.scopeId;
            send({
              type: "status",
              message: `Projeto identificado: ${resolvedProject.label || resolvedProject.scopeId}`,
            });
          } else {
            send({
              type: "warning",
              message:
                "Não foi possível vincular projeto automaticamente. Informe o projeto vinculado para contexto mais preciso.",
            });
          }
        }

        if (source === "qdrant" || source === "both") {
          send({ type: "status", message: "Consultando cérebro (Qdrant)..." });
          if (effectiveLinkedProjectId) {
            const factsContext = await fetchProjectFactsContext({
              orgId,
              scopeId: effectiveLinkedProjectId,
            });
            if (factsContext) {
              combinedContext += `## Facts Estruturados de Projeto\n${factsContext}\n\n`;
            }
          }
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
            effectiveLinkedProjectId
              ? fetchKbContext({
                  query: prompt,
                  orgId,
                  kbDomain: "project",
                  scopeId: effectiveLinkedProjectId,
                  limit: 5,
                  scoreThreshold: 0.3,
                  filters: { linkedProjectId: effectiveLinkedProjectId },
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
          const { context, sources, warning } = await fetchTavilyContext(prompt);
          tavilySources = sources;
          if (warning) send({ type: "warning", message: warning });
          if (source === "tavily" && !context) {
            throw new Error(warning || "Tavily não retornou resultados para este prompt.");
          }
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
