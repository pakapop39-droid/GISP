import { createServerClient } from "@insforge/sdk/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { logAnonymousSecurityEvent } from "@/lib/auth/auth-route";

const schema = z.object({ token: z.string().min(20), newPassword: z.string().min(10).max(128) });

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ code: "INVALID_INPUT", message: "ลิงก์ไม่ถูกต้องหรือรหัสผ่านสั้นกว่า 10 ตัว" }, { status: 400 });
  }
  const insforge = createServerClient();
  const { error } = await insforge.auth.resetPassword({ newPassword: parsed.data.newPassword, otp: parsed.data.token });
  if (error) {
    await logAnonymousSecurityEvent(request, "PASSWORD_RESET_COMPLETED", "FAILED");
    return NextResponse.json({ code: "INVALID_TRANSITION", message: "ลิงก์หมดอายุหรือถูกใช้แล้ว กรุณาขอลิงก์ใหม่" }, { status: 409 });
  }
  await logAnonymousSecurityEvent(request, "PASSWORD_RESET_COMPLETED", "SUCCESS");
  return NextResponse.json({ message: "เปลี่ยนรหัสผ่านแล้ว กรุณาเข้าสู่ระบบใหม่" });
}

