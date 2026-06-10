"use client";

import AdminLayout from "@/app/components/layout/AdminLayout";
import StudioNav from "@/app/components/admin/StudioNav";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/firebase/client";
import { useToast } from "@/hooks/use-toast";
import { withBasePath } from "@/lib/withBasePath";
import { DEFAULT_ORG_ID } from "@/lib/studio/org";

type Brief = {
  id: string;
  title: string;
  status?: string;
  owner?: string;
  orgId?: string;
  briefRunId?: string | null;
  strategyId?: string | null;
  calendarRunId?: string | null;
  period?: string | null;
  channel?: string;
  theme?: string | null;
  scope?: string | null;
  objective?: string;
  audience?: string[];
  angle?: string;
  keyMessages?: string[];
  cta?: string;
  sourceType?: string | null;
  editorialQuestion?: string | null;
  whyNow?: string | null;
  contentFormat?: string | null;
  scheduledAt?: string | null;
};

export default function StudioBriefs() {
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [activeTab, setActiveTab] = useState<"pautas" | "briefs">("pautas");
  const [loading, setLoading] = useState(false);
  const [updatingBriefId, setUpdatingBriefId] = useState<string | null>(null);
  const [sendingBriefId, setSendingBriefId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  const getToken = async () => {
    const token = await auth.currentUser?.getIdToken(true);
    if (!token) {
      throw new Error("Sessão necessária. Faça login novamente.");
    }
    return token;
  };

  const loadBriefs = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const response = await fetch(
        withBasePath(`/api/studio/cmo/briefs?orgId=${encodeURIComponent(DEFAULT_ORG_ID)}&limit=20`),
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const payload = await response.json();
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.message || "Falha ao carregar briefs.");
      }
      setBriefs(Array.isArray(payload.latestItems) ? payload.latestItems : []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao carregar briefs.";
      console.error(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadBriefs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const approveBrief = async (briefId: string) => {
    setUpdatingBriefId(briefId);
    try {
      const token = await getToken();
      const response = await fetch(withBasePath(`/api/studio/cmo/briefs/${encodeURIComponent(briefId)}`), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ orgId: DEFAULT_ORG_ID, status: "approved" }),
      });
      const payload = await response.json();
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.message || "Falha ao aprovar brief.");
      }
      toast({ title: "Brief aprovado", description: "Status atualizado." });
      await loadBriefs();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao aprovar brief.";
      toast({ title: "Erro", description: message, variant: "destructive" });
    } finally {
      setUpdatingBriefId(null);
    }
  };

  const sendBriefToAgenda = async (brief: Brief) => {
    setSendingBriefId(brief.id);
    try {
      const token = await getToken();
      const response = await fetch(
        withBasePath(`/api/studio/cmo/briefs/${encodeURIComponent(brief.id)}/send-to-agenda`),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ brief }),
        },
      );
      const payload = await response.json();
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.message || "Falha ao enviar para a agenda.");
      }
      toast({ title: "Enviado para agenda", description: "Item criado no calendário." });
      await loadBriefs();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao enviar para a agenda.";
      toast({ title: "Erro", description: message, variant: "destructive" });
    } finally {
      setSendingBriefId(null);
    }
  };

  const openBriefEdit = (brief: Brief) => {
    router.push(`/dashboard/studio/cmo/briefs/${encodeURIComponent(String(brief.id || ""))}/edit`);
  };

  const openBriefDraft = (brief: Brief) => {
    const searchParams = new URLSearchParams({
      briefId: String(brief.id || ""),
      orgId: DEFAULT_ORG_ID,
      briefTitle: brief.title || "Brief editorial",
      briefObjective: brief.objective || "",
      briefAngle: brief.angle || "",
      briefCta: brief.cta || "",
      briefChannel: brief.channel || "",
      briefTheme: brief.theme || "",
      briefScope: brief.scope || "",
      briefEditorialQuestion: brief.editorialQuestion || "",
      briefWhyNow: brief.whyNow || "",
      briefContentFormat: brief.contentFormat || "",
      briefSourceType: brief.sourceType || "",
    });

    router.push(`/dashboard/studio/cmo/draft?${searchParams.toString()}`);
  };

  const { pautas, briefsProduction } = useMemo(() => {
    const productionStatuses = new Set(["approved", "scheduled", "published"]);
    const pautaItems = briefs.filter((brief) => !productionStatuses.has(String(brief.status || "").toLowerCase()));
    const briefItems = briefs.filter((brief) => productionStatuses.has(String(brief.status || "").toLowerCase()));
    return { pautas: pautaItems, briefsProduction: briefItems };
  }, [briefs]);

  const visibleItems = activeTab === "pautas" ? pautas : briefsProduction;

  return (
    <AdminLayout>
      <div className="max-w-5xl space-y-2">
        <StudioNav />
        <h1 className="text-2xl font-semibold text-highlight-light dark:text-highlight-dark">
          Pautas & briefs
        </h1>
        <p className="text-secondary-dark dark:text-secondary-light">
          Pautas reais do Studio CMO, já conectadas ao calendário e ao editor de post.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <TabButton active={activeTab === "pautas"} onClick={() => setActiveTab("pautas")}>
            Pautas
          </TabButton>
          <TabButton active={activeTab === "briefs"} onClick={() => setActiveTab("briefs")}>
            Briefs
          </TabButton>
        </div>

        {loading && (
          <p className="text-xs text-secondary-dark dark:text-secondary-light">
            Carregando briefs...
          </p>
        )}
        {error && <p className="text-xs text-red-500">{error}</p>}

        <div className="mt-2 overflow-hidden rounded border border-secondary-dark/30 dark:border-secondary-light/30">
          <table className="w-full text-sm">
            <thead className="bg-secondary-light/40 dark:bg-secondary-dark/40 text-left">
              <tr>
                <th className="p-3">Título</th>
                <th className="p-3">Canal</th>
                <th className="p-3">Status</th>
                <th className="p-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((brief) => (
                <tr
                  key={brief.id}
                  className="border-t border-secondary-dark/20 dark:border-secondary-light/20"
                >
                  <td className="p-3">
                    <div className="font-medium text-secondary-dark dark:text-secondary-light">
                      {brief.title}
                    </div>
                    <div className="text-xs text-secondary-dark/60 dark:text-secondary-light/60">
                      {brief.objective || "Sem objetivo"}
                      {brief.sourceType ? ` • origem: ${brief.sourceType}` : ""}
                    </div>
                    {brief.editorialQuestion ? (
                      <div className="mt-1 text-xs text-secondary-dark/70 dark:text-secondary-light/70">
                        {brief.editorialQuestion}
                      </div>
                    ) : null}
                    {brief.whyNow ? (
                      <div className="mt-1 text-xs text-secondary-dark/60 dark:text-secondary-light/60">
                        {brief.whyNow}
                      </div>
                    ) : null}
                    {brief.contentFormat ? (
                      <div className="mt-1 text-[11px] uppercase tracking-wide text-secondary-dark/50 dark:text-secondary-light/50">
                        {brief.contentFormat}
                      </div>
                    ) : null}
                  </td>
                  <td className="p-3 capitalize">{brief.channel || "blog"}</td>
                  <td className="p-3 capitalize">{brief.status || "draft"}</td>
                  <td className="p-3 space-x-2">
                    <button
                      className="text-xs px-2 py-1 border rounded border-secondary-dark/40 dark:border-secondary-light/40 hover:bg-secondary-light/30 dark:hover:bg-secondary-dark/30 transition"
                      onClick={() => openBriefEdit(brief)}
                    >
                      Editar pauta
                    </button>
                    <button
                      className="text-xs px-2 py-1 border rounded border-secondary-dark/40 dark:border-secondary-light/40 hover:bg-secondary-light/30 dark:hover:bg-secondary-dark/30 transition"
                      onClick={() => openBriefDraft(brief)}
                    >
                      Gerar texto
                    </button>
                    <button
                      className="text-xs px-2 py-1 border rounded border-secondary-dark/40 dark:border-secondary-light/40 hover:bg-secondary-light/30 dark:hover:bg-secondary-dark/30 transition"
                      onClick={() => void approveBrief(brief.id)}
                      disabled={updatingBriefId === brief.id}
                    >
                      {updatingBriefId === brief.id ? "Aprovando..." : "Marcar como aprovado"}
                    </button>
                    <button
                      className="text-xs px-2 py-1 border rounded border-highlight-light text-highlight-light hover:bg-secondary-light/30 dark:hover:bg-secondary-dark/30 transition disabled:opacity-60"
                      onClick={() => void sendBriefToAgenda(brief)}
                      disabled={sendingBriefId === brief.id}
                    >
                      {sendingBriefId === brief.id ? "Enviando..." : "Enviar para agenda"}
                    </button>
                  </td>
                </tr>
              ))}
              {!visibleItems.length ? (
                <tr>
                  <td className="p-4 text-xs text-secondary-dark/70 dark:text-secondary-light/70" colSpan={4}>
                    {activeTab === "pautas"
                      ? "Nenhuma pauta encontrada."
                      : "Nenhum brief de produção encontrado."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded border px-3 py-1 text-sm transition ${
        active
          ? "border-highlight-light text-highlight-light bg-secondary-light/20 dark:border-highlight-dark dark:text-highlight-dark dark:bg-secondary-dark/30"
          : "border-secondary-dark/30 text-secondary-dark hover:bg-secondary-light/20 dark:border-secondary-light/30 dark:text-secondary-light dark:hover:bg-secondary-dark/30"
      }`}
    >
      {children}
    </button>
  );
}
