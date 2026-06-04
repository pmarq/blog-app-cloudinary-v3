import { NextRequest } from "next/server";
import { ok, badRequest, readJson, makeRunId } from "../../utils";

const normalizeStudioOrgId = (value: string | null | undefined) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "org_inlevor";
  const lowered = trimmed.toLowerCase();
  if (lowered === "default" || lowered === "inlevor" || lowered === "org-inlevor") {
    return "org_inlevor";
  }
  return trimmed;
};

interface CreatePostBody {
  briefId?: string;
  orgId?: string;
  title?: string;
  meta?: string;
  tags?: string[];
}

export async function POST(request: NextRequest) {
  const body = await readJson<CreatePostBody>(request);
  if (!body || !body.briefId) return badRequest("briefId é obrigatório.");

  const postId = `post-${makeRunId()}`;
  const now = new Date().toISOString();

  // Mock: retorna payload simulando um post recém criado
  return ok({
    post: {
      id: postId,
      briefId: body.briefId,
      orgId: normalizeStudioOrgId(body.orgId),
      title: body.title || "Post criado a partir do brief",
      meta: body.meta || "",
      tags: body.tags || [],
      status: "draft", // ou "idea"
      channel: "blog",
      origin: "studio",
      createdAt: now,
      updatedAt: now,
    },
  });
}
