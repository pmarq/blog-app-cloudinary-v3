import { NextRequest } from "next/server";
import { ok, badRequest, readJson, makeRunId } from "../utils";

type Brief = {
  id: string;
  orgId: string;
  title: string;
  goals?: string;
  target?: string;
  tone?: string;
  keywords?: string[];
  constraints?: string[];
  ownerId?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
};

const mockBriefs: Brief[] = [
  {
    id: "b1",
    orgId: "org_inlevor",
    title: "Lançamento Zona Sul",
    status: "draft",
    ownerId: "cmo",
    createdAt: new Date().toISOString(),
  },
  {
    id: "b2",
    orgId: "org_inlevor",
    title: "Guia de investimentos 2025",
    status: "in_review",
    ownerId: "cmo",
    createdAt: new Date().toISOString(),
  },
  {
    id: "b3",
    orgId: "org_inlevor",
    title: "Stories retrofit",
    status: "approved",
    ownerId: "design",
    createdAt: new Date().toISOString(),
  },
];

const normalizeStudioOrgId = (value: string | null | undefined) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "org_inlevor";
  const lowered = trimmed.toLowerCase();
  if (lowered === "default" || lowered === "inlevor" || lowered === "org-inlevor") {
    return "org_inlevor";
  }
  return trimmed;
};

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const limit = parseInt(searchParams.get("limit") || "20", 10);
  const orgId = normalizeStudioOrgId(searchParams.get("orgId"));

  const items = mockBriefs.filter((b) => b.orgId === orgId).slice(0, limit);
  return ok({ items, nextPage: null });
}

export async function POST(request: NextRequest) {
  const body = await readJson<Partial<Brief>>(request);
  if (!body || !body.title) return badRequest("Título é obrigatório.");

  const now = new Date().toISOString();
  const brief: Brief = {
    id: `brief-${makeRunId()}`,
    orgId: normalizeStudioOrgId(body.orgId),
    title: body.title,
    goals: body.goals,
    target: body.target,
    tone: body.tone,
    keywords: body.keywords || [],
    constraints: body.constraints || [],
    ownerId: body.ownerId || "unknown",
    status: body.status || "draft",
    createdAt: now,
    updatedAt: now,
  };

  // Mock only: não persiste, apenas retorna
  return ok({ brief });
}
