import { NextRequest } from "next/server";
import { forwardJson, requireAdmin } from "../../_shared";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  const body = await request.text();
  return forwardJson(request, "/studio/cmo/strategy/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body,
  });
}
