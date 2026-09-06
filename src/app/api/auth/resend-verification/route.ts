import { createServerClient } from "@insforge/sdk/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

const schema = z.object({ email: z.email() });

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ code: "INVALID_INPUT", message: "อีเมลไม่ถูกต้อง" }, { status: 400 });
  const insforge = createServerClient();
  await insforge.auth.resendVerificationEmail({ email: parsed.data.email });
  return NextResponse.json({ message: "หากบัญชีรอยืนยัน ระบบจะส่งรหัสใหม่ให้ทางอีเมล" });
}

