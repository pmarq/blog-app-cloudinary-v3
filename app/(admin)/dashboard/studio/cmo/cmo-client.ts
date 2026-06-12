import { auth } from "@/firebase/client";
import { withBasePath } from "@/lib/withBasePath";
import type {
  BriefItem,
  CalendarItem,
  CompanyProfile,
  MarketOpportunityPayload,
  PortfolioSnapshot,
  StrategyPayload,
} from "./cmo-domain";

export type CmoDraftBundle = {
  portfolioSnapshots: PortfolioSnapshot[];
  marketOpportunityDrafts: MarketOpportunityPayload[];
  strategyDrafts: StrategyPayload[];
  calendarItems: CalendarItem[];
  briefItems: BriefItem[];
};

export function createCmoClient(orgId: string) {
  const getToken = async () => {
    const token = await auth.currentUser?.getIdToken(true);
    if (!token) {
      throw new Error("Sessão necessária. Faça login novamente.");
    }
    return token;
  };

  const apiFetch = async (path: string, init: RequestInit = {}) => {
    const token = await getToken();
    return fetch(withBasePath(path), {
      ...init,
      headers: {
        ...(init.headers || {}),
        Authorization: `Bearer ${token}`,
      },
    });
  };

  const parseJson = async <T,>(response: Response): Promise<T> => {
    return response.json() as Promise<T>;
  };

  return {
    async loadCompanyProfile() {
      const response = await apiFetch(`/api/studio/cmo/company-profile?orgId=${encodeURIComponent(orgId)}`);
      const payload = await parseJson<{ ok: boolean; message?: string; companyProfile?: CompanyProfile }>(response);

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.message || "Falha ao carregar Company Profile.");
      }

      return payload.companyProfile || null;
    },

    async loadDrafts(): Promise<CmoDraftBundle> {
      const [portfolioResponse, opportunitiesResponse, strategiesResponse, calendarResponse, briefsResponse] =
        await Promise.all([
          apiFetch(`/api/studio/cmo/portfolio/snapshots?orgId=${encodeURIComponent(orgId)}&limit=3`),
          apiFetch(`/api/studio/cmo/opportunities?orgId=${encodeURIComponent(orgId)}&limit=3`),
          apiFetch(`/api/studio/cmo/strategies?orgId=${encodeURIComponent(orgId)}&limit=3`),
          apiFetch(`/api/studio/cmo/calendar/items?orgId=${encodeURIComponent(orgId)}&limit=8`),
          apiFetch(`/api/studio/cmo/briefs?orgId=${encodeURIComponent(orgId)}&limit=8`),
        ]);

      const [portfolioPayload, opportunitiesPayload, strategiesPayload, calendarPayload, briefsPayload] =
        await Promise.all([
          parseJson<{ ok: boolean; message?: string; latestItems?: PortfolioSnapshot[] }>(portfolioResponse),
          parseJson<{ ok: boolean; message?: string; latestItems?: MarketOpportunityPayload[] }>(opportunitiesResponse),
          parseJson<{ ok: boolean; message?: string; latestItems?: StrategyPayload[] }>(strategiesResponse),
          parseJson<{ ok: boolean; message?: string; latestItems?: CalendarItem[] }>(calendarResponse),
          parseJson<{ ok: boolean; message?: string; latestItems?: BriefItem[] }>(briefsResponse),
        ]);

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

      return {
        portfolioSnapshots: Array.isArray(portfolioPayload.latestItems) ? portfolioPayload.latestItems : [],
        marketOpportunityDrafts: Array.isArray(opportunitiesPayload.latestItems)
          ? opportunitiesPayload.latestItems
          : [],
        strategyDrafts: Array.isArray(strategiesPayload.latestItems) ? strategiesPayload.latestItems : [],
        calendarItems: Array.isArray(calendarPayload.latestItems) ? calendarPayload.latestItems : [],
        briefItems: Array.isArray(briefsPayload.latestItems) ? briefsPayload.latestItems : [],
      };
    },

    async saveCompanyProfile(companyProfile: CompanyProfile) {
      const response = await apiFetch("/api/studio/cmo/company-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, companyProfile }),
      });

      const payload = await parseJson<{ ok: boolean; message?: string; companyProfile?: CompanyProfile }>(response);
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.message || "Falha ao salvar Company Profile.");
      }

      return payload.companyProfile || null;
    },

    async analyzePortfolio() {
      const response = await apiFetch("/api/studio/cmo/portfolio/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId }),
      });
      const payload = await parseJson<{ ok: boolean; message?: string; latestPortfolioSnapshot?: PortfolioSnapshot }>(response);
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.message || "Falha ao analisar portfólio.");
      }
      return payload.latestPortfolioSnapshot || null;
    },

    async searchOpportunities(portfolioSnapshotId?: string) {
      const response = await apiFetch("/api/studio/cmo/opportunities/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId,
          portfolioSnapshotId: portfolioSnapshotId || undefined,
        }),
      });
      const payload = await parseJson<{ ok: boolean; message?: string; latestOpportunitySearch?: MarketOpportunityPayload }>(response);
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.message || "Falha ao buscar oportunidades.");
      }
      return payload.latestOpportunitySearch || null;
    },

    async generateStrategy(input: { period: string; objective: string; portfolioSnapshotId?: string; opportunitySearchId?: string }) {
      const response = await apiFetch("/api/studio/cmo/strategy/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId,
          period: input.period,
          objective: input.objective,
          portfolioSnapshotId: input.portfolioSnapshotId || undefined,
          opportunitySearchId: input.opportunitySearchId || undefined,
          marketOpportunityLimit: 5,
        }),
      });
      const payload = await parseJson<{ ok: boolean; message?: string; latestStrategy?: StrategyPayload }>(response);
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.message || "Falha ao gerar estratégia.");
      }
      return payload.latestStrategy || null;
    },

    async generateCalendar(input: {
      strategyId?: string;
      period: string;
      portfolioSnapshotId?: string;
      opportunitySearchId?: string;
    }) {
      const response = await apiFetch("/api/studio/cmo/calendar/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId,
          strategyId: input.strategyId || undefined,
          period: input.period,
          portfolioSnapshotId: input.portfolioSnapshotId || undefined,
          opportunitySearchId: input.opportunitySearchId || undefined,
          itemCount: 8,
        }),
      });
      const payload = await parseJson<{ ok: boolean; message?: string; latestCalendar?: { items?: CalendarItem[] } }>(response);
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.message || "Falha ao gerar calendário.");
      }
      return Array.isArray(payload.latestCalendar?.items) ? payload.latestCalendar.items : [];
    },

    async generateBriefs(input: {
      strategyId?: string;
      calendarRunId?: string;
      portfolioSnapshotId?: string;
      opportunitySearchId?: string;
      manualTopics: string[];
    }) {
      const response = await apiFetch("/api/studio/cmo/briefs/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId,
          strategyId: input.strategyId || undefined,
          calendarRunId: input.calendarRunId || undefined,
          portfolioSnapshotId: input.portfolioSnapshotId || undefined,
          opportunitySearchId: input.opportunitySearchId || undefined,
          itemCount: 6,
          manualTopics: input.manualTopics,
        }),
      });
      const payload = await parseJson<{ ok: boolean; message?: string; error?: string; latestItems?: BriefItem[] }>(response);
      if (!response.ok || !payload?.ok) {
        const backendError = [payload?.message, payload?.error].filter(Boolean).join(" ").trim();
        throw new Error(backendError || "Falha ao gerar briefs.");
      }
      return Array.isArray(payload.latestItems) ? payload.latestItems : [];
    },

    async approveBrief(briefId: string) {
      const response = await apiFetch(`/api/studio/cmo/briefs/${encodeURIComponent(briefId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId,
          status: "approved",
        }),
      });
      const payload = await parseJson<{ ok: boolean; message?: string }>(response);
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.message || "Falha ao aprovar brief.");
      }
    },

    async sendBriefToAgenda(brief: BriefItem) {
      if (!brief.id) return;
      const response = await apiFetch(`/api/studio/cmo/briefs/${encodeURIComponent(brief.id)}/send-to-agenda`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brief: {
            ...brief,
            orgId,
          },
        }),
      });
      const payload = await parseJson<{ ok: boolean; message?: string }>(response);
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.message || "Falha ao enviar brief para a agenda.");
      }
    },
  };
}
