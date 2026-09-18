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
    if (purpose !== "CUSTOMER") {
      return NextResponse.json({
        code: "INVALID_INPUT",
        message: "หลักฐาน Supplier ต้องอัปโหลดจากรายการ Supplier Payment ที่อนุมัติแล้ว",
      }, { status: 400 });
    }
    if (!(file instanceof File) || !allowedTypes.has(file.type) || file.size <= 0 || file.size > maxBytes) {
      return NextResponse.json({ code: "INVALID_FILE", message: "รองรับ PDF, JPEG, PNG ขนาดไม่เกิน 10 MB" }, { status: 400 });
    }
    if (!context.roles.includes("MEMBER")) {
      throw new AppAccessError("PERMISSION_DENIED", 403, "หลักฐานนี้สำหรับสมาชิก");
    }
    const profileId = context.memberProfileId;
    if (!profileId) throw new AppAccessError("PERMISSION_DENIED", 403, "ไม่พบข้อมูลสมาชิก");
    const admin = createInsForgeAdminClient();
    const bucket = "gisp-member-private";
    const extension = file.type === "application/pdf" ? "pdf" : file.type === "image/png" ? "png" : "jpg";
    const key = `payments/${profileId}/${randomUUID()}.${extension}`;
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
      visibility: "MEMBER_PRIVATE",
      entity_type: "CUSTOMER_PAYMENT_EVIDENCE",
      uploaded_by: context.userId,
    }]).select("id,original_name,mime_type,size_bytes,visibility").single();
    if (inserted.error) throw inserted.error;
    return NextResponse.json({ data: inserted.data, message: "อัปโหลดหลักฐานแล้ว" }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
