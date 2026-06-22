"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AdminLayout from "@/app/components/layout/AdminLayout";
import StudioNav from "@/app/components/admin/StudioNav";
import { useToast } from "@/hooks/use-toast";
import { withBasePath } from "@/lib/withBasePath";
import { getReadyIdToken } from "../../../cmo-auth";

type BriefData = {
  id?: string;
  orgId?: string;
  title?: string;
  status?: string;
  channel?: string;
  theme?: string | null;
  scope?: string | null;
  objective?: string;
  angle?: string;
  cta?: string;
  sourceType?: string | null;
  editorialQuestion?: string | null;
  whyNow?: string | null;
  contentFormat?: string | null;
  manualTopic?: string | null;
  priority?: number | null;
  audience?: string[];
  keyMessages?: string[];
  guardrails?: string[];
  scheduledAt?: string | null;
  sourceSignals?: {
    portfolioRegions?: string[];
    portfolioCities?: string[];
    portfolioSegments?: string[];
    opportunityTitles?: string[];
    opportunityScopes?: string[];
    opportunityRegions?: string[];
    calendarTitle?: string;
    calendarScope?: string;
    calendarTheme?: string;
    calendarAngle?: string;
    strategyPillars?: string[];
  };
  requiredSources?: {
    kb?: boolean;
    web?: boolean;
    projectFacts?: boolean;
  } | null;
};

type BriefFormState = {
  title: string;
  status: string;
  channel: string;
  theme: string;
  scope: string;
  objective: string;
  angle: string;
  cta: string;
  sourceType: string;
  editorialQuestion: string;
  whyNow: string;
  contentFormat: string;
  manualTopic: string;
  priority: string;
  audience: string;
  keyMessages: string;
  guardrails: string;
  scheduledAt: string;
};

function toText(values: string[] | undefined): string {
  return Array.isArray(values) ? values.join("\n") : "";
}

function fromText(value: string): string[] {
  return String(value || "")
    .split(/\r?\n/g)
    .map((item) => item.trim());
}

function toInputDate(value: string | null | undefined): string {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const pad = (input: number) => String(input).padStart(2, "0");
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const value of values) {
    const normalized = String(value || "").trim();
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(normalized);
  }

  return output;
}

function getSourceLabel(brief: BriefData | null): string {
  const signals = brief?.sourceSignals;
  if (!signals) {
    return brief?.sourceType === "manual" ? "Origem: usuário" : "Origem: calendário";
  }

  const parts: string[] = [];
  if (signals.calendarTitle) parts.push("calendário");
  if (signals.portfolioRegions?.length || signals.portfolioCities?.length || signals.portfolioSegments?.length) parts.push("portfólio");
  if (signals.opportunityTitles?.length || signals.opportunityScopes?.length || signals.opportunityRegions?.length) parts.push("oportunidade");
  if (signals.strategyPillars?.length) parts.push("estratégia");

  return `Origem: ${uniqueStrings(parts).join(" + ") || "calendário"}`;
}

type Props = {
  briefId: string;
};

