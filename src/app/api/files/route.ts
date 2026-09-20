import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { apiError } from "@/lib/api/response";
import { assertOrganizationPermission, requireAppAccess } from "@/lib/auth/session";
import { createInsForgeAdminClient } from "@/lib/insforge/admin";

const allowedTypes = new Set(["application/pdf", "image/jpeg", "image/png"]);
const maxBytes = 10 * 1024 * 1024;

export async function GET(request: NextRequest) {
  try {
    const context = await requireAppAccess({ active: false });
    const requestedProfileId = request.nextUrl.searchParams.get("memberProfileId") ?? context.memberProfileId ?? "";
    if (!requestedProfileId) {
      return NextResponse.json({ code: "PERMISSION_DENIED", message: "ไม่มีสิทธิ์ดูไฟล์ของสมาชิกนี้" }, { status: 403 });
    }
    const admin = createInsForgeAdminClient();
    if (requestedProfileId !== context.memberProfileId) {
      const target = await admin.database.from("member_profiles").select("organization_id")
        .eq("id", requestedProfileId).maybeSingle();
      if (target.error) throw target.error;
      if (!target.data?.organization_id) return NextResponse.json({ code: "NOT_FOUND", message: "ไม่พบสมาชิก" }, { status: 404 });
      assertOrganizationPermission(context, ["files.member.manage"], target.data.organization_id);
    }
    const result = await admin.database
      .from("file_metadata")
      .select("id,original_name,mime_type,size_bytes,visibility,created_at")
      .eq("member_profile_id", requestedProfileId)
      .eq("entity_type", "MEMBER_APPLICATION")
      .order("created_at", { ascending: false });

    if (result.error) throw result.error;
    return NextResponse.json({ data: result.data ?? [] });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await requireAppAccess({ active: false });
    const form = await request.formData();
    const file = form.get("file");
    const requestedProfileId = String(form.get("memberProfileId") ?? context.memberProfileId ?? "");
    const confidential = form.get("visibility") === "CONFIDENTIAL";
    if (!(file instanceof File) || !allowedTypes.has(file.type) || file.size <= 0 || file.size > maxBytes) {
      return NextResponse.json({ code: "INVALID_FILE", message: "รองรับ PDF, JPEG, PNG ขนาดไม่เกิน 10 MB" }, { status: 400 });
    }
    if (!requestedProfileId) {
      return NextResponse.json({ code: "PERMISSION_DENIED", message: "ไม่มีสิทธิ์อัปโหลดไฟล์ให้สมาชิกนี้" }, { status: 403 });
    }
    const admin = createInsForgeAdminClient();
    let targetOrganizationId = context.organizationId;
    if (requestedProfileId !== context.memberProfileId) {
      const target = await admin.database.from("member_profiles").select("organization_id")
        .eq("id", requestedProfileId).maybeSingle();
      if (target.error) throw target.error;
      if (!target.data?.organization_id) return NextResponse.json({ code: "NOT_FOUND", message: "ไม่พบสมาชิก" }, { status: 404 });
      targetOrganizationId = target.data.organization_id;
      assertOrganizationPermission(context, ["files.member.manage"], target.data.organization_id);
    }
    if (!targetOrganizationId) {
      return NextResponse.json({ code: "PERMISSION_DENIED", message: "ไม่พบขอบเขตองค์กรของไฟล์" }, { status: 403 });
    }
    if (confidential) {
      assertOrganizationPermission(context, ["files.confidential.manage"], targetOrganizationId);
    }
    const countResult = await admin.database.from("file_metadata").select("id", { count: "exact", head: true }).eq("member_profile_id", requestedProfileId).eq("entity_type", "MEMBER_APPLICATION");
    if ((countResult.count ?? 0) >= 5) return NextResponse.json({ code: "FILE_LIMIT_REACHED", message: "เอกสารสมัครได้สูงสุด 5 ไฟล์" }, { status: 409 });
    const bucket = confidential ? "gisp-confidential" : "gisp-member-private";
    const safeExtension = file.type === "application/pdf" ? "pdf" : file.type === "image/png" ? "png" : "jpg";
    const key = `members/${requestedProfileId}/${randomUUID()}.${safeExtension}`;
    const uploaded = await admin.storage.from(bucket).upload(key, file);
    if (uploaded.error || !uploaded.data) throw uploaded.error ?? new Error("UPLOAD_FAILED");
    const storageData = uploaded.data as unknown as { url?: string; key?: string };
    const inserted = await admin.database.from("file_metadata").insert([{
      organization_id: targetOrganizationId, member_profile_id: requestedProfileId, bucket,
      object_key: storageData.key ?? key, url: storageData.url ?? null, original_name: file.name,
      mime_type: file.type, size_bytes: file.size, visibility: confidential ? "CONFIDENTIAL" : "MEMBER_PRIVATE",
      entity_type: "MEMBER_APPLICATION", uploaded_by: context.userId,
    }]).select("*").single();
    if (inserted.error) throw inserted.error;
    return NextResponse.json({ data: inserted.data, message: "อัปโหลดเอกสารแล้ว" }, { status: 201 });
  } catch (error) { return apiError(error); }
}
