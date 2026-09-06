import { createServerClient } from "@insforge/sdk/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { logAnonymousSecurityEvent } from "@/lib/auth/auth-route";
import { requestPasswordResetEmail } from "@/lib/auth/password-reset";

const schema = z.object({ email: z.email() });

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  let outcome: "SUCCESS" | "DENIED" | "FAILED" = "DENIED";
  if (parsed.success) {
    const insforge = createServerClient();
    outcome = await requestPasswordResetEmail(
      (payload) => insforge.auth.sendResetPasswordEmail(payload),
      {
        email: parsed.data.email,
        redirectTo: new URL("/reset-password", process.env.NEXT_PUBLIC_APP_URL ?? request.url).toString(),
      },
    );
  }
  await logAnonymousSecurityEvent(request, "PASSWORD_RESET_REQUESTED", outcome);
  return NextResponse.json({ message: "หากอีเมลนี้มีบัญชี ระบบจะส่งลิงก์เปลี่ยนรหัสผ่านให้" });
}
