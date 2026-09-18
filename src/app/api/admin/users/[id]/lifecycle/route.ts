import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError, invalidInput } from "@/lib/api/response";
import { internalUserLifecycleSchema } from "@/lib/auth/internal-user-schema";
import { requireSuperAdmin } from "@/lib/auth/session";
import { createInsForgeServerClient } from "@/lib/insforge/server";

const messages = {
  suspend: "ระงับบัญชีและยกเลิก Session แล้ว",
  reactivate: "เปิดใช้งานบัญชีแล้ว",
  deactivate: "ปิดบัญชีถาวร ถอนสิทธิ์ และยกเลิก Session แล้ว โดยยังเก็บประวัติงานไว้",
} as const;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSuperAdmin();
    const { id } = await params;
    const parsed = internalUserLifecycleSchema.safeParse(await request.json().catch(() => null));
    if (!z.uuid().safeParse(id).success || !parsed.success) {
      return invalidInput(parsed.success ? undefined : parsed.error.flatten().fieldErrors);
    }
    const insforge = await createInsForgeServerClient();
    if (parsed.data.action === "deactivate") {
      const email = await insforge.database.rpc("admin_get_staff_user_email", { target_user_id_input: id });
      if (email.error) throw email.error;
      if (!email.data || String(email.data).trim().toLocaleLowerCase() !== parsed.data.confirmationEmail.trim().toLocaleLowerCase()) {
        return NextResponse.json({ message: "อีเมลยืนยันไม่ตรงกับบัญชีพนักงาน" }, { status: 400 });
      }
    }
    const result = await insforge.database.rpc("manage_internal_staff_lifecycle", {
      target_user_id_input: id,
      action_input: parsed.data.action.toUpperCase(),
      reason_input: "reason" in parsed.data ? parsed.data.reason : null,
    });
    if (result.error) throw result.error;
    return NextResponse.json({ data: result.data, message: messages[parsed.data.action] });
  } catch (error) {
    return apiError(error);
  }
}
