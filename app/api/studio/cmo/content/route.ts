import { NextRequest, NextResponse } from "next/server";
import { getCoreBaseUrl, getCoreHeaders, requireAdmin, getBearerToken } from "../_shared";

export async function GET(request: NextRequest) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(request.url);

  try {
    const token = getBearerToken(request);
    const response = await fetch(
      `${getCoreBaseUrl()}/studio/cmo/content?${searchParams.toString()}`,
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
    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao carregar conteúdo.";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
