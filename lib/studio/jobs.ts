import { Timestamp } from "firebase-admin/firestore";

import { firestore } from "@/firebase/server";
import { DEFAULT_ORG_ID, normalizeStudioOrgId } from "./org";
import type { StudioJob, StudioJobStatus, StudioJobType } from "./types";

const JOBS_COLLECTION = "studio_jobs";

function stripUndefined<T extends Record<string, unknown>>(data: T): Partial<T> {
  const entries = Object.entries(data).filter(([, value]) => value !== undefined);
  return Object.fromEntries(entries) as Partial<T>;
}

export type CreateJobInput = {
  type: StudioJobType;
  status: StudioJobStatus;
  payload?: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: string | null;
  scheduleItemId?: string;
};

function normalizeJob(
  doc: FirebaseFirestore.QueryDocumentSnapshot
): StudioJob {
  return {
    ...(doc.data() as StudioJob),
    id: doc.id,
  };
}

export async function createJob(input: CreateJobInput): Promise<StudioJob> {
  const ref = firestore.collection(JOBS_COLLECTION).doc();
  const now = Timestamp.now();

  const job: StudioJob = {
    id: ref.id,
    orgId: normalizeStudioOrgId(DEFAULT_ORG_ID),
    scheduleItemId: input.scheduleItemId,
    type: input.type,
    status: input.status,
    payload: input.payload,
    result: input.result,
    error: input.error ?? null,
    createdAt: now,
    updatedAt: now,
  };

  await ref.set(job);

  return job;
}

export async function listJobs(
  orgId = DEFAULT_ORG_ID,
  limit = 50
): Promise<StudioJob[]> {
  const snapshot = await firestore.collection(JOBS_COLLECTION).get();
  const normalizedOrgId = normalizeStudioOrgId(orgId);

  return snapshot.docs
    .map(normalizeJob)
    .filter((job) => normalizeStudioOrgId(job.orgId) === normalizedOrgId)
    .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis())
    .slice(0, limit);
}

export async function updateJob(
  id: string,
  updates: Partial<Omit<StudioJob, "id" | "orgId" | "createdAt">>
): Promise<StudioJob | null> {
  const ref = firestore.collection(JOBS_COLLECTION).doc(id);
  const updateData = stripUndefined({
    ...updates,
    updatedAt: Timestamp.now(),
  });

  await ref.update(updateData);

  const snapshot = await ref.get();
  if (!snapshot.exists) {
    return null;
  }

  return {
    ...(snapshot.data() as StudioJob),
    id: snapshot.id,
  };
}
