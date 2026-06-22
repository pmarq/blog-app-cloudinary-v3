import { NextRequest } from "next/server";
import { Job } from "@/app/models/Studio";
import { ok, badRequest, readJson, makeRunId } from "../../utils";
import { requireAdmin } from "@/lib/adminAuth";

interface InstagramJobRequestBody {
  postId?: string;
  when?: string;
  caption?: string;
  mediaUrls?: string[];
  idempotencyKey?: string;
  context?: Record<string, unknown>;
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  const body = await readJson<InstagramJobRequestBody>(request);
  if (!body) return badRequest("Invalid JSON body.");

  const idempotencyKey =
    body.idempotencyKey ||
    `${body.postId || "post"}-${body.when || "now"}-instagram`;

  const runAt = body.when || new Date().toISOString();

  const job: Job = {
    id: idempotencyKey,
    idempotencyKey,
    type: "instagram_publish",
    payload: {
      postId: body.postId,
      caption: body.caption,
      mediaUrls: body.mediaUrls || [],
      context: body.context,
    },
    status: "queued",
    runAt,
    nextRunAt: runAt,
    attempts: 0,
    maxAttempts: 3,
    lockedBy: undefined,
    leaseUntil: undefined,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    result: { note: "Mock job: nenhuma publicação real executada." },
  };

  return ok({
    job,
    runId: makeRunId(),
    schemaVersion: "1.0",
    notes: "Mock: job enfileirado para teste (não publica no Instagram).",
  });
}
