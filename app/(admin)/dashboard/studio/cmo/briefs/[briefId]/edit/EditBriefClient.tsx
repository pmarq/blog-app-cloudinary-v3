"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AdminLayout from "@/app/components/layout/AdminLayout";
import StudioNav from "@/app/components/admin/StudioNav";
import { auth } from "@/firebase/client";
import { useToast } from "@/hooks/use-toast";
import { withBasePath } from "@/lib/withBasePath";

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
    .split(/\r?\n|,|;/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function toInputDate(value: string | null | undefined): string {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const pad = (input: number) => String(input).padStart(2, "0");
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
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

  const getToken = useCallback(async () => {
    const token = await auth.currentUser?.getIdToken(true);
    if (!token) {
      throw new Error("Sessão necessária. Faça login novamente.");
    }
    return token;
  }, []);

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
        const token = await getToken();
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
  }, [getToken, normalizedBriefId, toast]);

  const summary = useMemo(
    () => [brief?.title, brief?.objective, brief?.angle].filter(Boolean).join(" • "),
    [brief?.angle, brief?.objective, brief?.title],
  );

  const saveBrief = useCallback(async (): Promise<boolean> => {
    if (!normalizedBriefId) return false;

    setSaving(true);
    setError(null);
    try {
      const token = await getToken();
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
  }, [brief?.orgId, form, getToken, normalizedBriefId, toast]);

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

        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-highlight-light dark:text-highlight-dark">
            Editar brief
          </h1>
          <p className="text-sm text-secondary-dark dark:text-secondary-light">
            Ajuste a pauta antes de gerar o texto rascunho.
          </p>
        </div>

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
            <Field label="Título" value={form.title} onChange={(value) => setForm((prev) => ({ ...prev, title: value }))} />
            <Field label="Status" value={form.status} onChange={(value) => setForm((prev) => ({ ...prev, status: value }))} />
            <Field label="Canal" value={form.channel} onChange={(value) => setForm((prev) => ({ ...prev, channel: value }))} />
            <Field label="Tema" value={form.theme} onChange={(value) => setForm((prev) => ({ ...prev, theme: value }))} />
            <Field label="Escopo" value={form.scope} onChange={(value) => setForm((prev) => ({ ...prev, scope: value }))} />
            <Field label="CTA" value={form.cta} onChange={(value) => setForm((prev) => ({ ...prev, cta: value }))} />
            <Field label="Origem" value={form.sourceType} onChange={(value) => setForm((prev) => ({ ...prev, sourceType: value }))} />
            <Field label="Formato" value={form.contentFormat} onChange={(value) => setForm((prev) => ({ ...prev, contentFormat: value }))} />
            <Field label="Pauta-base" value={form.manualTopic} onChange={(value) => setForm((prev) => ({ ...prev, manualTopic: value }))} />
            <Field label="Prioridade" value={form.priority} onChange={(value) => setForm((prev) => ({ ...prev, priority: value }))} />
            <Field label="Agendado em" type="datetime-local" value={form.scheduledAt} onChange={(value) => setForm((prev) => ({ ...prev, scheduledAt: value }))} />
          </div>

          <div className="grid gap-3">
            <TextAreaField label="Objetivo" value={form.objective} onChange={(value) => setForm((prev) => ({ ...prev, objective: value }))} />
            <TextAreaField label="Ângulo" value={form.angle} onChange={(value) => setForm((prev) => ({ ...prev, angle: value }))} />
            <TextAreaField label="Pergunta editorial" value={form.editorialQuestion} onChange={(value) => setForm((prev) => ({ ...prev, editorialQuestion: value }))} />
            <TextAreaField label="Por que agora" value={form.whyNow} onChange={(value) => setForm((prev) => ({ ...prev, whyNow: value }))} />
            <TextAreaField label="Público-alvo" value={form.audience} onChange={(value) => setForm((prev) => ({ ...prev, audience: value }))} />
            <TextAreaField label="Mensagens-chave" value={form.keyMessages} onChange={(value) => setForm((prev) => ({ ...prev, keyMessages: value }))} />
            <TextAreaField label="Guardrails" value={form.guardrails} onChange={(value) => setForm((prev) => ({ ...prev, guardrails: value }))} />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void saveBrief()}
              disabled={saving || loading}
              className="rounded border border-highlight-light px-4 py-2 text-sm font-semibold text-highlight-light transition hover:bg-secondary-light/20 disabled:opacity-60"
            >
              {saving ? "Salvando..." : "Salvar brief"}
            </button>
            <button
              type="button"
              onClick={() => router.push(`/dashboard/studio/cmo?briefId=${encodeURIComponent(normalizedBriefId)}`)}
              className="rounded border border-secondary-dark/30 px-4 py-2 text-sm transition hover:bg-secondary-light/20 dark:border-secondary-light/30"
            >
              Voltar ao CMO
            </button>
            <button
              type="button"
              onClick={() => void openDraft()}
              disabled={saving || loading}
              className="rounded border border-secondary-dark/30 px-4 py-2 text-sm transition hover:bg-secondary-light/20 dark:border-secondary-light/30 disabled:opacity-60"
            >
              Gerar texto rascunho
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
