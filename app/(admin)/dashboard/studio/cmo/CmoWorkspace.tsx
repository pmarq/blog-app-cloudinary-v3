"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AdminLayout from "@/app/components/layout/AdminLayout";
import StudioNav from "@/app/components/admin/StudioNav";
import { useToast } from "@/hooks/use-toast";
import { DEFAULT_ORG_ID } from "@/lib/studio/org";
import {
  type BriefItem,
  type CalendarItem,
  type CompanyProfile,
  type EditorialSuggestion,
  type EditorialSuggestionCategory,
  type MarketOpportunityPayload,
  type PortfolioSnapshot,
  type StrategyPayload,
  buildPortfolioSnapshotFrame,
  compactEvidence,
  emptyProfile,
  fromLines,
  normalizeLookupText,
  toLines,
  uniqueStrings,
} from "./cmo-domain";
import { createCmoClient } from "./cmo-client";
import { CmoDiagnosticSection } from "./CmoDiagnosticSection";
import { CmoPautasSection } from "./CmoPautasSection";
import { CmoSectionTabs } from "./CmoSectionTabs";
import { CmoReviewSection } from "./CmoReviewSection";
import { CmoWorkspaceHeader } from "./CmoWorkspaceHeader";

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

type EditorialGapSuggestion = {
  key: string;
  label: string;
  prompt: string;
};

type EditorialMixBucket = "territorio" | "produto" | "autoridade" | "institucional";

type EditorialMixSummary = {
  key: EditorialMixBucket;
  label: string;
  target: number;
  actual: number;
  count: number;
};

type EditorialPresetKey = "balanced" | "premium" | "market" | "technology" | "authority";

type EditorialPreset = {
  label: string;
  description: string;
  focusDomains: string[];
  seedThemes: string[];
  mixTargets: {
    territorio: number;
    produto: number;
    autoridade: number;
    institucional: number;
  };
  preferredTopics: string[];
};

type ProfileTextareaFormValue = {
  audience: string;
  commercialGoals: string;
  marketSegment: string;
  regions: string;
  forbiddenTopics: string;
  preferredTopics: string;
  channels: string;
  editorialFocusDomains: string;
  editorialSeedThemes: string;
  editorialMixTargets: string;
};

function buildProfileTextareaFormValue(profile: CompanyProfile): ProfileTextareaFormValue {
  return {
    audience: toLines(profile.audience),
    commercialGoals: toLines(profile.commercialGoals),
    marketSegment: toLines(profile.marketSegment),
    regions: toLines(profile.regions),
    forbiddenTopics: toLines(profile.forbiddenTopics),
    preferredTopics: toLines(profile.preferredTopics),
    channels: toLines(profile.channels),
    editorialFocusDomains: toLines(profile.editorialConfig?.focusDomains || []),
    editorialSeedThemes: toLines(profile.editorialConfig?.seedThemes || []),
    editorialMixTargets: formatEditorialMixTargets(profile.editorialConfig?.mixTargets),
  };
}

const EDITORIAL_PRESETS: Record<EditorialPresetKey, EditorialPreset> = {
  balanced: {
    label: "Equilibrado",
    description: "Combina mercado, produto, autoridade e território.",
    focusDomains: ["mercado", "produto", "autoridade", "território"],
    seedThemes: ["portfólio", "qualidade construtiva", "mercado premium"],
    mixTargets: { territorio: 35, produto: 30, autoridade: 25, institucional: 10 },
    preferredTopics: ["mercado imobiliário", "upgrade residencial", "portfólio"],
  },
  premium: {
    label: "Mercado premium",
    description: "Foco em alto padrão, percepção de valor e diferenciação.",
    focusDomains: ["branding", "produto", "arquitetura", "mercado"],
    seedThemes: ["mercado premium", "arquitetura", "qualidade construtiva"],
    mixTargets: { territorio: 25, produto: 35, autoridade: 30, institucional: 10 },
    preferredTopics: ["mercado premium", "alto padrão", "valor percebido"],
  },
  market: {
    label: "Mercado e portfólio",
    description: "Tese comercial, demanda, mix e leitura de portfólio.",
    focusDomains: ["mercado", "economia", "branding"],
    seedThemes: ["portfólio", "tese comercial", "economia"],
    mixTargets: { territorio: 25, produto: 25, autoridade: 35, institucional: 15 },
    preferredTopics: ["portfólio", "tese comercial", "demanda"],
  },
  technology: {
    label: "Tecnologia",
    description: "Blockchain, IA, inovação e transformação digital.",
    focusDomains: ["tecnologia", "mercado", "branding"],
    seedThemes: ["blockchain", "tokenização", "inteligência artificial"],
    mixTargets: { territorio: 20, produto: 20, autoridade: 50, institucional: 10 },
    preferredTopics: ["blockchain", "tokenização", "proptech"],
  },
  authority: {
    label: "Autoridade",
    description: "Construtoras, B3, economia e sinais de mercado.",
    focusDomains: ["construtoras", "economia", "branding"],
    seedThemes: ["B3", "construtoras", "juros"],
    mixTargets: { territorio: 20, produto: 20, autoridade: 50, institucional: 10 },
    preferredTopics: ["construtoras", "B3", "juros"],
  },
};

