import { NextResponse, type NextRequest } from "next/server";
import { apiError } from "@/lib/api/response";
import { requireMember } from "@/lib/custom-rfq/server";
import { createInsForgeAdminClient } from "@/lib/insforge/admin";

async function authorizedFile(requestId: string, fileId: string, memberProfileId: string | null) {
  const admin = createInsForgeAdminClient();
  const [requestResult, linkResult, fileResult] = await Promise.all([
    admin.database.from("custom_requests").select("id,member_profile_id,status").eq("id", requestId).maybeSingle(),
    admin.database.from("custom_request_files").select("file_id").eq("custom_request_id", requestId).eq("file_id", fileId).maybeSingle(),
    admin.database.from("file_metadata").select("id,bucket,object_key,original_name").eq("id", fileId).maybeSingle(),
  ]);
  for (const result of [requestResult, linkResult, fileResult]) if (result.error) throw result.error;
  if (!requestResult.data || requestResult.data.member_profile_id !== memberProfileId || !linkResult.data || !fileResult.data) return null;
  return { admin, request: requestResult.data, file: fileResult.data };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  try {
    const context = await requireMember();
    const { id, fileId } = await params;
    const access = await authorizedFile(id, fileId, context.memberProfileId);
    if (!access) return NextResponse.json({ message: "ไม่พบไฟล์" }, { status: 404 });
    const signed = await access.admin.storage.from(access.file.bucket).createSignedUrl(access.file.object_key, 300);
    if (signed.error || !signed.data) throw signed.error ?? new Error("SIGNED_URL_FAILED");
    return NextResponse.redirect(signed.data.signedUrl);
  } catch (error) { return apiError(error); }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  try {
    const context = await requireMember();
    const { id, fileId } = await params;
    const access = await authorizedFile(id, fileId, context.memberProfileId);
    if (!access) return NextResponse.json({ message: "ไม่พบไฟล์" }, { status: 404 });
    if (!["DRAFT", "NEED_INFO"].includes(access.request.status)) {
      return NextResponse.json({ code: "REQUEST_LOCKED", message: "ลบไฟล์ได้เฉพาะร่างหรือช่วงรอข้อมูลเพิ่ม" }, { status: 409 });
    }
    const link = await access.admin.database.from("custom_request_files").delete().eq("custom_request_id", id).eq("file_id", fileId);
    if (link.error) throw link.error;
    const metadata = await access.admin.database.from("file_metadata").delete().eq("id", fileId);
    if (metadata.error) throw metadata.error;
    await access.admin.storage.from(access.file.bucket).remove(access.file.object_key);
    return NextResponse.json({ message: "ลบไฟล์แล้ว" });
  } catch (error) { return apiError(error); }
}
