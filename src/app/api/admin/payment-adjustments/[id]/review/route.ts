import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError, invalidInput } from "@/lib/api/response";
import { requireAppAccess } from "@/lib/auth/session";
import {
  currentFinanceSessionHash,
  loadAuthorizedPaymentAdjustment,
} from "@/lib/payments/finance-access";
import { createInsForgeAdminClient } from "@/lib/insforge/admin";

const idSchema = z.uuid();
const schema = z.object({
  approve: z.boolean(),
  decision_note: z.string().trim().max(1000).optional(),
}).superRefine((input, context) => {
  if (!input.approve && !input.decision_note) {
    context.addIssue({
      code: "custom",
      path: ["decision_note"],
      message: "กรุณาระบุเหตุผลที่ไม่อนุมัติ",
    });
  }
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAppAccess({ active: true });
    const { id } = await params;
    if (!idSchema.safeParse(id).success) return invalidInput();

    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return invalidInput(parsed.error.flatten().fieldErrors);

    const adjustment = await loadAuthorizedPaymentAdjustment(id);
    if (!adjustment) {
      return NextResponse.json(
        { code: "ADJUSTMENT_NOT_AVAILABLE", message: "ไม่พบรายการปรับยอดที่ตรวจได้" },
        { status: 404 },
      );
    }
    if (adjustment.status !== "PENDING") {
      return NextResponse.json(
        { code: "PAYMENT_ADJUSTMENT_NOT_REVIEWABLE", message: "รายการนี้ตรวจแล้ว" },
        { status: 409 },
      );
    }

    const admin = createInsForgeAdminClient();
    const result = await admin.database.rpc("review_payment_adjustment_private", {
      adjustment_id_input: id,
      approve_input: parsed.data.approve,
      decision_note_input: parsed.data.decision_note ?? null,
      session_token_hash_input: await currentFinanceSessionHash(),
    });
    if (result.error) return apiError(result.error);
    if (!result.data) return apiError(new Error("PAYMENT_ADJUSTMENT_REVIEW_FAILED"));

    return NextResponse.json({
      data: { id: result.data },
      message: parsed.data.approve
        ? "อนุมัติและคำนวณยอดรับเงินใหม่แล้ว"
        : "ปฏิเสธคำขอปรับยอดแล้ว",
    });
  } catch (error) {
    return apiError(error);
  }
}

