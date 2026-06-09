import { NextRequest, NextResponse } from "next/server";
import { dedupeBriefItems, forwardJson, requireAdmin } from "../../_shared";

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  const body = await request.json().catch(() => ({}));
  const response = await forwardJson(request, "/studio/cmo/calendar/generate", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
  const payload = await response.json().catch(() => ({}));
  const calendar = payload && typeof payload === "object" ? (payload as Record<string, unknown>).calendar : null;
  const latestCalendar =
    calendar && typeof calendar === "object"
      ? {
          ...(calendar as Record<string, unknown>),
          items: dedupeBriefItems((calendar as Record<string, unknown>).items),
        }
      : null;

  const nextPayload =
    payload && typeof payload === "object"
      ? {
          ...(payload as Record<string, unknown>),
          latestCalendar,
        }
      : payload;

  return NextResponse.json(nextPayload, { status: response.status });
}
