import "server-only";

import { createServerClient } from "@insforge/sdk/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  APP_SESSION_COOKIE,
  APP_SESSION_MAX_AGE,
  appSessionCookieOptions,
  createSessionToken,
  hashSessionToken,
} from "@/lib/auth/session";
import { createInsForgeAdminClient } from "@/lib/insforge/admin";
import { secureAuthCookieOptions } from "@/lib/auth/cookies";

export { secureAuthCookieOptions } from "@/lib/auth/cookies";

export function requestNetworkData(request: NextRequest) {
  return {
    ip:
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip"),
    userAgent: request.headers.get("user-agent")?.slice(0, 500) ?? null,
    requestId:
      request.headers.get("x-request-id") ??
      request.headers.get("x-vercel-id") ??
      null,
  };
}

export async function attachAppSession(
  response: NextResponse,
  request: NextRequest,
) {
  const accessToken = response.cookies.get("insforge_access_token")?.value;
  if (!accessToken) throw new Error("AUTH_SESSION_NOT_CREATED");

  const rawAppToken = createSessionToken();
  const network = requestNetworkData(request);
  const insforge = createServerClient({ accessToken, ...secureAuthCookieOptions });
  const expiresAt = new Date(Date.now() + APP_SESSION_MAX_AGE * 1000).toISOString();
  const { error } = await insforge.database.rpc("register_app_session", {
    token_hash_input: hashSessionToken(rawAppToken),
    expires_at_input: expiresAt,
    ip_address_input: network.ip,
    user_agent_input: network.userAgent,
  });
  if (error) throw error;
  await insforge.database.rpc("write_security_event", {
    event_type_input: "LOGIN_SUCCEEDED",
    outcome_input: "SUCCESS",
    target_user_id_input: null,
    request_id_input: network.requestId,
    ip_address_input: network.ip,
    user_agent_input: network.userAgent,
    metadata_input: {},
  });
  response.cookies.set(APP_SESSION_COOKIE, rawAppToken, appSessionCookieOptions());
}

export async function logAnonymousSecurityEvent(
  request: NextRequest,
  eventType: "LOGIN_FAILED" | "PASSWORD_RESET_REQUESTED" | "PASSWORD_RESET_COMPLETED",
  outcome: "SUCCESS" | "DENIED" | "FAILED",
) {
  try {
    const network = requestNetworkData(request);
    const admin = createInsForgeAdminClient();
    await admin.database.from("security_events").insert([
      {
        event_type: eventType,
        outcome,
        request_id: network.requestId,
        ip_address: network.ip,
        user_agent: network.userAgent,
        metadata: {},
      },
    ]);
  } catch {
    // Logging must not reveal account existence or break the auth response.
  }
}
