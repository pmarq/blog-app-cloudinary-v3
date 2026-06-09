"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AdminLayout from "@/app/components/layout/AdminLayout";
import StudioNav from "@/app/components/admin/StudioNav";
import { auth } from "@/firebase/client";
import { useToast } from "@/hooks/use-toast";
import { withBasePath } from "@/lib/withBasePath";
import { DEFAULT_ORG_ID } from "@/lib/studio/org";

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

function formatBackendError(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";

  const record = payload as Record<string, unknown>;
  const parts = [
    record.message,
    record.error,
    record.details,
    record.link,
    record.url,
  ]
    .flatMap((value) => {
      if (!value) return [];
      if (Array.isArray(value)) return value.map((item) => String(item));
      return [String(value)];
    })
    .map((value) => value.trim())
    .filter(Boolean);

  return parts.join("\n");
}

function hasText(value: string | undefined | null): boolean {
  return Boolean(String(value || "").trim());
}

function hasItems(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0;
}

function getBriefSignature(brief: BriefItem): string {
  return [
    brief.id || "",
    brief.briefRunId || "",
    brief.strategyId || "",
    brief.calendarRunId || "",
    brief.title || "",
    brief.period || "",
    brief.channel || "",
    brief.objective || "",
  ]
    .map((part) => String(part || "").trim().toLowerCase())
    .join("|");
}

function dedupeBriefItems(items: BriefItem[]): BriefItem[] {
  const byRunId = new Map<string, BriefItem>();
  const bySignature = new Map<string, BriefItem>();

  for (const item of items) {
    const runId = String(item.briefRunId || "").trim().toLowerCase();
    const signature = getBriefSignature(item);

    if (runId) {
      if (byRunId.has(runId)) byRunId.delete(runId);
      byRunId.set(runId, item);
      continue;
    }

    if (!bySignature.has(signature)) {
      bySignature.set(signature, item);
    }
  }

  return [...byRunId.values(), ...bySignature.values()];
}

type CmoStage = "profile" | "portfolio" | "opportunities" | "strategy" | "calendar" | "briefs" | "ready";

function getCmoStage({
  companyProfile,
  portfolioSnapshot,
  opportunitySearch,
  strategy,
  calendarItems,
  briefItems,
}: {
  companyProfile: CompanyProfile;
  portfolioSnapshot: PortfolioSnapshot | null;
  opportunitySearch: MarketOpportunityPayload | null;
  strategy: StrategyPayload | null;
  calendarItems: CalendarItem[];
  briefItems: BriefItem[];
}): CmoStage {
  const profileReady =
    hasText(companyProfile.name) ||
    hasText(companyProfile.positioning) ||
    hasText(companyProfile.valueProposition) ||
    hasItems(companyProfile.audience) ||
    hasItems(companyProfile.regions);

  if (!profileReady) return "profile";
  if (!portfolioSnapshot?.id) return "portfolio";
  if (!opportunitySearch?.id && !hasItems(opportunitySearch?.opportunities)) return "opportunities";
  if (!strategy?.id) return "strategy";
  if (!hasItems(calendarItems)) return "calendar";
  if (!hasItems(briefItems)) return "briefs";
  return "ready";
}

