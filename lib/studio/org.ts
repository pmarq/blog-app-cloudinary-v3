export const DEFAULT_ORG_ID = "org_inlevor";

export function normalizeStudioOrgId(value: string | null | undefined): string {
  const trimmed = String(value || "").trim();
  if (!trimmed) return DEFAULT_ORG_ID;
  const lowered = trimmed.toLowerCase();
  if (lowered === "default" || lowered === "inlevor" || lowered === "org-inlevor") {
    return DEFAULT_ORG_ID;
  }
  return trimmed;
}