function inferEditorialPresetKey({
  companyProfile,
  portfolioSnapshot,
}: {
  companyProfile: CompanyProfile;
  portfolioSnapshot: PortfolioSnapshot | null;
}): { key: EditorialPresetKey; label: string; reason: string; segmentLabel: string; signals: string[] } {
  const contextText = normalizeLookupText(
    [
      ...(companyProfile.preferredTopics || []),
      ...(companyProfile.marketSegment || []),
      ...(companyProfile.commercialGoals || []),
      ...(companyProfile.editorialConfig?.seedThemes || []),
      ...(portfolioSnapshot?.commonAttributes || []),
      ...(portfolioSnapshot?.mainSegments || []),
      ...(portfolioSnapshot?.strategicSummary ? [portfolioSnapshot.strategicSummary] : []),
    ].join(" | "),
  );
  const signals: string[] = [];

  const pushSignal = (value: string) => {
    if (!signals.includes(value)) signals.push(value);
  };

  const has = (value: string) => contextText.includes(normalizeLookupText(value));

  if (has("alto padrão") || has("alto padrao") || has("premium") || has("luxo")) {
    pushSignal("alto padrão");
  }
  if (has("construtora") || has("incorporadora") || has("b3") || has("bolsa")) {
    pushSignal("construtoras / B3");
  }
  if (has("juros") || has("selic") || has("credito") || has("crédito") || has("incc")) {
    pushSignal("economia / crédito");
  }
  if (has("blockchain") || has("token") || has("ia") || has("proptech")) {
    pushSignal("tecnologia");
  }
  if (has("arquitet") || has("design") || has("interiores")) {
    pushSignal("arquitetura / interiores");
  }
  if (has("portfólio") || has("portfolio") || has("tese comercial") || has("mix")) {
    pushSignal("portfólio / tese");
  }

  if (
    contextText.includes("blockchain") ||
    contextText.includes("token") ||
    contextText.includes("ia") ||
    contextText.includes("proptech")
  ) {
    return {
      key: "technology",
      label: EDITORIAL_PRESETS.technology.label,
      reason: "Há sinais de tecnologia, inovação ou proptech no contexto.",
      segmentLabel: "Tecnologia",
      signals,
    };
  }

  if (
    contextText.includes("b3") ||
    contextText.includes("construtora") ||
    contextText.includes("incorporadora") ||
    contextText.includes("juros") ||
    contextText.includes("credito") ||
    contextText.includes("economia")
  ) {
    return {
      key: "authority",
      label: EDITORIAL_PRESETS.authority.label,
      reason: "O contexto favorece leitura de mercado, construtoras e economia.",
      segmentLabel: "Construtoras / mercado",
      signals,
    };
  }

  if (
    contextText.includes("premium") ||
    contextText.includes("alto padrão") ||
    contextText.includes("luxo") ||
    contextText.includes("arquitet") ||
    contextText.includes("design") ||
    contextText.includes("interiores")
  ) {
    return {
      key: "premium",
      label: EDITORIAL_PRESETS.premium.label,
      reason: "O portfólio aponta para alto padrão, design ou diferenciação de valor.",
      segmentLabel: "Alto padrão / premium",
      signals,
    };
  }

  if (contextText.includes("portfólio") || contextText.includes("tese comercial") || contextText.includes("mix")) {
    return {
      key: "market",
      label: EDITORIAL_PRESETS.market.label,
      reason: "O contexto pede leitura comercial e análise de portfólio.",
      segmentLabel: "Portfólio / tese comercial",
      signals,
    };
  }

  if (contextText.includes("marca") || contextText.includes("branding") || contextText.includes("autoridade")) {
    return {
      key: "authority",
      label: EDITORIAL_PRESETS.authority.label,
      reason: "A marca e a autoridade aparecem como alavancas principais.",
      segmentLabel: "Marca / autoridade",
      signals,
    };
  }

  return {
    key: "balanced",
    label: EDITORIAL_PRESETS.balanced.label,
    reason: "Sem um viés dominante; o mix equilibrado é o melhor ponto de partida.",
    segmentLabel: "Equilibrado",
    signals,
  };
}

function buildRecommendedEditorialConfig(presetKey: EditorialPresetKey) {
  const preset = EDITORIAL_PRESETS[presetKey] || EDITORIAL_PRESETS.balanced;
  return {
    presetKey,
    label: preset.label,
    description: preset.description,
    focusDomains: preset.focusDomains,
    seedThemes: preset.seedThemes,
    mixTargets: preset.mixTargets,
    preferredTopics: preset.preferredTopics,
  };
}

function getOpportunityKey(
  item: {
  title?: string;
  scope?: string;
  fitScore?: number;
  editorialType?: string | null;
    id?: string;
  },
): string {
  return item.id
    ? item.id
    : [
        item.title || "",
        item.scope || "",
        item.editorialType || "",
        String(item.fitScore || ""),
      ]
        .join("|")
        .toLowerCase();
}

function dedupeOpportunityItems(
  items: Array<{
    title?: string;
    scope?: string;
    fitScore?: number;
    editorialType?: string | null;
    id?: string;
    editorialPriority?: number | null;
  }>,
) {
  const map = new Map<string, (typeof items)[number]>();

  for (const item of items) {
    const key = getOpportunityKey(item);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, item);
      continue;
    }

    const existingPriority = Number(existing.editorialPriority || 0) + Number(existing.fitScore || 0);
    const nextPriority = Number(item.editorialPriority || 0) + Number(item.fitScore || 0);
    if (nextPriority > existingPriority) {
      map.set(key, item);
    }
  }

  return [...map.entries()].map(([key, item]) => ({ key, item }));
}

function getEditorialTypeLabel(value: string | null | undefined): string {
  const normalized = String(value || "").trim().toLowerCase();
  const labels: Record<string, string> = {
    mercado: "Mercado",
    território: "Território",
    territorio: "Território",
    economia: "Economia",
    construtoras: "Construtoras",
    arquitetura: "Arquitetura",
    branding: "Branding",
    tecnologia: "Tecnologia",
    produto: "Produto",
  };
  return labels[normalized] || "Outros";
}

function parseOpportunityDisplayParts(item: {
  title?: string;
  theme?: string | null;
  editorialType?: string | null;
  relatedRegions?: string[];
}): {
  territory: string;
  macrotheme: string;
  builder: string;
  stage: string;
} {
  const title = String(item.title || "").trim();
  const relatedRegion = item.relatedRegions?.[0] || "";
  const titleMatch = title.match(/^(.*?):\s*(.*)$/);
  const regionPart = titleMatch?.[1] || relatedRegion;
  const detailPart = titleMatch?.[2] || title;
  const builderMatch = detailPart.match(/\bcom\s+(.+?)(?:\s+em\s+.+)?$/i);
  const stageMatch = detailPart.match(/\bem\s+(.+)$/i);
  const stage = stageMatch?.[1]?.trim() || "";
  const builder = builderMatch?.[1]?.replace(/\s+em\s+.+$/i, "").trim() || "";
  const macrotheme = detailPart
    .replace(/\s+com\s+.+$/i, "")
    .replace(/\s+em\s+.+$/i, "")
    .trim() || item.theme || item.editorialType || "Oportunidade";

  return {
    territory: regionPart || relatedRegion || "Geral",
    macrotheme,
    builder,
    stage,
  };
}

function formatEditorialMixTargets(mixTargets?: {
  territorio?: number;
  produto?: number;
  autoridade?: number;
  institucional?: number;
}): string {
  const targets = mixTargets || {};
  return [
    `territorio:${targets.territorio ?? 40}`,
    `produto:${targets.produto ?? 30}`,
    `autoridade:${targets.autoridade ?? 20}`,
    `institucional:${targets.institucional ?? 10}`,
  ].join("\n");
}

