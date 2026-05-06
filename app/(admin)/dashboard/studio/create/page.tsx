"use client";

import { useState, useRef, useCallback } from "react";
import AdminLayout from "@/app/components/layout/AdminLayout";
import StudioNav from "@/app/components/admin/StudioNav";
import ReactMarkdown from "react-markdown";
import { auth } from "@/firebase/client";
import { useToast } from "@/hooks/use-toast";
import { withBasePath } from "@/lib/withBasePath";
import {
  CONTENT_FORMATS,
  type ContentFormat,
  type KnowledgeSource,
} from "@/lib/studio/prompts";
import {
  MAX_VARIATIONS,
  type QdrantSource,
  type TavilySource,
} from "@/lib/studio/generate-shared";

// ─── constants ────────────────────────────────────────────────────────────────

const SOURCES: { id: KnowledgeSource; label: string; emoji: string; description: string }[] = [
  {
    id: "qdrant",
    label: "Só Cérebro",
    emoji: "🧠",
    description: "Usa apenas os PDFs e dados indexados da Inlevor",
  },
  {
    id: "tavily",
    label: "Só Internet",
    emoji: "🌐",
    description: "Busca em tempo real nas notícias e web",
  },
  {
    id: "both",
    label: "Combinado",
    emoji: "⚡",
    description: "Cérebro + Internet — mais rico e atualizado",
  },
];

const TONE_OPTIONS = [
  { value: "sofisticado", label: "Sofisticado" },
  { value: "acessivel", label: "Acessível" },
  { value: "tecnico", label: "Técnico" },
  { value: "urgente", label: "Urgente" },
];

const AUDIENCE_OPTIONS = [
  { value: "investidor", label: "Investidor" },
  { value: "comprador", label: "Comprador Final" },
  { value: "arquiteto", label: "Arquiteto / Designer" },
  { value: "imprensa", label: "Imprensa" },
];

// ─── types ────────────────────────────────────────────────────────────────────

interface Sources {
  qdrant: QdrantSource[];
  tavily: TavilySource[];
}

// ─── main component ───────────────────────────────────────────────────────────

