import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError, invalidInput } from "@/lib/api/response";
import { requireAppAccess } from "@/lib/auth/session";
import { createInsForgeAdminClient } from "@/lib/insforge/admin";

const artifactTypes = ["CATALOG_IMPORT_NATIVE_TEXT", "CATALOG_IMPORT_OCR_TEXT", "CATALOG_IMPORT_AI_RAW", "CATALOG_IMPORT_PAGE"];

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  const { id, fileId } = await params;
  if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(fileId).success) return invalidInput();
  try {
    await requireAppAccess({ permissions: ["catalog.import"] });
    const admin = createInsForgeAdminClient();
    const job = await admin.database.from("catalog_import_jobs").select("id,security_status,security_verified_at")
      .eq("id", id).eq("source_type", "PDF").maybeSingle();
    if (job.error) throw job.error;
    if (!job.data) return NextResponse.json({ code: "NOT_FOUND", message: "ไม่พบ Import Job" }, { status: 404 });
    if (job.data.security_status !== "VERIFIED" || !job.data.security_verified_at) {
      return NextResponse.json({ code: "SECURITY_PENDING", message: "ไฟล์ยังไม่ผ่านการตรวจความปลอดภัย" }, { status: 423 });
    }
    const file = await admin.database.from("file_metadata").select("bucket,object_key")
      .eq("id", fileId).eq("entity_id", id).eq("visibility", "CONFIDENTIAL").in("entity_type", artifactTypes).maybeSingle();
    if (file.error) throw file.error;
    if (!file.data) return NextResponse.json({ code: "NOT_FOUND", message: "ไม่พบ Artifact" }, { status: 404 });
    const signed = await admin.storage.from(file.data.bucket).createSignedUrl(file.data.object_key, 300);
    if (signed.error || !signed.data) throw signed.error ?? new Error("SIGNED_URL_FAILED");
    return NextResponse.redirect(signed.data.signedUrl);
  } catch (error) { return apiError(error); }
}
