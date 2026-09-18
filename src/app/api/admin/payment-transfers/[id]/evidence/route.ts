import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api/response";
import { requireAppAccess } from "@/lib/auth/session";
import { loadBoundCustomerPaymentEvidence } from "@/lib/payments/bound-evidence";
import { currentFinanceSessionHash, loadAuthorizedFinanceTransfer } from "@/lib/payments/finance-access";
import { createInsForgeAdminClient } from "@/lib/insforge/admin";
import { isOrderOperationSliceVisible } from "@/lib/release-stage";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAppAccess({ active: true, permissions: ["payments.verify"] });
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) {
      return NextResponse.json(
        { code: "INVALID_INPUT", message: "รายการสลิปไม่ถูกต้อง" },
        { status: 400 },
      );
    }

    const transfer = await loadAuthorizedFinanceTransfer(id);
    if (!transfer) {
      return NextResponse.json({ code: "EVIDENCE_NOT_VERIFIED", message: "ไม่พบหลักฐานที่เปิดดูได้" }, { status: 404 });
    }
    if (transfer.scheduleType === "FREIGHT" && !isOrderOperationSliceVisible(8)) {
      return NextResponse.json({ code: "RELEASE_NOT_ENABLED", message: "งวดค่าขนส่งยังไม่เปิดใช้งาน" }, { status: 404 });
    }
    const evidence = await loadBoundCustomerPaymentEvidence(id, transfer.organizationId);
    if (!evidence) {
      return NextResponse.json(
        { code: "EVIDENCE_NOT_VERIFIED", message: "ไม่พบไฟล์หลักฐานที่ผูกกับรายการนี้หรือไฟล์ไม่สมบูรณ์" },
        { status: 404 },
      );
    }
    const admin = createInsForgeAdminClient();
    const receipt = await admin.database.rpc("record_customer_payment_evidence_preview", {
      transfer_id_input: id,
      session_token_hash_input: await currentFinanceSessionHash(),
      evidence_file_id_input: evidence.fileId,
      sha256_input: evidence.sha256,
      size_bytes_input: evidence.byteSize,
      mime_type_input: evidence.mimeType,
    });
    if (receipt.error || !receipt.data) throw receipt.error ?? new Error("PREVIEW_RECEIPT_FAILED");
    return new NextResponse(evidence.blob, {
      headers: {
        "Content-Type": evidence.mimeType,
        "Content-Disposition": "inline",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
