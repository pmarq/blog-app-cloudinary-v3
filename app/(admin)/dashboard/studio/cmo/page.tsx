"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AdminLayout from "@/app/components/layout/AdminLayout";
import StudioNav from "@/app/components/admin/StudioNav";
import { auth } from "@/firebase/client";
import { useToast } from "@/hooks/use-toast";
import { withBasePath } from "@/lib/withBasePath";

type CompanyProfile = {
  id?: string;
  orgId?: string;
  name: string;
  positioning: string;
  valueProposition: string;
  audience: string[];
  marketSegment: string[];
  regions: string[];
  preferredTone: string;
  contentStyle: string[];
  forbiddenTopics: string[];
  preferredTopics: string[];
  commercialGoals: string[];
  channels: string[];
};

type PortfolioSnapshot = {
  id?: string;
  orgId?: string;
  activeProductsCount?: number;
  mainCities?: string[];
  mainNeighborhoods?: string[];
  mainSegments?: string[];
  commonAttributes?: string[];
  audienceFit?: string[];
  excludedSegments?: string[];
  strategicSummary?: string;
  relatedProductIds?: string[];
};

type MarketOpportunityPayload = {
  id?: string;
  orgId?: string;
  portfolioSnapshotId?: string | null;
  queries?: string[];
  opportunities?: Array<{
    title: string;
    scope: string;
    fitScore: number;
    relatedRegions?: string[];
    suggestedContents?: string[];
    references?: Array<{ title: string; url: string | null }>;
    warning?: string | null;
  }>;
};

type StrategyPayload = {
  id?: string;
  orgId?: string;
  period?: string | null;
  objective?: string;
  diagnosis?: string;
  marketContext?: string;
  priorityAudiences?: string[];
  priorityRegions?: string[];
  priorityProjects?: string[];
  contentPillars?: string[];
  recommendedChannels?: string[];
  risks?: string[];
  portfolioSummary?: string[];
  marketSignals?: string[];
  portfolioSnapshotId?: string | null;
  marketOpportunityCount?: number;
};

type CalendarItem = {
  id?: string;
  orgId?: string;
  calendarRunId?: string | null;
  strategyId?: string | null;
  period?: string | null;
  title?: string;
  channel?: string;
  theme?: string;
  scope?: string;
  angle?: string;
  objective?: string;
  scheduledAt?: string | null;
  relatedProjectIds?: string[];
  relatedRegions?: string[];
  status?: string;
};

type BriefItem = {
  id?: string;
  orgId?: string;
  briefRunId?: string | null;
  strategyId?: string | null;
  calendarRunId?: string | null;
  period?: string | null;
  title?: string;
  channel?: string;
  theme?: string | null;
  scope?: string | null;
  objective?: string;
  audience?: string[];
  angle?: string;
  keyMessages?: string[];
  cta?: string;
  guardrails?: string[];
  requiredSources?: {
    kb?: boolean;
    web?: boolean;
    projectFacts?: boolean;
  };
  scheduledAt?: string | null;
  status?: string;
};

const DEFAULT_ORG_ID = "org_inlevor";

const emptyProfile: CompanyProfile = {
  name: "",
  positioning: "",
  valueProposition: "",
  audience: [],
  marketSegment: [],
  regions: [],
  preferredTone: "",
  contentStyle: [],
  forbiddenTopics: [],
  preferredTopics: [],
  commercialGoals: [],
  channels: [],
};

function toLines(value: string[]): string {
  return value.join("\n");
}

