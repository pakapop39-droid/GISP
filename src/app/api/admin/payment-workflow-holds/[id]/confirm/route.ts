import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError, invalidInput } from "@/lib/api/response";
import { requireAppAccess } from "@/lib/auth/session";
import { createInsForgeAdminClient } from "@/lib/insforge/admin";
import {
  currentFinanceSessionHash,
  loadAuthorizedPaymentWorkflowHold,
} from "@/lib/payments/finance-access";

const schema = z.object({
  role: z.enum(["FINANCE", "ORDER_ADMIN"]),
  note: z.string().trim().min(3).max(1000),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAppAccess({ active: true });
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return invalidInput(parsed.error.flatten().fieldErrors);
    const { id } = await params;
    if (!await loadAuthorizedPaymentWorkflowHold(id, parsed.data.role)) {
      return NextResponse.json({ message: "ไม่พบรายการพักงานหรือไม่มีสิทธิ์ยืนยัน" }, { status: 404 });
    }
    const sessionHash = await currentFinanceSessionHash();
    const admin = createInsForgeAdminClient();
    const result = await admin.database.rpc("confirm_payment_workflow_hold_private", {
      hold_id_input: id,
      decision_role_input: parsed.data.role,
      note_input: parsed.data.note,
      session_token_hash_input: sessionHash,
    });
    if (result.error) throw result.error;
    return NextResponse.json({ data: { id: result.data }, message: "บันทึกการยืนยัน Incident Runbook แล้ว" });
  } catch (error) {
    return apiError(error);
  }
}
