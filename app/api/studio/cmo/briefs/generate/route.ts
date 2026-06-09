import { NextRequest } from "next/server";
import { dedupeBriefPayload, forwardJson, requireAdmin } from "../../_shared";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  const body = await request.text();
  const response = await forwardJson(request, "/studio/cmo/briefs/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body,
  });
  const payload = await response.json().catch(() => ({}));
  return Response.json(dedupeBriefPayload(payload), { status: response.status });
}
