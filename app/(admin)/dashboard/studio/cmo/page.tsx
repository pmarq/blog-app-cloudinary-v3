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
  sourceType?: string | null;
  editorialQuestion?: string | null;
  whyNow?: string | null;
  contentFormat?: string | null;
  manualTopic?: string | null;
  priority?: number | null;
  guardrails?: string[];
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

function uniqueStrings(values: Array<string | null | undefined>): string[] {
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

type EditorialSuggestionCategory = "Mercado" | "Produto" | "Autoridade" | "Indicadores";

type EditorialSuggestion = {
  id: string;
  category: EditorialSuggestionCategory;
  label: string;
  rationale: string;
  evidence: string[];
};

function normalizeLookupText(value: string): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function compactEvidence(values: string[]): string[] {
  return uniqueStrings(values).slice(0, 4);
}

function buildTerritorialRanking(values: string[]): string[] {
  const counts = new Map<string, number>();
  const order: string[] = [];

  for (const value of values) {
    const normalized = normalizeLookupText(value);
    if (!normalized || isPlaceholderTopic(normalized)) continue;

    if (!counts.has(normalized)) {
      counts.set(normalized, 0);
      order.push(normalized);
    }
    counts.set(normalized, (counts.get(normalized) || 0) + 1);
  }

  return order
    .map((value, index) => ({
      value,
      score: counts.get(value) || 0,
      index,
    }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map((entry) => entry.value);
}

function pickRankedValues(values: string[], startIndex: number, count: number): string[] {
  const items = uniqueStrings(values).filter((value) => !isPlaceholderTopic(value));
  if (!items.length || count <= 0) return [];

  return Array.from({ length: Math.min(count, items.length) }, (_, index) => {
    const position = startIndex + index;
    return items[position % items.length];
  });
}

function isPlaceholderTopic(value: string): boolean {
  const text = normalizeLookupText(value);
  if (!text) return true;

  const bannedPhrases = [
    "publico principal",
    "objetivo principal",
    "regioes prioritarias",
    "segmentos de atuacao",
    "mercado imobiliario de alto padrao",
    "empreendimentos residenciais de alto padrao",
    "pauta-base sem detalhamento",
    "pauta base sem detalhamento",
  ];

  return bannedPhrases.some((phrase) => text.includes(phrase));
}

function isConcreteEditorialPhrase(value: string, anchors: string[]): boolean {
  const text = normalizeLookupText(value);
  if (!text || isPlaceholderTopic(value)) return false;

  const concreteMarkers = [
    "bairro",
    "bairros",
    "empreendimento",
    "empreendimentos",
    "projeto",
    "projetos",
    "lancamento",
    "lancamentos",
    "condominio",
    "condominio-clube",
    "incc",
    "selic",
    "juros",
    "credito",
    "b3",
    "demanda",
    "estoque",
    "incorporadora",
    "construtora",
    "upgrade",
    "comparativo",
    "planta",
    "patrimonial",
    "premium",
    "alto padrao",
  ];

  return (
    concreteMarkers.some((marker) => text.includes(marker)) ||
    anchors.some((anchor) => {
      const normalizedAnchor = normalizeLookupText(anchor);
      return Boolean(normalizedAnchor && text.includes(normalizedAnchor));
    })
  );
}

function titleCase(value: string): string {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/(^|\s)(\S)/g, (match) => match.toUpperCase());
}

function formatSignalLabel(value: string): string {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  if (/^[A-Z0-9&/-]{2,}$/.test(trimmed.replace(/\s+/g, ""))) {
    return trimmed.toUpperCase();
  }
  return titleCase(trimmed);
}

function buildEditorialSuggestions({
  companyProfile,
  portfolioSnapshot,
  opportunitySearch,
  strategy,
  calendarItems,
}: {
  companyProfile: CompanyProfile;
  portfolioSnapshot: PortfolioSnapshot | null;
  opportunitySearch: MarketOpportunityPayload | null;
  strategy: StrategyPayload | null;
  calendarItems: CalendarItem[];
}): EditorialSuggestion[] {
  const suggestions: EditorialSuggestion[] = [];
  const seen = new Set<string>();

  const addSuggestion = (
    category: EditorialSuggestionCategory,
    label: string,
    rationale: string,
    evidence: string[],
  ) => {
    const normalizedLabel = String(label || "").trim().replace(/\s+/g, " ");
    if (!normalizedLabel || normalizedLabel.length < 18) return;
    if (isPlaceholderTopic(normalizedLabel)) return;

    const key = `${category}|${normalizeLookupText(normalizedLabel)}`;
    if (seen.has(key)) return;

    seen.add(key);
    suggestions.push({
      id: key,
      category,
      label: titleCase(normalizedLabel),
      rationale,
      evidence: compactEvidence(evidence),
    });
  };

  const profileRegions = buildTerritorialRanking([
    ...(companyProfile.regions || []),
    ...(portfolioSnapshot?.mainNeighborhoods || []),
    ...(portfolioSnapshot?.mainCities || []),
  ]).filter((value) => {
    const normalized = normalizeLookupText(value);
    return (
      normalized &&
      !normalized.includes("prioritaria") &&
      !normalized.includes("prioritarias") &&
      !normalized.includes("ampliada") &&
      !normalized.includes("ampliado")
    );
  });
  const productSegments = uniqueStrings([
    ...(portfolioSnapshot?.mainSegments || []),
    ...(companyProfile.marketSegment || []),
  ]).filter((value) => normalizeLookupText(value).length > 3);

  const productAttributes = uniqueStrings([
    ...(portfolioSnapshot?.commonAttributes || []),
    ...(companyProfile.preferredTopics || []),
    ...(strategy?.contentPillars || []),
  ]).filter((value) => normalizeLookupText(value).length > 3);

  const marketSignals = uniqueStrings(strategy?.marketSignals || []).filter(
    (value) => normalizeLookupText(value).length > 1,
  );

  const marketOpportunities = uniqueStrings(
    (opportunitySearch?.opportunities || []).flatMap((opportunity) => [
      opportunity?.title || "",
      opportunity?.scope || "",
      ...(opportunity?.suggestedContents || []),
    ]),
  ).filter((value) =>
    isConcreteEditorialPhrase(value, [
      ...profileRegions,
      ...productSegments,
      ...marketSignals,
    ]),
  );

  const calendarThemes = uniqueStrings(
    calendarItems.flatMap((item) => [
      item.title || "",
      item.theme || "",
      item.scope || "",
      item.angle || "",
      item.objective || "",
    ]),
  ).filter((value) =>
    isConcreteEditorialPhrase(value, [
      ...profileRegions,
      ...productSegments,
      ...marketSignals,
    ]),
  );

  const segment =
    productSegments.find((value) =>
      /condominio|club|lancamento|boutique|alto padrao|premium|luxo|residencial|upgrade/i.test(
        normalizeLookupText(value),
      ),
    ) || productSegments[0] || "empreendimentos premium";
  const attribute =
    productAttributes.find((value) =>
      /condominio|club|lazer|servico|boutique|arquitetura|design|paisag|incc|estoque|demanda|preco|valor/i.test(
        normalizeLookupText(value),
      ),
    ) || productAttributes[0] || "alto padrão";
  const signal = marketSignals[0] || "";
  const opportunity = marketOpportunities[0] || "";
  const calendarTheme = calendarThemes[0] || "";

  if (opportunity && profileRegions.length) {
    const [regionA, regionB] = pickRankedValues(profileRegions, 0, 2);
    addSuggestion(
      "Mercado",
      `O que ${opportunity} revela sobre ${regionA || "o mercado"} e ${regionB || regionA || "a região"}`,
      "Cruza oportunidade de mercado com mais de um bairro real.",
      [opportunity, regionA, regionB, ...(opportunitySearch?.queries || [])],
    );
  }

  if (profileRegions.length >= 2) {
    const [regionA, regionB] = pickRankedValues(profileRegions, 1, 2);
    addSuggestion(
      "Mercado",
      `Comparativo entre ${regionA} e ${regionB} para empreendimentos premium`,
      "Usa a disputa entre bairros reais como gancho editorial.",
      [regionA, regionB, ...(portfolioSnapshot?.commonAttributes || [])],
    );
  }

  if (profileRegions.length >= 3) {
    const [regionA, regionB, regionC] = pickRankedValues(profileRegions, 2, 3);
    addSuggestion(
      "Mercado",
      `Como ${regionA}, ${regionB} e ${regionC} ajudam a ler o mercado de alto padrão`,
      "Distribui a leitura entre três bairros e evita um texto preso em uma única região.",
      [regionA, regionB, regionC, ...(portfolioSnapshot?.commonAttributes || [])],
    );
  }

  if (/condominio|club/i.test(normalizeLookupText(attribute)) && profileRegions.length) {
    const [regionA] = pickRankedValues(profileRegions, 3, 1);
    addSuggestion(
      "Produto",
      `5 projetos com ${attribute} em ${regionA}`,
      "Transforma um diferencial do portfólio em pauta concreta.",
      [attribute, regionA, ...(portfolioSnapshot?.commonAttributes || [])],
    );
  }

  if (productSegments.length && profileRegions.length) {
    const [regionA, regionB] = pickRankedValues(profileRegions, 4, 2);
    addSuggestion(
      "Produto",
      `Como ler empreendimentos ${segment} em ${regionA} e ${regionB}`,
      "Conecta segmento de produto com mais de uma região concreta do portfólio.",
      [segment, regionA, regionB, ...(portfolioSnapshot?.mainSegments || [])],
    );
  }

  if (portfolioSnapshot?.activeProductsCount && profileRegions.length) {
    const [regionA, regionB] = pickRankedValues(profileRegions, 5, 2);
    addSuggestion(
      "Autoridade",
      `O que o portfólio atual em ${uniqueStrings([regionA, regionB]).join(", ")} diz sobre a estratégia da Inlevor`,
      "Usa a leitura do portfólio como peça de autoridade editorial.",
      [
        `Produtos ativos: ${portfolioSnapshot.activeProductsCount}`,
        regionA,
        regionB,
        ...(portfolioSnapshot?.strategicSummary ? [portfolioSnapshot.strategicSummary] : []),
      ],
    );
  }

  if (
    signal &&
    /incc|selic|juros|credito|b3|estoque|demanda|lancamento/i.test(
      normalizeLookupText(signal),
    )
  ) {
    addSuggestion(
      "Indicadores",
      `${formatSignalLabel(signal)}: como isso afeta a compra de um imóvel premium`,
      "Usa indicador real do plano/mercado como tema jornalístico.",
      [signal, ...(strategy?.marketSignals || [])],
    );
  }

  if (/incc/i.test(normalizeLookupText(signal)) || /incc/i.test(normalizeLookupText(calendarTheme))) {
    addSuggestion(
      "Indicadores",
      "Como o INCC afeta a aquisição na planta",
      "Tema clássico e útil para comprador de alto padrão.",
      [signal || calendarTheme, ...(strategy?.marketSignals || [])],
    );
  }

  if (
    /b3|construtora|incorporadora|resultado|balanco|trimestre/i.test(
      normalizeLookupText(signal || calendarTheme),
    )
  ) {
    addSuggestion(
      "Indicadores",
      "O que os resultados das construtoras na B3 indicam para o setor",
      "Traça um gancho de mercado com leitura financeira e setorial.",
      [signal || calendarTheme, ...(strategy?.marketSignals || [])],
    );
  }

  if (calendarTheme && profileRegions.length) {
    const [regionA] = pickRankedValues(profileRegions, 6, 1);
    addSuggestion(
      "Autoridade",
      `${calendarTheme} em ${regionA}: o que analisar antes de publicar`,
      "Conecta o calendário editorial com uma região concreta.",
      [calendarTheme, regionA, ...(calendarItems[0]?.relatedRegions || [])],
    );
  }

  if (marketOpportunities.length >= 2) {
    addSuggestion(
      "Mercado",
      `Os sinais mais fortes de mercado hoje entre ${marketOpportunities[0]} e ${marketOpportunities[1]}`,
      "Gera pauta de análise cruzando oportunidades reais.",
      [marketOpportunities[0], marketOpportunities[1]],
    );
  }

  if (!suggestions.length) {
    const fallbackTopic = profileRegions[0] || productSegments[0] || "mercado imobiliário de São Paulo";
    addSuggestion(
      "Autoridade",
      `Como ler o mercado imobiliário de alto padrão em ${fallbackTopic}`,
      "Fallback seguro quando ainda não há sinais específicos suficientes.",
      [fallbackTopic],
    );
  }

  return suggestions.slice(0, 8);
}

function groupSuggestionsByCategory(suggestions: EditorialSuggestion[]) {
  const categories: EditorialSuggestionCategory[] = [
    "Mercado",
    "Produto",
    "Autoridade",
    "Indicadores",
  ];

  return categories.map((category) => ({
    category,
      items: suggestions.filter((suggestion) => suggestion.category === category),
  }));
}

function getSuggestionChipText(suggestion: EditorialSuggestion): string {
  return suggestion.label;
}

function getCalendarItemSourceLabel(
  item: CalendarItem,
  portfolioSnapshot: PortfolioSnapshot | null,
  opportunitySearch: MarketOpportunityPayload | null,
): string {
  const itemRegions = uniqueStrings(item.relatedRegions || []);
  const portfolioRegions = uniqueStrings([
    ...(portfolioSnapshot?.mainNeighborhoods || []),
    ...(portfolioSnapshot?.mainCities || []),
  ]);
  const opportunityRegions = uniqueStrings(
    (opportunitySearch?.opportunities || []).flatMap((opportunity) => opportunity.relatedRegions || []),
  );
  const opportunityTitles = uniqueStrings(
    (opportunitySearch?.opportunities || []).map((opportunity) => opportunity.title),
  );

  const parts: string[] = [];
  if (itemRegions.some((region) => portfolioRegions.includes(region))) parts.push("portfólio");
  const matchesOpportunityTitle =
    Boolean(item.title) &&
    opportunityTitles.some((title) =>
      normalizeLookupText(item.title || "").includes(normalizeLookupText(title)),
    );
  if (itemRegions.some((region) => opportunityRegions.includes(region)) || matchesOpportunityTitle) {
    parts.push("oportunidade");
  }
  if (!parts.length && item.theme) parts.push(item.theme);
  return parts.length ? `Base: ${parts.join(" + ")}` : "Base: calendário/estratégia";
}

function getBriefSourceLabel(brief: BriefItem): string {
  const signals = brief.sourceSignals;
  if (!signals) {
    return brief.sourceType === "manual" ? "Origem: usuário" : "Origem: calendário";
  }

  const parts: string[] = [];
  if (signals.calendarTitle) parts.push("calendário");
  if (signals.portfolioRegions?.length || signals.portfolioCities?.length || signals.portfolioSegments?.length) parts.push("portfólio");
  if (signals.opportunityTitles?.length || signals.opportunityScopes?.length || signals.opportunityRegions?.length) parts.push("oportunidade");
  if (signals.strategyPillars?.length) parts.push("estratégia");

  if (!parts.length && brief.manualTopic) return "Origem: usuário + pauta manual";
  return `Origem: ${uniqueStrings(parts).join(" + ") || "calendário"}`;
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
    brief.sourceType || "",
    brief.editorialQuestion || "",
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
      title: "Crie briefs para producao",
      description: "Cada pauta vira um brief claro para orientar o texto, tom, CTA e guardrails.",
      actionLabel: "Gerar briefs",
      hint: "Brief bom reduz retrabalho na producao.",
    },
    ready: {
      eyebrow: "Fim do fluxo",
      title: "Abra a area de briefs",
      description: "Voce ja saiu do diagnostico e chegou na etapa de revisao, geracao de texto e distribuicao dos briefs.",
      actionLabel: "Abrir briefs",
      hint: "Agora a proxima tela e a de revisao editorial.",
    },
  };

  return config[stage];
}

