import type { Timestamp } from "firebase-admin/firestore";

export type StudioTheme =
  | "tokenizacao"
  | "resultados_trimestrais"
  | "lancamentos"
  | "hub_weekly"
  | "educativo";

export type StudioChannel =
  | "blog"
  | "instagram"
  | "stories"
  | "reels"
  | "newsletter";

export type StudioStatus =
  | "idea"
  | "draft"
  | "review"
  | "approved"
  | "scheduled"
  | "published";

export type StudioScheduleItem = {
  id: string;
  orgId: string;
  title: string;
  theme: StudioTheme;
  channel: StudioChannel;
  status: StudioStatus;
  scheduledAt?: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  guardrailScore?: number | null;
};

export type StudioScheduleItemDTO = Omit<
  StudioScheduleItem,
  "scheduledAt" | "createdAt" | "updatedAt"
> & {
  scheduledAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type StudioScheduleItemInput = {
  title: string;
  theme: StudioTheme;
  channel: StudioChannel;
  status: StudioStatus;
  orgId?: string;
  scheduledAt?: Timestamp | null;
  guardrailScore?: number | null;
};

export type StudioScheduleItemUpdate = Partial<
  Pick<
    StudioScheduleItemInput,
    "title" | "theme" | "channel" | "status" | "scheduledAt" | "guardrailScore"
  >
>;

export type StudioJobType = "generate_draft" | "generate_month_ideas";
export type StudioJobStatus = "queued" | "processing" | "done" | "failed";

export type StudioJob = {
  id: string;
  orgId: string;
  scheduleItemId?: string;
  type: StudioJobType;
  status: StudioJobStatus;
  payload?: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: string | null;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
};

export type StudioPillarSetting = {
  key: StudioTheme;
  enabled: boolean;
  weight?: number | null;
};

export type StudioCadence = Record<StudioChannel, number>;

export type StudioEditorialSettings = {
  id: string;
  orgId: string;
  pillars: StudioPillarSetting[];
  cadence: StudioCadence;
  tone: string;
  guardrails: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type StudioEditorialSettingsDTO = Omit<
  StudioEditorialSettings,
  "createdAt" | "updatedAt"
> & {
  createdAt: string;
  updatedAt: string;
};

export type StudioSuggestion = {
  title: string;
  theme: StudioTheme;
  channel: StudioChannel;
  scheduledAt: string;
  rationale?: string;
};
