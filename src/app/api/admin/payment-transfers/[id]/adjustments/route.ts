import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError, invalidInput } from "@/lib/api/response";
import { requireAppAccess } from "@/lib/auth/session";
import {
  currentFinanceSessionHash,
  loadAuthorizedPaymentTransfer,
} from "@/lib/payments/finance-access";
import { createInsForgeAdminClient } from "@/lib/insforge/admin";

const idSchema = z.uuid();
const schema = z.object({
  adjustment_type: z.enum(["ADJUSTMENT", "REVERSAL"]),
  amount: z.coerce.number().positive().optional(),
  reason: z.string().trim().min(3).max(1000),
}).superRefine((input, context) => {
  if (input.adjustment_type === "ADJUSTMENT" && input.amount === undefined) {
    context.addIssue({
      code: "custom",
      path: ["amount"],
      message: "กรุณาระบุยอดที่ต้องการปรับลด",
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

    const transfer = await loadAuthorizedPaymentTransfer(id, "payments.adjust");
    if (!transfer) {
      return NextResponse.json(
        { code: "TRANSFER_NOT_AVAILABLE", message: "ไม่พบรายการรับเงินที่ปรับได้" },
        { status: 404 },
      );
    }
    if (transfer.status !== "VERIFIED") {
      return NextResponse.json(
        { code: "VERIFIED_TRANSFER_REQUIRED", message: "ปรับได้เฉพาะรายการที่ Finance ตรวจแล้ว" },
        { status: 409 },
      );
    }

    const admin = createInsForgeAdminClient();
    const result = await admin.database.rpc("create_payment_adjustment_private", {
      transfer_id_input: id,
      adjustment_type_input: parsed.data.adjustment_type,
      amount_input: parsed.data.amount === undefined ? null : -Math.abs(parsed.data.amount),
      reason_input: parsed.data.reason,
      session_token_hash_input: await currentFinanceSessionHash(),
    });
    if (result.error) return apiError(result.error);
    if (!result.data) return apiError(new Error("PAYMENT_ADJUSTMENT_CREATE_FAILED"));

    return NextResponse.json({
      data: { id: result.data },
      message: parsed.data.adjustment_type === "REVERSAL"
        ? "สร้างคำขอกลับรายการรับเงินแล้ว"
        : "สร้างคำขอปรับลดยอดรับเงินแล้ว",
    }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