function fromLines(value: string): string[] {
  return value
    .split(/\r?\n|,|;/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatJson(value: unknown): string {
  if (value === null || value === undefined) return "";
  return JSON.stringify(value, null, 2);
}

export default function StudioCmoPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [orgId] = useState(DEFAULT_ORG_ID);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [loadingDrafts, setLoadingDrafts] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [analyzingPortfolio, setAnalyzingPortfolio] = useState(false);
  const [searchingOpportunities, setSearchingOpportunities] = useState(false);
  const [generatingStrategy, setGeneratingStrategy] = useState(false);
  const [generatingCalendar, setGeneratingCalendar] = useState(false);
  const [generatingBriefs, setGeneratingBriefs] = useState(false);
  const [updatingBriefId, setUpdatingBriefId] = useState<string | null>(null);
  const [sendingBriefId, setSendingBriefId] = useState<string | null>(null);

  const [portfolioSnapshots, setPortfolioSnapshots] = useState<PortfolioSnapshot[]>([]);
  const [marketOpportunityDrafts, setMarketOpportunityDrafts] = useState<MarketOpportunityPayload[]>(
    [],
  );
  const [strategyDrafts, setStrategyDrafts] = useState<StrategyPayload[]>([]);
  const [calendarItems, setCalendarItems] = useState<CalendarItem[]>([]);
  const [briefItems, setBriefItems] = useState<BriefItem[]>([]);

  const [companyProfile, setCompanyProfile] = useState<CompanyProfile>(emptyProfile);
  const [portfolioSnapshot, setPortfolioSnapshot] = useState<PortfolioSnapshot | null>(null);
  const [opportunitySearch, setOpportunitySearch] = useState<MarketOpportunityPayload | null>(null);
  const [strategy, setStrategy] = useState<StrategyPayload | null>(null);

  const [period, setPeriod] = useState("2026-06");
  const [objective, setObjective] = useState(
    "aumentar leads qualificados para alto padrão em São Paulo",
  );

  const profileFormValue = useMemo(
    () => ({
      ...companyProfile,
      audience: toLines(companyProfile.audience),
      marketSegment: toLines(companyProfile.marketSegment),
      regions: toLines(companyProfile.regions),
      contentStyle: toLines(companyProfile.contentStyle),
      forbiddenTopics: toLines(companyProfile.forbiddenTopics),
      preferredTopics: toLines(companyProfile.preferredTopics),
      commercialGoals: toLines(companyProfile.commercialGoals),
      channels: toLines(companyProfile.channels),
    }),
    [companyProfile],
  );

  const getToken = async () => {
    const token = await auth.currentUser?.getIdToken();
    if (!token) {
      throw new Error("Sessão necessária. Faça login novamente.");
    }
    return token;
  };

  const refreshDrafts = async () => {
    setLoadingDrafts(true);
    try {
      const token = await getToken();
      const [
        portfolioResponse,
        opportunitiesResponse,
        strategiesResponse,
        calendarResponse,
        briefsResponse,
      ] = await Promise.all([
        fetch(
          withBasePath(
            `/api/studio/cmo/portfolio/snapshots?orgId=${encodeURIComponent(orgId)}&limit=3`,
          ),
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        ),
        fetch(
          withBasePath(
            `/api/studio/cmo/opportunities?orgId=${encodeURIComponent(orgId)}&limit=3`,
          ),
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        ),
        fetch(withBasePath(`/api/studio/cmo/strategies?orgId=${encodeURIComponent(orgId)}&limit=3`), {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(withBasePath(`/api/studio/cmo/calendar/items?orgId=${encodeURIComponent(orgId)}&limit=8`), {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(withBasePath(`/api/studio/cmo/briefs?orgId=${encodeURIComponent(orgId)}&limit=8`), {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const portfolioPayload = await portfolioResponse.json();
      const opportunitiesPayload = await opportunitiesResponse.json();
      const strategiesPayload = await strategiesResponse.json();
      const calendarPayload = await calendarResponse.json();
      const briefsPayload = await briefsResponse.json();

      if (!portfolioResponse.ok || !portfolioPayload?.ok) {
        throw new Error(portfolioPayload?.message || "Falha ao carregar snapshots.");
      }
      if (!opportunitiesResponse.ok || !opportunitiesPayload?.ok) {
        throw new Error(opportunitiesPayload?.message || "Falha ao carregar oportunidades.");
      }
      if (!strategiesResponse.ok || !strategiesPayload?.ok) {
        throw new Error(strategiesPayload?.message || "Falha ao carregar estratégias.");
      }
      if (!calendarResponse.ok || !calendarPayload?.ok) {
        throw new Error(calendarPayload?.message || "Falha ao carregar calendário.");
      }
      if (!briefsResponse.ok || !briefsPayload?.ok) {
        throw new Error(briefsPayload?.message || "Falha ao carregar briefs.");
      }

      const nextPortfolioSnapshots = Array.isArray(portfolioPayload.items) ? portfolioPayload.items : [];
      const nextOpportunityDrafts = Array.isArray(opportunitiesPayload.items)
        ? opportunitiesPayload.items
        : [];
      const nextStrategyDrafts = Array.isArray(strategiesPayload.items) ? strategiesPayload.items : [];
      const nextCalendarItems = Array.isArray(calendarPayload.items) ? calendarPayload.items : [];
      const nextBriefItems = Array.isArray(briefsPayload.items) ? briefsPayload.items : [];

      setPortfolioSnapshots(nextPortfolioSnapshots);
      setMarketOpportunityDrafts(nextOpportunityDrafts);
      setStrategyDrafts(nextStrategyDrafts);
      setCalendarItems(nextCalendarItems);
      setBriefItems(nextBriefItems);

      if (nextPortfolioSnapshots[0]) {
        setPortfolioSnapshot(nextPortfolioSnapshots[0]);
      }
      if (nextOpportunityDrafts[0]) {
        setOpportunitySearch(nextOpportunityDrafts[0]);
      }
      if (nextStrategyDrafts[0]) {
        setStrategy(nextStrategyDrafts[0]);
      }
      if (nextCalendarItems[0]) {
        setCalendarItems(nextCalendarItems);
      }
      if (nextBriefItems[0]) {
        setBriefItems(nextBriefItems);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao carregar drafts.";
      toast({ title: "Erro", description: message, variant: "destructive" });
    } finally {
      setLoadingDrafts(false);
    }
  };

  useEffect(() => {
    const loadProfile = async () => {
      setLoadingProfile(true);
      try {
        const token = await getToken();
        const response = await fetch(
          withBasePath(`/api/studio/cmo/company-profile?orgId=${encodeURIComponent(orgId)}`),
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        const payload = await response.json();
        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.message || "Falha ao carregar Company Profile.");
        }
        setCompanyProfile({
          ...emptyProfile,
          ...payload.companyProfile,
          audience: Array.isArray(payload.companyProfile?.audience)
            ? payload.companyProfile.audience
            : [],
          marketSegment: Array.isArray(payload.companyProfile?.marketSegment)
            ? payload.companyProfile.marketSegment
            : [],
          regions: Array.isArray(payload.companyProfile?.regions)
            ? payload.companyProfile.regions
            : [],
          contentStyle: Array.isArray(payload.companyProfile?.contentStyle)
            ? payload.companyProfile.contentStyle
            : [],
          forbiddenTopics: Array.isArray(payload.companyProfile?.forbiddenTopics)
            ? payload.companyProfile.forbiddenTopics
            : [],
          preferredTopics: Array.isArray(payload.companyProfile?.preferredTopics)
            ? payload.companyProfile.preferredTopics
            : [],
          commercialGoals: Array.isArray(payload.companyProfile?.commercialGoals)
            ? payload.companyProfile.commercialGoals
            : [],
          channels: Array.isArray(payload.companyProfile?.channels)
            ? payload.companyProfile.channels
            : [],
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erro ao carregar perfil.";
        toast({ title: "Erro", description: message, variant: "destructive" });
      } finally {
        setLoadingProfile(false);
      }
    };

    void loadProfile();
  }, [orgId, toast]);

  useEffect(() => {
    void refreshDrafts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, toast]);

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      const token = await getToken();
      const response = await fetch(withBasePath("/api/studio/cmo/company-profile"), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          orgId,
          companyProfile: {
            ...companyProfile,
            audience: fromLines(profileFormValue.audience),
            marketSegment: fromLines(profileFormValue.marketSegment),
            regions: fromLines(profileFormValue.regions),
            contentStyle: fromLines(profileFormValue.contentStyle),
            forbiddenTopics: fromLines(profileFormValue.forbiddenTopics),
            preferredTopics: fromLines(profileFormValue.preferredTopics),
            commercialGoals: fromLines(profileFormValue.commercialGoals),
            channels: fromLines(profileFormValue.channels),
          },
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.message || "Falha ao salvar Company Profile.");
      }
      setCompanyProfile({
        ...emptyProfile,
        ...payload.companyProfile,
      });
      await refreshDrafts();
      toast({ title: "Perfil salvo", description: "Company Profile atualizado." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao salvar perfil.";
      toast({ title: "Erro", description: message, variant: "destructive" });
    } finally {
      setSavingProfile(false);
    }
  };

  const analyzePortfolio = async () => {
    setAnalyzingPortfolio(true);
    try {
      const token = await getToken();
      const response = await fetch(withBasePath("/api/studio/cmo/portfolio/analyze"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ orgId }),
      });
      const payload = await response.json();
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.message || "Falha ao analisar portfólio.");
      }
      setPortfolioSnapshot(payload.portfolioSnapshot || null);
      await refreshDrafts();
      toast({ title: "Portfólio analisado", description: "Snapshot atualizado." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao analisar portfólio.";
      toast({ title: "Erro", description: message, variant: "destructive" });
    } finally {
      setAnalyzingPortfolio(false);
    }
  };

  const searchOpportunities = async () => {
    setSearchingOpportunities(true);
    try {
      const token = await getToken();
      const response = await fetch(withBasePath("/api/studio/cmo/opportunities/search"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          orgId,
          portfolioSnapshotId: portfolioSnapshot?.id || undefined,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.message || "Falha ao buscar oportunidades.");
      }
      setOpportunitySearch(payload.opportunitySearch || null);
      await refreshDrafts();
      toast({ title: "Oportunidades atualizadas", description: "Radar de mercado pronto." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao buscar oportunidades.";
      toast({ title: "Erro", description: message, variant: "destructive" });
    } finally {
      setSearchingOpportunities(false);
    }
  };

  const generateStrategy = async () => {
    setGeneratingStrategy(true);
    try {
      const token = await getToken();
      const response = await fetch(withBasePath("/api/studio/cmo/strategy/generate"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          orgId,
          period,
          objective,
          portfolioSnapshotId: portfolioSnapshot?.id || undefined,
          marketOpportunityLimit: 5,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.message || "Falha ao gerar estratégia.");
      }
      setStrategy(payload.strategy || null);
      await refreshDrafts();
      toast({ title: "Estratégia gerada", description: "Plano CMO salvo no backend." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao gerar estratégia.";
      toast({ title: "Erro", description: message, variant: "destructive" });
    } finally {
      setGeneratingStrategy(false);
    }
  };

  const generateCalendar = async () => {
    setGeneratingCalendar(true);
    try {
      const token = await getToken();
      const response = await fetch(withBasePath("/api/studio/cmo/calendar/generate"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          orgId,
          strategyId: strategy?.id || undefined,
          period,
          itemCount: 8,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.message || "Falha ao gerar calendário.");
      }
      setCalendarItems(Array.isArray(payload.calendar?.items) ? payload.calendar.items : []);
      await refreshDrafts();
      toast({ title: "Calendário gerado", description: "Pautas editoriais salvas no backend." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao gerar calendário.";
      toast({ title: "Erro", description: message, variant: "destructive" });
    } finally {
      setGeneratingCalendar(false);
    }
  };

  const generateBriefs = async () => {
    setGeneratingBriefs(true);
    try {
      const token = await getToken();
      const response = await fetch(withBasePath("/api/studio/cmo/briefs/generate"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          orgId,
          strategyId: strategy?.id || undefined,
          calendarRunId: calendarItems[0]?.calendarRunId || undefined,
          itemCount: 6,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.message || "Falha ao gerar briefs.");
      }
      setBriefItems(Array.isArray(payload.briefs?.items) ? payload.briefs.items : []);
      await refreshDrafts();
      toast({ title: "Briefs gerados", description: "Direcionamentos editoriais salvos no backend." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao gerar briefs.";
      toast({ title: "Erro", description: message, variant: "destructive" });
    } finally {
      setGeneratingBriefs(false);
    }
  };

  const approveBrief = async (brief: BriefItem) => {
    if (!brief.id) return;
    setUpdatingBriefId(brief.id);
    try {
      const token = await getToken();
      const response = await fetch(withBasePath(`/api/studio/cmo/briefs/${encodeURIComponent(brief.id)}`), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          orgId,
          status: "approved",
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.message || "Falha ao aprovar brief.");
      }
      await refreshDrafts();
      toast({ title: "Brief aprovado", description: "Status atualizado no backend." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao aprovar brief.";
      toast({ title: "Erro", description: message, variant: "destructive" });
    } finally {
      setUpdatingBriefId(null);
    }
  };

  const sendBriefToAgenda = async (brief: BriefItem) => {
    if (!brief.id) return;
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
          body: JSON.stringify({
            brief: {
              ...brief,
              orgId,
            },
          }),
        },
      );
      const payload = await response.json();
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.message || "Falha ao enviar brief para a agenda.");
      }
      await refreshDrafts();
      toast({
        title: "Brief enviado para a agenda",
        description: "Item criado no calendário do Studio.",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao enviar brief para a agenda.";
      toast({ title: "Erro", description: message, variant: "destructive" });
    } finally {
      setSendingBriefId(null);
    }
  };

  const openBriefInEditor = (brief: BriefItem) => {
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
      <div className="max-w-6xl space-y-6">
        <StudioNav />

        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-highlight-light dark:text-highlight-dark">
            CMO
          </h1>
          <p className="text-secondary-dark dark:text-secondary-light">
            Fluxo inicial do Marketing Director para a organização {orgId}.
          </p>
        </div>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded border border-secondary-dark/20 dark:border-secondary-light/20 bg-secondary-light/10 dark:bg-secondary-dark/20 p-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-highlight-light dark:text-highlight-dark">
                Company Profile
              </h2>
              <span className="text-xs text-secondary-dark/70 dark:text-secondary-light/70">
                {loadingProfile
                  ? "Carregando..."
                  : loadingDrafts
                    ? "Atualizando drafts..."
                    : "orgId: " + orgId}
              </span>
            </div>

            <div className="grid gap-3">
              <Field label="Nome" value={companyProfile.name} onChange={(value) => setCompanyProfile((prev) => ({ ...prev, name: value }))} />
              <Field label="Posicionamento" value={companyProfile.positioning} onChange={(value) => setCompanyProfile((prev) => ({ ...prev, positioning: value }))} />
              <Field label="Proposta de valor" value={companyProfile.valueProposition} onChange={(value) => setCompanyProfile((prev) => ({ ...prev, valueProposition: value }))} />
              <Field label="Tom preferido" value={companyProfile.preferredTone} onChange={(value) => setCompanyProfile((prev) => ({ ...prev, preferredTone: value }))} />
              <TextAreaField label="Público-alvo" value={profileFormValue.audience} onChange={(value) => setCompanyProfile((prev) => ({ ...prev, audience: fromLines(value) }))} />
              <TextAreaField label="Segmentos de atuação" value={profileFormValue.marketSegment} onChange={(value) => setCompanyProfile((prev) => ({ ...prev, marketSegment: fromLines(value) }))} />
              <TextAreaField label="Regiões atendidas" value={profileFormValue.regions} onChange={(value) => setCompanyProfile((prev) => ({ ...prev, regions: fromLines(value) }))} />
              <TextAreaField label="Assuntos proibidos" value={profileFormValue.forbiddenTopics} onChange={(value) => setCompanyProfile((prev) => ({ ...prev, forbiddenTopics: fromLines(value) }))} />
              <TextAreaField label="Assuntos preferenciais" value={profileFormValue.preferredTopics} onChange={(value) => setCompanyProfile((prev) => ({ ...prev, preferredTopics: fromLines(value) }))} />
              <TextAreaField label="Objetivos comerciais" value={profileFormValue.commercialGoals} onChange={(value) => setCompanyProfile((prev) => ({ ...prev, commercialGoals: fromLines(value) }))} />
              <TextAreaField label="Canais" value={profileFormValue.channels} onChange={(value) => setCompanyProfile((prev) => ({ ...prev, channels: fromLines(value) }))} />
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => void saveProfile()}
                disabled={savingProfile}
                className="rounded border border-highlight-light px-4 py-2 text-sm font-semibold text-highlight-light transition hover:bg-secondary-light/20 disabled:opacity-60"
              >
                {savingProfile ? "Salvando..." : "Salvar perfil"}
              </button>
              <button
                type="button"
                onClick={() => void analyzePortfolio()}
                disabled={analyzingPortfolio}
                className="rounded border border-secondary-dark/30 px-4 py-2 text-sm transition hover:bg-secondary-light/20 dark:border-secondary-light/30"
              >
                {analyzingPortfolio ? "Analisando..." : "Analisar portfólio"}
              </button>
              <button
                type="button"
                onClick={() => void searchOpportunities()}
                disabled={searchingOpportunities}
                className="rounded border border-secondary-dark/30 px-4 py-2 text-sm transition hover:bg-secondary-light/20 dark:border-secondary-light/30"
              >
                {searchingOpportunities ? "Buscando..." : "Buscar oportunidades"}
              </button>
            </div>
          </div>

          <div className="rounded border border-secondary-dark/20 dark:border-secondary-light/20 bg-secondary-light/10 dark:bg-secondary-dark/20 p-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-highlight-light dark:text-highlight-dark">
                Estratégia
              </h2>
              <span className="text-xs text-secondary-dark/70 dark:text-secondary-light/70">
                Draft persistido no backend
              </span>
            </div>

            <div className="grid gap-3">
              <Field label="Período" value={period} onChange={setPeriod} />
              <TextAreaField label="Objetivo" value={objective} onChange={setObjective} />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void generateStrategy()}
                disabled={generatingStrategy}
                className="rounded border border-highlight-light px-4 py-2 text-sm font-semibold text-highlight-light transition hover:bg-secondary-light/20 disabled:opacity-60"
              >
                {generatingStrategy ? "Gerando..." : "Gerar Plano CMO"}
              </button>
              <button
                type="button"
                onClick={() => void generateCalendar()}
                disabled={generatingCalendar || !strategy?.id}
                className="rounded border border-secondary-dark/30 px-4 py-2 text-sm transition hover:bg-secondary-light/20 dark:border-secondary-light/30 disabled:opacity-60"
              >
                {generatingCalendar ? "Gerando..." : "Gerar calendário"}
              </button>
              <button
                type="button"
                onClick={() => void generateBriefs()}
                disabled={generatingBriefs || !strategy?.id}
                className="rounded border border-secondary-dark/30 px-4 py-2 text-sm transition hover:bg-secondary-light/20 dark:border-secondary-light/30 disabled:opacity-60"
              >
                {generatingBriefs ? "Gerando..." : "Gerar briefs"}
              </button>
            </div>

            <ReadOnlyJson title="Portfolio Snapshot" value={portfolioSnapshot} />
            <ReadOnlyJson title="Oportunidades" value={opportunitySearch} />
            <ReadOnlyJson title="Estratégia" value={strategy} />
            <ReadOnlyJson title="Snapshots recentes" value={portfolioSnapshots} />
            <ReadOnlyJson title="Oportunidades recentes" value={marketOpportunityDrafts} />
            <ReadOnlyJson title="Estratégias recentes" value={strategyDrafts} />
            <ReadOnlyJson title="Calendário editorial" value={calendarItems} />
            <ReadOnlyJson title="Briefs editoriais" value={briefItems} />

            <div className="rounded border border-secondary-dark/20 dark:border-secondary-light/20 bg-white/30 dark:bg-black/10 p-3 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-highlight-light dark:text-highlight-dark">
                  Ações de briefs
                </div>
                <div className="text-xs text-secondary-dark/70 dark:text-secondary-light/70">
                  Aprovar e enviar para a agenda
                </div>
              </div>
              <div className="space-y-2">
                {briefItems.length ? (
                  briefItems.map((brief) => (
                    <div
                      key={brief.id || `${brief.title}-${brief.period}`}
                      className="rounded border border-secondary-dark/20 dark:border-secondary-light/20 p-3 space-y-2"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="font-medium text-secondary-dark dark:text-secondary-light">
                            {brief.title || "Brief sem título"}
                          </div>
                          <div className="text-xs text-secondary-dark/70 dark:text-secondary-light/70">
                            {brief.channel || "blog"} • {brief.status || "draft"} •{" "}
                            {brief.scheduledAt || "sem data"}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => void approveBrief(brief)}
                            disabled={updatingBriefId === brief.id || sendingBriefId === brief.id}
                            className="rounded border border-secondary-dark/30 px-3 py-1 text-xs transition hover:bg-secondary-light/20 dark:border-secondary-light/30 disabled:opacity-60"
                          >
                            {updatingBriefId === brief.id ? "Aprovando..." : "Aprovar"}
                          </button>
                          <button
                            type="button"
                            onClick={() => void sendBriefToAgenda(brief)}
                            disabled={sendingBriefId === brief.id}
                            className="rounded border border-highlight-light px-3 py-1 text-xs font-semibold text-highlight-light transition hover:bg-secondary-light/20 disabled:opacity-60"
                          >
                            {sendingBriefId === brief.id ? "Enviando..." : "Enviar para agenda"}
                          </button>
                          <button
                            type="button"
                            onClick={() => openBriefInEditor(brief)}
                            className="rounded border border-secondary-dark/30 px-3 py-1 text-xs transition hover:bg-secondary-light/20 dark:border-secondary-light/30"
                          >
                            Abrir no editor
                          </button>
                        </div>
                      </div>
                      <div className="grid gap-2 text-xs text-secondary-dark dark:text-secondary-light md:grid-cols-2">
                        <div>
                          <span className="font-semibold">Tema:</span> {brief.theme || "—"}
                        </div>
                        <div>
                          <span className="font-semibold">Alvo:</span>{" "}
                          {Array.isArray(brief.audience) && brief.audience.length
                            ? brief.audience.slice(0, 2).join(", ")
                            : "—"}
                        </div>
                        <div>
                          <span className="font-semibold">Objetivo:</span> {brief.objective || "—"}
                        </div>
                        <div>
                          <span className="font-semibold">CTA:</span> {brief.cta || "—"}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-secondary-dark/70 dark:text-secondary-light/70">
                    Nenhum brief gerado ainda.
                  </div>
                )}
              </div>
            </div>
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
      <input
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

function ReadOnlyJson({ title, value }: { title: string; value: unknown }) {
  return (
    <div className="rounded border border-secondary-dark/20 dark:border-secondary-light/20 bg-white/40 dark:bg-black/10 p-3">
      <div className="text-sm font-semibold text-highlight-light dark:text-highlight-dark mb-2">
        {title}
      </div>
      <pre className="max-h-80 overflow-auto whitespace-pre-wrap text-xs leading-relaxed text-secondary-dark dark:text-secondary-light">
        {formatJson(value) || "—"}
      </pre>
    </div>
  );
}
