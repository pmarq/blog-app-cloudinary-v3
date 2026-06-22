import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/firebase/server";

export function getBearerToken(request: NextRequest): string {
  const header = request.headers.get("authorization") || "";
  if (!header.startsWith("Bearer ")) return "";
  return header.slice("Bearer ".length).trim();
}

export async function requireAdmin(request: NextRequest): Promise<NextResponse | null> {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  try {
    const decoded = await auth.verifyIdToken(token);
    if (!decoded.admin) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
    }
    return null;
  } catch {
    return NextResponse.json({ success: false, message: "Token inválido." }, { status: 401 });
  }
}

export function getCoreBaseUrl(): string {
  const configured =
    process.env.KB_CORE_BASE_URL ||
    process.env.KB_RETRIEVE_API_URL ||
    process.env.API_INLEVOR_BASE_URL ||
    "https://api.inlevor.com.br";

  return String(configured || "").replace(/\/+$/, "");
}

export function getCoreHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const authHeader = (extra.authorization || extra.Authorization || "").trim();
  if (authHeader) {
    return { ...extra, Authorization: authHeader, authorization: authHeader };
  }
  const apiKey = String(process.env.KB_CORE_API_KEY || "").trim();
  return { ...extra, ...(apiKey ? { "x-api-key": apiKey } : {}) };
}

function normalizeText(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export function dedupeBriefItems(items: unknown): unknown[] {
  if (!Array.isArray(items)) return [];

  const byRunId = new Map<string, unknown>();
  const bySignature = new Map<string, unknown>();

  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const runId = normalizeText(record.briefRunId);
    const signature = [
      record.strategyId,
      record.calendarRunId,
      record.title,
      record.period,
      record.channel,
      record.objective,
    ]
      .map(normalizeText)
      .join("|");

    if (runId) {
      if (byRunId.has(runId)) byRunId.delete(runId);
      byRunId.set(runId, item);
      continue;
    }

    if (!bySignature.has(signature)) {
      bySignature.set(signature, item);
    }
  }

  return [...byRunId.values(), ...bySignature.values()];
}

export function dedupeBriefPayload(payload: unknown): unknown {
  if (!payload || typeof payload !== "object") return payload;

  const record = payload as Record<string, unknown>;
  const next = { ...record };
  const sourceItems = Array.isArray(record.items)
    ? record.items
    : record.briefs && typeof record.briefs === "object" && Array.isArray((record.briefs as Record<string, unknown>).items)
      ? ((record.briefs as Record<string, unknown>).items as unknown[])
      : [];
  const dedupedItems = dedupeBriefItems(sourceItems);

  next.latestBriefs = { items: dedupedItems };
  next.latestItems = dedupedItems;
  delete next.items;
  delete next.briefs;

  return next;
}

export function withLatestItemsPayload(payload: unknown): unknown {
  if (!payload || typeof payload !== "object") return payload;

  const record = payload as Record<string, unknown>;
  const next = { ...record };
  next.latestItems = Array.isArray(record.items) ? [...record.items] : [];
  delete next.items;

  return next;
}

export async function forwardJson(request: NextRequest, path: string, init?: RequestInit) {
  const method = String(init?.method || request.method || "GET").toUpperCase();
  const bearer = getBearerToken(request);
  const response = await fetch(`${getCoreBaseUrl()}${path}`, {
    cache: "no-store",
    ...init,
    headers: getCoreHeaders({
      ...(init?.headers && typeof init.headers === "object" ? (init.headers as Record<string, string>) : {}),
      ...(bearer ? { authorization: `Bearer ${bearer}` } : {}),
    }),
  });

  const text = await response.text().catch(() => "");
  let payload: unknown = {};
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { ok: false, error: text.slice(0, 4000) };
    }
  }

  if (!response.ok) {
    console.error(`[studio/cmo] ${method} ${path} -> ${response.status}`, payload);
  }

  return NextResponse.json(payload, { status: response.status });
}
