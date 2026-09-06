import { createAuthActions } from "@insforge/sdk/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { secureAuthCookieOptions } from "@/lib/auth/auth-route";

const inputSchema = z.object({ name: z.string().trim().min(2).max(120), email: z.email(), password: z.string().min(10).max(128) });

export async function POST(request: NextRequest) {
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ code: "INVALID_INPUT", message: "ข้อมูลสมัครไม่ครบหรือรหัสผ่านสั้นกว่า 10 ตัว" }, { status: 400 });
  }
  const response = NextResponse.json({ ok: true });
  const auth = createAuthActions({ requestCookies: request.cookies, responseCookies: response.cookies, ...secureAuthCookieOptions });
  const { data, error } = await auth.signUp({
    ...parsed.data,
    redirectTo: new URL("/register?verified=1", process.env.NEXT_PUBLIC_APP_URL ?? request.url).toString(),
  });
  if (error) {
    return NextResponse.json({ code: "SIGN_UP_FAILED", message: "สมัครสมาชิกไม่สำเร็จ กรุณาตรวจข้อมูลแล้วลองอีกครั้ง" }, { status: 400 });
  }
  return NextResponse.json({ requiresVerification: Boolean(data?.requireEmailVerification), message: data?.requireEmailVerification ? "ส่งรหัสยืนยัน 6 หลักไปยังอีเมลแล้ว" : "สร้างบัญชีแล้ว" }, { status: 201, headers: response.headers });
}

