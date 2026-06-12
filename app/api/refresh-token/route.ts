import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

function getSafeRedirectPath(rawPath: string | null, requestUrl: URL) {
  if (!rawPath) return "/";

  try {
    const parsed = new URL(rawPath, requestUrl);
    if (parsed.origin !== requestUrl.origin) return "/";
    return `${parsed.pathname}${parsed.search}${parsed.hash}` || "/";
  } catch {
    return "/";
  }
}

export const GET = async (request: NextRequest) => {
  const path = getSafeRedirectPath(request.nextUrl.searchParams.get("redirect"), request.nextUrl);

  const cookieStore = await cookies();
  const refreshToken = cookieStore.get("firebaseAuthRefreshToken")?.value;

  if (!refreshToken) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  try {
    const apiKey =
      process.env.FIREBASE_WEB_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    if (!apiKey) {
      console.error("FIREBASE_WEB_API_KEY ausente no ambiente.");
      return NextResponse.redirect(new URL("/", request.url));
    }

    const response = await fetch(
      `https://securetoken.googleapis.com/v1/token?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          grant_type: "refresh_token",
          refresh_token: refreshToken,
        }),
      }
    );

    const json = await response.json();
    const newToken = json.id_token;
    cookieStore.set("firebaseAuthToken", newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      sameSite: "lax",
    });
    cookieStore.set("firebaseAuthRefreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      sameSite: "lax",
    });

    return NextResponse.redirect(new URL(path, request.url));
  } catch (e) {
    console.log("Failed to refresh token: ", e);
    return NextResponse.redirect(new URL("/", request.url));
  }
};
