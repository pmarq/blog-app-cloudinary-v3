"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import AdminLayout from "@/app/components/layout/AdminLayout";
import StudioNav from "@/app/components/admin/StudioNav";
import { auth } from "@/firebase/client";
import { useToast } from "@/hooks/use-toast";
import { withBasePath } from "@/lib/withBasePath";

type GeneratedContent = {
  id?: string;
  title?: string | null;
  body?: string | null;
  warning?: string | null;
  sources?: {
    kb?: unknown[];
    web?: Array<{ title?: string | null; url?: string | null; snippet?: string | null }>;
  };
};

type SearchParamsValue = Record<string, string | string[] | undefined>;

type DraftClientProps = {
  initialSearchParams: SearchParamsValue;
};

function slugify(value: string): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function firstValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

export default function DraftClient({ initialSearchParams }: DraftClientProps) {
  const router = useRouter();
  const { toast } = useToast();

  const briefId = firstValue(initialSearchParams.briefId);
  const orgId = firstValue(initialSearchParams.orgId);
  const briefTitle = firstValue(initialSearchParams.briefTitle);
  const briefObjective = firstValue(initialSearchParams.briefObjective);
  const briefAngle = firstValue(initialSearchParams.briefAngle);
  const briefCta = firstValue(initialSearchParams.briefCta);
  const briefChannel = firstValue(initialSearchParams.briefChannel);
  const briefTheme = firstValue(initialSearchParams.briefTheme);
  const briefScope = firstValue(initialSearchParams.briefScope);
  const briefEditorialQuestion = firstValue(initialSearchParams.briefEditorialQuestion);
  const briefWhyNow = firstValue(initialSearchParams.briefWhyNow);
  const briefContentFormat = firstValue(initialSearchParams.briefContentFormat);
  const briefSourceType = firstValue(initialSearchParams.briefSourceType);

  const [generating, setGenerating] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [content, setContent] = useState<GeneratedContent | null>(null);
  const [meta, setMeta] = useState<{
    channel?: string | null;
    model?: string | null;
    webResultCount?: number | null;
    kbProjectCount?: number | null;
    warnings?: string[];
  } | null>(null);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const autoGenerateRef = useRef(false);

  const briefSummary = useMemo(
    () => [
      briefObjective ? `Objetivo: ${briefObjective}` : "",
      briefAngle ? `Ângulo: ${briefAngle}` : "",
      briefCta ? `CTA: ${briefCta}` : "",
      briefScope ? `Escopo: ${briefScope}` : "",
      briefChannel ? `Canal: ${briefChannel}` : "",
      briefTheme ? `Tema: ${briefTheme}` : "",
      briefContentFormat ? `Formato: ${briefContentFormat}` : "",
      briefSourceType ? `Origem: ${briefSourceType}` : "",
      briefEditorialQuestion ? `Pergunta editorial: ${briefEditorialQuestion}` : "",
      briefWhyNow ? `Por que agora: ${briefWhyNow}` : "",
    ].filter(Boolean),
    [
      briefAngle,
      briefCta,
      briefChannel,
      briefContentFormat,
      briefEditorialQuestion,
      briefObjective,
      briefScope,
      briefSourceType,
      briefTheme,
      briefWhyNow,
    ],
  );

  const getToken = useCallback(async () => {
    const token = await auth.currentUser?.getIdToken(true);
    if (!token) {
      throw new Error("Sessão necessária. Faça login novamente.");
    }
    return token;
  }, []);

  const loadExistingContent = useCallback(async (): Promise<boolean> => {
    if (!briefId) return false;

    setLoadingExisting(true);
    try {
      const token = await getToken();
      const response = await fetch(
        withBasePath(
          `/api/studio/cmo/content?briefId=${encodeURIComponent(briefId)}&orgId=${encodeURIComponent(orgId || "")}&limit=1`,
        ),
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) {
        return false;
      }

      const latest = Array.isArray(payload.items) ? payload.items[0] : null;
      if (!latest) {
        return false;
      }

      setContent(latest);
      const cleanWarning =
        latest.warning && !String(latest.warning).toLowerCase().includes("nenhum rascunho")
          ? String(latest.warning)
          : null;
      setWarning(cleanWarning);
      setMeta({
        channel: latest.channel || null,
        model: null,
        webResultCount: Array.isArray(latest?.sources?.web) ? latest.sources.web.length : null,
        kbProjectCount: Array.isArray(latest?.sources?.kb) ? latest.sources.kb.length : null,
        warnings: cleanWarning ? [cleanWarning] : [],
      });
      return true;
    } catch {
      return false;
    } finally {
      setLoadingExisting(false);
    }
  }, [briefId, getToken, orgId]);

  const generateContent = useCallback(async () => {
    if (!briefId) {
      setError("briefId ausente.");
      return;
    }

    setGenerating(true);
    setStatus("Gerando texto rascunho...");
    setError(null);
    setWarning(null);

    try {
      const token = await getToken();
      const response = await fetch(
        withBasePath(`/api/studio/cmo/briefs/${encodeURIComponent(briefId)}/generate-content`),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            orgId: orgId || undefined,
          }),
        },
      );

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.message || "Falha ao gerar conteúdo.");
      }

      setContent(payload.content || null);
      setMeta(payload.meta || null);
      const warnings = Array.isArray(payload?.meta?.warnings) ? payload.meta.warnings : [];
      setWarning(
        warnings.length
          ? warnings.join(" | ")
          : payload?.content?.warning || null,
      );
      toast({
        title: "Rascunho gerado",
        description: "O texto rascunho foi criado e pode ser revisado antes do editor final.",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao gerar conteúdo.";
      setError(message);
      toast({ title: "Erro", description: message, variant: "destructive" });
    } finally {
      setGenerating(false);
      setStatus(null);
    }
  }, [briefId, getToken, orgId, toast]);

  useEffect(() => {
    if (!briefId) return;

    let cancelled = false;

    void (async () => {
      const hasExisting = await loadExistingContent();
      if (cancelled || hasExisting || autoGenerateRef.current) return;
      autoGenerateRef.current = true;
      await generateContent();
    })();

    return () => {
      cancelled = true;
    };
  }, [briefId, generateContent, loadExistingContent]);

  const openInEditor = useCallback(() => {
    const title = content?.title || briefTitle || "Rascunho editorial";
    const body = content?.body || "";
    const metaValue = [briefObjective, briefAngle, briefCta, briefEditorialQuestion, briefWhyNow].filter(Boolean).join(" | ");
    const search = new URLSearchParams({
      briefId,
      title,
      meta: metaValue,
      content: body,
      slug: slugify(title),
      tags: briefChannel || "",
    });

    router.push(`/dashboard/posts/create?${search.toString()}`);
  }, [
    briefAngle,
    briefCta,
    briefChannel,
    briefEditorialQuestion,
    briefId,
    briefObjective,
    briefTitle,
    briefWhyNow,
    content?.body,
    content?.title,
    router,
  ]);

  const totalSources = (content?.sources?.kb?.length ?? 0) + (content?.sources?.web?.length ?? 0);

  return (
    <AdminLayout>
      <div className="max-w-5xl space-y-6">
        <StudioNav />

        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-highlight-light dark:text-highlight-dark">
            Rascunho do texto
          </h1>
          <p className="text-sm text-secondary-dark dark:text-secondary-light">
            Etapa intermediária: a IA gera o texto, você revisa e só então envia para o editor final.
          </p>
        </div>

        <section className="rounded border border-secondary-dark/20 dark:border-secondary-light/20 bg-secondary-light/10 dark:bg-secondary-dark/20 p-4 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="text-xs font-semibold uppercase tracking-wide text-highlight-light">
                Brief selecionado
              </div>
              <h2 className="text-xl font-semibold text-secondary-dark dark:text-secondary-light">
                {briefTitle || "Texto sem título"}
              </h2>
              <div className="text-xs text-secondary-dark/70 dark:text-secondary-light/70">
                {briefId || "Sem briefId"}
              </div>
            </div>
            <div className="rounded border border-secondary-dark/20 dark:border-secondary-light/20 bg-white/50 dark:bg-black/10 px-3 py-2 text-xs text-secondary-dark dark:text-secondary-light">
              <div className="font-semibold">{briefChannel || "blog"}</div>
              <div>{briefTheme || briefScope || "Rascunho de texto"}</div>
            </div>
          </div>

          {briefSummary.length ? (
            <div className="rounded border border-secondary-dark/20 dark:border-secondary-light/20 bg-white/30 dark:bg-black/10 p-3 text-xs text-secondary-dark dark:text-secondary-light space-y-1">
              {briefSummary.map((line) => (
                <div key={line}>{line}</div>
              ))}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void generateContent()}
              disabled={generating}
              className="rounded border border-highlight-light px-4 py-2 text-sm font-semibold text-highlight-light transition hover:bg-secondary-light/20 disabled:opacity-60"
            >
              {generating ? "Gerando..." : content ? "Regerar texto" : "Gerar texto"}
            </button>
            <button
              type="button"
              onClick={() => router.push(`/dashboard/studio/cmo?briefId=${encodeURIComponent(briefId)}`)}
              className="rounded border border-secondary-dark/30 px-4 py-2 text-sm transition hover:bg-secondary-light/20 dark:border-secondary-light/30"
            >
              Voltar ao CMO
            </button>
          </div>
        </section>

        {status || loadingExisting ? (
          <div className="flex items-center gap-2 text-xs text-secondary-dark dark:text-secondary-light">
            <span className="inline-block h-2 w-2 rounded-full bg-highlight-light dark:bg-highlight-dark animate-pulse" />
            {status || "Carregando texto rascunho salvo..."}
          </div>
        ) : null}

        {warning ? (
          <div className="rounded border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
            {warning}
          </div>
        ) : null}

        {error ? (
          <div className="rounded border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        ) : null}

        {meta ? (
          <div className="text-xs text-secondary-dark dark:text-secondary-light">
            Canal: <span className="font-semibold">{meta.channel || "blog"}</span>
            {meta.model ? ` · modelo ${meta.model}` : ""}
            {typeof meta.webResultCount === "number" ? ` · web ${meta.webResultCount}` : ""}
            {typeof meta.kbProjectCount === "number" ? ` · KB ${meta.kbProjectCount}` : ""}
          </div>
        ) : null}

        {content?.body || generating ? (
          <div className="space-y-3">
            <div className="rounded border border-secondary-dark/30 dark:border-secondary-light/20 bg-secondary-light/5 dark:bg-secondary-dark/20 p-4 min-h-[160px]">
              <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed">
                <ReactMarkdown>{content?.body || ""}</ReactMarkdown>
              </div>
              {generating ? (
                <span className="inline-block ml-1 h-4 w-0.5 bg-highlight-light dark:bg-highlight-dark animate-pulse" />
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={async () => {
                  if (!content?.body) return;
                  try {
                    await navigator.clipboard.writeText(content.body);
                    toast({ title: "Copiado", description: "Rascunho copiado para a área de transferência." });
                  } catch {
                    toast({ title: "Erro", description: "Não foi possível copiar.", variant: "destructive" });
                  }
                }}
                className="text-xs px-3 py-2 rounded border border-secondary-dark/40 dark:border-secondary-light/30 hover:bg-secondary-light/20 dark:hover:bg-secondary-dark/30 transition"
              >
                Copiar
              </button>
              <button
                type="button"
                onClick={() => void generateContent()}
                className="text-xs px-3 py-2 rounded border border-secondary-dark/40 dark:border-secondary-light/30 hover:bg-secondary-light/20 dark:hover:bg-secondary-dark/30 transition"
              >
                Regerar
              </button>
              <button
                type="button"
                onClick={() => void openInEditor()}
                disabled={!content?.body}
                className="text-xs px-3 py-2 rounded border border-highlight-light text-highlight-light hover:bg-secondary-light/20 transition disabled:opacity-60"
              >
              Abrir texto no editor final
              </button>
            </div>
          </div>
        ) : null}

        {content?.sources?.web?.length || content?.sources?.kb?.length ? (
          <details className="rounded border border-secondary-dark/20 dark:border-secondary-light/20 bg-white/20 dark:bg-black/10 p-3">
            <summary className="cursor-pointer text-sm font-semibold text-highlight-light dark:text-highlight-dark">
              Fontes usadas ({totalSources})
            </summary>
            <div className="mt-3 grid gap-3 text-xs text-secondary-dark dark:text-secondary-light">
              {Array.isArray(content?.sources?.web) && content.sources.web.length ? (
                <div className="space-y-2">
                  <div className="font-semibold">Web</div>
                  {content.sources.web.map((item, index) => (
                    <div key={`${item.url || "web"}-${index}`} className="rounded border border-secondary-dark/20 dark:border-secondary-light/20 p-2">
                      <div className="font-medium">{item.title || item.url || `Fonte ${index + 1}`}</div>
                      {item.url ? <div className="break-all opacity-70">{item.url}</div> : null}
                      {item.snippet ? <div className="mt-1 opacity-80">{item.snippet}</div> : null}
                    </div>
                  ))}
                </div>
              ) : null}
              {Array.isArray(content?.sources?.kb) && content.sources.kb.length ? (
                <div className="space-y-2">
                  <div className="font-semibold">KB</div>
                  <div className="rounded border border-secondary-dark/20 dark:border-secondary-light/20 p-2 opacity-80">
                    {content.sources.kb.length} referências internas vinculadas.
                  </div>
                </div>
              ) : null}
            </div>
          </details>
        ) : null}
      </div>
    </AdminLayout>
  );
}
