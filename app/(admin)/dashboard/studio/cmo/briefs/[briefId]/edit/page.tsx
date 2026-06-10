"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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

export default function EditBriefPage() {
  const params = useParams<{ briefId: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const briefId = String(params?.briefId || "").trim();

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
    if (!briefId) {
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
          withBasePath(`/api/studio/cmo/briefs/${encodeURIComponent(briefId)}`),
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
  }, [briefId, getToken, toast]);

  const summary = useMemo(
    () => [brief?.title, brief?.objective, brief?.angle].filter(Boolean).join(" • "),
    [brief?.angle, brief?.objective, brief?.title],
  );

  const saveBrief = useCallback(async (): Promise<boolean> => {
    if (!briefId) return false;

    setSaving(true);
    setError(null);
    try {
      const token = await getToken();
      const response = await fetch(
        withBasePath(`/api/studio/cmo/briefs/${encodeURIComponent(briefId)}`),
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
  }, [brief?.orgId, briefId, form, getToken, toast]);

  const openDraft = useCallback(async () => {
    const saved = await saveBrief();
    if (!saved) return;
    router.push(
      `/dashboard/studio/cmo/draft?briefId=${encodeURIComponent(briefId)}&orgId=${encodeURIComponent(brief?.orgId || "")}&briefTitle=${encodeURIComponent(form.title)}&briefObjective=${encodeURIComponent(form.objective)}&briefAngle=${encodeURIComponent(form.angle)}&briefCta=${encodeURIComponent(form.cta)}&briefChannel=${encodeURIComponent(form.channel)}&briefTheme=${encodeURIComponent(form.theme)}&briefScope=${encodeURIComponent(form.scope)}`,
    );
  }, [brief?.orgId, briefId, form.angle, form.channel, form.cta, form.objective, form.scope, form.theme, form.title, router, saveBrief]);

  return (
    <AdminLayout>
      <div className="max-w-5xl space-y-6">
        <StudioNav />

        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-highlight-light dark:text-highlight-dark">
            Editar brief
          </h1>
          <p className="text-sm text-secondary-dark dark:text-secondary-light">
            Ajuste a pauta antes de gerar o rascunho de conteúdo.
          </p>
        </div>

        <section className="rounded border border-secondary-dark/20 dark:border-secondary-light/20 bg-secondary-light/10 dark:bg-secondary-dark/20 p-4 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="text-xs font-semibold uppercase tracking-wide text-highlight-light">
                Brief {briefId || ""}
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
            <Field label="Agendado em" type="datetime-local" value={form.scheduledAt} onChange={(value) => setForm((prev) => ({ ...prev, scheduledAt: value }))} />
          </div>

          <div className="grid gap-3">
            <TextAreaField label="Objetivo" value={form.objective} onChange={(value) => setForm((prev) => ({ ...prev, objective: value }))} />
            <TextAreaField label="Ângulo" value={form.angle} onChange={(value) => setForm((prev) => ({ ...prev, angle: value }))} />
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
              onClick={() => router.push(`/dashboard/studio/cmo?briefId=${encodeURIComponent(briefId)}`)}
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
              Gerar texto
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
