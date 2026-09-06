import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { apiError } from "@/lib/api/response";
import { createInsForgeAdminClient } from "@/lib/insforge/admin";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { requireMember } from "@/lib/shared-catalog/server";

const allowedTypes = new Map([["image/jpeg", "jpg"], ["image/png", "png"], ["image/webp", "webp"]]);
const maxBytes = 5 * 1024 * 1024;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let uploadedKey = ""; let metadataId = "";
  try {
    const context = await requireMember(); const { id } = await params;
    const form = await request.formData(); const file = form.get("file");
    if (!(file instanceof File) || !allowedTypes.has(file.type) || file.size <= 0 || file.size > maxBytes) {
      return NextResponse.json({ code: "INVALID_FILE", message: "รองรับ JPG, PNG และ WebP ขนาดไม่เกิน 5 MB" }, { status: 400 });
    }
    const admin = createInsForgeAdminClient();
    const catalog = await admin.database.from("shared_catalogs").select("id,member_profile_id").eq("id", id).maybeSingle();
    if (catalog.error) throw catalog.error;
    if (!catalog.data || catalog.data.member_profile_id !== context.memberProfileId) return NextResponse.json({ message: "ไม่มีสิทธิ์แก้ Catalog นี้" }, { status: 403 });
    uploadedKey = `shared-catalogs/${context.memberProfileId}/${id}/${randomUUID()}.${allowedTypes.get(file.type)}`;
    const uploaded = await admin.storage.from("gisp-member-private").upload(uploadedKey, file);
    if (uploaded.error || !uploaded.data) throw uploaded.error ?? new Error("UPLOAD_FAILED");
    const storageData = uploaded.data as unknown as { url?: string; key?: string };
    const metadata = await admin.database.from("file_metadata").insert([{
      organization_id: context.organizationId, member_profile_id: context.memberProfileId,
      bucket: "gisp-member-private", object_key: storageData.key ?? uploadedKey, url: storageData.url ?? null,
      original_name: file.name, mime_type: file.type, size_bytes: file.size, visibility: "MEMBER_PRIVATE",
      entity_type: "SHARED_CATALOG_LOGO", entity_id: id, uploaded_by: context.userId,
    }]).select("id").single();
    if (metadata.error || !metadata.data) throw metadata.error ?? new Error("FILE_METADATA_FAILED");
    metadataId = metadata.data.id;
    const db = await createInsForgeServerClient();
    const linked = await db.database.rpc("set_shared_catalog_logo", { catalog_id_input: id, file_id_input: metadataId });
    if (linked.error) throw linked.error;
    return NextResponse.json({ data: { id: metadataId }, message: "อัปโหลดโลโก้แล้ว" }, { status: 201 });
  } catch (error) {
    const admin = createInsForgeAdminClient();
    if (metadataId) await admin.database.from("file_metadata").delete().eq("id", metadataId);
    if (uploadedKey) await admin.storage.from("gisp-member-private").remove(uploadedKey);
    return apiError(error);
  }
}
