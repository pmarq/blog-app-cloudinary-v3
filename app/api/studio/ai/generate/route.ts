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
import { DEFAULT_ORG_ID } from "@/lib/studio/org";

export const runtime = "nodejs";

// ─── env helpers ──────────────────────────────────────────────────────────────

function getOpenAiKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY não configurada.");
  return key;
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

type RetrieveMode = "kb_only" | "web_only" | "hybrid" | "auto";

type OrchestratedCitation = {
  sourceType?: "kb" | "web";
  id?: string;
  sourceId?: string | null;
  title?: string;
  snippet?: string;
  score?: number | null;
  url?: string | null;
  metadata?: Record<string, unknown>;
};

type OrchestratedRetrievePayload = {
  ok?: boolean;
  strategy?: {
    selectedMode?: "kb_only" | "web_only" | "hybrid";
    requestedMode?: string;
    reason?: string;
  };
  confidence?: number;
  evidenceSufficient?: boolean;
  missingFields?: string[];
  citations?: OrchestratedCitation[];
  warnings?: string[];
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
    headers: buildKbCoreHeaders({ Accept: "application/json" }, token),
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
      headers: buildKbCoreHeaders({ Accept: "application/json" }, token),
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

function mapSourceToRetrieveMode(source: KnowledgeSource): RetrieveMode {
  if (source === "qdrant") return "kb_only";
  if (source === "tavily") return "web_only";
  if (source === "both") return "hybrid";
  return "auto";
}

function buildContextFromCitations(citations: OrchestratedCitation[]): string {
  const lines = citations
    .map((citation, index) => {
      const sourceType = citation.sourceType === "web" ? "Web" : "KB";
      const title = String(citation.title ?? "").trim();
      const snippet = String(citation.snippet ?? "").trim();
      if (!snippet) return "";
      return `[${sourceType} ${index + 1}${title ? ` — ${title}` : ""}]: ${snippet}`;
    })
    .filter(Boolean);
  return lines.join("\n\n");
}

async function fetchOrchestratedRetrieve(params: {
  query: string;
  orgId: string;
  source: KnowledgeSource;
  state?: string;
  city?: string;
  neighborhood?: string;
  linkedProjectId?: string;
}): Promise<{
  context: string;
  qdrantSources: QdrantSource[];
  tavilySources: TavilySource[];
  warnings: string[];
  confidence: number | null;
  evidenceSufficient: boolean | null;
  missingFields: string[];
  selectedMode: string;
}> {
  const body: Record<string, unknown> = {
    query: params.query,
    orgId: params.orgId,
    mode: mapSourceToRetrieveMode(params.source),
    sourceProject: "inlevor-app",
    isActive: true,
    limit: 10,
    webLimit: 5,
  };

  if (params.state) body.state = params.state;
  if (params.city) body.city = params.city;
  if (params.neighborhood) body.neighborhood = params.neighborhood;
  if (params.linkedProjectId) {
    body.linkedProjectId = params.linkedProjectId;
    body.scopeId = params.linkedProjectId;
    body.projectId = params.linkedProjectId;
    body.kbDomain = "project";
  } else if (params.state || params.city || params.neighborhood) {
    body.kbDomain = "market";
  }

  const response = await fetch(getKbCoreUrl("/ai/retrieve/orchestrated"), {
    method: "POST",
    headers: buildKbCoreHeaders({
      "Content-Type": "application/json",
      Accept: "application/json",
    }, token),
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(
      `Retrieve orquestrado falhou (${response.status})${errorText ? `: ${errorText.slice(0, 240)}` : ""}`,
    );
  }

  const payload = (await response.json()) as OrchestratedRetrievePayload;
  const citations = Array.isArray(payload?.citations) ? payload.citations : [];
  const warnings = Array.isArray(payload?.warnings)
    ? payload.warnings.map((item) => String(item)).filter(Boolean)
    : [];

  const qdrantSources: QdrantSource[] = citations
    .filter((citation) => citation?.sourceType === "kb")
    .map((citation) => {
      const metadata =
        citation.metadata && typeof citation.metadata === "object"
          ? citation.metadata
          : {};
      return {
        id: String(citation.id ?? ""),
        score: typeof citation.score === "number" ? citation.score : null,
        snippet: String(citation.snippet ?? "").slice(0, 400),
        storagePath: String((metadata as Record<string, unknown>).storagePath ?? ""),
        sectionKind: String((metadata as Record<string, unknown>).sectionKind ?? ""),
        kbDomain: String((metadata as Record<string, unknown>).kbDomain ?? ""),
        documentType: String((metadata as Record<string, unknown>).documentType ?? ""),
      };
    });

  const tavilySources: TavilySource[] = citations
    .filter((citation) => citation?.sourceType === "web")
    .map((citation) => ({
      title: String(citation.title ?? ""),
      url: String(citation.url ?? ""),
      snippet: String(citation.snippet ?? "").slice(0, 400),
    }));

  return {
    context: buildContextFromCitations(citations),
    qdrantSources,
    tavilySources,
    warnings,
    confidence: typeof payload?.confidence === "number" ? payload.confidence : null,
    evidenceSufficient:
      typeof payload?.evidenceSufficient === "boolean"
        ? payload.evidenceSufficient
        : null,
    missingFields: Array.isArray(payload?.missingFields)
      ? payload.missingFields
          .map((item) => String(item || "").trim())
          .filter(Boolean)
      : [],
    selectedMode: String(payload?.strategy?.selectedMode ?? "unknown"),
  };
}

// ─── OpenAI streaming ─────────────────────────────────────────────────────────

async function streamOpenAI(
  systemPrompt: string,
  userMessage: string,
  onDelta: (text: string) => void,
  temperature = 0.3,
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
      temperature,
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
  const orgId = normalizeSlug(String(body.orgId ?? DEFAULT_ORG_ID)) || DEFAULT_ORG_ID;
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
        let retrieveMode = "unknown";
        let retrieveConfidence: number | null = null;
        let evidenceSufficient: boolean | null = null;
        let missingFields: string[] = [];

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
          send({ type: "status", message: "Carregando facts estruturados do projeto..." });
          if (effectiveLinkedProjectId) {
            const factsContext = await fetchProjectFactsContext({
              orgId,
              scopeId: effectiveLinkedProjectId,
            });
            if (factsContext) {
              combinedContext += `## Facts Estruturados de Projeto\n${factsContext}\n\n`;
            }
          }
        }

        send({ type: "status", message: "Orquestrando retrieve (KB/Web)..." });
        const orchestrated = await fetchOrchestratedRetrieve({
          query: prompt,
          orgId,
          source,
          state: state || undefined,
          city: city || undefined,
          neighborhood: neighborhood || undefined,
          linkedProjectId: effectiveLinkedProjectId || undefined,
        });

        qdrantSources = orchestrated.qdrantSources;
        tavilySources = orchestrated.tavilySources;
        retrieveMode = orchestrated.selectedMode;
        retrieveConfidence = orchestrated.confidence;
        evidenceSufficient = orchestrated.evidenceSufficient;
        missingFields = orchestrated.missingFields;

        for (const warning of orchestrated.warnings) {
          send({ type: "warning", message: warning });
        }

        if (orchestrated.context) {
          combinedContext += `## Evidências Recuperadas\n${orchestrated.context}\n\n`;
        }
        if (source === "tavily" && !orchestrated.context) {
          throw new Error("Sem evidências web para este prompt.");
        }

        const isFactualFormat = ["faq", "meta_seo", "property_description"].includes(format);
        if (
          (source === "qdrant" || source === "both") &&
          evidenceSufficient === false &&
          isFactualFormat
        ) {
          send({
            type: "error",
            message:
              "Evidência insuficiente para geração confiável. Refine o prompt ou vincule o projeto correto.",
          });
          send({
            type: "retrieve_meta",
            mode: retrieveMode,
            confidence: retrieveConfidence,
            evidenceSufficient,
            missingFields,
          });
          send({
            type: "done",
          });
          return;
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

        const responseTemperature = isFactualFormat ? 0.2 : 0.5;
        await streamOpenAI(systemPrompt, userMessage, (text) => {
          send({ type: "delta", text });
        }, responseTemperature);

        // 3d. Send sources metadata
        send({
          type: "sources",
          qdrant: qdrantSources,
          tavily: tavilySources,
        });
        send({
          type: "retrieve_meta",
          mode: retrieveMode,
          confidence: retrieveConfidence,
          evidenceSufficient,
          missingFields,
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


