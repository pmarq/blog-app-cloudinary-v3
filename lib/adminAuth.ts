import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { DecodedIdToken } from "firebase-admin/auth";
import { auth } from "@/firebase/server";

function getBearerToken(request: Request): string {
  const header = request.headers.get("authorization") || "";
  if (!header.startsWith("Bearer ")) return "";
  return header.slice("Bearer ".length).trim();
}

async function getSessionToken(): Promise<string> {
  const cookieStore = await cookies();
  return String(cookieStore.get("firebaseAuthToken")?.value || "").trim();
}

export async function requireAdmin(request: Request): Promise<NextResponse | null> {
  const verification = await verifyAdminRequest(request);
  return verification.response;
}

export async function verifyAdminRequest(
  request: Request,
): Promise<{ response: NextResponse | null; decoded: DecodedIdToken | null }> {
  const token = getBearerToken(request) || (await getSessionToken());

  if (!token) {
    return {
      response: NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 },
      ),
      decoded: null,
    };
  }

  try {
    const decoded = await auth.verifyIdToken(token);
    if (!decoded.admin) {
      return {
        response: NextResponse.json(
          { success: false, message: "Unauthorized" },
          { status: 403 },
        ),
        decoded: null,
      };
    }
    return { response: null, decoded };
  } catch (error) {
    console.error("[adminAuth] invalid token:", error);
    return {
      response: NextResponse.json(
        { success: false, message: "Token inválido ou expirado." },
        { status: 401 },
      ),
      decoded: null,
    };
  }
}