function parseEditorialMixTargets(value: string): {
  territorio: number;
  produto: number;
  autoridade: number;
  institucional: number;
} {
  const defaults = {
    territorio: 40,
    produto: 30,
    autoridade: 20,
    institucional: 10,
  };
  const result = { ...defaults };

  for (const line of fromLines(value)) {
    const [rawKey, rawValue] = line.split(/[:=]/).map((item) => item.trim());
    if (!rawKey || !rawValue) continue;
    const normalizedKey = normalizeLookupText(rawKey).replace(/\s+/g, "");
    const parsedValue = Number(rawValue.replace("%", "").trim());
    if (!Number.isFinite(parsedValue)) continue;

    if (normalizedKey.includes("territorio")) result.territorio = parsedValue;
    if (normalizedKey.includes("produto")) result.produto = parsedValue;
    if (normalizedKey.includes("autoridade")) result.autoridade = parsedValue;
    if (normalizedKey.includes("institucional")) result.institucional = parsedValue;
  }

  return result;
}

const EDITORIAL_GAP_HINTS: Record<string, { label: string; prompt: string }> = {
  economia: {
    label: "Economia",
    prompt: "Adicionar pauta sobre juros, crédito, INCC ou financiamento",
  },
  construtoras: {
    label: "Construtoras",
    prompt: "Adicionar análise sobre desempenho de construtoras na B3",
  },
  arquitetura: {
    label: "Arquitetura",
    prompt: "Adicionar pauta sobre design de interiores, arquitetura ou acabamento",
  },
  produto: {
    label: "Produto",
    prompt: "Adicionar pauta sobre qualidade construtiva e diferenciais do produto",
  },
  branding: {
    label: "Branding",
    prompt: "Adicionar análise de posicionamento e percepção de marca",
  },
  tecnologia: {
    label: "Tecnologia",
    prompt: "Adicionar pauta sobre blockchain, tokenização ou tecnologia aplicada",
  },
  território: {
    label: "Território",
    prompt: "Adicionar pauta territorial com bairro como recorte, não como tema único",
  },
  mercado: {
    label: "Mercado",
    prompt: "Adicionar leitura de mercado mais ampla para o público de alto padrão",
  },
};

function buildEditorialGapSuggestions(groups: Array<{ key: string; count: number }>): EditorialGapSuggestion[] {
  const countByType = new Map(groups.map((group) => [group.key, group.count]));
  const priorities = ["economia", "construtoras", "arquitetura", "produto", "branding", "tecnologia", "mercado", "território"];
  const suggestions: EditorialGapSuggestion[] = [];

  for (const type of priorities) {
    const count = countByType.get(type) || 0;
    if (count > 0) continue;
    const hint = EDITORIAL_GAP_HINTS[type];
    if (!hint) continue;
    suggestions.push({ key: type, label: hint.label, prompt: hint.prompt });
  }

  if (!suggestions.length) {
    suggestions.push({
      key: "balanced",
      label: "Cobertura equilibrada",
      prompt: "Cobertura equilibrada entre mercado, portfólio e território",
    });
  }

  return suggestions.slice(0, 4);
}

function buildThemeGapSuggestions(
  items: Array<{ title: string; theme?: string | null; editorialType?: string | null; macrotheme?: string | null }>,
): EditorialGapSuggestion[] {
  const text = normalizeLookupText(
    items.map((item) => [item.title, item.theme, item.editorialType, item.macrotheme].filter(Boolean).join(" ")).join(" | "),
  );

  const themes = [
    {
      key: "economia",
      label: "Economia e crédito",
      prompt: "Adicionar pauta sobre juros, crédito, INCC e financiamento",
      keywords: ["juros", "selic", "credito", "crédito", "incc", "financiamento", "economia"],
    },
    {
      key: "construtoras",
      label: "Construtoras e B3",
      prompt: "Adicionar análise sobre performance das construtoras na B3",
      keywords: ["b3", "bolsa", "construtora", "construtoras", "incorporadora", "balanço"],
    },
    {
      key: "arquitetura",
      label: "Arquitetura e interiores",
      prompt: "Adicionar pauta sobre design de interiores, arquitetura e acabamento",
      keywords: ["arquitetura", "interiores", "design", "paisagismo", "acabamento"],
    },
    {
      key: "produto",
      label: "Qualidade construtiva",
      prompt: "Adicionar pauta sobre qualidade construtiva e diferenciais do produto",
      keywords: ["qualidade", "obra", "patologia", "durabilidade", "performance construtiva"],
    },
    {
      key: "branding",
      label: "Branding e valor",
      prompt: "Adicionar análise sobre mercado premium e percepção de valor",
      keywords: ["branding", "marca", "premium", "alto padrão", "luxo", "valor percebido"],
    },
    {
      key: "tecnologia",
      label: "Tecnologia e inovação",
      prompt: "Adicionar pauta sobre blockchain, tokenização ou IA no imobiliário",
      keywords: ["blockchain", "token", "tokeniza", "cripto", "ia", "proptech", "inteligência artificial"],
    },
    {
      key: "portfolio",
      label: "Portfólio e tese",
      prompt: "Adicionar leitura sobre o que os dados do portfólio dizem da tese comercial",
      keywords: ["portfólio", "tese comercial", "mix", "demanda"],
    },
    {
      key: "territorio",
      label: "Território e urbanismo",
      prompt: "Adicionar pauta territorial com bairro como recorte, não como tema único",
      keywords: ["bairro", "território", "urbanismo", "mobilidade", "localização", "entorno", "sustentabilidade"],
    },
    {
      key: "macro_b3",
      label: "Macrotema: B3 e construtoras",
      prompt: "Adicionar leitura sobre performance das construtoras na B3 e impacto no mercado premium",
      keywords: ["b3 e construtoras", "performance das construtoras na b3", "construtoras e b3"],
    },
    {
      key: "macro_blockchain",
      label: "Macrotema: blockchain",
      prompt: "Adicionar leitura sobre blockchain no mercado imobiliário e tokenização",
      keywords: ["blockchain no mercado imobiliario", "tokenização imobiliária", "tecnologia aplicada ao imobiliario"],
    },
    {
      key: "macro_economia",
      label: "Macrotema: economia e crédito",
      prompt: "Adicionar leitura sobre juros, crédito e construção civil no mercado premium",
      keywords: ["economia e crédito", "juros, credito e construcao civil"],
    },
    {
      key: "macro_arquitetura",
      label: "Macrotema: arquitetura e interiores",
      prompt: "Adicionar leitura sobre arquitetura, interiores e diferenciais de produto",
      keywords: ["arquitetura e interiores", "design de interiores", "arquitetura"],
    },
  ];

  return themes
    .filter((theme) => !theme.keywords.some((keyword) => text.includes(keyword)))
    .map((theme) => ({
      key: theme.key,
      label: theme.label,
      prompt: theme.prompt,
    }))
    .slice(0, 4);
}

