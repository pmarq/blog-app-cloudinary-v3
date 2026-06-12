import { NextRequest, NextResponse } from "next/server";
import { forwardJson, requireAdmin } from "../../_shared";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  const body = await request.text();
  const response = await forwardJson(request, "/studio/cmo/opportunities/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body,
  });
  const payload = await response.json().catch(() => ({}));
  const nextPayload =
    payload && typeof payload === "object"
      ? {
          ...(payload as Record<string, unknown>),
          latestOpportunitySearch:
            (payload as Record<string, unknown>).opportunitySearch ||
            (payload as Record<string, unknown>).latestOpportunitySearch ||
            null,
        }
      : payload;
  return NextResponse.json(nextPayload, { status: response.status });
}
