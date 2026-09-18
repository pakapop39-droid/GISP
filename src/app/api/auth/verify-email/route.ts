import { clearAuthCookies, createAuthActions } from "@insforge/sdk/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { attachAppSession, isAccountInactiveError, secureAuthCookieOptions } from "@/lib/auth/auth-route";
import { APP_SESSION_COOKIE } from "@/lib/auth/session";

const schema = z.object({ email: z.email(), otp: z.string().regex(/^\d{6}$/) });

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ code: "INVALID_INPUT", message: "กรุณากรอกรหัสยืนยัน 6 หลัก" }, { status: 400 });
  }
  const response = NextResponse.json({ ok: true });
  const auth = createAuthActions({ requestCookies: request.cookies, responseCookies: response.cookies, ...secureAuthCookieOptions });
  const { data, error } = await auth.verifyEmail(parsed.data);
  if (error || !data?.user) {
    return NextResponse.json({ code: "INVALID_VERIFICATION", message: "รหัสยืนยันไม่ถูกต้องหรือหมดอายุ" }, { status: 400 });
  }
  try {
    await attachAppSession(response, request);
  } catch (error) {
    await auth.signOut();
    clearAuthCookies(response.cookies, secureAuthCookieOptions);
    response.cookies.delete(APP_SESSION_COOKIE);
    if (isAccountInactiveError(error)) {
      return NextResponse.json(
        { code: "ACCOUNT_INACTIVE", message: "บัญชีนี้ถูกปิดใช้งานถาวร" },
        { status: 403, headers: response.headers },
      );
    }
    return NextResponse.json(
      { code: "SESSION_REVOKED", message: "ยืนยันอีเมลสำเร็จ แต่สร้างเซสชันไม่สำเร็จ กรุณาเข้าสู่ระบบ" },
      { status: 503, headers: response.headers },
    );
  }
  return NextResponse.json({ ok: true, next: "/onboarding" }, { headers: response.headers });
}
