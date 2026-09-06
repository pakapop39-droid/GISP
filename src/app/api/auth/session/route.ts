import { clearAuthCookies } from "@insforge/sdk/ssr";
import { NextResponse } from "next/server";
import { secureAuthCookieOptions } from "@/lib/auth/cookies";
import { APP_SESSION_COOKIE, accessHome, readAppAccessContext } from "@/lib/auth/session";

export async function GET() {
  const context = await readAppAccessContext();
  if (!context) {
    const response = NextResponse.json({ code: "SESSION_REVOKED", message: "เซสชันหมดอายุหรือถูกยกเลิก" }, { status: 401 });
    clearAuthCookies(response.cookies, secureAuthCookieOptions);
    response.cookies.delete(APP_SESSION_COOKIE);
    return response;
  }
  return NextResponse.json({ data: context, next: accessHome(context) });
}
