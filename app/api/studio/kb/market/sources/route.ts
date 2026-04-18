import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/firebase/server";
import { buildKbCoreHeaders, getKbCoreUrl } from "@/lib/studio/kb-core";

export const runtime = "nodejs";

const MARKET_SCOPE_ID = "market__br";

const normalizeId = (value: unknown) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^\w-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

const getBearerToken = (request: NextRequest) => {
  const header = request.headers.get("authorization") || "";
  if (!header.startsWith("Bearer ")) return "";
  return header.slice("Bearer ".length).trim();
};

export async function GET(request: NextRequest) {
  try {
    const token = getBearerToken(request);
    if (!token) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 },
      );
    }

    const decoded = await auth.verifyIdToken(token);
    if (!decoded.admin) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 403 },
      );
    }

    const url = new URL(request.url);
    const orgId = normalizeId(url.searchParams.get("orgId") || "inlevor") || "inlevor";
    const state = normalizeId(url.searchParams.get("state"));
    const city = normalizeId(url.searchParams.get("city"));
    const neighborhood = normalizeId(url.searchParams.get("neighborhood"));

    const params = new URLSearchParams({
      orgId,
      sourceProject: "blog-app",
      kbDomain: "market",
      scopeId: MARKET_SCOPE_ID,
      limit: "100",
    });
    if (state) params.set("state", state);
    if (city) params.set("city", city);
    if (neighborhood) params.set("neighborhood", neighborhood);

    const upstreamResponse = await fetch(
      `${getKbCoreUrl("/kb/sources")}?${params.toString()}`,
      {
        method: "GET",
        headers: buildKbCoreHeaders({ Accept: "application/json" }),
        cache: "no-store",
      },
    );

    const raw = await upstreamResponse.text();
    const upstreamPayload = raw ? JSON.parse(raw) : {};

    if (!upstreamResponse.ok || !upstreamPayload?.ok) {
      return NextResponse.json(
        {
          success: false,
          message:
            upstreamPayload?.error || "Falha ao carregar fontes do KB Core.",
        },
        { status: upstreamResponse.status === 400 ? 400 : 502 },
      );
    }

    return NextResponse.json({
      success: true,
      orgId,
      scopeId: MARKET_SCOPE_ID,
      state: state || null,
      city: city || null,
      neighborhood: neighborhood || null,
      sources: Array.isArray(upstreamPayload?.sources)
        ? upstreamPayload.sources
        : [],
    });
  } catch (error) {
    console.error("[studio/kb/market/sources] error:", error);
    return NextResponse.json(
      { success: false, message: "Erro ao carregar fontes." },
      { status: 500 },
    );
  }
}
