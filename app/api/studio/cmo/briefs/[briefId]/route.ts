import { NextRequest } from "next/server";
import { forwardJson, getBearerToken, getCoreBaseUrl, getCoreHeaders, requireAdmin } from "../../_shared";

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ briefId: string }> },
) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  const { briefId } = await params;
  const normalizedBriefId = String(briefId || "").trim();
  if (!normalizedBriefId) {
    return new Response(JSON.stringify({ ok: false, message: "briefId obrigatório." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const token = getBearerToken(request);
    const response = await fetch(
      `${getCoreBaseUrl()}/studio/cmo/briefs/${encodeURIComponent(normalizedBriefId)}`,
      {
        method: "GET",
        cache: "no-store",
        headers: getCoreHeaders({
          Accept: "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        }),
      },
    );

    const payload = await response.json().catch(() => ({}));
    return new Response(JSON.stringify(payload), {
      status: response.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao carregar brief.";
    return new Response(JSON.stringify({ ok: false, message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
