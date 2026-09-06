import { clearAuthCookies, createAuthActions } from "@insforge/sdk/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { attachAppSession, logAnonymousSecurityEvent, secureAuthCookieOptions } from "@/lib/auth/auth-route";
import { APP_SESSION_COOKIE } from "@/lib/auth/session";

const inputSchema = z.object({ email: z.email(), password: z.string().min(10).max(128) });

export async function POST(request: NextRequest) {
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ code: "INVALID_INPUT", message: "กรุณากรอกอีเมลและรหัสผ่านให้ถูกต้อง" }, { status: 400 });
  }
  const response = NextResponse.json({ ok: true });
  // A browser profile has one cookie jar. Clear the previous account before
  // issuing a new session so switching UAT roles cannot leave mixed cookies.
  clearAuthCookies(response.cookies, secureAuthCookieOptions);
  response.cookies.delete(APP_SESSION_COOKIE);
  const auth = createAuthActions({ requestCookies: request.cookies, responseCookies: response.cookies, ...secureAuthCookieOptions });
  const { data, error } = await auth.signInWithPassword(parsed.data);
  if (error || !data?.user) {
    await logAnonymousSecurityEvent(request, "LOGIN_FAILED", "DENIED");
    return NextResponse.json(
      { code: "UNAUTHENTICATED", message: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" },
      { status: 401, headers: response.headers },
    );
  }
  try {
    await attachAppSession(response, request);
  } catch {
    await auth.signOut();
    return NextResponse.json(
      { code: "SESSION_REVOKED", message: "สร้างเซสชันความปลอดภัยไม่สำเร็จ กรุณาลองอีกครั้ง" },
      { status: 503, headers: response.headers },
    );
  }
  return NextResponse.json({ user: { id: data.user.id, email: data.user.email } }, { headers: response.headers });
}
