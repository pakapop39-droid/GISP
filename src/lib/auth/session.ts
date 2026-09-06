import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import type { AppAccessContext, AppErrorCode } from "@/lib/auth/types";
import { APP_SESSION_COOKIE } from "@/lib/auth/cookies";
import { hasAllPermissions, isStaffRole } from "@/lib/auth/policy";

export { APP_SESSION_COOKIE } from "@/lib/auth/cookies";
export const APP_SESSION_MAX_AGE = 60 * 60 * 24 * 7;

export class AppAccessError extends Error {
  constructor(
    public readonly code: AppErrorCode,
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createSessionToken() {
  return randomBytes(32).toString("hex");
}

export function appSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: APP_SESSION_MAX_AGE,
  };
}

export async function getRequestFingerprint() {
  const requestHeaders = await headers();
  return {
    ip:
      requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      requestHeaders.get("x-real-ip") ??
      null,
    userAgent: requestHeaders.get("user-agent")?.slice(0, 500) ?? null,
    requestId:
      requestHeaders.get("x-request-id") ??
      requestHeaders.get("x-vercel-id") ??
      null,
  };
}

export async function readAppAccessContext(): Promise<AppAccessContext | null> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(APP_SESSION_COOKIE)?.value;
  if (!rawToken) return null;

  const insforge = await createInsForgeServerClient();
  const { data: authData, error: authError } = await insforge.auth.getCurrentUser();
  if (authError || !authData?.user) return null;

  const { data, error } = await insforge.database.rpc("get_app_access_context", {
    token_hash_input: hashSessionToken(rawToken),
  });
  if (error || !data) return null;
  return data as AppAccessContext;
}

export type AccessRequirement = {
  active?: boolean;
  permissions?: string[];
  allowSuspendedHistory?: boolean;
};

export async function requireAppAccess(
  requirement: AccessRequirement = { active: true },
): Promise<AppAccessContext> {
  const context = await readAppAccessContext();
  if (!context) {
    throw new AppAccessError("SESSION_REVOKED", 401, "เซสชันหมดอายุหรือถูกยกเลิก");
  }
  if (context.userStatus === "SUSPENDED" && !requirement.allowSuspendedHistory) {
    throw new AppAccessError("ACCOUNT_SUSPENDED", 403, "บัญชีถูกระงับการใช้งาน");
  }
  if (
    requirement.active !== false &&
    (context.userStatus !== "ACTIVE" || context.applicationStatus !== "APPROVED") &&
    !context.roles.some(isStaffRole)
  ) {
    throw new AppAccessError("ACCOUNT_PENDING", 403, "บัญชียังไม่พร้อมใช้งาน");
  }
  if (
    requirement.permissions?.length &&
    !hasAllPermissions(context, requirement.permissions)
  ) {
    throw new AppAccessError("PERMISSION_DENIED", 403, "ไม่มีสิทธิ์ทำรายการนี้");
  }
  return context;
}

export async function requireSuperAdmin(): Promise<AppAccessContext> {
  const context = await requireAppAccess({ active: true });
  if (!context.roles.includes("SUPER_ADMIN")) {
    throw new AppAccessError("PERMISSION_DENIED", 403, "ส่วนนี้สำหรับเจ้าของระบบเท่านั้น");
  }
  return context;
}

export { accessHome } from "@/lib/auth/policy";
