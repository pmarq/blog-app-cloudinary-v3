import { NextRequest } from "next/server";
import { forwardJson, requireAdmin } from "../../_shared";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ briefId: string }> },
) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  const { briefId } = await params;
  const body = await request.text();
  return forwardJson(request, `/studio/cmo/briefs/${encodeURIComponent(briefId)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body,
  });
}
