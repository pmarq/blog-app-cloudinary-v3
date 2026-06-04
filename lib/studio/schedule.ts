import { Timestamp } from "firebase-admin/firestore";

import { firestore } from "@/firebase/server";
import { DEFAULT_ORG_ID, normalizeStudioOrgId } from "./org";
import type {
  StudioJob,
  StudioScheduleItem,
  StudioScheduleItemDTO,
  StudioScheduleItemInput,
  StudioScheduleItemUpdate,
} from "./types";

const SCHEDULE_COLLECTION = "studio_schedule_items";
const JOBS_COLLECTION = "studio_jobs";

function stripUndefined<T extends Record<string, unknown>>(data: T): Partial<T> {
  const entries = Object.entries(data).filter(([, value]) => value !== undefined);
  return Object.fromEntries(entries) as Partial<T>;
}

function ensureId(item: StudioScheduleItem, fallbackId: string): StudioScheduleItem {
  if (item.id) {
    return item;
  }

  return {
    ...item,
    id: fallbackId,
  };
}

function normalizeScheduleItem(
  doc: FirebaseFirestore.QueryDocumentSnapshot
): StudioScheduleItem {
  return ensureId(doc.data() as StudioScheduleItem, doc.id);
}

export function serializeScheduleItem(
  item: StudioScheduleItem
): StudioScheduleItemDTO {
  return {
    ...item,
    scheduledAt: item.scheduledAt ? item.scheduledAt.toDate().toISOString() : null,
    createdAt: item.createdAt.toDate().toISOString(),
    updatedAt: item.updatedAt.toDate().toISOString(),
  };
}

export async function listAllItems(
  orgId = DEFAULT_ORG_ID
): Promise<StudioScheduleItem[]> {
  const snapshot = await firestore.collection(SCHEDULE_COLLECTION).get();
  const normalizedOrgId = normalizeStudioOrgId(orgId);

  return snapshot.docs
    .map(normalizeScheduleItem)
    .filter((item) => normalizeStudioOrgId(item.orgId) === normalizedOrgId);
}

export async function listWeekItems(
  startOfWeek: Date,
  endOfWeek: Date
): Promise<StudioScheduleItem[]> {
  const items = await listAllItems(DEFAULT_ORG_ID);

  return items
    .filter((item) => {
      if (!item.scheduledAt) {
        return false;
      }
      const scheduledAt = item.scheduledAt.toDate();
      return scheduledAt >= startOfWeek && scheduledAt < endOfWeek;
    })
    .sort((a, b) => a.scheduledAt!.toMillis() - b.scheduledAt!.toMillis());
}

export async function listMonthItems(
  startOfMonth: Date,
  endOfMonth: Date
): Promise<StudioScheduleItem[]> {
  const items = await listAllItems(DEFAULT_ORG_ID);

  return items
    .filter((item) => {
      if (!item.scheduledAt) {
        return false;
      }
      const scheduledAt = item.scheduledAt.toDate();
      return scheduledAt >= startOfMonth && scheduledAt < endOfMonth;
    })
    .sort((a, b) => a.scheduledAt!.toMillis() - b.scheduledAt!.toMillis());
}

export async function listBacklogItems(): Promise<StudioScheduleItem[]> {
  const items = await listAllItems(DEFAULT_ORG_ID);

  return items
    .filter((item) => !item.scheduledAt)
    .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
}

export async function createItem(
  input: StudioScheduleItemInput
): Promise<StudioScheduleItem> {
  const ref = firestore.collection(SCHEDULE_COLLECTION).doc();
  const now = Timestamp.now();

  const newItem: StudioScheduleItem = {
    id: ref.id,
    orgId: normalizeStudioOrgId(DEFAULT_ORG_ID),
    title: input.title,
    theme: input.theme,
    channel: input.channel,
    status: input.status,
    scheduledAt: input.scheduledAt ?? null,
    createdAt: now,
    updatedAt: now,
    guardrailScore: input.guardrailScore ?? null,
  };

  await ref.set(newItem);

  return newItem;
}

export async function updateItem(
  id: string,
  partial: StudioScheduleItemUpdate
): Promise<StudioScheduleItem | null> {
  const ref = firestore.collection(SCHEDULE_COLLECTION).doc(id);
  const updateData = stripUndefined({
    ...partial,
    updatedAt: Timestamp.now(),
  });

  await ref.update(updateData);

  const snapshot = await ref.get();
  if (!snapshot.exists) {
    return null;
  }

  return ensureId(snapshot.data() as StudioScheduleItem, snapshot.id);
}

export async function enqueueGenerateDraftJob(
  scheduleItemId: string
): Promise<StudioJob> {
  const ref = firestore.collection(JOBS_COLLECTION).doc();
  const job: StudioJob = {
    id: ref.id,
    orgId: normalizeStudioOrgId(DEFAULT_ORG_ID),
    scheduleItemId,
    type: "generate_draft",
    status: "queued",
    createdAt: Timestamp.now(),
  };

  await ref.set(job);

  return job;
}
