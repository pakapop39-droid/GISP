import { clearAuthCookies, createServerClient, refreshAuth } from "@insforge/sdk/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { secureAuthCookieOptions } from "@/lib/auth/auth-route";
import { APP_SESSION_COOKIE, hashSessionToken } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  const refreshed = await refreshAuth({ request, ...secureAuthCookieOptions });
  const rawAppToken = request.cookies.get(APP_SESSION_COOKIE)?.value;
  if (refreshed.error || !refreshed.accessToken || !rawAppToken) return deniedResponse();
  const insforge = createServerClient({ accessToken: refreshed.accessToken, ...secureAuthCookieOptions });
  const { data } = await insforge.database.rpc("get_app_access_context", { token_hash_input: hashSessionToken(rawAppToken) });
  return data ? refreshed.response : deniedResponse();
}

function deniedResponse() {
  const response = NextResponse.json({ code: "SESSION_REVOKED", message: "เซสชันหมดอายุหรือถูกยกเลิก" }, { status: 401 });
  clearAuthCookies(response.cookies, secureAuthCookieOptions);
  response.cookies.delete(APP_SESSION_COOKIE);
  return response;
}

