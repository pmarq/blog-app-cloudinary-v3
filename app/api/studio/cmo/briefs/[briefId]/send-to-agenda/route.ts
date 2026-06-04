import { Timestamp } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createItem, serializeScheduleItem } from "@/lib/studio/schedule";
import type { StudioChannel, StudioTheme } from "@/lib/studio/types";
import {
  getCoreBaseUrl,
  getCoreHeaders,
  requireAdmin,
  getBearerToken,
} from "../../../_shared";

function resolveTheme(input: string | null | undefined): StudioTheme {
  const text = String(input || "").toLowerCase();
  if (text.includes("bairro") || text.includes("territ")) return "hub_weekly";
  if (text.includes("produto") || text.includes("empreendimento")) return "lancamentos";
  if (text.includes("mercado") || text.includes("autor")) return "resultados_trimestrais";
  return "educativo";
}

function resolveChannel(input: string | null | undefined): StudioChannel {
  const text = String(input || "").toLowerCase();
  if (text === "instagram" || text === "stories" || text === "reels" || text === "newsletter" || text === "blog") {
    return text as StudioChannel;
  }
  return "blog";
}

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

  const brief = typeof body?.brief === "object" && body.brief !== null ? body.brief : body;
  const title = String(brief?.title || "").trim();
  const channel = resolveChannel(brief?.channel);
  const theme = resolveTheme(brief?.theme || brief?.scope || title);
  const scheduledCandidate = brief?.scheduledAt ? new Date(brief.scheduledAt) : null;
  const scheduledAt =
    scheduledCandidate && Number.isFinite(scheduledCandidate.getTime()) ? scheduledCandidate : null;

  if (!title) {
    return NextResponse.json({ ok: false, message: "Brief sem título." }, { status: 400 });
  }

  try {
    const token = getBearerToken(request);
    const updateResponse = await fetch(`${getCoreBaseUrl()}/studio/cmo/briefs/${encodeURIComponent(normalizedBriefId)}`, {
      method: "PATCH",
      cache: "no-store",
      headers: getCoreHeaders({
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      }),
      body: JSON.stringify({
        status: "approved",
        title,
        channel,
        theme,
        scope: brief?.scope || null,
        scheduledAt: brief?.scheduledAt || null,
        objective: brief?.objective || null,
        angle: brief?.angle || null,
        cta: brief?.cta || null,
      }),
    });

    const updatePayload = await updateResponse.json().catch(() => ({}));
    if (!updateResponse.ok || !updatePayload?.ok) {
      return NextResponse.json(
        { ok: false, message: updatePayload?.message || "Falha ao aprovar brief." },
        { status: updateResponse.status || 500 },
      );
    }

    const scheduleItem = await createItem({
      title,
      theme,
      channel,
      status: scheduledAt ? "scheduled" : "approved",
      scheduledAt: scheduledAt ? Timestamp.fromDate(scheduledAt) : null,
    });

    revalidatePath("/dashboard/studio/agenda");
    revalidatePath("/dashboard/studio/cmo");

    return NextResponse.json({
      ok: true,
      brief: updatePayload.brief,
      scheduleItem: serializeScheduleItem(scheduleItem),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao enviar brief para a agenda.";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

