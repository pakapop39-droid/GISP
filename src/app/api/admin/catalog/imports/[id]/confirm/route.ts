import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError, invalidInput } from "@/lib/api/response";
import { requireAppAccess } from "@/lib/auth/session";
import { isPdfCatalogImportEnabled } from "@/lib/catalog/pdf-import";
import { createInsForgeAdminClient } from "@/lib/insforge/admin";
import { createInsForgeServerClient } from "@/lib/insforge/server";

async function stageDurableImages(jobId: string, rowIds: string[] | null) {
  const admin = createInsForgeAdminClient();
  let query = admin.database.from("catalog_import_rows")
    .select("id,selected_image_file_id,approved_image_file_id,approved_image_source_file_id")
    .eq("import_job_id", jobId).eq("validation_status", "VALID").eq("review_status", "APPROVED");
  if (rowIds) query = query.in("id", rowIds);
  const rows = await query.limit(500);
  if (rows.error) throw rows.error;
  for (const row of rows.data ?? []) {
    if (!row.selected_image_file_id) continue;
    if (row.approved_image_file_id && row.approved_image_source_file_id === row.selected_image_file_id) continue;
    const source = await admin.database.from("file_metadata")
      .select("id,organization_id,bucket,object_key,mime_type,original_name,size_bytes,uploaded_by")
      .eq("id", row.selected_image_file_id).eq("visibility", "CONFIDENTIAL").eq("entity_type", "CATALOG_IMPORT_CANDIDATE").maybeSingle();
    if (source.error || !source.data) throw source.error ?? new Error("CANDIDATE_IMAGE_NOT_FOUND");
    if (!['image/jpeg','image/png'].includes(source.data.mime_type) || Number(source.data.size_bytes) > 10 * 1024 * 1024) throw new Error("CANDIDATE_IMAGE_INVALID");
    const extension = source.data.mime_type === "image/png" ? "png" : "jpg";
    const durableKey = `${source.data.organization_id}/products/imported/${jobId}/${row.id}-${source.data.id}.${extension}`;
    let durable = await admin.database.from("file_metadata").select("id").eq("bucket", "gisp-confidential").eq("object_key", durableKey).maybeSingle();
    if (durable.error) throw durable.error;
    if (!durable.data) {
      const signed = await admin.storage.from(source.data.bucket).createSignedUrl(source.data.object_key, 300);
      if (signed.error || !signed.data) throw signed.error ?? new Error("CANDIDATE_IMAGE_READ_FAILED");
      const downloaded = await fetch(signed.data.signedUrl, { cache: "no-store" });
      if (!downloaded.ok) throw new Error("CANDIDATE_IMAGE_READ_FAILED");
      const bytes = await downloaded.arrayBuffer();
      if (bytes.byteLength !== Number(source.data.size_bytes) || bytes.byteLength > 10 * 1024 * 1024) throw new Error("CANDIDATE_IMAGE_SIZE_MISMATCH");
      const uploaded = await admin.storage.from("gisp-confidential").upload(durableKey, new File([bytes], source.data.original_name, { type: source.data.mime_type }));
      if (uploaded.error || !uploaded.data) throw uploaded.error ?? new Error("DURABLE_IMAGE_UPLOAD_FAILED");
      const storageData = uploaded.data as unknown as { url?: string; key?: string };
      durable = await admin.database.from("file_metadata").insert([{
        organization_id: source.data.organization_id, bucket: "gisp-confidential", object_key: storageData.key ?? durableKey,
        url: storageData.url ?? null, original_name: source.data.original_name, mime_type: source.data.mime_type,
        size_bytes: bytes.byteLength, visibility: "CONFIDENTIAL", entity_type: "CATALOG_IMPORT_APPROVED_IMAGE",
        entity_id: jobId, uploaded_by: source.data.uploaded_by,
      }]).select("id").single();
      if (durable.error || !durable.data) throw durable.error ?? new Error("DURABLE_IMAGE_METADATA_FAILED");
    }
    const staged = await admin.database.rpc("stage_catalog_pdf_product_image", {
      import_job_id_input: jobId, import_row_id_input: row.id, source_file_id_input: row.selected_image_file_id, durable_file_id_input: durable.data.id,
    });
    if (staged.error) throw staged.error;
  }
}

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return invalidInput();
  try {
    await requireAppAccess({ permissions: ["catalog.import", "catalog.manage"] });
    const insforge = await createInsForgeServerClient();
    const job = await insforge.database.from("catalog_import_jobs").select("source_type").eq("id", id).maybeSingle();
    if (job.error) throw job.error;
    if (!job.data) return NextResponse.json({ code: "NOT_FOUND", message: "ไม่พบ Import Job" }, { status: 404 });
    if (job.data.source_type === "PDF" && !isPdfCatalogImportEnabled()) {
      return NextResponse.json({ code: "FEATURE_DISABLED", message: "PDF Catalog Import ยังไม่ได้เปิดใน Environment นี้" }, { status: 404 });
    }
    let rowIds: string[] | null = null;
    if (job.data.source_type === "PDF") {
      const body = await _request.json().catch(() => ({}));
      const parsed = z.object({ rowIds: z.array(z.uuid()).min(1).max(500).nullable().optional() }).safeParse(body);
      if (!parsed.success) return invalidInput();
      rowIds = parsed.data.rowIds ?? null;
      await stageDurableImages(id, rowIds);
    }
    const result = job.data.source_type === "PDF"
      ? await insforge.database.rpc("execute_catalog_pdf_import_job", { import_job_id_input: id, row_ids_input: rowIds })
      : await insforge.database.rpc("execute_catalog_import_job", { import_job_id_input: id });
    if (result.error) throw result.error;
    return NextResponse.json({ data: result.data, message: `สร้าง Product Draft แล้ว ${result.data?.imported ?? 0} รายการ` });
  } catch (error) {
    return apiError(error);
  }
}
