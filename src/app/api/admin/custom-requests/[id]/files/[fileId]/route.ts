import { NextResponse, type NextRequest } from "next/server";
import { apiError } from "@/lib/api/response";
import { requireRfqAdmin } from "@/lib/custom-rfq/server";
import { assertOrganizationPermission } from "@/lib/auth/session";
import { createInsForgeAdminClient } from "@/lib/insforge/admin";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  try {
    const context = await requireRfqAdmin();
    const { id, fileId } = await params;
    const admin = createInsForgeAdminClient();
    const [customRequest, link, file] = await Promise.all([
      admin.database.from("custom_requests").select("id,organization_id,member_profile_id").eq("id", id).maybeSingle(),
      admin.database.from("custom_request_files").select("custom_request_id,file_id").eq("custom_request_id", id).eq("file_id", fileId).maybeSingle(),
      admin.database.from("file_metadata").select("id,organization_id,member_profile_id,entity_type,entity_id,bucket,visibility,object_key").eq("id", fileId).maybeSingle(),
    ]);
    if (customRequest.error) throw customRequest.error;
    if (link.error) throw link.error;
    if (file.error) throw file.error;
    const requestData = customRequest.data;
    const linkData = link.data;
    const fileData = file.data;
    const expectedPrefix = requestData
      ? `custom-requests/${requestData.member_profile_id}/${id}/`
      : "";
    if (
      requestData?.id !== id
      || !requestData.organization_id
      || !requestData.member_profile_id
      || linkData?.custom_request_id !== id
      || linkData.file_id !== fileId
      || fileData?.id !== fileId
      || fileData.entity_type !== "CUSTOM_REQUEST"
      || fileData.entity_id !== id
      || fileData.organization_id !== requestData.organization_id
      || fileData.member_profile_id !== requestData.member_profile_id
      || fileData.bucket !== "gisp-member-private"
      || fileData.visibility !== "MEMBER_PRIVATE"
      || typeof fileData.object_key !== "string"
      || fileData.object_key.length <= expectedPrefix.length
      || !fileData.object_key.startsWith(expectedPrefix)
    ) return NextResponse.json({ message: "ไม่พบไฟล์" }, { status: 404 });
    assertOrganizationPermission(context, ["rfq.manage"], requestData.organization_id);
    const signed = await admin.storage.from(fileData.bucket).createSignedUrl(fileData.object_key, 300);
    if (signed.error || !signed.data) throw signed.error ?? new Error("SIGNED_URL_FAILED");
    return NextResponse.redirect(signed.data.signedUrl);
  } catch (error) { return apiError(error); }
}