function getEditorialMixBucket(item: {
  editorialType?: string | null;
  theme?: string | null;
  title?: string;
}): EditorialMixBucket {
  const text = normalizeLookupText([item.editorialType, item.theme, item.title].filter(Boolean).join(" "));
  if (
    text.includes("bairro") ||
    text.includes("territ") ||
    text.includes("urbanism") ||
    text.includes("mobilidade") ||
    text.includes("localiza") ||
    text.includes("entorno")
  ) {
    return "territorio";
  }
  if (text.includes("arquitet") || text.includes("qualidade") || text.includes("obra") || text.includes("produto")) {
    return "produto";
  }
  if (
    text.includes("construtor") ||
    text.includes("incorpor") ||
    text.includes("b3") ||
    text.includes("marca") ||
    text.includes("premium") ||
    text.includes("blockchain") ||
    text.includes("tecnologia")
  ) {
    return "autoridade";
  }
  return "institucional";
}

function buildEditorialMixSummary(
  items: Array<{ editorialType?: string | null; theme?: string | null; title: string }>,
  targets: Record<EditorialMixBucket, number>,
): EditorialMixSummary[] {
  const normalizedTargets: Record<EditorialMixBucket, number> = {
    territorio: targets.territorio || 40,
    produto: targets.produto || 30,
    autoridade: targets.autoridade || 20,
    institucional: targets.institucional || 10,
  };

  const buckets: Record<EditorialMixBucket, number> = {
    territorio: 0,
    produto: 0,
    autoridade: 0,
    institucional: 0,
  };

  for (const item of items) {
    buckets[getEditorialMixBucket(item)] += 1;
  }

  const total = Math.max(items.length, 1);
  const labels: Record<EditorialMixBucket, string> = {
    territorio: "Território / bairro",
    produto: "Produto / empreendimento",
    autoridade: "Autoridade",
    institucional: "Institucional / educativo",
  };

  return (Object.keys(normalizedTargets) as EditorialMixBucket[]).map((key) => ({
    key,
    label: labels[key],
    target: normalizedTargets[key],
    actual: Math.round((buckets[key] / total) * 100),
    count: buckets[key],
  }));
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
    hasText(companyProfile.name) &&
    hasText(companyProfile.positioning) &&
    hasText(companyProfile.valueProposition) &&
    (hasItems(companyProfile.audience) || hasItems(companyProfile.regions) || hasItems(companyProfile.marketSegment));

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
      description: "Defina posicionamento, público, regiões e guardrails antes de pedir qualquer geração.",
      actionLabel: "Salvar perfil",
      hint: "Sem isso, o sistema não sabe para quem falar.",
    },
    portfolio: {
      eyebrow: "Próximo passo",
      title: "Leia o portfólio atual",
      description: "O sistema precisa entender quais produtos existem e o que eles comunicam para montar o plano.",
      actionLabel: "Analisar portfólio",
      hint: "Isso cria o diagnóstico base do mês.",
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
      title: "Gere o Plano CMO do mês",
      description: "Transforme o diagnóstico em prioridades, canais, riscos e direções editoriais.",
      actionLabel: "Gerar plano",
      hint: "Essa é a síntese estratégica do sistema.",
    },
    calendar: {
      eyebrow: "Operacao",
      title: "Monte o calendario editorial",
      description: "Converta a estrategia em pautas com datas, canais e temas definidos.",
      actionLabel: "Gerar calendario",
      hint: "Sem calendário, não existe execução previsível.",
    },
    briefs: {
      eyebrow: "Produção",
      title: "Crie briefs para produção",
      description: "Cada pauta vira um brief claro para orientar o texto, tom, CTA e guardrails.",
      actionLabel: "Gerar briefs",
      hint: "Brief bom reduz retrabalho na produção.",
    },
    ready: {
      eyebrow: "Fim do fluxo",
      title: "Abra a area de briefs",
      description: "Você já saiu do diagnóstico e chegou na etapa de revisão, geração de texto e distribuição das pautas.",
      actionLabel: "Abrir briefs",
      hint: "Agora a próxima tela é a de revisão editorial.",
    },
  };

  return config[stage];
}

function getProfileHealth(profile: CompanyProfile): {
  score: number;
  missingFields: string[];
  state: "forte" | "ok" | "incompleto";
} {
  const requiredSignals = [
    hasText(profile.name),
    hasText(profile.positioning),
    hasText(profile.valueProposition),
    hasItems(profile.audience),
    hasItems(profile.marketSegment),
    hasItems(profile.regions),
    hasText(profile.preferredTone),
    hasItems(profile.commercialGoals),
  ];

  const optionalSignals = [
    hasItems(profile.contentStyle),
    hasItems(profile.forbiddenTopics),
    hasItems(profile.preferredTopics),
    hasItems(profile.channels),
  ];

  const requiredFilled = requiredSignals.filter(Boolean).length;
  const optionalFilled = optionalSignals.filter(Boolean).length;
  const score = Math.round(
    ((requiredFilled / requiredSignals.length) * 0.75 +
      (optionalFilled / optionalSignals.length) * 0.25) *
      100,
  );

  const missingFields = [
    !hasText(profile.name) ? "nome da empresa" : null,
    !hasText(profile.positioning) ? "posicionamento" : null,
    !hasText(profile.valueProposition) ? "proposta de valor" : null,
    !hasItems(profile.audience) ? "público-alvo" : null,
    !hasItems(profile.marketSegment) ? "segmentos" : null,
    !hasItems(profile.regions) ? "regiões" : null,
    !hasText(profile.preferredTone) ? "tom de voz" : null,
    !hasItems(profile.commercialGoals) ? "objetivos comerciais" : null,
  ].filter(Boolean) as string[];

  return {
    score,
    missingFields,
    state:
      score >= 85 ? "forte" : score >= 55 ? "ok" : "incompleto",
  };
}

