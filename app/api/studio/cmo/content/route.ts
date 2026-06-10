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

    const responseText = await response.text().catch(() => "");
    let payload: unknown = {};
    if (responseText) {
      try {
        payload = JSON.parse(responseText);
      } catch {
        payload = { ok: false, message: responseText };
      }
    }

    if (!response.ok) {
      console.warn("[studio/cmo/content] upstream error", response.status, payload);
      return NextResponse.json(
        {
          ok: true,
          orgId: searchParams.get("orgId") || null,
          briefId: searchParams.get("briefId") || null,
          items: [],
          warning: "Nenhum texto rascunho salvo encontrado. O sistema vai gerar um novo.",
        },
        { status: 200 },
      );
    }

    if (!payload || typeof payload !== "object") {
      return NextResponse.json(
        {
          ok: true,
          orgId: searchParams.get("orgId") || null,
          briefId: searchParams.get("briefId") || null,
          items: [],
        },
        { status: 200 },
      );
    }

    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao carregar conteúdo.";
    console.warn("[studio/cmo/content] proxy fallback", message);
    return NextResponse.json(
      {
        ok: true,
        orgId: searchParams.get("orgId") || null,
        briefId: searchParams.get("briefId") || null,
        items: [],
        warning: message,
      },
      { status: 200 },
    );
  }
}