export default function StudioCmoPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<"diagnostico" | "pautas" | "revisao">("diagnostico");
  const [activePautaView, setActivePautaView] = useState<"ia" | "usuario">("ia");
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
  const [manualTopics, setManualTopics] = useState("");

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
  const pautaIaItems = useMemo(
    () =>
      uniqueBriefItems.filter(
        (brief) => String(brief.sourceType || "").trim().toLowerCase() !== "manual",
      ),
    [uniqueBriefItems],
  );
  const pautaUserItems = useMemo(
    () =>
      uniqueBriefItems.filter(
        (brief) => String(brief.sourceType || "").trim().toLowerCase() === "manual",
      ),
    [uniqueBriefItems],
  );
  const manualTopicSuggestions = useMemo(() => fromLines(manualTopics), [manualTopics]);
  const aiTopicSuggestions = useMemo(
    () =>
      buildEditorialSuggestions({
        companyProfile,
        portfolioSnapshot,
        opportunitySearch,
        strategy,
        calendarItems,
      }),
    [calendarItems, companyProfile, opportunitySearch, portfolioSnapshot, strategy],
  );
  const aiTopicSuggestionGroups = useMemo(
    () => groupSuggestionsByCategory(aiTopicSuggestions),
    [aiTopicSuggestions],
  );
  const aiTopicSuggestionSummary = useMemo(() => {
    const regionCount = uniqueStrings([
      ...(companyProfile.regions || []),
      ...(portfolioSnapshot?.mainNeighborhoods || []),
      ...(portfolioSnapshot?.mainCities || []),
    ]).length;
    const opportunityCount = Array.isArray(opportunitySearch?.opportunities)
      ? opportunitySearch.opportunities.length
      : 0;
    const signalCount = uniqueStrings([...(strategy?.marketSignals || [])]).length;
    const calendarCount = calendarItems.length;
    const segmentCount = uniqueStrings([
      ...(portfolioSnapshot?.mainSegments || []),
      ...(companyProfile.marketSegment || []),
    ]).length;

    return `${regionCount} regiões, ${segmentCount} segmentos, ${opportunityCount} oportunidades, ${signalCount} sinais e ${calendarCount} itens de calendário`;
  }, [calendarItems.length, companyProfile.marketSegment, companyProfile.regions, opportunitySearch, portfolioSnapshot, strategy?.marketSignals]);
  const briefGenerationIssues = useMemo(() => {
    const issues: string[] = [];

    if (!hasText(companyProfile.name)) issues.push("Preencha o nome da empresa.");
    if (!hasText(companyProfile.positioning)) issues.push("Descreva o posicionamento.");
    if (!hasText(companyProfile.valueProposition)) issues.push("Explique a proposta de valor.");
    if (!companyProfile.audience.length) issues.push("Defina o público-alvo.");
    if (!strategy?.id) issues.push("Gere a estratégia antes dos briefs.");
    if (!calendarItems.length) issues.push("Gere o calendário editorial antes dos briefs.");
    if (!manualTopicSuggestions.length && !aiTopicSuggestions.length) {
      issues.push("Adicione pautas do usuário ou use sugestões IA.");
    }

    return issues;
  }, [aiTopicSuggestions, calendarItems.length, companyProfile.audience.length, companyProfile.name, companyProfile.positioning, companyProfile.valueProposition, manualTopicSuggestions.length, strategy?.id]);
  const briefGenerationReady = briefGenerationIssues.length === 0;

  const appendTopicToManualTopics = (topic: string) => {
    const nextTopics = uniqueStrings([...fromLines(manualTopics), topic]);
    setManualTopics(nextTopics.join("\n"));
    setActivePautaView("usuario");
  };

  const appendAllAiSuggestions = () => {
    const nextTopics = uniqueStrings([
      ...fromLines(manualTopics),
      ...aiTopicSuggestions.map((suggestion) => suggestion.label),
    ]);
    setManualTopics(nextTopics.join("\n"));
    setActivePautaView("usuario");
  };

  const jumpToSection = (sectionId: "diagnostico" | "pautas" | "revisao") => {
    setActiveSection(sectionId);
    if (typeof document === "undefined") return;
    document.getElementById(`cmo-${sectionId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

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
          opportunitySearchId: opportunitySearch?.id || undefined,
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
          portfolioSnapshotId: portfolioSnapshot?.id || undefined,
          opportunitySearchId: opportunitySearch?.id || undefined,
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
    if (!briefGenerationReady) {
      const message =
        "Não gerei os briefs porque o contexto ainda está fraco:\n- " +
        briefGenerationIssues.join("\n- ");
      setBriefsError(message);
      toast({ title: "Contexto insuficiente", description: briefGenerationIssues[0], variant: "destructive" });
      return;
    }

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
          portfolioSnapshotId: portfolioSnapshot?.id || undefined,
          opportunitySearchId: opportunitySearch?.id || undefined,
          itemCount: 6,
          manualTopics: fromLines(manualTopics),
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
      toast({ title: "Pautas geradas", description: "Direcionamentos editoriais mais específicos foram salvos no backend." });
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

  const openBriefEdit = (brief: BriefItem) => {
    const searchParams = new URLSearchParams({
      briefId: String(brief.id || ""),
    });

    router.push(`/dashboard/studio/cmo/briefs/${encodeURIComponent(String(brief.id || ""))}/edit?${searchParams.toString()}`);
  };

  const openBriefDraft = (brief: BriefItem) => {
    const searchParams = new URLSearchParams({
      briefId: String(brief.id || ""),
      orgId,
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

        <div className="grid gap-2 md:grid-cols-3">
          {[
            {
              key: "diagnostico",
              title: "1. Diagnóstico",
              description: "Perfil da marca, portfólio, oportunidades e estratégia.",
            },
            {
              key: "pautas",
              title: "2. Agenda",
              description: "Pautas concretas geradas a partir dos sinais reais.",
            },
            {
              key: "revisao",
              title: "3. Revisão",
              description: "Briefs, rascunho e envio para publicação.",
            },
          ].map((step) => {
            const isActive = activeSection === step.key;
            return (
              <button
                key={step.key}
                type="button"
                onClick={() => jumpToSection(step.key as "diagnostico" | "pautas" | "revisao")}
                className={`rounded border p-3 text-left transition ${
                  isActive
                    ? "border-highlight-light bg-secondary-light/20 text-highlight-light dark:border-highlight-dark dark:bg-secondary-dark/30 dark:text-highlight-dark"
                    : "border-secondary-dark/20 bg-white/20 text-secondary-dark hover:bg-secondary-light/20 dark:border-secondary-light/20 dark:bg-black/10 dark:text-secondary-light dark:hover:bg-secondary-dark/20"
                }`}
              >
                <div className="text-xs font-semibold uppercase tracking-wide">{step.title}</div>
                <div className="mt-1 text-xs opacity-80">{step.description}</div>
              </button>
            );
          })} 
        </div>

        <div className="rounded border border-secondary-dark/20 dark:border-secondary-light/20 bg-white/25 dark:bg-black/10 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="text-xs font-semibold uppercase tracking-wide text-highlight-light">
                Etapa ativa
              </div>
              <div className="text-sm font-semibold text-secondary-dark dark:text-secondary-light">
                {activeSection === "diagnostico"
                  ? "Diagnóstico"
                  : activeSection === "pautas"
                    ? "Agenda"
                    : "Revisão"}
              </div>
              <div className="text-xs text-secondary-dark/70 dark:text-secondary-light/70">
                {activeSection === "diagnostico"
                  ? "Preencha o contexto da marca para a IA sair do genérico."
                  : activeSection === "pautas"
                    ? "Veja as pautas geradas, ajuste o que estiver fraco e mantenha só o que fizer sentido."
                    : "Revise briefs, abra rascunhos e envie os melhores para a agenda."}
              </div>
            </div>
            <div className="rounded border border-secondary-dark/15 dark:border-secondary-light/15 bg-white/40 dark:bg-black/10 px-3 py-2 text-xs text-secondary-dark/70 dark:text-secondary-light/70">
              {activeSection === "diagnostico"
                ? "Próximo: gerar estratégia"
                : activeSection === "pautas"
                  ? "Próximo: revisar briefs"
                  : "Próximo: publicar ou editar"}
            </div>
          </div>
        </div>

        <section className="grid gap-3 lg:grid-cols-[1.4fr_0.9fr]">
          <div className="rounded border border-secondary-dark/20 dark:border-secondary-light/20 bg-white/30 dark:bg-black/10 p-4 space-y-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-highlight-light">
                Como esse fluxo funciona
              </div>
              <div className="mt-1 text-sm text-secondary-dark/80 dark:text-secondary-light/80">
                O Studio não gera conteúdo pronto de uma vez. Ele organiza contexto, monta agenda e só então libera a revisão.
              </div>
            </div>
            <div className="grid gap-2 md:grid-cols-3">
              {[
                {
                  title: "1. Diagnóstico",
                  text: "Você alimenta perfil, portfólio, oportunidades e direção editorial.",
                },
                {
                  title: "2. Agenda",
                  text: "A IA gera pautas concretas com base nos sinais reais do negócio.",
                },
                {
                  title: "3. Revisão",
                  text: "Você aprova, edita, abre rascunho e envia para publicação.",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded border border-secondary-dark/15 dark:border-secondary-light/15 bg-secondary-light/10 dark:bg-secondary-dark/20 p-3"
                >
                  <div className="text-xs font-semibold uppercase tracking-wide text-highlight-light">
                    {item.title}
                  </div>
                  <div className="mt-1 text-xs leading-5 text-secondary-dark/75 dark:text-secondary-light/75">
                    {item.text}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded border border-highlight-light/30 bg-highlight-light/5 p-4 space-y-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-highlight-light">
                Depois de gerar pautas
              </div>
              <div className="mt-1 text-sm text-secondary-dark/80 dark:text-secondary-light/80">
                O fluxo certo é revisar as pautas, editar o que fizer sentido e transformar as melhores em briefs.
              </div>
            </div>
            <ol className="space-y-2 text-sm text-secondary-dark dark:text-secondary-light">
              <li className="rounded border border-secondary-dark/10 dark:border-secondary-light/10 bg-white/30 dark:bg-black/10 px-3 py-2">
                1. Revisar as pautas sugeridas.
              </li>
              <li className="rounded border border-secondary-dark/10 dark:border-secondary-light/10 bg-white/30 dark:bg-black/10 px-3 py-2">
                2. Ajustar título, ângulo e objetivo.
              </li>
              <li className="rounded border border-secondary-dark/10 dark:border-secondary-light/10 bg-white/30 dark:bg-black/10 px-3 py-2">
                3. Abrir o rascunho ou enviar para a agenda.
              </li>
            </ol>
            <div className="text-xs text-secondary-dark/70 dark:text-secondary-light/70">
              Isso evita uma IA genérica e mantém a geração ancorada no contexto real do projeto.
            </div>
          </div>
        </section>

        {activeSection === "diagnostico" ? (
          <section id="cmo-diagnostico" className="grid gap-4 lg:grid-cols-2">
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
              <TextAreaField label="Objetivos comerciais" value={profileFormValue.commercialGoals} onChange={(value) => setCompanyProfile((prev) => ({ ...prev, commercialGoals: fromLines(value) }))} />
            </div>

            <details className="rounded border border-secondary-dark/15 dark:border-secondary-light/15 bg-white/30 dark:bg-black/10 p-3">
              <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-highlight-light">
                Campos avançados
              </summary>
              <div className="mt-3 grid gap-3">
                <TextAreaField label="Segmentos de atuação" value={profileFormValue.marketSegment} onChange={(value) => setCompanyProfile((prev) => ({ ...prev, marketSegment: fromLines(value) }))} />
                <TextAreaField label="Regiões atendidas" value={profileFormValue.regions} onChange={(value) => setCompanyProfile((prev) => ({ ...prev, regions: fromLines(value) }))} />
                <TextAreaField label="Assuntos proibidos" value={profileFormValue.forbiddenTopics} onChange={(value) => setCompanyProfile((prev) => ({ ...prev, forbiddenTopics: fromLines(value) }))} />
                <TextAreaField label="Assuntos preferenciais" value={profileFormValue.preferredTopics} onChange={(value) => setCompanyProfile((prev) => ({ ...prev, preferredTopics: fromLines(value) }))} />
                <TextAreaField label="Canais" value={profileFormValue.channels} onChange={(value) => setCompanyProfile((prev) => ({ ...prev, channels: fromLines(value) }))} />
              </div>
            </details>

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
                disabled={generatingBriefs || !briefGenerationReady}
                className="rounded border border-secondary-dark/30 px-4 py-2 text-sm transition hover:bg-secondary-light/20 dark:border-secondary-light/30 disabled:opacity-60"
              >
                {generatingBriefs ? "Gerando..." : "Gerar pautas + briefs"}
              </button>
            </div>

            <div className="rounded border border-secondary-dark/20 dark:border-secondary-light/20 bg-white/20 dark:bg-black/10 p-3 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-highlight-light">
                    Agenda gerada
                  </div>
                  <p className="text-xs text-secondary-dark/70 dark:text-secondary-light/70">
                    Cada item agora mostra a sua base real: portfólio, oportunidades e regiões associadas.
                  </p>
                </div>
                <div className="text-[11px] text-secondary-dark/60 dark:text-secondary-light/60">
                  {calendarItems.length} itens
                </div>
              </div>

              {calendarItems.length ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {calendarItems.map((item, index) => (
                    <div
                      key={item.id || `${item.calendarRunId || "calendar"}-${item.title || "untitled"}-${item.period || "no-period"}-${index}`}
                      className="rounded border border-secondary-dark/15 dark:border-secondary-light/15 bg-white/30 dark:bg-black/10 p-3 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="text-sm font-medium text-secondary-dark dark:text-secondary-light">
                            {item.title || "Item sem título"}
                          </div>
                          <div className="text-xs text-secondary-dark/70 dark:text-secondary-light/70">
                            {item.channel || "blog"} • {item.scope || "escopo não definido"} •{" "}
                            {item.scheduledAt ? new Date(item.scheduledAt).toLocaleDateString("pt-BR") : "sem data"}
                          </div>
                        </div>
                        <span className="rounded-full border border-secondary-dark/15 dark:border-secondary-light/15 px-2 py-0.5 text-[10px] text-secondary-dark/70 dark:text-secondary-light/70">
                          {getCalendarItemSourceLabel(item, portfolioSnapshot, opportunitySearch)}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {uniqueStrings([
                          ...(item.relatedRegions || []),
                          item.theme || "",
                          item.angle || "",
                        ])
                          .slice(0, 4)
                          .map((chip) => (
                            <span
                              key={`${item.id || item.title || "calendar"}-${chip}`}
                              className="rounded-full border border-secondary-dark/15 dark:border-secondary-light/15 bg-white/40 dark:bg-black/10 px-2 py-0.5 text-[10px] text-secondary-dark/70 dark:text-secondary-light/70"
                            >
                              {chip}
                            </span>
                          ))}
                      </div>

                      <div className="text-[11px] leading-4 text-secondary-dark/65 dark:text-secondary-light/65">
                        {item.objective || strategy?.objective || "Sem objetivo definido."}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-secondary-dark/70 dark:text-secondary-light/70">
                  Gere o calendário para visualizar a origem de cada pauta.
                </div>
              )}
            </div>
          </div>
          </section>
        ) : null}

        {activeSection === "pautas" ? (
          <div
            id="cmo-pautas"
            className="space-y-4 rounded border border-secondary-dark/20 dark:border-secondary-light/20 bg-white/30 dark:bg-black/10 p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="text-xs font-semibold uppercase tracking-wide text-highlight-light">
                  Pautas por origem
                </div>
                <p className="text-sm text-secondary-dark/80 dark:text-secondary-light/80">
                  A IA sugere pautas com base no contexto real. O usuário completa o que fizer sentido e ignora o resto.
                </p>
                <div className="text-[11px] text-secondary-dark/60 dark:text-secondary-light/60">
                  Base usada: {aiTopicSuggestionSummary}
                </div>
              </div>
              <button
                type="button"
                onClick={appendAllAiSuggestions}
                disabled={!aiTopicSuggestions.length}
                className="rounded border border-highlight-light px-3 py-2 text-xs font-semibold text-highlight-light transition hover:bg-secondary-light/20 disabled:opacity-60"
              >
                Usar todas as sugestões IA
              </button>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-3">
                <div className="rounded border border-secondary-dark/20 dark:border-secondary-light/20 bg-white/20 dark:bg-black/10 p-3 space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-highlight-light">
                    Sugestões IA
                  </div>
                  <div className="text-xs text-secondary-dark/70 dark:text-secondary-light/70">
                    Ideias mais úteis para o blog, com base em portfólio, oportunidades e agenda.
                  </div>
                </div>

                {aiTopicSuggestions.length ? (
                  <div className="space-y-2">
                    {aiTopicSuggestions.map((suggestion) => (
                      <button
                        key={suggestion.id}
                        type="button"
                        onClick={() => appendTopicToManualTopics(suggestion.label)}
                        className="w-full rounded border border-secondary-dark/20 dark:border-secondary-light/20 bg-white/20 dark:bg-black/10 px-3 py-3 text-left transition hover:bg-secondary-light/20 dark:hover:bg-secondary-dark/30"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-sm font-medium text-secondary-dark dark:text-secondary-light">
                            + {getSuggestionChipText(suggestion)}
                          </div>
                          <span className="rounded-full border border-secondary-dark/15 dark:border-secondary-light/15 px-2 py-0.5 text-[10px] text-secondary-dark/60 dark:text-secondary-light/60">
                            adicionar
                          </span>
                        </div>
                        <div className="mt-1 text-[11px] leading-4 text-secondary-dark/70 dark:text-secondary-light/70">
                          {suggestion.rationale}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {suggestion.evidence.slice(0, 3).map((evidence, evidenceIndex) => (
                            <span
                              key={`${suggestion.id}-evidence-${evidenceIndex}`}
                              className="rounded-full border border-secondary-dark/15 dark:border-secondary-light/15 bg-white/30 dark:bg-black/10 px-2 py-0.5 text-[10px] text-secondary-dark/70 dark:text-secondary-light/70"
                            >
                              {evidence}
                            </span>
                          ))}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="rounded border border-dashed border-secondary-dark/20 dark:border-secondary-light/20 p-3 text-xs text-secondary-dark/70 dark:text-secondary-light/70">
                    Complete o contexto para gerar sugestões mais precisas.
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="rounded border border-secondary-dark/20 dark:border-secondary-light/20 bg-white/20 dark:bg-black/10 p-3 space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-highlight-light">
                    Pautas do usuário
                  </div>
                  <div className="text-xs text-secondary-dark/70 dark:text-secondary-light/70">
                    Aqui entram as pautas que você quer forçar no plano editorial.
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs text-secondary-dark/70 dark:text-secondary-light/70">
                    Uma pauta por linha.
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setManualTopics(
                        [
                          "Upgrade residencial em bairros nobres",
                          "Comparativo entre empreendimentos premium",
                          "Como analisar um lançamento sem cair em hype",
                        ].join("\n"),
                      )
                    }
                    className="rounded border border-secondary-dark/20 px-3 py-1 text-xs transition hover:bg-secondary-light/20 dark:border-secondary-light/20"
                  >
                    Usar exemplos
                  </button>
                </div>

                <TextAreaField label="Pautas sugeridas" value={manualTopics} onChange={setManualTopics} rows={6} />

                <div className="rounded border border-secondary-dark/20 dark:border-secondary-light/20 bg-white/20 dark:bg-black/10 p-3 space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-highlight-light">
                    Pré-visualização
                  </div>
                  {manualTopicSuggestions.length ? (
                    <ul className="space-y-1 text-sm text-secondary-dark dark:text-secondary-light">
                      {manualTopicSuggestions.map((topic, index) => (
                        <li key={`${topic}-${index}`} className="rounded border border-secondary-dark/10 px-2 py-1">
                          {topic}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-xs text-secondary-dark/70 dark:text-secondary-light/70">
                      Nenhuma pauta sugerida pelo usuário ainda.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {activeSection === "revisao" ? (
          <>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded border border-secondary-dark/20 dark:border-secondary-light/20 bg-white/30 dark:bg-black/10 p-3 space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-highlight-light">
                  Gate de qualidade
                </div>
                {briefGenerationReady ? (
                  <div className="text-sm text-secondary-dark dark:text-secondary-light">
                    Contexto suficiente para gerar briefs com menos ruído.
                  </div>
                ) : (
                  <div className="space-y-2 text-sm text-secondary-dark dark:text-secondary-light">
                    <div>Bloqueado até resolver os pontos abaixo:</div>
                    <ul className="space-y-1 text-xs text-secondary-dark/80 dark:text-secondary-light/80">
                      {briefGenerationIssues.map((issue) => (
                        <li key={issue} className="rounded border border-secondary-dark/10 px-2 py-1">
                          {issue}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <div className="rounded border border-secondary-dark/20 dark:border-secondary-light/20 bg-white/30 dark:bg-black/10 p-3 space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-highlight-light">
                  Proxima acao
                </div>
                <div className="text-sm text-secondary-dark dark:text-secondary-light">
                  {strategy?.id
                    ? "Misturar o calendário com pautas sugeridas e gerar briefs mais específicos."
                    : "Gerar o plano CMO antes de seguir."}
                </div>
              </div>
              <div className="rounded border border-secondary-dark/20 dark:border-secondary-light/20 bg-white/30 dark:bg-black/10 p-3 space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-highlight-light">
                  Revisao
                </div>
                <div className="text-sm text-secondary-dark dark:text-secondary-light">
                  Depois disso, o usuario revisa o texto rascunho e abre o editor final.
                </div>
              </div>
            </div>

            <div id="cmo-revisao" className="space-y-4">
              <div className="rounded border border-secondary-dark/20 dark:border-secondary-light/20 bg-white/30 dark:bg-black/10 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="text-xs font-semibold uppercase tracking-wide text-highlight-light">
                      Pautas em revisão
                    </div>
                    <div className="text-sm text-secondary-dark/80 dark:text-secondary-light/80">
                      Ajuste, aprove e envie só o que realmente vale seguir adiante.
                    </div>
                  </div>
                  <div className="rounded border border-secondary-dark/15 dark:border-secondary-light/15 bg-white/40 dark:bg-black/10 px-3 py-2 text-xs text-secondary-dark/70 dark:text-secondary-light/70">
                    {uniqueBriefItems.length} brief(s)
                  </div>
                </div>

                {briefsError ? (
                  <div className="mt-3 rounded border border-red-500/40 bg-red-500/5 p-3 text-xs text-red-700 dark:text-red-300">
                    <div className="font-semibold">Erro ao gerar pautas</div>
                    <pre className="mt-2 whitespace-pre-wrap break-words">{briefsError}</pre>
                  </div>
                ) : null}
              </div>

              {uniqueBriefItems.length ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  {uniqueBriefItems.map((brief, index) => (
                    <div
                      key={brief.id || `${brief.briefRunId || "brief"}-${brief.title || "untitled"}-${brief.period || "no-period"}-${index}`}
                      className="rounded border border-secondary-dark/20 dark:border-secondary-light/20 bg-white/20 dark:bg-black/10 p-4 space-y-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="font-medium text-secondary-dark dark:text-secondary-light">
                            {brief.title || "Brief sem titulo"}
                          </div>
                          <div className="text-xs text-secondary-dark/70 dark:text-secondary-light/70">
                            {brief.channel || "blog"} • {brief.status || "draft"} • {brief.scheduledAt || "sem data"}
                          </div>
                          <div className="text-xs text-secondary-dark/70 dark:text-secondary-light/70">
                            {brief.objective || "Sem objetivo definido."}
                          </div>
                        </div>
                        <span className="rounded-full border border-secondary-dark/15 dark:border-secondary-light/15 px-2 py-0.5 text-[10px] text-secondary-dark/70 dark:text-secondary-light/70">
                          {getBriefSourceLabel(brief)}
                        </span>
                      </div>

                      {brief.sourceSignals ? (
                        <div className="flex flex-wrap gap-1.5">
                          {uniqueStrings([
                            ...(brief.sourceSignals.calendarTitle ? [brief.sourceSignals.calendarTitle] : []),
                            ...(brief.sourceSignals.calendarScope ? [brief.sourceSignals.calendarScope] : []),
                            ...(brief.sourceSignals.calendarTheme ? [brief.sourceSignals.calendarTheme] : []),
                            ...(brief.sourceSignals.portfolioRegions || []),
                            ...(brief.sourceSignals.opportunityTitles || []),
                            ...(brief.sourceSignals.strategyPillars || []),
                          ])
                            .slice(0, 5)
                            .map((chip) => (
                              <span
                                key={`${brief.id || brief.title || "brief"}-${chip}`}
                                className="rounded-full border border-secondary-dark/15 dark:border-secondary-light/15 bg-white/40 dark:bg-black/10 px-2 py-0.5 text-[10px] text-secondary-dark/70 dark:text-secondary-light/70"
                              >
                                {chip}
                              </span>
                            ))}
                        </div>
                      ) : null}

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
                          onClick={() => openBriefEdit(brief)}
                          className="rounded border border-secondary-dark/30 px-3 py-1 text-xs transition hover:bg-secondary-light/20 dark:border-secondary-light/30"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => openBriefDraft(brief)}
                          className="rounded border border-secondary-dark/30 px-3 py-1 text-xs transition hover:bg-secondary-light/20 dark:border-secondary-light/30"
                        >
                          Rascunho
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded border border-dashed border-secondary-dark/20 dark:border-secondary-light/20 p-4 text-xs text-secondary-dark/70 dark:text-secondary-light/70">
                  Nenhuma pauta gerada ainda.
                </div>
              )}
            </div>
          </>
        ) : null}
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
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  return (
    <label className="space-y-1">
      <div className="text-xs font-semibold text-secondary-dark dark:text-secondary-light">
        {label}
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
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
        {formatJson(value) || "â€”"}
      </pre>
    </div>
  );
}




