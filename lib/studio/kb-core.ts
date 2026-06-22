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
  authToken = "",
): Record<string, string> {
  const headers: Record<string, string> = { ...extra };
  const bearer = String(authToken || "").trim();
  if (bearer) {
    headers.Authorization = `Bearer ${bearer}`;
    return headers;
  }
  const apiKey = String(process.env.KB_CORE_API_KEY || "").trim();
  if (apiKey) {
    headers["x-api-key"] = apiKey;
  }
  return headers;
}

export function getBearerToken(request: { headers?: { get(name: string): string | null } }): string {
  const header = request.headers?.get("authorization") || "";
  if (!header.startsWith("Bearer ")) return "";
  return header.slice("Bearer ".length).trim();
}
