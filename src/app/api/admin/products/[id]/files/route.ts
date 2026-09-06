import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError, invalidInput } from "@/lib/api/response";
import { requireAppAccess } from "@/lib/auth/session";
import { productFileSchema } from "@/lib/catalog/api-schema";
import { createInsForgeAdminClient } from "@/lib/insforge/admin";
import { createInsForgeServerClient } from "@/lib/insforge/server";

const maxBytes = 10 * 1024 * 1024;
const imageTypes = new Map([["image/jpeg", "jpg"], ["image/png", "png"], ["image/webp", "webp"]]);
const documentTypes = new Map([["application/pdf", "pdf"]]);

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return invalidInput();
  try {
    const context = await requireAppAccess({ permissions: ["catalog.manage"] });
    const form = await request.formData();
    const file = form.get("file");
    const parsed = productFileSchema.safeParse({
      kind: form.get("kind"), documentType: form.get("documentType") || "OTHER",
      sourcePage: form.get("sourcePage") || "", isPrimary: form.get("isPrimary") === "true",
      isMemberVisible: form.get("isMemberVisible") === "true",
    });
    if (!(file instanceof File) || !parsed.success || file.size <= 0 || file.size > maxBytes) {
      return NextResponse.json({ code: "INVALID_FILE", message: "รูปภาพและ PDF ต้องมีขนาดไม่เกิน 10 MB" }, { status: 400 });
    }
    const extensions = parsed.data.kind === "IMAGE" ? imageTypes : documentTypes;
    const extension = extensions.get(file.type);
    if (!extension) {
      return NextResponse.json({ code: "INVALID_FILE", message: parsed.data.kind === "IMAGE" ? "รูปภาพรองรับ JPEG, PNG, WebP" : "เอกสารรองรับ PDF" }, { status: 400 });
    }
    const admin = createInsForgeAdminClient();
    const key = `catalog/products/${id}/${parsed.data.kind.toLowerCase()}/${randomUUID()}.${extension}`;
    const uploaded = await admin.storage.from("gisp-confidential").upload(key, file);
    if (uploaded.error || !uploaded.data) throw uploaded.error ?? new Error("UPLOAD_FAILED");
    const storageData = uploaded.data as unknown as { url?: string; key?: string };
    const objectKey = storageData.key ?? key;
    const inserted = await admin.database.from("file_metadata").insert([{
      organization_id: context.organizationId, bucket: "gisp-confidential", object_key: objectKey,
      url: storageData.url ?? null, original_name: file.name, mime_type: file.type, size_bytes: file.size,
      visibility: "CONFIDENTIAL", entity_type: parsed.data.kind === "IMAGE" ? "PRODUCT_MEDIA" : "PRODUCT_DOCUMENT",
      entity_id: id, uploaded_by: context.userId,
    }]).select("id").single();
    if (inserted.error || !inserted.data) {
      await admin.storage.from("gisp-confidential").remove(objectKey);
      throw inserted.error ?? new Error("FILE_METADATA_FAILED");
    }
    const insforge = await createInsForgeServerClient();
    const attached = await insforge.database.rpc("attach_product_file", {
      product_id_input: id, file_id_input: inserted.data.id, file_kind_input: parsed.data.kind,
      document_type_input: parsed.data.documentType, source_page_input: parsed.data.sourcePage,
      is_primary_input: parsed.data.isPrimary, is_member_visible_input: parsed.data.isMemberVisible,
    });
    if (attached.error) {
      await admin.database.from("file_metadata").delete().eq("id", inserted.data.id);
      await admin.storage.from("gisp-confidential").remove(objectKey);
      throw attached.error;
    }
    return NextResponse.json({ data: { id: attached.data, fileId: inserted.data.id }, message: parsed.data.kind === "IMAGE" ? "อัปโหลดรูปสินค้าแล้ว" : "อัปโหลดเอกสารสินค้าแล้ว" }, { status: 201 });
  } catch (error) { return apiError(error); }
}
