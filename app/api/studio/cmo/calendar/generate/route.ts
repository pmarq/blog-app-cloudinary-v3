import { NextRequest } from "next/server";
import { forwardJson, requireAdmin } from "../../_shared";

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  const body = await request.json().catch(() => ({}));
  return forwardJson(request, "/studio/cmo/calendar/generate", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}
