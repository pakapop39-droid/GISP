import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError, invalidInput } from "@/lib/api/response";
import { requireAppAccess } from "@/lib/auth/session";
import { createInsForgeAdminClient } from "@/lib/insforge/admin";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { validatedSwatchExtension } from "@/lib/catalog/swatch-file";

const maxBytes = 5 * 1024 * 1024;
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return invalidInput();
  let objectKey: string | null = null;
  let fileId: string | null = null;
  try {
    const context = await requireAppAccess({ permissions: ["catalog.manage"] });
    const form = await request.formData();
    const file = form.get("file");
    const extension = file instanceof File ? await validatedSwatchExtension(file) : null;
    if (!(file instanceof File) || !extension || file.size <= 0 || file.size > maxBytes) {
      return NextResponse.json({ code: "INVALID_FILE", message: "รูปสวอตช์รองรับ JPEG, PNG, WebP ขนาดไม่เกิน 5 MB" }, { status: 400 });
    }
    const admin = createInsForgeAdminClient();
    const finish = await admin.database.from("finishes").select("id,swatch_file_id").eq("id", id).maybeSingle();
    if (finish.error) throw finish.error;
    if (!finish.data) return NextResponse.json({ code: "NOT_FOUND", message: "ไม่พบสีที่ต้องการอัปโหลดรูป" }, { status: 404 });
    objectKey = `catalog/finishes/${id}/${randomUUID()}.${extension}`;
    const uploaded = await admin.storage.from("gisp-confidential").upload(objectKey, file);
    if (uploaded.error || !uploaded.data) throw uploaded.error ?? new Error("UPLOAD_FAILED");
    const storageData = uploaded.data as unknown as { url?: string; key?: string };
    objectKey = storageData.key ?? objectKey;
    const inserted = await admin.database.from("file_metadata").insert([{
      organization_id: context.organizationId,
      bucket: "gisp-confidential",
      object_key: objectKey,
      url: storageData.url ?? null,
      original_name: file.name,
      mime_type: file.type,
      size_bytes: file.size,
      visibility: "CONFIDENTIAL",
      entity_type: "FINISH_SWATCH",
      entity_id: id,
      uploaded_by: context.userId,
    }]).select("id").single();
    if (inserted.error || !inserted.data) throw inserted.error ?? new Error("FILE_METADATA_FAILED");
    fileId = inserted.data.id;
    const insforge = await createInsForgeServerClient();
    const attached = await insforge.database.rpc("attach_finish_swatch", {
      finish_id_input: id,
      file_id_input: fileId,
    });
    if (attached.error) throw attached.error;
    let oldSwatchCleanupPending = false;
    const oldFileId = finish.data.swatch_file_id as string | null;
    if (oldFileId && oldFileId !== fileId) {
      const references = await admin.database.from("finishes").select("id").eq("swatch_file_id", oldFileId).limit(1);
      if (references.error) oldSwatchCleanupPending = true;
      else if (!(references.data ?? []).length) {
        const oldFile = await admin.database.from("file_metadata")
          .select("id,bucket,object_key,entity_type,entity_id").eq("id", oldFileId).maybeSingle();
        if (oldFile.error) oldSwatchCleanupPending = true;
        else if (oldFile.data?.entity_type === "FINISH_SWATCH" && oldFile.data.entity_id === id) {
          const removed = await admin.storage.from(oldFile.data.bucket).remove(oldFile.data.object_key);
          if (removed.error) oldSwatchCleanupPending = true;
          else {
            const deleted = await admin.database.from("file_metadata").delete().eq("id", oldFileId);
            if (deleted.error) oldSwatchCleanupPending = true;
          }
        }
      }
    }
    return NextResponse.json({ data: { id, fileId, oldSwatchCleanupPending }, message: oldSwatchCleanupPending
      ? "อัปโหลดรูปสวอตช์แล้ว แต่ไฟล์เดิมยังรอการเก็บกวาด"
      : "อัปโหลดรูปสวอตช์แล้ว" }, { status: 201 });
  } catch (error) {
    if (fileId || objectKey) {
      const admin = createInsForgeAdminClient();
      if (objectKey) await admin.storage.from("gisp-confidential").remove(objectKey);
      if (fileId) await admin.database.from("file_metadata").delete().eq("id", fileId);
    }
    return apiError(error);
  }
}
