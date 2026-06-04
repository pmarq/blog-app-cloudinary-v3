import { NextResponse } from "next/server";
import { ActionResult, StudioContext } from "@/app/models/Studio";

export const schemaVersion: ActionResult["schemaVersion"] = "1.0";

export const makeRunId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

export const normalizeContext = (
  context?: Partial<StudioContext>
): StudioContext => ({
  orgId: context?.orgId || "org_inlevor",
  userId: context?.userId || "anonymous",
  postId: context?.postId,
  briefId: context?.briefId,
  assetSetId: context?.assetSetId,
  locale: context?.locale || "pt-BR",
  tone: context?.tone,
});

export const ok = <T>(data: T) => NextResponse.json(data);

export const badRequest = (message: string) =>
  NextResponse.json({ error: message }, { status: 400 });

export const readJson = async <T>(request: Request): Promise<T | null> => {
  try {
    const body = await request.json();
    return body as T;
  } catch (error) {
    console.error("Failed to parse JSON body:", error);
    return null;
  }
};

export const mockActionResult = (
  overrides: Partial<ActionResult> & { context?: Partial<StudioContext> }
): ActionResult => {
  const context = normalizeContext(overrides.context);
  return {
    schemaVersion,
    runId: overrides.runId || makeRunId(),
    context,
    actions: overrides.actions || [],
    guardrailScore: overrides.guardrailScore,
    issues: overrides.issues,
    claims: overrides.claims,
    notes: overrides.notes,
    applied: overrides.applied,
  };
};
