import { createAuthActions } from "@insforge/sdk/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { requestNetworkData, secureAuthCookieOptions } from "@/lib/auth/auth-route";
import { APP_SESSION_COOKIE, hashSessionToken } from "@/lib/auth/session";
import { createInsForgeServerClient } from "@/lib/insforge/server";

export async function POST(request: NextRequest) {
  const rawSession = request.cookies.get(APP_SESSION_COOKIE)?.value;
  if (rawSession) {
    const insforge = await createInsForgeServerClient();
    await insforge.database.rpc("revoke_app_session", { token_hash_input: hashSessionToken(rawSession), reason_input: "SIGN_OUT" });
    const network = requestNetworkData(request);
    await insforge.database.rpc("write_security_event", { event_type_input: "LOGOUT", outcome_input: "SUCCESS", target_user_id_input: null, request_id_input: network.requestId, ip_address_input: network.ip, user_agent_input: network.userAgent, metadata_input: {} });
  }
  const response = NextResponse.json({ ok: true });
  const auth = createAuthActions({ requestCookies: request.cookies, responseCookies: response.cookies, ...secureAuthCookieOptions });
  await auth.signOut();
  response.cookies.delete(APP_SESSION_COOKIE);
  return response;
}

