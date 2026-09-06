import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api/response";
import { requireMember } from "@/lib/custom-rfq/server";
import { customRequestFileRoles } from "@/lib/custom-rfq/types";
import { createInsForgeAdminClient } from "@/lib/insforge/admin";

const roleSchema = z.enum(customRequestFileRoles);
const maxBytes = 25 * 1024 * 1024;
const extensions = new Set(["pdf", "jpg", "jpeg", "png", "dwg", "dxf"]);

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let uploadedKey = "";
  let metadataId = "";
  try {
    const context = await requireMember();
    const { id } = await params;
    const form = await request.formData();
    const file = form.get("file");
    const role = roleSchema.safeParse(form.get("fileRole"));
    const extension = file instanceof File ? (file.name.split(".").pop() ?? "").toLowerCase() : "";
    if (!(file instanceof File) || !role.success || file.size <= 0 || file.size > maxBytes || !extensions.has(extension)) {
      return NextResponse.json({ code: "INVALID_FILE", message: "รองรับ PDF, JPG, PNG, DWG และ DXF ขนาดไม่เกิน 25 MB" }, { status: 400 });
    }
    const admin = createInsForgeAdminClient();
    const requestResult = await admin.database.from("custom_requests").select("id,member_profile_id,status").eq("id", id).maybeSingle();
    if (requestResult.error) throw requestResult.error;
    if (!requestResult.data || requestResult.data.member_profile_id !== context.memberProfileId) {
      return NextResponse.json({ code: "PERMISSION_DENIED", message: "ไม่มีสิทธิ์แนบไฟล์กับคำขอนี้" }, { status: 403 });
    }
    if (!["DRAFT", "NEED_INFO"].includes(requestResult.data.status)) {
      return NextResponse.json({ code: "REQUEST_LOCKED", message: "เพิ่มหรือลบไฟล์ได้เฉพาะร่างหรือช่วงรอข้อมูลเพิ่ม" }, { status: 409 });
    }
    const count = await admin.database.from("custom_request_files").select("file_id", { count: "exact", head: true }).eq("custom_request_id", id);
    if ((count.count ?? 0) >= 10) return NextResponse.json({ code: "FILE_LIMIT_REACHED", message: "แนบไฟล์ได้สูงสุด 10 ไฟล์" }, { status: 409 });
    uploadedKey = `custom-requests/${context.memberProfileId}/${id}/${randomUUID()}.${extension}`;
    const uploaded = await admin.storage.from("gisp-member-private").upload(uploadedKey, file);
    if (uploaded.error || !uploaded.data) throw uploaded.error ?? new Error("UPLOAD_FAILED");
    const storageData = uploaded.data as unknown as { url?: string; key?: string };
    const metadata = await admin.database.from("file_metadata").insert([{
      organization_id: context.organizationId,
      member_profile_id: context.memberProfileId,
      bucket: "gisp-member-private",
      object_key: storageData.key ?? uploadedKey,
      url: storageData.url ?? null,
      original_name: file.name,
      mime_type: file.type || "application/octet-stream",
      size_bytes: file.size,
      visibility: "MEMBER_PRIVATE",
      entity_type: "CUSTOM_REQUEST",
      entity_id: id,
      uploaded_by: context.userId,
    }]).select("id,original_name,mime_type,size_bytes,created_at").single();
    if (metadata.error || !metadata.data) throw metadata.error ?? new Error("FILE_METADATA_FAILED");
    metadataId = metadata.data.id;
    const link = await admin.database.from("custom_request_files").insert([{
      custom_request_id: id, file_id: metadataId, file_role: role.data,
      version_number: 1, uploaded_by: context.userId,
    }]);
    if (link.error) throw link.error;
    return NextResponse.json({ data: { ...metadata.data, file_role: role.data, version_number: 1 }, message: "แนบไฟล์แล้ว" }, { status: 201 });
  } catch (error) {
    if (metadataId) {
      const admin = createInsForgeAdminClient();
      await admin.database.from("file_metadata").delete().eq("id", metadataId);
    }
    if (uploadedKey) await createInsForgeAdminClient().storage.from("gisp-member-private").remove(uploadedKey);
    return apiError(error);
  }
}
