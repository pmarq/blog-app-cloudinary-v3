import { NextRequest, NextResponse } from "next/server";
import { getCoreBaseUrl, getCoreHeaders, requireAdmin, getBearerToken } from "../../../_shared";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ briefId: string }> },
) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  const body = await request.json().catch(() => ({}));
  const { briefId } = await params;
  const normalizedBriefId = String(briefId || "").trim();

  if (!normalizedBriefId) {
    return NextResponse.json({ ok: false, message: "briefId obrigatório." }, { status: 400 });
  }

  try {
    const token = getBearerToken(request);
    const response = await fetch(
      `${getCoreBaseUrl()}/studio/cmo/briefs/${encodeURIComponent(normalizedBriefId)}/generate-content`,
      {
        method: "POST",
        cache: "no-store",
        headers: getCoreHeaders({
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        }),
        body: JSON.stringify(body),
      },
    );

    const payload = await response.json().catch(() => ({}));

    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao gerar conteúdo.";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
