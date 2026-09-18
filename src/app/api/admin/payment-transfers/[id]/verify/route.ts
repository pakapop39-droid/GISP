import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api/response";
import { requireAppAccess } from "@/lib/auth/session";
import { loadBoundCustomerPaymentEvidence } from "@/lib/payments/bound-evidence";
import { currentFinanceSessionHash, loadAuthorizedFinanceTransfer } from "@/lib/payments/finance-access";
import { createInsForgeAdminClient } from "@/lib/insforge/admin";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { isOrderOperationSliceVisible } from "@/lib/release-stage";

const schema = z.object({
  id: z.uuid(),
  approve: z.boolean(),
  evidence_confirmed: z.boolean().optional(),
  finance_note: z.string().trim().max(1000).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ code: "INVALID_INPUT", message: "รูปแบบ JSON ไม่ถูกต้อง" }, { status: 400 });
  }
  const parsed = schema.safeParse({ ...body, id });
  if (!parsed.success) return NextResponse.json({ code: "INVALID_INPUT", message: "ข้อมูลไม่ครบหรือรูปแบบไม่ถูกต้อง" }, { status: 400 });
  if (parsed.data.approve && parsed.data.evidence_confirmed !== true) {
    return NextResponse.json({ code: "EVIDENCE_CONFIRMATION_REQUIRED", message: "ต้องยืนยันว่าเปิดตรวจสลิปและยอดเงินแล้ว" }, { status: 400 });
  }
  if (!parsed.data.approve && !parsed.data.finance_note) {
    return NextResponse.json({ code: "REJECTION_REASON_REQUIRED", message: "กรุณาระบุเหตุผลที่ไม่ผ่าน" }, { status: 400 });
  }
  try {
    await requireAppAccess({ active: true, permissions: ["payments.verify"] });
    const transfer = await loadAuthorizedFinanceTransfer(id);
    if (!transfer) {
      return NextResponse.json({ code: "TRANSFER_NOT_AVAILABLE", message: "ไม่พบรายการที่ตรวจได้" }, { status: 404 });
    }
    if (transfer.scheduleType === "FREIGHT" && !isOrderOperationSliceVisible(8)) {
      return NextResponse.json({ code: "RELEASE_NOT_ENABLED", message: "งวดค่าขนส่งยังไม่เปิดใช้งาน" }, { status: 404 });
    }
    if (transfer.status !== "SUBMITTED") {
      return NextResponse.json({ code: "TRANSFER_NOT_VERIFIABLE", message: "รายการนี้ตรวจแล้ว" }, { status: 409 });
    }

    // A rejected transfer must remain rejectable even when its file is missing.
    const evidence = parsed.data.approve
      ? await loadBoundCustomerPaymentEvidence(id, transfer.organizationId)
      : null;
    if (parsed.data.approve && !evidence) {
      return NextResponse.json({
        code: "EVIDENCE_NOT_VERIFIED",
        message: "หลักฐานไม่ตรงรายการหรือไม่สามารถเปิดไฟล์ที่เก็บจริงได้ กรุณาตรวจและปฏิเสธรายการที่ผิด",
      }, { status: 409 });
    }

    const admin = createInsForgeAdminClient();
    const result = await admin.database.rpc("verify_payment_transfer_private", {
      transfer_id_input: id,
      approve_input: parsed.data.approve,
      finance_note_input: parsed.data.finance_note ?? null,
      session_token_hash_input: await currentFinanceSessionHash(),
      evidence_file_id_input: evidence?.fileId ?? null,
      sha256_input: evidence?.sha256 ?? null,
      size_bytes_input: evidence?.byteSize ?? null,
    });
    if (result.error || !result.data) return apiError(result.error ?? new Error("PAYMENT_VERIFICATION_FAILED"));

    let notificationWarning: string | undefined;
    try {
      const userClient = await createInsForgeServerClient();
      const auth = await userClient.auth.getCurrentUser();
      if (auth.error) {
        notificationWarning = "ธุรกรรมสำเร็จ แต่ตรวจข้อมูลแจ้งเตือนไม่สำเร็จ ระบบต้องตรวจ Log";
      } else if (auth.data?.user?.email) {
        const notification = await userClient.database.rpc("queue_current_user_notification", {
          type_input: "VERIFY_PAYMENT_TRANSFER_PRIVATE",
          title_input: "บันทึกผลการตรวจเงินแล้ว",
          body_input: "บันทึกผลการตรวจเงินแล้ว",
          recipient_email_input: auth.data.user.email,
          action_url_input: null,
        });
        if (notification.error) notificationWarning = "ธุรกรรมสำเร็จ แต่สร้าง Email Job ไม่สำเร็จ ระบบต้องตรวจ Log";
      }
    } catch {
      notificationWarning = "ธุรกรรมสำเร็จ แต่สร้าง Email Job ไม่สำเร็จ ระบบต้องตรวจ Log";
    }
    return NextResponse.json({ data: result.data, message: "บันทึกผลการตรวจเงินแล้ว", notificationWarning });
  } catch (error) {
    return apiError(error);
  }
}
