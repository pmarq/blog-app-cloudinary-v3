import { Timestamp } from "firebase-admin/firestore";

import { firestore } from "@/firebase/server";
import type {
  StudioCadence,
  StudioEditorialSettings,
  StudioEditorialSettingsDTO,
  StudioPillarSetting,
  StudioTheme,
} from "./types";

const SETTINGS_COLLECTION = "studio_settings";
const EDITORIAL_DOC_ID = "default_editorial";
const DEFAULT_ORG_ID = "org_inlevor";

function normalizeStudioOrgId(value: string | null | undefined): string {
  const trimmed = String(value || "").trim();
  if (!trimmed) return DEFAULT_ORG_ID;
  const lowered = trimmed.toLowerCase();
  if (lowered === "default" || lowered === "inlevor" || lowered === "org-inlevor") {
    return DEFAULT_ORG_ID;
  }
  return trimmed;
}

const PILLAR_ORDER: StudioTheme[] = [
  "tokenizacao",
  "resultados_trimestrais",
  "lancamentos",
  "hub_weekly",
  "educativo",
];

const DEFAULT_PILLARS: StudioPillarSetting[] = PILLAR_ORDER.map((key) => ({
  key,
  enabled: true,
  weight: 20,
}));

const DEFAULT_CADENCE: StudioCadence = {
  blog: 1,
  instagram: 3,
  stories: 4,
  reels: 2,
  newsletter: 1,
};

const DEFAULT_GUARDRAILS = [
  "Nao prometer rentabilidade.",
  "Nao usar numeros sem fonte.",
  "Evitar linguagem sensacionalista.",
];

export type StudioEditorialSettingsInput = {
  pillars: StudioPillarSetting[];
  cadence: StudioCadence;
  tone: string;
  guardrails: string[];
};

function normalizePillars(pillars: StudioPillarSetting[]): StudioPillarSetting[] {
  const map = new Map(pillars.map((pillar) => [pillar.key, pillar]));
  return PILLAR_ORDER.map((key) => {
    const pillar = map.get(key);
    const weight = pillar?.weight;
    const normalizedWeight =
      typeof weight === "number" && weight >= 0 && weight <= 100
        ? weight
        : null;

    return {
      key,
      enabled: pillar?.enabled ?? true,
      weight: normalizedWeight,
    };
  });
}

function normalizeGuardrails(guardrails: string[]): string[] {
  return guardrails
    .map((rule) => rule.trim())
    .filter((rule) => rule.length > 0);
}

function normalizeTone(tone: string): string {
  const trimmed = tone.trim();
  return trimmed || "premium";
}

function buildDefaultSettings(now: Timestamp): StudioEditorialSettings {
  return {
    id: EDITORIAL_DOC_ID,
    orgId: DEFAULT_ORG_ID,
    pillars: DEFAULT_PILLARS,
    cadence: DEFAULT_CADENCE,
    tone: "premium",
    guardrails: DEFAULT_GUARDRAILS,
    createdAt: now,
    updatedAt: now,
  };
}

export function serializeEditorialSettings(
  settings: StudioEditorialSettings
): StudioEditorialSettingsDTO {
  return {
    ...settings,
    createdAt: settings.createdAt.toDate().toISOString(),
    updatedAt: settings.updatedAt.toDate().toISOString(),
  };
}

export async function getEditorialSettings(): Promise<StudioEditorialSettings> {
  const ref = firestore.collection(SETTINGS_COLLECTION).doc(EDITORIAL_DOC_ID);
  const snapshot = await ref.get();

  if (!snapshot.exists) {
    const now = Timestamp.now();
    const defaults = buildDefaultSettings(now);
    await ref.set(defaults);
    return defaults;
  }

  const data = snapshot.data() as StudioEditorialSettings;
  return {
    ...data,
    id: data.id || snapshot.id,
    orgId: normalizeStudioOrgId(data.orgId),
    pillars: normalizePillars(data.pillars || DEFAULT_PILLARS),
    cadence: data.cadence || DEFAULT_CADENCE,
    tone: normalizeTone(data.tone || "premium"),
    guardrails: normalizeGuardrails(data.guardrails || DEFAULT_GUARDRAILS),
    createdAt: data.createdAt || Timestamp.now(),
    updatedAt: data.updatedAt || Timestamp.now(),
  };
}

export async function saveEditorialSettings(
  input: StudioEditorialSettingsInput
): Promise<StudioEditorialSettings> {
  const ref = firestore.collection(SETTINGS_COLLECTION).doc(EDITORIAL_DOC_ID);
  const snapshot = await ref.get();
  const now = Timestamp.now();

  const createdAt = snapshot.exists
    ? (snapshot.data()?.createdAt as Timestamp | undefined) || now
    : now;

  const settings: StudioEditorialSettings = {
    id: EDITORIAL_DOC_ID,
    orgId: normalizeStudioOrgId(DEFAULT_ORG_ID),
    pillars: normalizePillars(input.pillars),
    cadence: input.cadence,
    tone: normalizeTone(input.tone),
    guardrails: normalizeGuardrails(input.guardrails),
    createdAt,
    updatedAt: now,
  };

  await ref.set(settings, { merge: true });

  return settings;
}

export async function resetEditorialSettings(): Promise<StudioEditorialSettings> {
  const now = Timestamp.now();
  const defaults = buildDefaultSettings(now);
  const ref = firestore.collection(SETTINGS_COLLECTION).doc(EDITORIAL_DOC_ID);
  await ref.set(defaults, { merge: true });
  return defaults;
}
