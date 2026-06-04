"use client";

import AdminLayout from "@/app/components/layout/AdminLayout";
import StudioNav from "@/app/components/admin/StudioNav";
import { useState } from "react";
import { GuardrailIssue, Action, ActionResult } from "@/app/models/Studio";
import { withBasePath } from "@/lib/withBasePath";

type ExtractResult = {
  extractedText: string;
  sections: { heading: string; content: string }[];
  sources: string[];
  notes?: string;
  runId?: string;
};

export default function StudioCuradoria() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExtractResult | null>(null);
  const [guardrailBusy, setGuardrailBusy] = useState(false);
  const [issues, setIssues] = useState<GuardrailIssue[]>([]);
  const [visualBusy, setVisualBusy] = useState(false);
  const [visualActions, setVisualActions] = useState<Action[]>([]);

  const handleUpload = async () => {
    if (!file) {
      setError("Selecione um PDF primeiro.");
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(withBasePath("/api/studio/curate/pdf"), {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Falha ao processar PDF.");
      const data = await res.json();
      setResult(data);
    } catch (err) {
      console.error(err);
      setError("Erro ao processar PDF.");
    } finally {
      setBusy(false);
    }
  };

  const handleGuardrails = async () => {
    if (!result) return;
    setGuardrailBusy(true);
    setIssues([]);
    try {
      const res = await fetch(withBasePath("/api/studio/guardrails/check"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          html: result.extractedText,
          context: { locale: "pt-BR" },
        }),
      });
      if (!res.ok) throw new Error("Falha ao checar guardrails.");
      const data: ActionResult = await res.json();
      setIssues(data.issues || []);
    } catch (err) {
      console.error(err);
      setError("Erro ao checar guardrails.");
    } finally {
      setGuardrailBusy(false);
    }
  };

  const handleVisual = async () => {
    setVisualBusy(true);
    setVisualActions([]);
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
      if (!res.ok) throw new Error("Falha ao gerar visual.");
      const data: ActionResult = await res.json();
      setVisualActions(data.actions || []);
    } catch (err) {
      console.error(err);
      setError("Erro ao gerar visual.");
    } finally {
      setVisualBusy(false);
    }
  };

  return (
    <AdminLayout>
      <div className="max-w-4xl space-y-4">
        <StudioNav />
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-highlight-light dark:text-highlight-dark">
            Curadoria
          </h1>
          <p className="text-secondary-dark dark:text-secondary-light">
            Ingestão de PDFs e imagens, extração de texto e referências, e
            geração de prompts visuais.
          </p>
        </div>

        <div className="rounded border border-secondary-dark/30 dark:border-secondary-light/30 p-4 space-y-3 bg-secondary-light/10 dark:bg-secondary-dark/30">
          <div className="flex flex-col gap-2 text-sm">
            <label className="font-semibold text-secondary-dark dark:text-secondary-light">
              Envie um PDF para extração
            </label>
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="text-secondary-dark dark:text-secondary-light text-sm"
            />
            <button
              onClick={handleUpload}
              disabled={busy}
              className="w-fit text-xs px-3 py-2 border rounded border-secondary-dark/40 dark:border-secondary-light/40 hover:bg-secondary-light/30 dark:hover:bg-secondary-dark/30 transition disabled:opacity-60"
            >
              {busy ? "Processando..." : "Processar PDF"}
            </button>
            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>

          {result ? (
            <div className="text-sm text-secondary-dark dark:text-secondary-light space-y-2">
              <div className="font-semibold">Resultado</div>
              {result.runId ? (
                <div className="text-[11px] opacity-70">runId: {result.runId}</div>
              ) : null}
              <div>
                <span className="font-semibold">Texto extraído:</span>{" "}
                {result.extractedText}
              </div>
              <div className="space-y-1">
                <div className="font-semibold">Seções:</div>
                {result.sections?.map((s, idx) => (
                  <div key={idx} className="pl-2">
                    <div className="font-semibold">{s.heading}</div>
                    <div className="text-xs">{s.content}</div>
                  </div>
                ))}
              </div>
              <div>
                <span className="font-semibold">Fontes:</span>{" "}
                {result.sources?.join(", ")}
              </div>
              {result.notes ? (
                <div className="text-xs opacity-80">Notas: {result.notes}</div>
              ) : null}
            </div>
          ) : null}

          {result ? (
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex gap-2">
                <button
                  onClick={handleGuardrails}
                  disabled={guardrailBusy}
                  className="text-xs px-3 py-2 border rounded border-secondary-dark/40 dark:border-secondary-light/40 hover:bg-secondary-light/30 dark:hover:bg-secondary-dark/30 transition disabled:opacity-60"
                >
                  {guardrailBusy ? "Checando..." : "Checar guardrails"}
                </button>
                <button
                  onClick={handleVisual}
                  disabled={visualBusy}
                  className="text-xs px-3 py-2 border rounded border-secondary-dark/40 dark:border-secondary-light/40 hover:bg-secondary-light/30 dark:hover:bg-secondary-dark/30 transition disabled:opacity-60"
                >
                  {visualBusy ? "Gerando..." : "Gerar visual"}
                </button>
              </div>

              {issues.length ? (
                <div className="rounded bg-secondary-light/30 dark:bg-secondary-dark/30 p-2 text-xs space-y-1">
                  <div className="font-semibold">Issues de guardrail</div>
                  {issues.map((issue) => (
                    <div
                      key={`${issue.field}-${issue.message}`}
                      className="flex justify-between gap-2"
                    >
                      <span>
                        {issue.field}: {issue.message}
                      </span>
                      <span className="capitalize text-secondary-dark/80 dark:text-secondary-light/80">
                        {issue.severity}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}

              {visualActions.length ? (
                <div className="rounded border border-secondary-dark/30 dark:border-secondary-light/30 p-2 text-xs space-y-1">
                  <div className="font-semibold">Prompts/ações visuais</div>
                  {visualActions.map((act, idx) => (
                    <div
                      key={idx}
                      className="border-t border-secondary-dark/10 dark:border-secondary-light/10 pt-1"
                    >
                      <div className="capitalize">{act.type}</div>
                      {act.prompt ? (
                        <div className="text-[11px] opacity-80">{act.prompt}</div>
                      ) : null}
                      {act.items ? (
                        <div className="text-[11px] opacity-80">
                          {Array.isArray(act.items)
                            ? act.items.join(", ")
                            : String(act.items)}
                        </div>
                      ) : null}
                      {act.message ? (
                        <div className="text-[11px] opacity-80">{act.message}</div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </AdminLayout>
  );
}
