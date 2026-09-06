import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { apiError } from "@/lib/api/response";
import { requireAppAccess } from "@/lib/auth/session";
import { createInsForgeAdminClient } from "@/lib/insforge/admin";

const allowedTypes = new Set(["application/pdf", "image/jpeg", "image/png", "video/mp4"]);
const maxBytes = 25 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const context = await requireAppAccess({ active: true });
    const isMember = context.roles.includes("MEMBER") && Boolean(context.memberProfileId);
    const canManage = context.permissions.includes("claims.manage");
    if (!isMember && !canManage) return NextResponse.json({ message: "ไม่มีสิทธิ์อัปโหลดหลักฐาน Claim" }, { status: 403 });
    const form = await request.formData();
    const file = form.get("file");
    const memberProfileId = String(form.get("memberProfileId") ?? context.memberProfileId ?? "");
    if (!(file instanceof File) || !allowedTypes.has(file.type) || file.size <= 0 || file.size > maxBytes) {
      return NextResponse.json({ message: "รองรับ PDF, JPG, PNG หรือ MP4 ขนาดไม่เกิน 25 MB" }, { status: 400 });
    }
    if (!memberProfileId || (isMember && memberProfileId !== context.memberProfileId)) {
      return NextResponse.json({ message: "ไม่พบ Member Profile สำหรับหลักฐาน" }, { status: 400 });
    }
    const extension = file.type === "application/pdf" ? "pdf" : file.type === "image/png" ? "png" : file.type === "video/mp4" ? "mp4" : "jpg";
    const key = `claims/${memberProfileId}/${randomUUID()}.${extension}`;
    const admin = createInsForgeAdminClient();
    const uploaded = await admin.storage.from("gisp-member-private").upload(key, file);
    if (uploaded.error || !uploaded.data) throw uploaded.error ?? new Error("อัปโหลดหลักฐานไม่สำเร็จ");
    const storageData = uploaded.data as unknown as { url?: string; key?: string };
    const inserted = await admin.database.from("file_metadata").insert([{
      organization_id: context.organizationId, member_profile_id: memberProfileId,
      bucket: "gisp-member-private", object_key: storageData.key ?? key, url: storageData.url ?? null,
      original_name: file.name, mime_type: file.type, size_bytes: file.size,
      visibility: "MEMBER_PRIVATE", entity_type: "CLAIM_EVIDENCE", uploaded_by: context.userId,
    }]).select("id,original_name,mime_type").single();
    if (inserted.error) throw inserted.error;
    return NextResponse.json({ data: inserted.data, message: "อัปโหลดหลักฐานแล้ว" }, { status: 201 });
  } catch (error) { return apiError(error); }
}