type CmoWorkspaceProps = {
  initialSection?: "diagnostico" | "pautas" | "revisao";
  focusId?: string;
};

export function CmoWorkspace({
  initialSection = "diagnostico",
  focusId,
}: CmoWorkspaceProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<"diagnostico" | "pautas" | "revisao">(
    initialSection,
  );
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
  const [profileTextareaFormValue, setProfileTextareaFormValue] = useState<ProfileTextareaFormValue>(
    () => buildProfileTextareaFormValue(emptyProfile),
  );
  const [portfolioSnapshot, setPortfolioSnapshot] = useState<PortfolioSnapshot | null>(null);
  const [opportunitySearch, setOpportunitySearch] = useState<MarketOpportunityPayload | null>(null);
  const [lastOpportunitySearchRequest, setLastOpportunitySearchRequest] = useState<{
    requestedAt: string;
    portfolioSnapshotId?: string;
    previousOpportunitySearchId?: string;
    previousOpportunitySearchTitle?: string;
    companyProfileName: string;
  } | null>(null);
  const [selectedOpportunityKeys, setSelectedOpportunityKeys] = useState<string[]>([]);
  const [strategy, setStrategy] = useState<StrategyPayload | null>(null);

  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7));
  const [objective, setObjective] = useState("");
  const cmoClient = useMemo(() => createCmoClient(orgId), [orgId]);

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
      editorialFocusDomains: toLines(companyProfile.editorialConfig?.focusDomains || []),
      editorialSeedThemes: toLines(companyProfile.editorialConfig?.seedThemes || []),
      editorialMixTargets: formatEditorialMixTargets(companyProfile.editorialConfig?.mixTargets),
    }),
    [companyProfile],
  );
  const recommendedEditorialPreset = useMemo(
    () => inferEditorialPresetKey({ companyProfile, portfolioSnapshot }),
    [companyProfile, portfolioSnapshot],
  );
  const recommendedEditorialConfig = useMemo(
    () => buildRecommendedEditorialConfig(recommendedEditorialPreset.key),
    [recommendedEditorialPreset.key],
  );
  const recommendedEditorialSignals = useMemo(
    () => recommendedEditorialPreset.signals,
    [recommendedEditorialPreset.signals],
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
  const territorialSnapshot = useMemo(() => buildPortfolioSnapshotFrame(portfolioSnapshot), [portfolioSnapshot]);
  const aiTopicSuggestionSummary = useMemo(() => {
    const regionCount = uniqueStrings([
      ...(companyProfile.regions || []),
      ...(portfolioSnapshot?.mainNeighborhoods || []),
      ...(portfolioSnapshot?.mainCities || []),
      ...territorialSnapshot.topNeighborhoods,
      ...territorialSnapshot.topCities,
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
  }, [calendarItems.length, companyProfile.marketSegment, companyProfile.regions, opportunitySearch, portfolioSnapshot, strategy?.marketSignals, territorialSnapshot]);
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
  const profileHealth = useMemo(() => getProfileHealth(companyProfile), [companyProfile]);
  const dashboardStats = useMemo(
    () => ({
      activeProducts: portfolioSnapshot?.activeProductsCount ?? portfolioSnapshots[0]?.activeProductsCount ?? 0,
      opportunities: Array.isArray(opportunitySearch?.opportunities)
        ? opportunitySearch.opportunities.length
        : marketOpportunityDrafts[0]?.opportunities?.length ?? 0,
      calendarItems: calendarItems.length,
      briefs: uniqueBriefItems.length,
    }),
    [calendarItems.length, marketOpportunityDrafts, opportunitySearch, portfolioSnapshot, portfolioSnapshots, uniqueBriefItems.length],
  );
  const opportunitySummary = useMemo(
    () => {
      const normalizedItems = (opportunitySearch?.opportunities || []).map((item) => {
        const key = getOpportunityKey(item);
        const editorialType = item.editorialType || "mercado";
        const displayParts = parseOpportunityDisplayParts(item);
        return {
          title: item.title || "Oportunidade",
          theme: item.theme || null,
          editorialType,
          editorialPriority: item.editorialPriority || 0,
          scope: item.scope || "mercado",
          fitScore: item.fitScore || 0,
          relatedRegions: item.relatedRegions || [],
          key,
          selected: selectedOpportunityKeys.includes(key),
          suggestedContents: item.suggestedContents || [],
          territory: displayParts.territory,
          macrotheme: displayParts.macrotheme,
          builder: displayParts.builder,
          stage: displayParts.stage,
        };
      });

      const dedupedItems = dedupeOpportunityItems(normalizedItems).map(({ key, item }) => ({
        ...item,
        title: item.title || "Oportunidade",
        scope: item.scope || "mercado",
        key,
        selected: selectedOpportunityKeys.includes(key),
      })) as Array<{
        key: string;
        selected: boolean;
        title: string;
        theme?: string | null;
        editorialType?: string | null;
        editorialPriority?: number | null;
        scope: string;
        fitScore: number;
        relatedRegions?: string[];
        suggestedContents?: string[];
        territory?: string;
        macrotheme?: string;
        builder?: string;
        stage?: string;
      }>;

      const groupedMap = new Map<string, typeof dedupedItems>();
      for (const item of dedupedItems) {
        const groupKey = String(item.editorialType || "mercado").toLowerCase();
        const groupItems = groupedMap.get(groupKey) || [];
        groupItems.push(item);
        groupedMap.set(groupKey, groupItems);
      }

      const groupOrder = ["mercado", "economia", "construtoras", "arquitetura", "produto", "branding", "tecnologia", "território", "outros"];
      const groups = groupOrder
        .map((groupKey) => {
          const groupItems = groupedMap.get(groupKey) || [];
          if (!groupItems.length) return null;
          const sortedItems = [...groupItems].sort(
            (left, right) =>
              (right.editorialPriority || 0) - (left.editorialPriority || 0) ||
              (right.fitScore || 0) - (left.fitScore || 0),
          );
          return {
            key: groupKey,
            label: getEditorialTypeLabel(groupKey),
            count: sortedItems.length,
            selectedCount: sortedItems.filter((item) => item.selected).length,
            items: sortedItems,
            averagePriority: Math.round(
              sortedItems.reduce((sum, item) => sum + (item.editorialPriority || 0), 0) /
                Math.max(sortedItems.length, 1),
            ),
          };
        })
        .filter(Boolean) as Array<{
        key: string;
        label: string;
        count: number;
        selectedCount: number;
        averagePriority: number;
        items: typeof dedupedItems;
      }>;
      const editorialGapSuggestions = [
        ...buildEditorialGapSuggestions(groups.map((group) => ({ key: group.key, count: group.count }))),
        ...buildThemeGapSuggestions(dedupedItems),
      ]
        .filter((suggestion, index, list) =>
          list.findIndex((candidate) => candidate.key === suggestion.key) === index,
        )
        .slice(0, 4);
      const macrothemeSummary = [...dedupedItems].reduce((accumulator, item) => {
        const key = String(item.macrotheme || item.theme || item.title || "Outros").trim();
        if (!key) return accumulator;
        accumulator.set(key, (accumulator.get(key) || 0) + 1);
        return accumulator;
      }, new Map<string, number>());
      const editorialMixSummary = buildEditorialMixSummary(dedupedItems, {
        territorio: companyProfile.editorialConfig?.mixTargets?.territorio || 40,
        produto: companyProfile.editorialConfig?.mixTargets?.produto || 30,
        autoridade: companyProfile.editorialConfig?.mixTargets?.autoridade || 20,
        institucional: companyProfile.editorialConfig?.mixTargets?.institucional || 10,
      });

      return {
        count: dedupedItems.length,
        selectedCount: dedupedItems.filter((item) => item.selected).length,
        items: dedupedItems,
        macrothemes: [...macrothemeSummary.entries()]
          .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
          .slice(0, 6)
          .map(([label, count]) => ({ label, count })),
        editorialGapSuggestions,
        editorialMixSummary,
        groups: [...groups].sort(
          (left, right) =>
            right.averagePriority - left.averagePriority ||
            right.count - left.count ||
            left.label.localeCompare(right.label),
        ),
      };
    },
    [opportunitySearch, selectedOpportunityKeys],
  );

  const selectedOpportunityItems = useMemo(
    () =>
      (opportunitySearch?.opportunities || []).filter((item) =>
        selectedOpportunityKeys.includes(getOpportunityKey(item)),
      ),
    [opportunitySearch, selectedOpportunityKeys],
  );

  const selectedOpportunityContext = useMemo(
    () =>
      uniqueStrings(
        selectedOpportunityItems.flatMap((item) => [
          item.title || "",
          item.scope || "",
          ...(item.relatedRegions || []),
          ...(item.suggestedContents || []),
        ]),
      ).join(" | "),
    [selectedOpportunityItems],
  );
  const cmoRunTrace = useMemo(
    () => ({
      opportunitySearchId: opportunitySearch?.id || marketOpportunityDrafts[0]?.id || null,
      strategyId: strategy?.id || strategyDrafts[0]?.id || null,
      calendarRunId: calendarItems[0]?.calendarRunId || null,
      briefRunId: briefItems[0]?.briefRunId || null,
      selectedOpportunityTitles: selectedOpportunityItems.map((item) => item.title || "").filter(Boolean),
    }),
    [briefItems, calendarItems, marketOpportunityDrafts, opportunitySearch, selectedOpportunityItems, strategy, strategyDrafts],
  );

  useEffect(() => {
    setActiveSection(initialSection);
  }, [initialSection]);

  useEffect(() => {
    if (!focusId) return;

    const element = document.getElementById(focusId);
    if (!element) return;

    element.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [focusId]);

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

  const toggleOpportunitySelection = (key: string) => {
    setSelectedOpportunityKeys((previous) =>
      previous.includes(key) ? previous.filter((item) => item !== key) : [...previous, key],
    );
  };

  const clearOpportunitySelection = () => {
    setSelectedOpportunityKeys([]);
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

  const refreshDrafts = async () => {
    setLoadingDrafts(true);
    try {
      const drafts = await cmoClient.loadDrafts();
      const nextPortfolioSnapshots = drafts.portfolioSnapshots;
      const nextOpportunityDrafts = drafts.marketOpportunityDrafts;
      const nextStrategyDrafts = drafts.strategyDrafts;
      const nextCalendarItems = drafts.calendarItems;
      const nextBriefItems = dedupeBriefItems(drafts.briefItems);

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
        const nextCompanyProfile = await cmoClient.loadCompanyProfile();
        setCompanyProfile({
          ...emptyProfile,
          ...nextCompanyProfile,
          audience: Array.isArray(nextCompanyProfile?.audience) ? nextCompanyProfile.audience : [],
          marketSegment: Array.isArray(nextCompanyProfile?.marketSegment)
            ? nextCompanyProfile.marketSegment
            : [],
          regions: Array.isArray(nextCompanyProfile?.regions) ? nextCompanyProfile.regions : [],
          contentStyle: Array.isArray(nextCompanyProfile?.contentStyle)
            ? nextCompanyProfile.contentStyle
            : [],
          forbiddenTopics: Array.isArray(nextCompanyProfile?.forbiddenTopics)
            ? nextCompanyProfile.forbiddenTopics
            : [],
          preferredTopics: Array.isArray(nextCompanyProfile?.preferredTopics)
            ? nextCompanyProfile.preferredTopics
            : [],
          commercialGoals: Array.isArray(nextCompanyProfile?.commercialGoals)
            ? nextCompanyProfile.commercialGoals
            : [],
          channels: Array.isArray(nextCompanyProfile?.channels) ? nextCompanyProfile.channels : [],
          editorialConfig: {
            focusDomains: Array.isArray(nextCompanyProfile?.editorialConfig?.focusDomains)
              ? nextCompanyProfile.editorialConfig.focusDomains
              : [],
            seedThemes: Array.isArray(nextCompanyProfile?.editorialConfig?.seedThemes)
              ? nextCompanyProfile.editorialConfig.seedThemes
              : [],
            mixTargets: {
              territorio: Number(nextCompanyProfile?.editorialConfig?.mixTargets?.territorio) || 40,
              produto: Number(nextCompanyProfile?.editorialConfig?.mixTargets?.produto) || 30,
              autoridade: Number(nextCompanyProfile?.editorialConfig?.mixTargets?.autoridade) || 20,
              institucional: Number(nextCompanyProfile?.editorialConfig?.mixTargets?.institucional) || 10,
            },
          },
        });
        setProfileTextareaFormValue(buildProfileTextareaFormValue(nextCompanyProfile || emptyProfile));
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erro ao carregar perfil.";
        toast({ title: "Erro", description: message, variant: "destructive" });
      } finally {
        setLoadingProfile(false);
      }
    };

    void loadProfile();
  }, [cmoClient, toast]);

  useEffect(() => {
    void refreshDrafts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cmoClient, toast]);

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      const nextCompanyProfile = await cmoClient.saveCompanyProfile({
        ...companyProfile,
        audience: fromLines(profileTextareaFormValue.audience),
        marketSegment: fromLines(profileTextareaFormValue.marketSegment),
        regions: fromLines(profileTextareaFormValue.regions),
        contentStyle: fromLines(profileFormValue.contentStyle),
        forbiddenTopics: fromLines(profileTextareaFormValue.forbiddenTopics),
        preferredTopics: fromLines(profileTextareaFormValue.preferredTopics),
        commercialGoals: fromLines(profileTextareaFormValue.commercialGoals),
        channels: fromLines(profileTextareaFormValue.channels),
        editorialConfig: {
          focusDomains: fromLines(profileTextareaFormValue.editorialFocusDomains),
          seedThemes: fromLines(profileTextareaFormValue.editorialSeedThemes),
          mixTargets: parseEditorialMixTargets(profileTextareaFormValue.editorialMixTargets),
        },
      });
      setCompanyProfile({
        ...emptyProfile,
        ...nextCompanyProfile,
      });
      setProfileTextareaFormValue(buildProfileTextareaFormValue(nextCompanyProfile || emptyProfile));
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
      const nextPortfolioSnapshot = await cmoClient.analyzePortfolio();
      setPortfolioSnapshot(nextPortfolioSnapshot);
      await refreshDrafts();
      toast({ title: "Portfólio analisado", description: "Snapshot atualizado." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao analisar portfólio.";
      toast({ title: "Erro", description: message, variant: "destructive" });
    } finally {
      setAnalyzingPortfolio(false);
    }
  };

  const runOpportunitySearch = async (focusEditorialTypes: string[] = []) => {
    setSearchingOpportunities(true);
    const previousOpportunitySearch = opportunitySearch || marketOpportunityDrafts[0] || null;
    setLastOpportunitySearchRequest({
      requestedAt: new Date().toISOString(),
      portfolioSnapshotId: portfolioSnapshot?.id || undefined,
      previousOpportunitySearchId: previousOpportunitySearch?.id || undefined,
      previousOpportunitySearchTitle:
        previousOpportunitySearch?.opportunities?.[0]?.title || undefined,
      companyProfileName: companyProfile.name || "Sem nome",
    });
    try {
      const nextOpportunitySearch = await cmoClient.searchOpportunities({
        portfolioSnapshotId: portfolioSnapshot?.id || undefined,
        companyProfile,
        portfolioSnapshot,
        previousOpportunitySearch,
        focusEditorialTypes,
      });
      setOpportunitySearch(nextOpportunitySearch);
      setSelectedOpportunityKeys([]);
      await refreshDrafts();
      toast({ title: "Oportunidades atualizadas", description: "Radar de mercado pronto." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao buscar oportunidades.";
      toast({ title: "Erro", description: message, variant: "destructive" });
    } finally {
      setSearchingOpportunities(false);
    }
  };

  const applyEditorialPreset = (presetKey: string) => {
    const preset = EDITORIAL_PRESETS[presetKey as EditorialPresetKey];
    if (!preset) return;

    setCompanyProfile((previous) => ({
      ...previous,
      preferredTopics: uniqueStrings([...preset.preferredTopics, ...(previous.preferredTopics || [])]),
      editorialConfig: {
        ...(previous.editorialConfig || {}),
        focusDomains: preset.focusDomains,
        seedThemes: preset.seedThemes,
        mixTargets: preset.mixTargets,
      },
    }));
    setProfileTextareaFormValue((previous) => ({
      ...previous,
      editorialFocusDomains: toLines(preset.focusDomains),
      editorialSeedThemes: toLines(preset.seedThemes),
      editorialMixTargets: formatEditorialMixTargets(preset.mixTargets),
    }));
  };

  const searchOpportunities = async () => {
    await runOpportunitySearch();
  };

  const searchOpportunitiesForEditorialGap = async (key: string) => {
    const normalizedKey = normalizeLookupText(key);
    const focusEditorialTypes = normalizedKey && normalizedKey !== "balanced" ? [normalizedKey] : [];
    await runOpportunitySearch(focusEditorialTypes);
  };

  const generateStrategy = async () => {
    setGeneratingStrategy(true);
    try {
      const selectedContext = selectedOpportunityContext
        ? `\n\nOportunidades selecionadas:\n${selectedOpportunityContext}`
        : "";
      const nextStrategy = await cmoClient.generateStrategy({
        period,
        objective: `${objective}${selectedContext}`.trim(),
        portfolioSnapshotId: portfolioSnapshot?.id || undefined,
        opportunitySearchId: opportunitySearch?.id || undefined,
      });
      setStrategy(nextStrategy);
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
      const nextCalendarItems = await cmoClient.generateCalendar({
        strategyId: strategy?.id || undefined,
        period,
        portfolioSnapshotId: portfolioSnapshot?.id || undefined,
        opportunitySearchId: opportunitySearch?.id || undefined,
      });
      setCalendarItems(nextCalendarItems);
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
      const selectedManualTopics = uniqueStrings([
        ...fromLines(manualTopics),
        ...selectedOpportunityItems.flatMap((item) => [
          item.title || "",
          ...(item.suggestedContents || []).slice(0, 2),
        ]),
      ]);
      const nextBriefItems = await cmoClient.generateBriefs({
        strategyId: strategy?.id || undefined,
        calendarRunId: calendarItems[0]?.calendarRunId || undefined,
        portfolioSnapshotId: portfolioSnapshot?.id || undefined,
        opportunitySearchId: opportunitySearch?.id || undefined,
        manualTopics: selectedManualTopics,
      });
      setBriefItems(nextBriefItems);
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
    try {
      await cmoClient.approveBrief(brief.id);
      await refreshDrafts();
      toast({ title: "Brief aprovado", description: "Status atualizado no backend." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao aprovar brief.";
      toast({ title: "Erro", description: message, variant: "destructive" });
    }
  };

  const sendBriefToAgenda = async (brief: BriefItem) => {
    if (!brief.id) return;
    try {
      await cmoClient.sendBriefToAgenda(brief);
      await refreshDrafts();
      toast({
        title: "Brief enviado para a agenda",
        description: "Item criado no calendário do Studio.",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao enviar brief para a agenda.";
      toast({ title: "Erro", description: message, variant: "destructive" });
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
      <div className="max-w-7xl space-y-6">
        <StudioNav />

        <CmoWorkspaceHeader
          cmoStage={cmoStage}
          profileScore={profileHealth.score}
          profileState={profileHealth.state}
          missingFields={profileHealth.missingFields}
          activeProducts={dashboardStats.activeProducts}
          opportunities={dashboardStats.opportunities}
          calendarItems={dashboardStats.calendarItems}
          briefs={dashboardStats.briefs}
          strategies={strategyDrafts.length}
          title={stageConfig.title}
          description={stageConfig.description}
          hint={stageConfig.hint}
          actionLabel={stageConfig.actionLabel}
          onExecuteNextStep={() => void executeNextStep()}
          onJumpToSection={jumpToSection}
          disabled={
            (cmoStage === "profile" && savingProfile) ||
            (cmoStage === "portfolio" && analyzingPortfolio) ||
            (cmoStage === "opportunities" && searchingOpportunities) ||
            (cmoStage === "strategy" && generatingStrategy) ||
            (cmoStage === "calendar" && generatingCalendar) ||
            (cmoStage === "briefs" && generatingBriefs)
          }
        />

        <CmoSectionTabs activeSection={activeSection} onChange={jumpToSection} />

        {activeSection === "diagnostico" ? (
          <CmoDiagnosticSection
            orgId={orgId}
            portfolioSnapshot={portfolioSnapshot}
            loadingProfile={loadingProfile}
            loadingDrafts={loadingDrafts}
            savingProfile={savingProfile}
            analyzingPortfolio={analyzingPortfolio}
            searchingOpportunities={searchingOpportunities}
            generatingStrategy={generatingStrategy}
            generatingCalendar={generatingCalendar}
            generatingBriefs={generatingBriefs}
            period={period}
            objective={objective}
            opportunitySearchContext={{
              runId: opportunitySearch?.id || null,
              requestedAt: lastOpportunitySearchRequest?.requestedAt || null,
              companyProfileName:
                lastOpportunitySearchRequest?.companyProfileName || companyProfile.name || "Sem nome",
              portfolioSnapshotId:
                lastOpportunitySearchRequest?.portfolioSnapshotId ||
                portfolioSnapshot?.id ||
                null,
              previousOpportunitySearchId:
                lastOpportunitySearchRequest?.previousOpportunitySearchId || null,
              previousOpportunitySearchTitle:
                lastOpportunitySearchRequest?.previousOpportunitySearchTitle || null,
              queriesCount: Array.isArray(opportunitySearch?.queries)
                ? opportunitySearch.queries.length
                : 0,
            }}
            cmoRunTrace={cmoRunTrace}
            companyProfile={companyProfile as any}
            profileFormValue={profileFormValue}
            calendarItems={calendarItems}
            strategyObjective={strategy?.objective}
            opportunitySummary={opportunitySummary}
            selectedOpportunityKeys={selectedOpportunityKeys}
            onToggleOpportunitySelection={toggleOpportunitySelection}
            onClearOpportunitySelection={clearOpportunitySelection}
            onExploreEditorialGap={searchOpportunitiesForEditorialGap}
            onApplyEditorialPreset={applyEditorialPreset}
            recommendedEditorialPreset={recommendedEditorialPreset}
            recommendedEditorialConfig={recommendedEditorialConfig}
            recommendedEditorialSignals={recommendedEditorialSignals}
            profileTextareaFormValue={profileTextareaFormValue}
            onProfileTextareaChange={setProfileTextareaFormValue}
            onProfileChange={(updater) => {
              setCompanyProfile((prev) => ({ ...prev, ...updater(prev as any) }));
            }}
            onSaveProfile={() => void saveProfile()}
            onAnalyzePortfolio={() => void analyzePortfolio()}
            onSearchOpportunities={() => void searchOpportunities()}
            onGenerateStrategy={() => void generateStrategy()}
            onGenerateCalendar={() => void generateCalendar()}
            onGenerateBriefs={() => void generateBriefs()}
            onPeriodChange={setPeriod}
            onObjectiveChange={setObjective}
            getCalendarItemSourceLabel={(item) =>
              getCalendarItemSourceLabel(item as CalendarItem, portfolioSnapshot, opportunitySearch)
            }
          />
        ) : null}

        {activeSection === "pautas" ? (
          <CmoPautasSection
            activePautaView={activePautaView}
            aiTopicSuggestionSummary={aiTopicSuggestionSummary}
            aiTopicSuggestions={aiTopicSuggestions as any}
            aiTopicSuggestionGroups={aiTopicSuggestionGroups as any}
            manualTopicSuggestions={manualTopicSuggestions}
            manualTopics={manualTopics}
            onActivePautaViewChange={setActivePautaView}
            onAppendAllAiSuggestions={appendAllAiSuggestions}
            onAppendTopic={appendTopicToManualTopics}
            onManualTopicsChange={setManualTopics}
            onUseExamples={() =>
              setManualTopics(
                [
                  "Upgrade residencial em bairros nobres",
                  "Comparativo entre empreendimentos premium",
                  "Como analisar um lançamento sem cair em hype",
                ].join("\n"),
              )
            }
            getSuggestionChipText={(suggestion) => getSuggestionChipText(suggestion as any)}
          />
        ) : null}

        {activeSection === "revisao" ? (
          <CmoReviewSection
            briefGenerationReady={briefGenerationReady}
            briefGenerationIssues={briefGenerationIssues}
            strategyId={strategy?.id}
            portfolioSnapshot={portfolioSnapshot}
            cmoRunTrace={cmoRunTrace}
            uniqueBriefItems={uniqueBriefItems as any}
            pautaIaItemsCount={pautaIaItems.length}
            pautaUserItemsCount={pautaUserItems.length}
            briefsError={briefsError}
            onApproveBrief={(brief) => void approveBrief(brief as BriefItem)}
            onSendBriefToAgenda={(brief) => void sendBriefToAgenda(brief as BriefItem)}
            onOpenBriefEdit={(brief) => openBriefEdit(brief as BriefItem)}
            onOpenBriefDraft={(brief) => openBriefDraft(brief as BriefItem)}
            getBriefSourceLabel={(brief) => getBriefSourceLabel(brief as any)}
          />
        ) : null}
      </div>
    </AdminLayout>
  );
}




