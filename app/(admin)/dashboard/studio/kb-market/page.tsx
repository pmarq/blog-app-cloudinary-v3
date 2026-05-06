"use client";

import { useEffect, useMemo, useState } from "react";
import AdminLayout from "@/app/components/layout/AdminLayout";
import StudioNav from "@/app/components/admin/StudioNav";
import { auth } from "@/firebase/client";
import { withBasePath } from "@/lib/withBasePath";

type MarketSource = {
  id: string;
  label: string;
  type: string;
  documentType: string;
  storagePath: string;
  kbDomain?: string;
  scopeId?: string;
  state?: string | null;
  city?: string | null;
  neighborhood?: string | null;
  status?: string;
  preparationStatus: string;
  indexationStatus: string;
};

type RetrieveResult = {
  id?: string;
  score?: number | null;
  payload?: Record<string, unknown>;
};

function toNumberInput(value: string) {
  const cleaned = value.trim();
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

export default function StudioKbMarketPage() {
  const [orgId, setOrgId] = useState("inlevor");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState("5");
  const [scoreThreshold, setScoreThreshold] = useState("");
  const [selectedSourceId, setSelectedSourceId] = useState("");

  const [pdf, setPdf] = useState<File | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadOk, setUploadOk] = useState<string | null>(null);

  const [sources, setSources] = useState<MarketSource[]>([]);
  const [sourcesBusy, setSourcesBusy] = useState(false);
  const [sourcesError, setSourcesError] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<RetrieveResult[]>([]);

  const scoreThresholdValue = useMemo(
    () => toNumberInput(scoreThreshold),
    [scoreThreshold],
  );

  const getToken = async () => {
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error("Sessao necessaria. Faca login para continuar.");
    return token;
  };

  const refreshSources = async () => {
    setSourcesBusy(true);
    setSourcesError(null);
    try {
      const token = await getToken();
      const params = new URLSearchParams({ orgId });
      if (state.trim()) params.set("state", state.trim());
      if (city.trim()) params.set("city", city.trim());
      if (neighborhood.trim()) params.set("neighborhood", neighborhood.trim());

      const res = await fetch(withBasePath(`/api/studio/kb/market/sources?${params.toString()}`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json();
      if (!res.ok || !payload?.success) {
        throw new Error(payload?.message || "Falha ao carregar fontes.");
      }
      setSources(Array.isArray(payload.sources) ? payload.sources : []);
    } catch (e) {
      setSourcesError(e instanceof Error ? e.message : "Erro ao carregar fontes.");
      setSources([]);
    } finally {
      setSourcesBusy(false);
    }
  };

  useEffect(() => {
    refreshSources();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, state, city, neighborhood]);

  const handleUpload = async () => {
    setUploadOk(null);
    setUploadError(null);
    if (!pdf) {
      setUploadError("Selecione um PDF primeiro.");
      return;
    }

    setUploadBusy(true);
    try {
      const token = await getToken();
      const form = new FormData();
      form.append("authToken", token);
      form.append("orgId", orgId);
      form.append("autoIndex", "true");
      if (state.trim()) form.append("state", state.trim());
      if (city.trim()) form.append("city", city.trim());
      if (neighborhood.trim()) form.append("neighborhood", neighborhood.trim());
      form.append("file", pdf);

      const res = await fetch(withBasePath("/api/studio/kb/market/add-source"), {
        method: "POST",
        body: form,
      });
      const payload = await res.json();
      if (!res.ok || !payload?.success) {
        throw new Error(payload?.message || "Falha ao enviar PDF.");
      }

      setUploadOk(
        `Enviado: sourceId ${payload.sourceId || ""} (preparo+indexacao foram enfileirados)`,
      );
      setPdf(null);
      await refreshSources();
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Erro ao enviar PDF.");
    } finally {
      setUploadBusy(false);
    }
  };

  const handleSearch = async () => {
    setError(null);
    setResults([]);
    if (!query.trim()) {
      setError("Digite uma pergunta primeiro.");
      return;
    }

    setBusy(true);
    try {
      const token = await getToken();
      const res = await fetch(withBasePath("/api/studio/kb/market/test-search"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          query,
          orgId,
          sourceId: selectedSourceId || undefined,
          state: state.trim() || undefined,
          city: city.trim() || undefined,
          neighborhood: neighborhood.trim() || undefined,
          limit: toNumberInput(limit) ?? 5,
          scoreThreshold: scoreThresholdValue ?? undefined,
        }),
      });
      const payload = await res.json();
      if (!res.ok || !payload?.success) {
        throw new Error(payload?.message || "Falha ao consultar busca.");
      }

      const upstream = payload?.upstream || {};
      const upstreamResults = Array.isArray(upstream?.results)
        ? upstream.results
        : [];
      setResults(upstreamResults);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao consultar busca.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminLayout>
      <div className="max-w-5xl space-y-4">
        <StudioNav />

        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-highlight-light dark:text-highlight-dark">
            KB Mercado
          </h1>
          <p className="text-secondary-dark dark:text-secondary-light">
            Envie materiais de mercado com `scopeId = market__br` e refine a
            busca por estado, cidade e bairro quando fizer sentido.
          </p>
        </div>

        <div className="rounded border border-secondary-dark/30 dark:border-secondary-light/30 p-4 space-y-4 bg-secondary-light/10 dark:bg-secondary-dark/30">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <div className="text-xs font-semibold">Org</div>
              <input
                value={orgId}
                onChange={(e) => setOrgId(e.target.value)}
                className="w-full px-3 py-2 border rounded text-sm bg-transparent"
                placeholder="inlevor"
              />
            </div>
            <div className="space-y-1">
              <div className="text-xs font-semibold">Estado</div>
              <input
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full px-3 py-2 border rounded text-sm bg-transparent"
                placeholder="sp"
              />
            </div>
            <div className="space-y-1">
              <div className="text-xs font-semibold">Cidade</div>
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-3 py-2 border rounded text-sm bg-transparent"
                placeholder="sao-paulo"
              />
            </div>
            <div className="space-y-1">
              <div className="text-xs font-semibold">Bairro</div>
              <input
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
                className="w-full px-3 py-2 border rounded text-sm bg-transparent"
                placeholder="vila-mariana"
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <div className="text-xs font-semibold">Fonte (opcional)</div>
              <select
                value={selectedSourceId}
                onChange={(e) => setSelectedSourceId(e.target.value)}
                className="w-full px-3 py-2 border rounded text-sm bg-transparent"
              >
                <option value="">Todas as fontes</option>
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label || s.id}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-end gap-3">
            <div className="flex-1 space-y-1">
              <div className="text-xs font-semibold">Upload PDF (mercado)</div>
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => setPdf(e.target.files?.[0] || null)}
                className="text-sm"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={refreshSources}
                disabled={sourcesBusy}
                className="text-xs px-3 py-2 border rounded border-secondary-dark/40 dark:border-secondary-light/40 hover:bg-secondary-light/30 dark:hover:bg-secondary-dark/30 transition disabled:opacity-60"
              >
                {sourcesBusy ? "Atualizando..." : "Atualizar fontes"}
              </button>
              <button
                onClick={handleUpload}
                disabled={uploadBusy}
                className="text-xs px-3 py-2 border rounded border-secondary-dark/40 dark:border-secondary-light/40 hover:bg-secondary-light/30 dark:hover:bg-secondary-dark/30 transition disabled:opacity-60"
              >
                {uploadBusy ? "Enviando..." : "Enviar para KB"}
              </button>
            </div>
          </div>

          {uploadError ? (
            <div className="text-xs text-red-500">{uploadError}</div>
          ) : null}
          {uploadOk ? (
            <div className="text-xs text-green-600">{uploadOk}</div>
          ) : null}
          {sourcesError ? (
            <div className="text-xs text-red-500">{sourcesError}</div>
          ) : null}

          <div className="border-t border-secondary-dark/20 dark:border-secondary-light/20 pt-4 space-y-2">
            <div className="text-xs font-semibold">Teste de busca</div>
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border rounded text-sm bg-transparent"
              placeholder="Ex: Quais bairros mais valorizam em Sao Paulo nos ultimos 12 meses?"
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <div className="text-xs font-semibold">Limite</div>
                <input
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                  className="w-full px-3 py-2 border rounded text-sm bg-transparent"
                  placeholder="5"
                />
              </div>
              <div className="space-y-1">
                <div className="text-xs font-semibold">Score minimo (opcional)</div>
                <input
                  value={scoreThreshold}
                  onChange={(e) => setScoreThreshold(e.target.value)}
                  className="w-full px-3 py-2 border rounded text-sm bg-transparent"
                  placeholder="0.45"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={handleSearch}
                  disabled={busy}
                  className="w-full text-xs px-3 py-2 border rounded border-secondary-dark/40 dark:border-secondary-light/40 hover:bg-secondary-light/30 dark:hover:bg-secondary-dark/30 transition disabled:opacity-60"
                >
                  {busy ? "Buscando..." : "Buscar"}
                </button>
              </div>
            </div>
            {error ? <div className="text-xs text-red-500">{error}</div> : null}

            <div className="space-y-2">
              {results.length ? (
                <div className="text-xs opacity-80">
                  {results.length} resultado(s)
                </div>
              ) : null}
              {results.map((r, idx) => {
                const payload = (r.payload || {}) as Record<string, unknown>;
                const snippet = String(payload.snippet || payload.text || "");
                const sectionKind = String(payload.sectionKind || "");
                const score =
                  typeof r.score === "number" ? r.score.toFixed(3) : "-";
                const geo = [payload.state, payload.city, payload.neighborhood]
                  .filter(Boolean)
                  .join(" / ");
                return (
                  <div
                    key={r.id || String(idx)}
                    className="rounded border border-secondary-dark/20 dark:border-secondary-light/20 p-3 bg-white/50 dark:bg-black/10"
                  >
                    <div className="text-xs opacity-80">
                      #{idx + 1} score {score}{" "}
                      {sectionKind ? `| ${sectionKind}` : ""}
                    </div>
                    {geo ? (
                      <div className="text-[11px] opacity-70 mt-1">{geo}</div>
                    ) : null}
                    <div className="text-sm mt-1 whitespace-pre-wrap">
                      {snippet.slice(0, 500)}
                      {snippet.length > 500 ? "..." : ""}
                    </div>
                    {payload.storagePath ? (
                      <div className="text-[11px] opacity-70 mt-2 break-all">
                        {String(payload.storagePath)}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
