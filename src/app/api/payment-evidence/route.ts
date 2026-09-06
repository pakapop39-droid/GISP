import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { apiError } from "@/lib/api/response";
import { AppAccessError, requireAppAccess } from "@/lib/auth/session";
import { createInsForgeAdminClient } from "@/lib/insforge/admin";

const allowedTypes = new Set(["application/pdf", "image/jpeg", "image/png"]);
const maxBytes = 10 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const context = await requireAppAccess({ active: true });
    const form = await request.formData();
    const file = form.get("file");
    const purpose = String(form.get("purpose") ?? "CUSTOMER");
    const isSupplier = purpose === "SUPPLIER";
    if (!(file instanceof File) || !allowedTypes.has(file.type) || file.size <= 0 || file.size > maxBytes) {
      return NextResponse.json({ code: "INVALID_FILE", message: "รองรับ PDF, JPEG, PNG ขนาดไม่เกิน 10 MB" }, { status: 400 });
    }
    if (isSupplier && !context.permissions.includes("supplier_payments.manage")) {
      throw new AppAccessError("PERMISSION_DENIED", 403, "ไม่มีสิทธิ์อัปโหลดหลักฐาน Supplier Payment");
    }
    if (!isSupplier && !context.roles.includes("MEMBER")) {
      throw new AppAccessError("PERMISSION_DENIED", 403, "หลักฐานนี้สำหรับสมาชิก");
    }
    const profileId = isSupplier ? null : context.memberProfileId;
    if (!isSupplier && !profileId) throw new AppAccessError("PERMISSION_DENIED", 403, "ไม่พบข้อมูลสมาชิก");
    const admin = createInsForgeAdminClient();
    const bucket = isSupplier ? "gisp-confidential" : "gisp-member-private";
    const extension = file.type === "application/pdf" ? "pdf" : file.type === "image/png" ? "png" : "jpg";
    const key = `payments/${isSupplier ? "supplier" : profileId}/${randomUUID()}.${extension}`;
    const uploaded = await admin.storage.from(bucket).upload(key, file);
    if (uploaded.error || !uploaded.data) throw uploaded.error ?? new Error("UPLOAD_FAILED");
    const storageData = uploaded.data as unknown as { url?: string; key?: string };
    const inserted = await admin.database.from("file_metadata").insert([{
      organization_id: context.organizationId,
      member_profile_id: profileId,
      bucket,
      object_key: storageData.key ?? key,
      url: storageData.url ?? null,
      original_name: file.name,
      mime_type: file.type,
      size_bytes: file.size,
      visibility: isSupplier ? "CONFIDENTIAL" : "MEMBER_PRIVATE",
      entity_type: isSupplier ? "SUPPLIER_PAYMENT_EVIDENCE" : "CUSTOMER_PAYMENT_EVIDENCE",
      uploaded_by: context.userId,
    }]).select("id,original_name,mime_type,size_bytes,visibility").single();
    if (inserted.error) throw inserted.error;
    return NextResponse.json({ data: inserted.data, message: "อัปโหลดหลักฐานแล้ว" }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
