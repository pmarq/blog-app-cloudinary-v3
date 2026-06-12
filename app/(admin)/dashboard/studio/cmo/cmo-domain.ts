export type CompanyProfile = {
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

export type PortfolioSnapshot = {
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
  territorialIndex?: {
    coverage?: {
      projectCount?: number;
      neighborhoodCount?: number;
      cityCount?: number;
    };
    primaryCity?: string | null;
    primaryNeighborhood?: string | null;
    focusCities?: string[];
    focusNeighborhoods?: string[];
    explorationNeighborhoods?: string[];
    neighborhoods?: Array<{
      name: string;
      count: number;
      projectIds?: string[];
      cities?: string[];
      segments?: string[];
      lastUpdatedAt?: number | null;
    }>;
    cities?: Array<{
      name: string;
      count: number;
      projectIds?: string[];
      neighborhoods?: string[];
      segments?: string[];
      lastUpdatedAt?: number | null;
    }>;
    territorialSummary?: string;
  };
};

export type MarketOpportunityPayload = {
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

export type OpportunitySearchContext = {
  companyProfile: CompanyProfile;
  portfolioSnapshot: PortfolioSnapshot | null;
  previousOpportunitySearch: MarketOpportunityPayload | null;
  previousOpportunitySearchId?: string;
};

export type OpportunitySearchRequest = {
  orgId: string;
  portfolioSnapshotId?: string;
  context: OpportunitySearchContext;
};

export type StrategyPayload = {
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

export type CalendarItem = {
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

export type BriefItem = {
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
  sourceType?: string | null;
  editorialQuestion?: string | null;
  whyNow?: string | null;
  contentFormat?: string | null;
  manualTopic?: string | null;
  priority?: number | null;
  guardrails?: string[];
  territorialFocus?: string[];
  sourceSignals?: {
    portfolioRegions?: string[];
    portfolioCities?: string[];
    portfolioSegments?: string[];
    opportunityTitles?: string[];
    opportunityScopes?: string[];
    opportunityRegions?: string[];
    calendarTitle?: string;
    calendarScope?: string;
    calendarTheme?: string;
    calendarAngle?: string;
    strategyPillars?: string[];
  };
  requiredSources?: {
    kb?: boolean;
    web?: boolean;
    projectFacts?: boolean;
  };
  scheduledAt?: string | null;
  status?: string;
};

export type EditorialSuggestionCategory = "Mercado" | "Produto" | "Autoridade" | "Indicadores";

export type EditorialSuggestion = {
  id: string;
  category: EditorialSuggestionCategory;
  label: string;
  rationale: string;
  evidence: string[];
};

export const emptyProfile: CompanyProfile = {
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

export function toLines(value: string[]): string {
  return value.join("\n");
}

export function fromLines(value: string): string[] {
  return value
    .split(/\r?\n|,|;/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function uniqueStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const value of values) {
    const normalized = String(value || "").trim();
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(normalized);
  }

  return output;
}

export function normalizeLookupText(value: string): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function compactEvidence(values: string[]): string[] {
  return uniqueStrings(values).slice(0, 4);
}

