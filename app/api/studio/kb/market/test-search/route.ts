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

type Payload = {
  query?: string;
  orgId?: string;
  sourceId?: string;
  state?: string;
  city?: string;
  neighborhood?: string;
  limit?: number;
  scoreThreshold?: number;
};

export async function POST(request: NextRequest) {
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

    const body = (await request.json()) as Payload;
    const query = String(body?.query || "").trim();
    if (!query) {
      return NextResponse.json(
        { success: false, message: "query e obrigatorio." },
        { status: 400 },
      );
    }

    const orgId = normalizeId(body?.orgId || "inlevor") || "inlevor";
    const sourceId = String(body?.sourceId || "").trim();
    const state = normalizeId(body?.state);
    const city = normalizeId(body?.city);
    const neighborhood = normalizeId(body?.neighborhood);
    const limit = Math.min(Math.max(Number(body?.limit || 5), 1), 20);
    const scoreThreshold = Number.isFinite(Number(body?.scoreThreshold))
      ? Number(body?.scoreThreshold)
      : undefined;

    const upstreamResponse = await fetch(getKbCoreUrl("/kb/retrieve"), {
      method: "POST",
      headers: buildKbCoreHeaders({
        "Content-Type": "application/json",
        Accept: "application/json",
      }),
      body: JSON.stringify({
        query,
        limit,
        scoreThreshold,
        kbDomain: "market",
        orgId,
        scopeId: MARKET_SCOPE_ID,
        filters: {
          ...(sourceId ? { sourceId } : {}),
          ...(state ? { state } : {}),
          ...(city ? { city } : {}),
          ...(neighborhood ? { neighborhood } : {}),
        },
      }),
      cache: "no-store",
    });

    const rawText = await upstreamResponse.text();
    const upstreamPayload = rawText ? JSON.parse(rawText) : null;

    if (!upstreamResponse.ok) {
      const message =
        (upstreamPayload &&
          typeof upstreamPayload === "object" &&
          "error" in upstreamPayload &&
          typeof (upstreamPayload as { error?: unknown }).error === "string" &&
          (upstreamPayload as { error: string }).error) ||
        `Falha ao consultar busca (${upstreamResponse.status}).`;

      return NextResponse.json(
        { success: false, message, statusCode: upstreamResponse.status },
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
      upstream: upstreamPayload,
    });
  } catch (error) {
    console.error("[studio/kb/market/test-search] error:", error);
    return NextResponse.json(
      { success: false, message: "Erro ao testar busca." },
      { status: 500 },
    );
  }
}