export default function EditBriefClient({ briefId }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const normalizedBriefId = String(briefId || "").trim();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [brief, setBrief] = useState<BriefData | null>(null);
  const [form, setForm] = useState<BriefFormState>({
    title: "",
    status: "draft",
    channel: "blog",
    theme: "",
    scope: "",
    objective: "",
    angle: "",
    cta: "",
    sourceType: "",
    editorialQuestion: "",
    whyNow: "",
    contentFormat: "",
    manualTopic: "",
    priority: "",
    audience: "",
    keyMessages: "",
    guardrails: "",
    scheduledAt: "",
  });

  useEffect(() => {
    if (!normalizedBriefId) {
      setError("briefId ausente.");
      setLoading(false);
      return;
    }

    let cancelled = false;

    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const token = await getReadyIdToken();
        const response = await fetch(
          withBasePath(`/api/studio/cmo/briefs/${encodeURIComponent(normalizedBriefId)}`),
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.message || "Falha ao carregar brief.");
        }

        if (cancelled) return;

        const nextBrief: BriefData = payload.brief || {};
        setBrief(nextBrief);
        setForm({
          title: nextBrief.title || "",
          status: nextBrief.status || "draft",
          channel: nextBrief.channel || "blog",
          theme: nextBrief.theme || "",
          scope: nextBrief.scope || "",
          objective: nextBrief.objective || "",
          angle: nextBrief.angle || "",
          cta: nextBrief.cta || "",
          sourceType: nextBrief.sourceType || "",
          editorialQuestion: nextBrief.editorialQuestion || "",
          whyNow: nextBrief.whyNow || "",
          contentFormat: nextBrief.contentFormat || "",
          manualTopic: nextBrief.manualTopic || "",
          priority:
            nextBrief.priority !== undefined && nextBrief.priority !== null
              ? String(nextBrief.priority)
              : "",
          audience: toText(nextBrief.audience),
          keyMessages: toText(nextBrief.keyMessages),
          guardrails: toText(nextBrief.guardrails),
          scheduledAt: toInputDate(nextBrief.scheduledAt),
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Falha ao carregar brief.";
        if (!cancelled) {
          setError(message);
          toast({ title: "Erro", description: message, variant: "destructive" });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [normalizedBriefId, toast]);

  const summary = useMemo(
    () => [brief?.title, brief?.objective, brief?.angle].filter(Boolean).join(" • "),
    [brief?.angle, brief?.objective, brief?.title],
  );

  const saveBrief = useCallback(async (): Promise<boolean> => {
    if (!normalizedBriefId) return false;

    setSaving(true);
    setError(null);
    try {
      const token = await getReadyIdToken();
      const response = await fetch(
        withBasePath(`/api/studio/cmo/briefs/${encodeURIComponent(normalizedBriefId)}`),
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            orgId: brief?.orgId,
            title: form.title,
            status: form.status,
            channel: form.channel,
            theme: form.theme || null,
            scope: form.scope || null,
            objective: form.objective || null,
            angle: form.angle || null,
            cta: form.cta || null,
            sourceType: form.sourceType || null,
            editorialQuestion: form.editorialQuestion || null,
            whyNow: form.whyNow || null,
            contentFormat: form.contentFormat || null,
            manualTopic: form.manualTopic || null,
            priority: form.priority ? Number(form.priority) : null,
            audience: fromText(form.audience),
            keyMessages: fromText(form.keyMessages),
            guardrails: fromText(form.guardrails),
            scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : null,
          }),
        },
      );

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.message || "Falha ao salvar brief.");
      }

      setBrief(payload.brief || null);
      toast({
        title: "Brief salvo",
        description: "A pauta foi atualizada com sucesso.",
      });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao salvar brief.";
      setError(message);
      toast({ title: "Erro", description: message, variant: "destructive" });
      return false;
    } finally {
      setSaving(false);
    }
  }, [brief?.orgId, form, normalizedBriefId, toast]);

  const openDraft = useCallback(async () => {
    const saved = await saveBrief();
    if (!saved) return;
    router.push(
      `/dashboard/studio/cmo/draft?briefId=${encodeURIComponent(normalizedBriefId)}&orgId=${encodeURIComponent(brief?.orgId || "")}&briefTitle=${encodeURIComponent(form.title)}&briefObjective=${encodeURIComponent(form.objective)}&briefAngle=${encodeURIComponent(form.angle)}&briefCta=${encodeURIComponent(form.cta)}&briefChannel=${encodeURIComponent(form.channel)}&briefTheme=${encodeURIComponent(form.theme)}&briefScope=${encodeURIComponent(form.scope)}&briefEditorialQuestion=${encodeURIComponent(form.editorialQuestion)}&briefWhyNow=${encodeURIComponent(form.whyNow)}&briefContentFormat=${encodeURIComponent(form.contentFormat)}&briefSourceType=${encodeURIComponent(form.sourceType)}`,
    );
  }, [brief?.orgId, form.angle, form.channel, form.contentFormat, form.cta, form.editorialQuestion, form.objective, form.scope, form.sourceType, form.theme, form.title, form.whyNow, normalizedBriefId, router, saveBrief]);

  return (
    <AdminLayout>
      <div className="max-w-5xl space-y-6">
        <StudioNav />

        <section className="rounded-2xl border border-secondary-dark/15 dark:border-secondary-light/15 bg-gradient-to-br from-highlight-light/10 via-white/35 to-white/10 dark:from-highlight-dark/10 dark:via-black/10 dark:to-black/20 p-6 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-highlight-light/20 bg-white/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-highlight-light dark:border-highlight-dark/20 dark:bg-black/20 dark:text-highlight-dark">
              CMO Studio
            </div>
            <div className="rounded-full border border-secondary-dark/15 bg-white/50 px-3 py-1 text-[11px] font-medium text-secondary-dark/70 dark:border-secondary-light/15 dark:bg-black/15 dark:text-secondary-light/70">
              Editor de brief
            </div>
          </div>
          <div className="mt-4 space-y-3">
            <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-secondary-dark dark:text-secondary-light">
              Ajuste o brief antes de gerar o texto final.
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-secondary-dark/80 dark:text-secondary-light/80">
              Aqui você mantém o controle do conteúdo: revê o contexto, ajusta os campos principais e só então libera o rascunho.
            </p>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              { label: "Canal", value: form.channel || "blog", detail: "onde o conteúdo vai viver" },
              { label: "Status", value: form.status || "draft", detail: "estado atual do brief" },
              { label: "Sinais", value: String(uniqueStrings([...(brief?.sourceSignals?.calendarTitle ? [brief.sourceSignals.calendarTitle] : []), ...(brief?.sourceSignals?.portfolioRegions || []), ...(brief?.sourceSignals?.opportunityTitles || []), ...(brief?.sourceSignals?.strategyPillars || [])]).length), detail: "contexto vinculado ao brief" },
            ].map((metric) => (
              <div key={metric.label} className="rounded-xl border border-secondary-dark/15 dark:border-secondary-light/15 bg-white/60 dark:bg-black/20 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-secondary-dark/60 dark:text-secondary-light/60">
                  {metric.label}
                </div>
                <div className="mt-2 text-2xl font-semibold text-secondary-dark dark:text-secondary-light">
                  {metric.value}
                </div>
                <div className="mt-1 text-xs leading-5 text-secondary-dark/70 dark:text-secondary-light/70">
                  {metric.detail}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded border border-secondary-dark/20 dark:border-secondary-light/20 bg-secondary-light/10 dark:bg-secondary-dark/20 p-4 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="text-xs font-semibold uppercase tracking-wide text-highlight-light">
                Brief {normalizedBriefId || ""}
              </div>
              <h2 className="text-xl font-semibold text-secondary-dark dark:text-secondary-light">
                {form.title || "Brief sem título"}
              </h2>
              <div className="text-xs text-secondary-dark/70 dark:text-secondary-light/70">
                {summary || "Edite os campos abaixo"}
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {uniqueStrings([
                  ...(brief?.sourceSignals?.calendarTitle ? [brief.sourceSignals.calendarTitle] : []),
                  ...(brief?.sourceSignals?.calendarScope ? [brief.sourceSignals.calendarScope] : []),
                  ...(brief?.sourceSignals?.calendarTheme ? [brief.sourceSignals.calendarTheme] : []),
                  ...(brief?.sourceSignals?.portfolioRegions || []),
                  ...(brief?.sourceSignals?.opportunityTitles || []),
                  ...(brief?.sourceSignals?.strategyPillars || []),
                ])
                  .slice(0, 5)
                  .map((chip) => (
                    <span
                      key={`${normalizedBriefId}-${chip}`}
                      className="rounded-full border border-secondary-dark/15 dark:border-secondary-light/15 bg-white/40 dark:bg-black/10 px-2 py-0.5 text-[10px] text-secondary-dark/70 dark:text-secondary-light/70"
                    >
                      {chip}
                    </span>
                  ))}
              </div>
            </div>
            <div className="rounded border border-secondary-dark/20 dark:border-secondary-light/20 bg-white/50 dark:bg-black/10 px-3 py-2 text-xs text-secondary-dark dark:text-secondary-light">
              <div className="font-semibold">{form.channel || "blog"}</div>
              <div>{form.status || "draft"}</div>
            </div>
          </div>

          {loading ? (
            <div className="text-xs text-secondary-dark dark:text-secondary-light">Carregando brief...</div>
          ) : null}
          {error ? (
            <div className="rounded border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          ) : null}
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="T?tulo" value={form.title} onChange={(value) => setForm((prev) => ({ ...prev, title: value }))} />
            <Field label="Status" value={form.status} onChange={(value) => setForm((prev) => ({ ...prev, status: value }))} />
            <Field label="Canal" value={form.channel} onChange={(value) => setForm((prev) => ({ ...prev, channel: value }))} />
            <Field label="Tema" value={form.theme} onChange={(value) => setForm((prev) => ({ ...prev, theme: value }))} />
            <Field label="Escopo" value={form.scope} onChange={(value) => setForm((prev) => ({ ...prev, scope: value }))} />
            <Field label="CTA" value={form.cta} onChange={(value) => setForm((prev) => ({ ...prev, cta: value }))} />
          </div>

          <details className="rounded border border-secondary-dark/20 dark:border-secondary-light/20 bg-white/20 dark:bg-black/10 p-3">
            <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-highlight-light">
              Campos avan?ados
            </summary>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <Field label="Origem" value={form.sourceType} onChange={(value) => setForm((prev) => ({ ...prev, sourceType: value }))} />
              <Field label="Formato" value={form.contentFormat} onChange={(value) => setForm((prev) => ({ ...prev, contentFormat: value }))} />
              <Field label="Pauta-base" value={form.manualTopic} onChange={(value) => setForm((prev) => ({ ...prev, manualTopic: value }))} />
              <Field label="Prioridade" value={form.priority} onChange={(value) => setForm((prev) => ({ ...prev, priority: value }))} />
              <Field label="Agendado em" type="datetime-local" value={form.scheduledAt} onChange={(value) => setForm((prev) => ({ ...prev, scheduledAt: value }))} />
            </div>
            <div className="mt-3 grid gap-3">
              <TextAreaField label="Objetivo" value={form.objective} onChange={(value) => setForm((prev) => ({ ...prev, objective: value }))} />
              <TextAreaField label="?ngulo" value={form.angle} onChange={(value) => setForm((prev) => ({ ...prev, angle: value }))} />
              <TextAreaField label="Pergunta editorial" value={form.editorialQuestion} onChange={(value) => setForm((prev) => ({ ...prev, editorialQuestion: value }))} />
              <TextAreaField label="Por que agora" value={form.whyNow} onChange={(value) => setForm((prev) => ({ ...prev, whyNow: value }))} />
              <TextAreaField label="P?blico-alvo" value={form.audience} onChange={(value) => setForm((prev) => ({ ...prev, audience: value }))} />
              <TextAreaField label="Mensagens-chave" value={form.keyMessages} onChange={(value) => setForm((prev) => ({ ...prev, keyMessages: value }))} />
              <TextAreaField label="Guardrails" value={form.guardrails} onChange={(value) => setForm((prev) => ({ ...prev, guardrails: value }))} />
            </div>
          </details>

          <details className="rounded border border-secondary-dark/20 dark:border-secondary-light/20 bg-white/20 dark:bg-black/10 p-3">
            <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-highlight-light">
              Sinais de origem
            </summary>
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-highlight-light">
                  Origem do brief
                </div>
                <div className="text-[11px] text-secondary-dark/60 dark:text-secondary-light/60">
                  {getSourceLabel(brief)}
                </div>
              </div>
              {brief?.sourceSignals ? (
                <div className="grid gap-2 md:grid-cols-2">
                  <div className="rounded border border-secondary-dark/10 dark:border-secondary-light/10 p-2 text-xs text-secondary-dark dark:text-secondary-light">
                    <div className="font-semibold">Calend?rio</div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {uniqueStrings([
                        brief.sourceSignals.calendarTitle || "",
                        brief.sourceSignals.calendarScope || "",
                        brief.sourceSignals.calendarTheme || "",
                        brief.sourceSignals.calendarAngle || "",
                      ])
                        .slice(0, 4)
                        .map((chip) => (
                          <span
                            key={`${normalizedBriefId}-calendar-${chip}`}
                            className="rounded-full border border-secondary-dark/15 dark:border-secondary-light/15 bg-white/40 dark:bg-black/10 px-2 py-0.5 text-[10px]"
                          >
                            {chip}
                          </span>
                        ))}
                    </div>
                  </div>
                  <div className="rounded border border-secondary-dark/10 dark:border-secondary-light/10 p-2 text-xs text-secondary-dark dark:text-secondary-light">
                    <div className="font-semibold">Portf?lio e mercado</div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {uniqueStrings([
                        ...(brief.sourceSignals.portfolioRegions || []),
                        ...(brief.sourceSignals.portfolioCities || []),
                        ...(brief.sourceSignals.portfolioSegments || []),
                        ...(brief.sourceSignals.opportunityTitles || []),
                        ...(brief.sourceSignals.opportunityScopes || []),
                        ...(brief.sourceSignals.opportunityRegions || []),
                        ...(brief.sourceSignals.strategyPillars || []),
                      ])
                        .slice(0, 6)
                        .map((chip) => (
                          <span
                            key={`${normalizedBriefId}-signals-${chip}`}
                            className="rounded-full border border-secondary-dark/15 dark:border-secondary-light/15 bg-white/40 dark:bg-black/10 px-2 py-0.5 text-[10px]"
                          >
                            {chip}
                          </span>
                        ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-secondary-dark/70 dark:text-secondary-light/70">
                  Este brief n?o trouxe sinais persistidos de origem.
                </div>
              )}
            </div>
          </details>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void saveBrief()}
              disabled={saving || loading}
              className="rounded border border-highlight-light px-4 py-2 text-sm font-semibold text-highlight-light transition hover:bg-secondary-light/20 disabled:opacity-60"
            >
              {saving ? "Salvando..." : "Salvar e revisar"}
            </button>
            <button
              type="button"
              onClick={() => router.push(`/dashboard/studio/cmo?briefId=${encodeURIComponent(normalizedBriefId)}`)}
              className="rounded border border-secondary-dark/30 px-4 py-2 text-sm transition hover:bg-secondary-light/20 dark:border-secondary-light/30"
            >
              Voltar ao painel
            </button>
            <button
              type="button"
              onClick={() => void openDraft()}
              disabled={saving || loading}
              className="rounded border border-secondary-dark/30 px-4 py-2 text-sm transition hover:bg-secondary-light/20 dark:border-secondary-light/30 disabled:opacity-60"
            >
              Ir para o rascunho
            </button>
          </div>
        </section>
      </div>
    </AdminLayout>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="space-y-1">
      <div className="text-xs font-semibold text-secondary-dark dark:text-secondary-light">
        {label}
      </div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded border border-secondary-dark/30 dark:border-secondary-light/30 bg-transparent px-3 py-2 text-sm"
      />
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-1">
      <div className="text-xs font-semibold text-secondary-dark dark:text-secondary-light">
        {label}
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="w-full rounded border border-secondary-dark/30 dark:border-secondary-light/30 bg-transparent px-3 py-2 text-sm"
      />
    </label>
  );
}
