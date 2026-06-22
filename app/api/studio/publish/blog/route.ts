import { NextRequest } from "next/server";
import { Job } from "@/app/models/Studio";
import { ok, badRequest, readJson, makeRunId } from "../../utils";
import { requireAdmin } from "@/lib/adminAuth";

interface PublishBlogRequestBody {
  postId?: string;
  idempotencyKey?: string;
  context?: Record<string, unknown>;
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  const body = await readJson<PublishBlogRequestBody>(request);
  if (!body) return badRequest("Invalid JSON body.");

  const idempotencyKey =
    body.idempotencyKey || `${body.postId || "post"}-blog-publish`;

  const runAt = new Date().toISOString();

  const job: Job = {
    id: idempotencyKey,
    idempotencyKey,
    type: "blog_publish",
    payload: { postId: body.postId, context: body.context },
    status: "queued",
    runAt,
    nextRunAt: runAt,
    attempts: 0,
    maxAttempts: 3,
    createdAt: runAt,
    updatedAt: runAt,
    result: { note: "Mock job: nenhuma publicação real no blog." },
  };

  return ok({
    job,
    runId: makeRunId(),
    schemaVersion: "1.0",
    notes: "Mock: publicação em fila (sem efeitos).",
  });
}
