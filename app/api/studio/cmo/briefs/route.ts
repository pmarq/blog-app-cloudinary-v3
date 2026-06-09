import { NextRequest, NextResponse } from "next/server";
import { dedupeBriefPayload, forwardJson, requireAdmin } from "../_shared";

export async function GET(request: NextRequest) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  const url = new URL(request.url);
  const search = url.searchParams.toString();
  const response = await forwardJson(request, `/studio/cmo/briefs${search ? `?${search}` : ""}`, {
    method: "GET",
  });
  const payload = await response.json().catch(() => ({}));
  return NextResponse.json(dedupeBriefPayload(payload), { status: response.status });
}
