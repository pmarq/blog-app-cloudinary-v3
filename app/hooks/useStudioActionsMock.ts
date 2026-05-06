import { useState } from "react";
import { ActionResult, Action, GuardrailIssue } from "@/app/models/Studio";
import { withBasePath } from "@/lib/withBasePath";

type AppliedAction = {
  action: Action;
  applied: boolean;
};

export function useStudioActionsMock() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<ActionResult | null>(null);
  const [applied, setApplied] = useState<AppliedAction[]>([]);
  const [issues, setIssues] = useState<GuardrailIssue[]>([]);

  const fetchIdeas = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(withBasePath("/api/studio/ai/ideas"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context: { locale: "pt-BR", tone: "inlevor" },
        }),
      });
      if (!res.ok) throw new Error("Falha ao chamar /api/studio/ai/ideas");
      const data = (await res.json()) as ActionResult;
      setLastRun(data);
      setApplied([]);
      setIssues([]);
      return data;
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Erro desconhecido");
      return null;
    } finally {
      setLoading(false);
    }
  };

  const markApplied = (action: Action, appliedFlag: boolean) => {
    setApplied((prev) => [...prev, { action, applied: appliedFlag }]);
  };

  const fetchGuardrails = async (html?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(withBasePath("/api/studio/guardrails/check"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context: { locale: "pt-BR" },
          html: html || "<p>mock</p>",
          assets: [],
        }),
      });
      if (!res.ok) throw new Error("Falha ao chamar /api/studio/guardrails/check");
      const data = (await res.json()) as ActionResult;
      setLastRun(data);
      setIssues(data.issues || []);
      return data;
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Erro desconhecido");
      return null;
    } finally {
      setLoading(false);
    }
  };

  const fetchVisual = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(withBasePath("/api/studio/ai/visual"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context: { locale: "pt-BR", tone: "inlevor" },
          references: [],
          style: "inlevor",
        }),
      });
      if (!res.ok) throw new Error("Falha ao chamar /api/studio/ai/visual");
      const data = (await res.json()) as ActionResult;
      setLastRun(data);
      setApplied([]);
      setIssues([]);
      return data;
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Erro desconhecido");
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    lastRun,
    applied,
    fetchIdeas,
    fetchGuardrails,
    fetchVisual,
    markApplied,
    issues,
  };
}
