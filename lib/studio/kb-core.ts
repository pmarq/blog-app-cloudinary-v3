const DEFAULT_KB_CORE_BASE_URL = "https://api.inlevor.com.br";

export function getKbCoreBaseUrl(): string {
  const configured =
    process.env.KB_CORE_BASE_URL ||
    process.env.KB_RETRIEVE_API_URL ||
    process.env.API_INLEVOR_BASE_URL ||
    DEFAULT_KB_CORE_BASE_URL;

  const normalized = String(configured || "").replace(/\/+$/, "");
  if (normalized.endsWith("/kb/retrieve")) {
    return normalized.replace(/\/kb\/retrieve$/, "");
  }
  return normalized;
}

export function getKbCoreUrl(path: string): string {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${getKbCoreBaseUrl()}${suffix}`;
}

export function buildKbCoreHeaders(
  extra: Record<string, string> = {},
): Record<string, string> {
  const headers: Record<string, string> = { ...extra };
  const apiKey = String(process.env.KB_CORE_API_KEY || "").trim();
  if (apiKey) {
    headers["x-api-key"] = apiKey;
  }
  return headers;
}
