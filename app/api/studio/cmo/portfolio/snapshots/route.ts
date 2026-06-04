import { NextRequest } from "next/server";
import { forwardJson, requireAdmin } from "../../_shared";

export async function GET(request: NextRequest) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  const url = new URL(request.url);
  const search = url.searchParams.toString();
  return forwardJson(
    request,
    `/studio/cmo/portfolio/snapshots${search ? `?${search}` : ""}`,
    { method: "GET" },
  );
}
