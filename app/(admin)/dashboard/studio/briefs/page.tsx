"use client";

import AdminLayout from "@/app/components/layout/AdminLayout";
import StudioNav from "@/app/components/admin/StudioNav";
import { useEffect, useState } from "react";
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
  scheduledAt?: string | null;
};

export default function StudioBriefs() {
  const [briefs, setBriefs] = useState<Brief[]>([]);
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

  const openInEditor = (brief: Brief) => {
    const title = brief.title || "Brief editorial";
    const meta = [brief.objective, brief.angle, brief.cta].filter(Boolean).join(" | ");
    const content = [
      `<h2>${title}</h2>`,
      brief.objective ? `<p><strong>Objetivo:</strong> ${brief.objective}</p>` : "",
      brief.angle ? `<p><strong>Ângulo:</strong> ${brief.angle}</p>` : "",
      Array.isArray(brief.keyMessages) && brief.keyMessages.length
        ? `<ul>${brief.keyMessages.map((message) => `<li>${message}</li>`).join("")}</ul>`
        : "",
      brief.cta ? `<p><strong>CTA:</strong> ${brief.cta}</p>` : "",
    ]
      .filter(Boolean)
      .join("");

    const searchParams = new URLSearchParams({
      briefId: String(brief.id || ""),
      title,
      meta,
      content,
      tags: Array.isArray(brief.audience) ? brief.audience.slice(0, 3).join(", ") : "",
    });

    router.push(`/dashboard/posts/create?${searchParams.toString()}`);
  };

  return (
    <AdminLayout>
      <div className="max-w-5xl space-y-2">
        <StudioNav />
        <h1 className="text-2xl font-semibold text-highlight-light dark:text-highlight-dark">
          Briefs
        </h1>
        <p className="text-secondary-dark dark:text-secondary-light">
          Briefs reais do Studio CMO, já conectados ao calendário e ao editor de post.
        </p>

        {loading && (
          <p className="text-xs text-secondary-dark dark:text-secondary-light">
            Carregando briefs...
          </p>
        )}
        {error && <p className="text-xs text-red-500">{error}</p>}

        <div className="mt-4 overflow-hidden rounded border border-secondary-dark/30 dark:border-secondary-light/30">
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
              {briefs.map((brief) => (
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
                    </div>
                  </td>
                  <td className="p-3 capitalize">{brief.channel || "blog"}</td>
                  <td className="p-3 capitalize">{brief.status || "draft"}</td>
                  <td className="p-3 space-x-2">
                    <button
                      className="text-xs px-2 py-1 border rounded border-secondary-dark/40 dark:border-secondary-light/40 hover:bg-secondary-light/30 dark:hover:bg-secondary-dark/30 transition"
                      onClick={() => openInEditor(brief)}
                    >
                      Abrir no editor
                    </button>
                    <button
                      className="text-xs px-2 py-1 border rounded border-secondary-dark/40 dark:border-secondary-light/40 hover:bg-secondary-light/30 dark:hover:bg-secondary-dark/30 transition"
                      onClick={() => void approveBrief(brief.id)}
                      disabled={updatingBriefId === brief.id}
                    >
                      {updatingBriefId === brief.id ? "Aprovando..." : "Aprovar"}
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
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}