export default function StudioCreatePage() {
  const [prompt, setPrompt] = useState("");
  const [source, setSource] = useState<KnowledgeSource>("both");
  const [format, setFormat] = useState<ContentFormat>("blog");
  const [tone, setTone] = useState("sofisticado");
  const [audience, setAudience] = useState("investidor");
  const [language, setLanguage] = useState("pt-BR");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [linkedProjectId, setLinkedProjectId] = useState("");
  const [includeSources, setIncludeSources] = useState(true);
  const [variations, setVariations] = useState(1);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const [status, setStatus] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState("");
  const [sources, setSources] = useState<Sources | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSources, setShowSources] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const { toast } = useToast();

  // ─── generate ───────────────────────────────────────────────────────────────

  const handleGenerate = useCallback(async () => {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      toast({
        title: "Prompt vazio",
        description: "Descreva o que você quer criar.",
        variant: "destructive",
      });
      return;
    }

    // abort previous if any
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setGenerating(true);
    setResult("");
    setSources(null);
    setError(null);
    setStatus("Iniciando...");
    setShowSources(false);

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Sessão necessária. Faça login para continuar.");

      const response = await fetch(withBasePath("/api/studio/ai/generate"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          prompt: trimmedPrompt,
          source,
          format,
          tone,
          audience,
          language,
          state: state.trim() || undefined,
          city: city.trim() || undefined,
          neighborhood: neighborhood.trim() || undefined,
          linkedProjectId: linkedProjectId.trim() || undefined,
          includeSources,
          variations,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Erro ${response.status}`);
      }

      if (!response.body) throw new Error("Resposta sem corpo.");

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
          const raw = trimmed.slice("data: ".length);
          if (!raw) continue;

          try {
            const event = JSON.parse(raw) as {
              type: string;
              text?: string;
              message?: string;
              qdrant?: QdrantSource[];
              tavily?: TavilySource[];
            };

            if (event.type === "status") {
              setStatus(event.message ?? null);
            } else if (event.type === "delta") {
              if (event.text) setResult((prev) => prev + event.text);
              setStatus(null);
            } else if (event.type === "sources") {
              setSources({
                qdrant: event.qdrant ?? [],
                tavily: event.tavily ?? [],
              });
            } else if (event.type === "done") {
              setGenerating(false);
              setStatus(null);
            } else if (event.type === "error") {
              throw new Error(event.message ?? "Erro ao gerar conteúdo.");
            }
          } catch (parseErr) {
            if (parseErr instanceof SyntaxError) continue; // incomplete JSON, skip
            throw parseErr;
          }
        }
      }
    } catch (err) {
      if ((err as { name?: string }).name === "AbortError") return;
      const message =
        err instanceof Error ? err.message : "Erro desconhecido.";
      setError(message);
      toast({ title: "Erro", description: message, variant: "destructive" });
    } finally {
      setGenerating(false);
      setStatus(null);
    }
  }, [
    prompt,
    source,
    format,
    tone,
    audience,
    language,
    state,
    city,
    neighborhood,
    linkedProjectId,
    includeSources,
    variations,
    toast,
  ]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    setGenerating(false);
    setStatus(null);
  }, []);

  const handleCopy = useCallback(async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result);
      toast({ title: "Copiado!", description: "Conteúdo copiado para a área de transferência." });
    } catch {
      toast({ title: "Erro", description: "Não foi possível copiar.", variant: "destructive" });
    }
  }, [result, toast]);

  const handleClear = useCallback(() => {
    abortRef.current?.abort();
    setResult("");
    setSources(null);
    setError(null);
    setStatus(null);
    setGenerating(false);
    setShowSources(false);
  }, []);

  const totalSources =
    (sources?.qdrant.length ?? 0) + (sources?.tavily.length ?? 0);

  // ─── render ─────────────────────────────────────────────────────────────────

  return (
    <AdminLayout>
      <div className="max-w-5xl space-y-6">
        <StudioNav />

        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-highlight-light dark:text-highlight-dark">
            Criar com IA
          </h1>
          <p className="text-sm text-secondary-dark dark:text-secondary-light">
            Descreva o que quer criar, escolha a fonte de conhecimento e o
            formato. A IA gera em tempo real.
          </p>
        </div>

        {/* ── Prompt area ────────────────────────────────────────────────── */}
        <div className="space-y-3">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !generating) {
                void handleGenerate();
              }
            }}
            rows={5}
            placeholder={`Ex: Crie um post para blog sobre valorização de imóveis de luxo no Jardins em 2025, com dados de mercado, tendências e CTA.`}
            className="w-full rounded border border-secondary-dark/30 dark:border-secondary-light/30 bg-transparent px-4 py-3 text-sm text-highlight-light dark:text-highlight-dark placeholder:text-secondary-dark/50 dark:placeholder:text-secondary-light/50 focus:outline-none focus:ring-1 focus:ring-highlight-light dark:focus:ring-highlight-dark resize-none"
          />
          <p className="text-xs text-secondary-dark/60 dark:text-secondary-light/60">
            Dica: ⌘+Enter (Mac) ou Ctrl+Enter (Windows) para gerar rapidamente.
          </p>
        </div>

        {/* ── Source selector ─────────────────────────────────────────────── */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-secondary-dark dark:text-secondary-light uppercase tracking-wide">
            Fonte de Conhecimento
          </div>
          <div className="flex flex-wrap gap-3">
            {SOURCES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSource(s.id)}
                className={`flex flex-col items-start gap-0.5 px-4 py-3 rounded border text-left transition ${
                  source === s.id
                    ? "border-highlight-light dark:border-highlight-dark bg-secondary-light/20 dark:bg-secondary-dark/40"
                    : "border-secondary-dark/30 dark:border-secondary-light/20 hover:border-secondary-dark/60 dark:hover:border-secondary-light/40"
                }`}
              >
                <span className="text-base leading-none">
                  {s.emoji}{" "}
                  <span className="text-sm font-semibold text-highlight-light dark:text-highlight-dark">
                    {s.label}
                  </span>
                </span>
                <span className="text-xs text-secondary-dark/80 dark:text-secondary-light/70">
                  {s.description}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Format selector ─────────────────────────────────────────────── */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-secondary-dark dark:text-secondary-light uppercase tracking-wide">
            Formato de Saída
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {CONTENT_FORMATS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFormat(f.id)}
                title={f.description}
                className={`flex items-start gap-2 px-3 py-2.5 rounded border text-left transition ${
                  format === f.id
                    ? "border-highlight-light dark:border-highlight-dark bg-secondary-light/20 dark:bg-secondary-dark/40"
                    : "border-secondary-dark/30 dark:border-secondary-light/20 hover:border-secondary-dark/60 dark:hover:border-secondary-light/40"
                }`}
              >
                <span className="text-base leading-none flex-shrink-0 mt-0.5">
                  {f.emoji}
                </span>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-highlight-light dark:text-highlight-dark truncate">
                    {f.label}
                  </div>
                  <div className="text-[10px] text-secondary-dark/70 dark:text-secondary-light/60 leading-tight mt-0.5 line-clamp-2">
                    {f.description}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ── Advanced settings ───────────────────────────────────────────── */}
        <details
          open={advancedOpen}
          onToggle={(e) =>
            setAdvancedOpen((e.currentTarget as HTMLDetailsElement).open)
          }
          className="rounded border border-secondary-dark/30 dark:border-secondary-light/20"
        >
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-secondary-dark dark:text-secondary-light hover:bg-secondary-light/20 dark:hover:bg-secondary-dark/20 transition rounded select-none">
            {advancedOpen ? "▾" : "▸"} Configurações Avançadas
          </summary>

          <div className="px-4 pb-4 pt-2 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            {/* Tone */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-secondary-dark dark:text-secondary-light">
                Tom de Voz
              </label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="w-full rounded border border-secondary-dark/30 dark:border-secondary-light/30 bg-transparent px-3 py-2 text-sm"
              >
                {TONE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Audience */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-secondary-dark dark:text-secondary-light">
                Público-Alvo
              </label>
              <select
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                className="w-full rounded border border-secondary-dark/30 dark:border-secondary-light/30 bg-transparent px-3 py-2 text-sm"
              >
                {AUDIENCE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Language */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-secondary-dark dark:text-secondary-light">
                Idioma
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full rounded border border-secondary-dark/30 dark:border-secondary-light/30 bg-transparent px-3 py-2 text-sm"
              >
                <option value="pt-BR">Português (PT-BR)</option>
                <option value="en">Inglês (EN)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-secondary-dark dark:text-secondary-light">
                Estado
              </label>
              <input
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full rounded border border-secondary-dark/30 dark:border-secondary-light/30 bg-transparent px-3 py-2 text-sm"
                placeholder="sp"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-secondary-dark dark:text-secondary-light">
                Cidade
              </label>
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full rounded border border-secondary-dark/30 dark:border-secondary-light/30 bg-transparent px-3 py-2 text-sm"
                placeholder="sao-paulo"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-secondary-dark dark:text-secondary-light">
                Bairro
              </label>
              <input
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
                className="w-full rounded border border-secondary-dark/30 dark:border-secondary-light/30 bg-transparent px-3 py-2 text-sm"
                placeholder="vila-mariana"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-secondary-dark dark:text-secondary-light">
                Projeto vinculado
              </label>
              <input
                value={linkedProjectId}
                onChange={(e) => setLinkedProjectId(e.target.value)}
                className="w-full rounded border border-secondary-dark/30 dark:border-secondary-light/30 bg-transparent px-3 py-2 text-sm"
                placeholder="uuid-do-empreendimento"
              />
            </div>

            {/* Variations */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-secondary-dark dark:text-secondary-light">
                Variações (1-3)
              </label>
              <input
                type="number"
                min={1}
                max={MAX_VARIATIONS}
                value={variations}
                onChange={(e) =>
                  setVariations(
                    Math.min(MAX_VARIATIONS, Math.max(1, Number(e.target.value) || 1))
                  )
                }
                className="w-full rounded border border-secondary-dark/30 dark:border-secondary-light/30 bg-transparent px-3 py-2 text-sm"
              />
            </div>

            {/* Include sources */}
            <div className="flex items-center gap-3 pt-5">
              <input
                id="include-sources"
                type="checkbox"
                checked={includeSources}
                onChange={(e) => setIncludeSources(e.target.checked)}
                className="h-4 w-4"
              />
              <label
                htmlFor="include-sources"
                className="text-xs text-secondary-dark dark:text-secondary-light select-none"
              >
                Incluir dados/fontes no conteúdo
              </label>
            </div>
          </div>
        </details>

        {/* ── Generate button ─────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-3">
          {!generating ? (
            <button
              type="button"
              onClick={() => void handleGenerate()}
              disabled={!prompt.trim()}
              className="px-6 py-2.5 rounded border border-highlight-light dark:border-highlight-dark text-highlight-light dark:text-highlight-dark font-semibold text-sm hover:bg-secondary-light/20 dark:hover:bg-secondary-dark/40 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ✦ Criar com IA
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStop}
              className="px-6 py-2.5 rounded border border-red-500/60 text-red-500 font-semibold text-sm hover:bg-red-500/10 transition"
            >
              ■ Parar
            </button>
          )}

          {result && !generating && (
            <button
              type="button"
              onClick={handleClear}
              className="px-4 py-2.5 rounded border border-secondary-dark/40 dark:border-secondary-light/30 text-secondary-dark dark:text-secondary-light text-sm hover:bg-secondary-light/20 dark:hover:bg-secondary-dark/30 transition"
            >
              Limpar
            </button>
          )}
        </div>

        {/* ── Status line ─────────────────────────────────────────────────── */}
        {status && (
          <div className="flex items-center gap-2 text-xs text-secondary-dark dark:text-secondary-light">
            <span className="inline-block h-2 w-2 rounded-full bg-highlight-light dark:bg-highlight-dark animate-pulse" />
            {status}
          </div>
        )}

        {/* ── Error ───────────────────────────────────────────────────────── */}
        {error && (
          <div className="rounded border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        {/* ── Result area ─────────────────────────────────────────────────── */}
        {(result || generating) && (
          <div className="space-y-3">
            <div className="rounded border border-secondary-dark/30 dark:border-secondary-light/20 bg-secondary-light/5 dark:bg-secondary-dark/20 p-4 min-h-[160px]">
              <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed">
                <ReactMarkdown>{result}</ReactMarkdown>
              </div>
              {generating && (
                <span className="inline-block ml-1 h-4 w-0.5 bg-highlight-light dark:bg-highlight-dark animate-pulse" />
              )}
            </div>

            {/* Action buttons */}
            {result && !generating && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handleCopy()}
                  className="text-xs px-3 py-2 rounded border border-secondary-dark/40 dark:border-secondary-light/30 hover:bg-secondary-light/20 dark:hover:bg-secondary-dark/30 transition"
                >
                  📋 Copiar
                </button>
                <button
                  type="button"
                  onClick={() => void handleGenerate()}
                  className="text-xs px-3 py-2 rounded border border-secondary-dark/40 dark:border-secondary-light/30 hover:bg-secondary-light/20 dark:hover:bg-secondary-dark/30 transition"
                >
                  🔄 Refinar (gerar novamente)
                </button>

                {totalSources > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowSources((v) => !v)}
                    className="text-xs px-3 py-2 rounded border border-secondary-dark/40 dark:border-secondary-light/30 hover:bg-secondary-light/20 dark:hover:bg-secondary-dark/30 transition"
                  >
                    {showSources ? "▲ Ocultar" : "▼ Ver"} fontes ({totalSources})
                  </button>
                )}
              </div>
            )}

            {/* Sources panel */}
            {showSources && sources && (
              <div className="rounded border border-secondary-dark/20 dark:border-secondary-light/10 bg-secondary-light/5 dark:bg-secondary-dark/10 p-4 space-y-4 text-xs">
                {sources.qdrant.length > 0 && (
                  <div>
                    <div className="font-semibold mb-2 text-secondary-dark dark:text-secondary-light">
                      🧠 Cérebro Qdrant ({sources.qdrant.length})
                    </div>
                    <div className="space-y-2">
                      {sources.qdrant.map((s, i) => (
                        <div
                          key={s.id ?? i}
                          className="rounded border border-secondary-dark/10 dark:border-secondary-light/10 bg-white/30 dark:bg-black/10 p-2"
                        >
                          <div className="opacity-70 mb-1">
                            #{i + 1}{" "}
                            {typeof s.score === "number"
                              ? `· score ${s.score.toFixed(3)}`
                              : ""}{" "}
                            {s.kbDomain ? `· ${s.kbDomain}` : ""}{" "}
                            {s.sectionKind ? `· ${s.sectionKind}` : ""}
                          </div>
                          <div className="text-secondary-dark dark:text-secondary-light">
                            {s.snippet || "—"}
                          </div>
                          {s.storagePath && (
                            <div className="opacity-50 mt-1 break-all">
                              {s.storagePath}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {sources.tavily.length > 0 && (
                  <div>
                    <div className="font-semibold mb-2 text-secondary-dark dark:text-secondary-light">
                      🌐 Internet Tavily ({sources.tavily.length})
                    </div>
                    <div className="space-y-2">
                      {sources.tavily.map((s, i) => (
                        <div
                          key={s.url ?? i}
                          className="rounded border border-secondary-dark/10 dark:border-secondary-light/10 bg-white/30 dark:bg-black/10 p-2"
                        >
                          {s.url ? (
                            <a
                              href={s.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-action hover:underline font-semibold break-all"
                            >
                              {s.title || s.url}
                            </a>
                          ) : (
                            <div className="font-semibold">{s.title || `Fonte ${i + 1}`}</div>
                          )}
                          <div className="text-secondary-dark dark:text-secondary-light mt-1">
                            {s.snippet || "—"}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
