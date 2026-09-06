import { NextResponse, type NextRequest } from "next/server";
import { apiError } from "@/lib/api/response";
import { requireRfqAdmin } from "@/lib/custom-rfq/server";
import { createInsForgeAdminClient } from "@/lib/insforge/admin";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  try {
    await requireRfqAdmin();
    const { id, fileId } = await params;
    const admin = createInsForgeAdminClient();
    const [link, file] = await Promise.all([
      admin.database.from("custom_request_files").select("file_id").eq("custom_request_id", id).eq("file_id", fileId).maybeSingle(),
      admin.database.from("file_metadata").select("id,bucket,object_key").eq("id", fileId).maybeSingle(),
    ]);
    if (link.error) throw link.error;
    if (file.error) throw file.error;
    if (!link.data || !file.data) return NextResponse.json({ message: "ไม่พบไฟล์" }, { status: 404 });
    const signed = await admin.storage.from(file.data.bucket).createSignedUrl(file.data.object_key, 300);
    if (signed.error || !signed.data) throw signed.error ?? new Error("SIGNED_URL_FAILED");
    return NextResponse.redirect(signed.data.signedUrl);
  } catch (error) { return apiError(error); }
}