function getStageConfig(stage: CmoStage) {
  const config: Record<CmoStage, { eyebrow: string; title: string; description: string; actionLabel: string; hint: string }> = {
    profile: {
      eyebrow: "Comece aqui",
      title: "Preencha o Company Profile",
      description: "Defina posicionamento, publico, regioes e guardrails antes de pedir qualquer geracao.",
      actionLabel: "Salvar perfil",
      hint: "Sem isso, o sistema nao sabe para quem falar.",
    },
    portfolio: {
      eyebrow: "Proximo passo",
      title: "Leia o portfolio atual",
      description: "O sistema precisa entender quais produtos existem e o que eles comunicam para montar o plano.",
      actionLabel: "Analisar portfolio",
      hint: "Isso cria o diagnostico base do mes.",
    },
    opportunities: {
      eyebrow: "Agora sim",
      title: "Busque oportunidades de mercado",
      description: "Cruze portfolio, perfil e web para descobrir temas com aderencia comercial e editorial.",
      actionLabel: "Buscar oportunidades",
      hint: "Aqui surgem temas com valor real.",
    },
    strategy: {
      eyebrow: "Decisao",
      title: "Gere o Plano CMO do mes",
      description: "Transforme o diagnostico em prioridades, canais, riscos e direcoes editoriais.",
      actionLabel: "Gerar plano",
      hint: "Essa e a sintese estrategica do sistema.",
    },
    calendar: {
      eyebrow: "Operacao",
      title: "Monte o calendario editorial",
      description: "Converta a estrategia em pautas com datas, canais e temas definidos.",
      actionLabel: "Gerar calendario",
      hint: "Sem calendario, nao existe execucao previsivel.",
    },
    briefs: {
      eyebrow: "Producao",
      title: "Crie briefs para execucao",
      description: "Cada pauta vira um brief claro para orientar texto, tom, CTA e guardrails.",
      actionLabel: "Gerar briefs",
      hint: "Brief bom reduz retrabalho na producao.",
    },
    ready: {
      eyebrow: "Fim do fluxo",
      title: "Abra a area de briefs",
      description: "Voce ja saiu do diagnostico e chegou na etapa de revisao e distribuicao dos briefs.",
      actionLabel: "Abrir briefs",
      hint: "Agora a proxima tela e a de revisao editorial.",
    },
  };

  return config[stage];
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
  const [briefsError, setBriefsError] = useState<string | null>(null);

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

  const cmoStage = useMemo(
    () =>
      getCmoStage({
        companyProfile,
        portfolioSnapshot,
        opportunitySearch,
        strategy,
        calendarItems,
        briefItems,
      }),
    [briefItems, calendarItems, companyProfile, opportunitySearch, portfolioSnapshot, strategy],
  );

  const stageConfig = useMemo(() => getStageConfig(cmoStage), [cmoStage]);
  const uniqueBriefItems = useMemo(() => dedupeBriefItems(briefItems), [briefItems]);

  const executeNextStep = async () => {
    if (cmoStage === "profile") {
      await saveProfile();
      return;
    }
    if (cmoStage === "portfolio") {
      await analyzePortfolio();
      return;
    }
    if (cmoStage === "opportunities") {
      await searchOpportunities();
      return;
    }
    if (cmoStage === "strategy") {
      await generateStrategy();
      return;
    }
    if (cmoStage === "calendar") {
      await generateCalendar();
      return;
    }
    if (cmoStage === "briefs") {
      await generateBriefs();
      return;
    }

    router.push("/dashboard/studio/briefs");
  };

  const getToken = async () => {
    const token = await auth.currentUser?.getIdToken(true);
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

      const nextPortfolioSnapshots = Array.isArray(portfolioPayload.latestItems)
        ? portfolioPayload.latestItems
        : [];
      const nextOpportunityDrafts = Array.isArray(opportunitiesPayload.latestItems)
        ? opportunitiesPayload.latestItems
        : [];
      const nextStrategyDrafts = Array.isArray(strategiesPayload.latestItems)
        ? strategiesPayload.latestItems
        : [];
      const nextCalendarItems = Array.isArray(calendarPayload.latestItems)
        ? calendarPayload.latestItems
        : [];
      const nextBriefItems = dedupeBriefItems(
        Array.isArray(briefsPayload.latestItems) ? briefsPayload.latestItems : [],
      );

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
      setPortfolioSnapshot(payload.latestPortfolioSnapshot || null);
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
      setOpportunitySearch(payload.latestOpportunitySearch || null);
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
      setStrategy(payload.latestStrategy || null);
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
      setCalendarItems(
        Array.isArray(payload.latestCalendar?.items)
          ? payload.latestCalendar.items
          : [],
      );
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
    setBriefsError(null);
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
        const backendError = formatBackendError(payload);
        throw new Error(
          backendError ||
            (payload?.message as string | undefined) ||
            (payload?.error as string | undefined) ||
            "Falha ao gerar briefs.",
        );
      }
      setBriefItems(
        Array.isArray(payload.latestItems) ? payload.latestItems : [],
      );
      await refreshDrafts();
      toast({ title: "Briefs gerados", description: "Direcionamentos editoriais salvos no backend." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao gerar briefs.";
      setBriefsError(message);
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

        <section className="rounded border border-highlight-light/30 bg-highlight-light/5 p-4 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="text-xs font-semibold uppercase tracking-wide text-highlight-light">
                {stageConfig.eyebrow}
              </div>
              <h2 className="text-xl font-semibold text-secondary-dark dark:text-secondary-light">
                {stageConfig.title}
              </h2>
              <p className="max-w-3xl text-sm text-secondary-dark/80 dark:text-secondary-light/80">
                {stageConfig.description}
              </p>
            </div>

            <div className="rounded border border-secondary-dark/20 dark:border-secondary-light/20 bg-white/50 dark:bg-black/10 px-3 py-2 text-xs text-secondary-dark dark:text-secondary-light">
              <div className="font-semibold">{cmoStage.toUpperCase()}</div>
              <div>{stageConfig.hint}</div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void executeNextStep()}
              disabled={
                (cmoStage === "profile" && savingProfile) ||
                (cmoStage === "portfolio" && analyzingPortfolio) ||
                (cmoStage === "opportunities" && searchingOpportunities) ||
                (cmoStage === "strategy" && generatingStrategy) ||
                (cmoStage === "calendar" && generatingCalendar) ||
                (cmoStage === "briefs" && generatingBriefs)
              }
              className="rounded bg-highlight-light px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
            >
              {stageConfig.actionLabel}
            </button>
            <div className="text-xs text-secondary-dark/70 dark:text-secondary-light/70">
              O sistema deve sugerir a proxima acao, nao todas ao mesmo tempo.
            </div>
          </div>
        </section>

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
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded border border-secondary-dark/20 dark:border-secondary-light/20 bg-white/30 dark:bg-black/10 p-3 space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-highlight-light">
                  Estado
                </div>
                <div className="text-sm text-secondary-dark dark:text-secondary-light">
                  {briefItems.length
                    ? `${briefItems.length} briefs prontos para revisao`
                    : "Ainda nao ha briefs. Gere a agenda primeiro."}
                </div>
              </div>
              <div className="rounded border border-secondary-dark/20 dark:border-secondary-light/20 bg-white/30 dark:bg-black/10 p-3 space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-highlight-light">
                  Proxima acao
                </div>
                <div className="text-sm text-secondary-dark dark:text-secondary-light">
                  {strategy?.id
                    ? "Gerar calendario e briefs a partir da estrategia."
                    : "Gerar o plano CMO antes de seguir."}
                </div>
              </div>
              <div className="rounded border border-secondary-dark/20 dark:border-secondary-light/20 bg-white/30 dark:bg-black/10 p-3 space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-highlight-light">
                  Revisao
                </div>
                <div className="text-sm text-secondary-dark dark:text-secondary-light">
                  Depois disso, o usuario abre o editor e valida o conteudo final.
                </div>
              </div>
            </div>

            <details className="rounded border border-secondary-dark/20 dark:border-secondary-light/20 bg-white/20 dark:bg-black/10 p-3">
              <summary className="cursor-pointer text-sm font-semibold text-highlight-light dark:text-highlight-dark">
                Dados tecnicos
              </summary>
              <div className="mt-3 grid gap-3">
                <ReadOnlyJson title="Portfolio Snapshot" value={portfolioSnapshot} />
                <ReadOnlyJson title="Oportunidades" value={opportunitySearch} />
                <ReadOnlyJson title="Estrategia" value={strategy} />
                <ReadOnlyJson title="Snapshots recentes" value={portfolioSnapshots} />
                <ReadOnlyJson title="Oportunidades recentes" value={marketOpportunityDrafts} />
                <ReadOnlyJson title="Estrategias recentes" value={strategyDrafts} />
                <ReadOnlyJson title="Calendario editorial" value={calendarItems} />
                <ReadOnlyJson title="Briefs editoriais" value={briefItems} />
              </div>
            </details>

            <div className="rounded border border-secondary-dark/20 dark:border-secondary-light/20 bg-white/30 dark:bg-black/10 p-3 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-highlight-light dark:text-highlight-dark">
                  Briefs em revisao
                </div>
                <div className="text-xs text-secondary-dark/70 dark:text-secondary-light/70">
                  Aprovar, enviar para a agenda e abrir no editor
                </div>
              </div>
              {briefsError ? (
                <div className="rounded border border-red-500/40 bg-red-500/5 p-3 text-xs text-red-700 dark:text-red-300">
                  <div className="font-semibold">Erro ao gerar briefs</div>
                  <pre className="mt-2 whitespace-pre-wrap break-words">{briefsError}</pre>
                </div>
              ) : null}
              <div className="space-y-2">
                {uniqueBriefItems.length ? (
                  uniqueBriefItems.map((brief, index) => (
                    <div
                      key={brief.id || `${brief.briefRunId || "brief"}-${brief.title || "untitled"}-${brief.period || "no-period"}-${index}`}
                      className="rounded border border-secondary-dark/20 dark:border-secondary-light/20 p-3 space-y-2"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="font-medium text-secondary-dark dark:text-secondary-light">
                            {brief.title || "Brief sem titulo"}
                          </div>
                          <div className="text-xs text-secondary-dark/70 dark:text-secondary-light/70">
                            {brief.channel || "blog"} - {brief.status || "draft"} -{" "}
                            {brief.scheduledAt || "sem data"}
                          </div>
                          <div className="text-xs text-secondary-dark/70 dark:text-secondary-light/70">
                            {brief.objective || "Sem objetivo definido."}
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
                            {sendingBriefId === brief.id ? "Enviando..." : "Enviar"}
                          </button>
                          <button
                            type="button"
                            onClick={() => openBriefInEditor(brief)}
                            className="rounded border border-secondary-dark/30 px-3 py-1 text-xs transition hover:bg-secondary-light/20 dark:border-secondary-light/30"
                          >
                            Editor
                          </button>
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
