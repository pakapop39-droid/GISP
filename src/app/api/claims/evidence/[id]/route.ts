import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api/response";
import { requireAppAccess } from "@/lib/auth/session";
import { createInsForgeAdminClient } from "@/lib/insforge/admin";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ message: "ไฟล์ไม่ถูกต้อง" }, { status: 400 });
  try {
    const context = await requireAppAccess({ active: true });
    const admin = createInsForgeAdminClient();
    const linkResult = await admin.database.from("claim_evidence").select("claim_id,is_member_visible").eq("file_id", id).maybeSingle();
    if (linkResult.error) throw linkResult.error;
    if (!linkResult.data) return NextResponse.json({ message: "ไม่พบหลักฐาน Claim" }, { status: 404 });
    const claimResult = await admin.database.from("claims").select("member_profile_id,organization_id").eq("id", linkResult.data.claim_id).maybeSingle();
    if (claimResult.error) throw claimResult.error;
    const ownVisible = claimResult.data?.member_profile_id === context.memberProfileId && linkResult.data.is_member_visible;
    const canManage = context.permissions.includes("claims.manage") && (!context.organizationId || claimResult.data?.organization_id === context.organizationId);
    if (!ownVisible && !canManage) return NextResponse.json({ message: "ไม่มีสิทธิ์ดูหลักฐานนี้" }, { status: 403 });
    const fileResult = await admin.database.from("file_metadata").select("bucket,object_key").eq("id", id).maybeSingle();
    if (fileResult.error || !fileResult.data) throw fileResult.error ?? new Error("ไม่พบไฟล์");
    const signed = await admin.storage.from(fileResult.data.bucket).createSignedUrl(fileResult.data.object_key, 300);
    if (signed.error || !signed.data) throw signed.error ?? new Error("สร้างลิงก์ไฟล์ไม่สำเร็จ");
    if (new URL(request.url).searchParams.get("redirect") === "1") return NextResponse.redirect(signed.data.signedUrl);
    return NextResponse.json({ data: signed.data });
  } catch (error) { return apiError(error); }
}
