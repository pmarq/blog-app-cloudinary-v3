import { NextRequest, NextResponse } from "next/server";
import { forwardJson, requireAdmin } from "../_shared";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  const url = new URL(request.url);
  const orgId = url.searchParams.get("orgId") || "inlevor";
  return forwardJson(
    request,
    `/studio/cmo/company-profile?orgId=${encodeURIComponent(orgId)}`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
    },
  );
}

export async function PUT(request: NextRequest) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  const body = await request.text();
  return forwardJson(request, "/studio/cmo/company-profile", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body,
  });
}
