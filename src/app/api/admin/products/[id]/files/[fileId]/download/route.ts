import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, invalidInput } from "@/lib/api/response";
import { requireAppAccess } from "@/lib/auth/session";
import { createInsForgeAdminClient } from "@/lib/insforge/admin";

export async function GET(request: Request, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  const { id, fileId } = await params;
  if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(fileId).success) return invalidInput();
  try {
    await requireAppAccess({ permissions: ["catalog.read"] });
    const admin = createInsForgeAdminClient();
    const { data: file, error } = await admin.database.from("file_metadata").select("id,bucket,object_key,entity_id").eq("id", fileId).maybeSingle();
    if (error) throw error;
    if (!file || file.entity_id !== id) return NextResponse.json({ code: "NOT_FOUND", message: "ไม่พบไฟล์" }, { status: 404 });
    const signed = await admin.storage.from(file.bucket).createSignedUrl(file.object_key, 300);
    if (signed.error || !signed.data) throw signed.error ?? new Error("SIGNED_URL_FAILED");
    if (new URL(request.url).searchParams.get("redirect") === "1") return NextResponse.redirect(signed.data.signedUrl);
    return NextResponse.json({ data: { url: signed.data.signedUrl, expiresAt: signed.data.expiresAt } });
  } catch (error) { return apiError(error); }
}
