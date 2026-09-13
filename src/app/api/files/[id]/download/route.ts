import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api/response";
import { requireAppAccess } from "@/lib/auth/session";
import { createInsForgeAdminClient } from "@/lib/insforge/admin";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ code: "INVALID_INPUT", message: "ไฟล์ไม่ถูกต้อง" }, { status: 400 });
  try {
    const context = await requireAppAccess({ active: false });
    const admin = createInsForgeAdminClient();
    const { data: file, error } = await admin.database.from("file_metadata").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!file) return NextResponse.json({ code: "NOT_FOUND", message: "ไม่พบไฟล์" }, { status: 404 });
    if (typeof file.entity_type === "string" && file.entity_type.startsWith("CATALOG_IMPORT") && file.entity_id) {
      const job = await admin.database.from("catalog_import_jobs").select("source_type,security_status,security_verified_at")
        .eq("id", file.entity_id).maybeSingle();
      if (job.error) throw job.error;
      if (job.data?.source_type === "PDF") {
        if (!context.permissions.includes("catalog.import")) {
          return NextResponse.json({ code: "PERMISSION_DENIED", message: "ไม่มีสิทธิ์ดาวน์โหลดไฟล์" }, { status: 403 });
        }
        if (job.data.security_status !== "VERIFIED" || !job.data.security_verified_at) {
          return NextResponse.json({ code: "SECURITY_PENDING", message: "ไฟล์ยังไม่ผ่านการตรวจความปลอดภัย" }, { status: 423 });
        }
      }
    }
    const own = file.member_profile_id === context.memberProfileId;
    const staff = context.permissions.includes("files.member.manage");
    const confidential = file.visibility === "CONFIDENTIAL";
    if ((!own && !staff) || (confidential && !context.permissions.includes("files.confidential.read"))) {
      return NextResponse.json({ code: "PERMISSION_DENIED", message: "ไม่มีสิทธิ์ดาวน์โหลดไฟล์" }, { status: 403 });
    }
    const signed = await admin.storage.from(file.bucket).createSignedUrl(file.object_key, 300);
    if (signed.error || !signed.data) throw signed.error ?? new Error("SIGNED_URL_FAILED");
    if (new URL(request.url).searchParams.get("redirect") === "1") {
      return NextResponse.redirect(signed.data.signedUrl);
    }
    return NextResponse.json({ data: { url: signed.data.signedUrl, expiresAt: signed.data.expiresAt } });
  } catch (error) { return apiError(error); }
}
