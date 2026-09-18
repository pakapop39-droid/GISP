import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError, invalidInput } from "@/lib/api/response";
import { AppAccessError, requireAppAccess } from "@/lib/auth/session";
import { createInsForgeAdminClient } from "@/lib/insforge/admin";
import { createInsForgeServerClient } from "@/lib/insforge/server";

const idSchema = z.uuid();
const bucket = "gisp-confidential";
const maxBytes = 10 * 1024 * 1024;
const allowedTypes = new Map([
  ["application/pdf", "pdf"],
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
]);

async function validatedEvidenceExtension(file: File) {
  const extension = allowedTypes.get(file.type);
  if (!extension || file.size <= 0 || file.size > maxBytes) return null;
  const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const valid = file.type === "application/pdf"
    ? new TextDecoder("ascii").decode(bytes.subarray(0, 5)) === "%PDF-"
    : file.type === "image/jpeg"
      ? bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
      : [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
        .every((value, index) => bytes[index] === value);
  return valid ? extension : null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!idSchema.safeParse(id).success) return invalidInput();

  let objectKey: string | null = null;
  let metadataId: string | null = null;
  let paymentCommitted = false;
  const admin = createInsForgeAdminClient();

  try {
    const context = await requireAppAccess({
      active: true,
      permissions: ["supplier_payments.manage"],
    });
    const payment = await admin.database.from("supplier_payments")
      .select("id,supplier_order_id,status").eq("id", id).maybeSingle();
    if (payment.error) throw payment.error;
    if (!payment.data) {
      return NextResponse.json({ code: "NOT_FOUND", message: "ไม่พบ Supplier Payment" }, { status: 404 });
    }
    if (payment.data.status !== "APPROVED") {
      return NextResponse.json({
        code: "INVALID_TRANSITION",
        message: "แนบหลักฐานจ่ายได้เฉพาะ Supplier Payment ที่อนุมัติแล้ว",
      }, { status: 409 });
    }

    const supplierOrder = await admin.database.from("supplier_orders")
      .select("id,organization_id").eq("id", payment.data.supplier_order_id).maybeSingle();
    if (supplierOrder.error) throw supplierOrder.error;
    if (!supplierOrder.data?.organization_id) {
      return NextResponse.json({ code: "NOT_FOUND", message: "ไม่พบ Supplier Order ของรายการจ่ายนี้" }, { status: 404 });
    }
    if (context.organizationId && context.organizationId !== supplierOrder.data.organization_id) {
      throw new AppAccessError("PERMISSION_DENIED", 403, "ไม่มีสิทธิ์จัดการ Supplier Payment ขององค์กรนี้");
    }

    const form = await request.formData();
    const file = form.get("file");
    const extension = file instanceof File ? await validatedEvidenceExtension(file) : null;
    if (!(file instanceof File) || !extension) {
      return NextResponse.json({
        code: "INVALID_FILE",
        message: "รองรับ PDF, JPEG, PNG ขนาดไม่เกิน 10 MB",
      }, { status: 400 });
    }

    objectKey = `payments/supplier/${supplierOrder.data.organization_id}/${id}/${randomUUID()}.${extension}`;
    const uploaded = await admin.storage.from(bucket).upload(objectKey, file);
    if (uploaded.error || !uploaded.data) throw uploaded.error ?? new Error("UPLOAD_FAILED");
    const storageData = uploaded.data as unknown as { url?: string; key?: string };
    objectKey = storageData.key ?? objectKey;

    const inserted = await admin.database.from("file_metadata").insert([{
      organization_id: supplierOrder.data.organization_id,
      member_profile_id: null,
      bucket,
      object_key: objectKey,
      url: storageData.url ?? null,
      original_name: file.name,
      mime_type: file.type,
      size_bytes: file.size,
      visibility: "CONFIDENTIAL",
      entity_type: "SUPPLIER_PAYMENT_EVIDENCE",
      entity_id: id,
      uploaded_by: context.userId,
    }]).select("id,original_name,mime_type,size_bytes,visibility").single();
    if (inserted.error || !inserted.data) throw inserted.error ?? new Error("FILE_METADATA_FAILED");
    metadataId = inserted.data.id;

    const insforge = await createInsForgeServerClient();
    const auth = await insforge.auth.getCurrentUser();
    if (auth.error || !auth.data?.user) {
      throw new AppAccessError("SESSION_REVOKED", 401, "กรุณาเข้าสู่ระบบอีกครั้ง");
    }
    let markPaidFailure: unknown;
    try {
      const markedPaid = await insforge.database.rpc("mark_supplier_payment_paid", {
        supplier_payment_id_input: id,
        evidence_file_id_input: metadataId,
      });
      markPaidFailure = markedPaid.error;
    } catch (error) {
      markPaidFailure = error;
    }
    if (markPaidFailure) {
      let reconciled: { data: { status: string; evidence_file_id: string | null } | null; error: unknown };
      try {
        reconciled = await admin.database.from("supplier_payments")
          .select("status,evidence_file_id").eq("id", id).maybeSingle();
      } catch {
        return NextResponse.json({
          code: "PAYMENT_STATUS_UNCONFIRMED",
          message: "ยังยืนยันผลการบันทึก Paid ไม่ได้ ระบบเก็บหลักฐานไว้เพื่อความปลอดภัย กรุณาโหลดหน้าใหม่และตรวจสถานะก่อนทำซ้ำ",
        }, { status: 503 });
      }
      if (!reconciled.error && reconciled.data?.status === "PAID"
        && reconciled.data.evidence_file_id === metadataId) {
        paymentCommitted = true;
        return NextResponse.json({
          data: { paymentId: id, evidence: inserted.data },
          message: "บันทึก Supplier Payment เป็น Paid แล้ว",
          notificationWarning: "ยืนยันสถานะ Paid จากระบบแล้ว แต่ไม่ได้รับผลตอบกลับครั้งแรก กรุณาตรวจประวัติรายการ",
        });
      }
      if (reconciled.error || !reconciled.data) {
        return NextResponse.json({
          code: "PAYMENT_STATUS_UNCONFIRMED",
          message: "ยังยืนยันผลการบันทึก Paid ไม่ได้ ระบบเก็บหลักฐานไว้เพื่อความปลอดภัย กรุณาโหลดหน้าใหม่และตรวจสถานะก่อนทำซ้ำ",
        }, { status: 503 });
      }
      throw markPaidFailure;
    }
    // Commit boundary: the payment now references this evidence, so later failures must never remove it.
    paymentCommitted = true;

    let notificationWarning: string | undefined;
    if (auth.data.user.email) {
      try {
        const notification = await insforge.database.rpc("queue_current_user_notification", {
          type_input: "MARK_SUPPLIER_PAYMENT_PAID",
          title_input: "บันทึก Supplier Payment เป็น Paid แล้ว",
          body_input: "บันทึก Supplier Payment เป็น Paid แล้ว",
          recipient_email_input: auth.data.user.email,
          action_url_input: null,
        });
        if (notification.error) {
          notificationWarning = "ธุรกรรมสำเร็จ แต่สร้าง Email Job ไม่สำเร็จ ระบบต้องตรวจ Log";
        }
      } catch {
        notificationWarning = "ธุรกรรมสำเร็จ แต่สร้าง Email Job ไม่สำเร็จ ระบบต้องตรวจ Log";
      }
    }

    return NextResponse.json({
      data: { paymentId: id, evidence: inserted.data },
      message: "บันทึก Supplier Payment เป็น Paid แล้ว",
      notificationWarning,
    });
  } catch (error) {
    if (paymentCommitted) {
      return NextResponse.json({
        data: { paymentId: id, evidenceId: metadataId },
        message: "บันทึก Supplier Payment เป็น Paid แล้ว",
        notificationWarning: "ธุรกรรมสำเร็จ แต่ขั้นตอนหลังบันทึกมีปัญหา ระบบต้องตรวจ Log",
      });
    }
    const cleanup: PromiseLike<unknown>[] = [];
    if (metadataId) cleanup.push(admin.database.from("file_metadata").delete().eq("id", metadataId));
    if (objectKey) cleanup.push(admin.storage.from(bucket).remove(objectKey));
    const cleanupResults = await Promise.allSettled(cleanup);
    const cleanupFailed = cleanupResults.some((result) => result.status === "rejected"
      || (result.value && typeof result.value === "object" && "error" in result.value && result.value.error));
    if (cleanupFailed) {
      console.error("Supplier payment evidence cleanup incomplete", {
        supplierPaymentId: id,
        metadataCleanupRequested: Boolean(metadataId),
        objectCleanupRequested: Boolean(objectKey),
      });
    }
    return apiError(error);
  }
}
