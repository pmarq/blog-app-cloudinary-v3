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
  const apiKey = String(process.env.KB_CORE_API_KEY || "").trim();
  return {
    ...extra,
    ...(apiKey ? { "x-api-key": apiKey } : {}),
  };
}

export async function forwardJson(request: NextRequest, path: string, init?: RequestInit) {
  const response = await fetch(`${getCoreBaseUrl()}${path}`, {
    cache: "no-store",
    ...init,
    headers: getCoreHeaders({
      ...(init?.headers && typeof init.headers === "object" ? (init.headers as Record<string, string>) : {}),
    }),
  });

  const text = await response.text().catch(() => "");
  let payload: unknown = {};
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { ok: false, error: text.slice(0, 500) };
    }
  }

  return NextResponse.json(payload, { status: response.status });
}
