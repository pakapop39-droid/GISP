import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { apiError } from "@/lib/api/response";
import { requireAppAccess } from "@/lib/auth/session";
import { createInsForgeAdminClient } from "@/lib/insforge/admin";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { readCatalogImportFile, validateCatalogImportRows } from "@/lib/catalog/import-file";

const maxBytes = 10 * 1024 * 1024;
const mimeByExtension = new Map([
  ["csv", "text/csv"],
  ["xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
]);

function chunks<T>(items: T[], size = 200) {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));
}

export async function GET() {
  try {
    await requireAppAccess({ permissions: ["catalog.import"] });
    const insforge = await createInsForgeServerClient();
    const result = await insforge.database
      .from("catalog_import_jobs")
      .select("id,source_type,status,total_rows,valid_rows,invalid_rows,created_at,completed_at,source_file_id")
      .order("created_at", { ascending: false })
      .limit(20);
    if (result.error) throw result.error;
    const fileIds = (result.data ?? []).map((item) => item.source_file_id);
    const files = fileIds.length
      ? await insforge.database.from("file_metadata").select("id,original_name").in("id", fileIds).limit(20)
      : { data: [], error: null };
    if (files.error) throw files.error;
    const nameById = new Map((files.data ?? []).map((file) => [file.id, file.original_name]));
    return NextResponse.json({ data: (result.data ?? []).map((job) => ({ ...job, file_name: nameById.get(job.source_file_id) ?? "—" })) });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  let uploadedKey: string | null = null;
  let fileMetadataId: string | null = null;
  try {
    const context = await requireAppAccess({ permissions: ["catalog.import"] });
    const form = await request.formData();
    const file = form.get("file");
    const supplierId = String(form.get("supplierId") ?? "");
    if (!(file instanceof File) || !supplierId || file.size <= 0 || file.size > maxBytes) {
      return NextResponse.json({ code: "INVALID_FILE", message: "เลือก Supplier และไฟล์ขนาดไม่เกิน 10 MB" }, { status: 400 });
    }
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    const mimeType = mimeByExtension.get(extension);
    if (!mimeType) return NextResponse.json({ code: "INVALID_FILE", message: "รองรับเฉพาะไฟล์ .xlsx และ .csv" }, { status: 400 });

    const parsed = await readCatalogImportFile(file);
    const insforge = await createInsForgeServerClient();
    const [supplier, categories, products] = await Promise.all([
      insforge.database.from("suppliers").select("id,code,name,status").eq("id", supplierId).in("status", ["PROSPECT", "ACTIVE"]).maybeSingle(),
      insforge.database.from("categories").select("id,code").eq("status", "ACTIVE").limit(500),
      insforge.database.from("products").select("sku").limit(5000),
    ]);
    if (supplier.error || categories.error || products.error) throw supplier.error ?? categories.error ?? products.error;
    if (!supplier.data) return NextResponse.json({ code: "INVALID_INPUT", message: "ไม่พบ Supplier ที่เลือก" }, { status: 400 });
    const validated = validateCatalogImportRows({
      rows: parsed.rows,
      supplierId,
      categories: categories.data ?? [],
      existingSkus: (products.data ?? []).map((item) => item.sku),
    });

    const jobId = randomUUID();
    const admin = createInsForgeAdminClient();
    uploadedKey = `catalog/imports/${jobId}/${randomUUID()}.${extension}`;
    const uploaded = await admin.storage.from("gisp-confidential").upload(uploadedKey, new File([await file.arrayBuffer()], file.name, { type: mimeType }));
    if (uploaded.error || !uploaded.data) throw uploaded.error ?? new Error("UPLOAD_FAILED");
    const storageData = uploaded.data as unknown as { url?: string; key?: string };
    uploadedKey = storageData.key ?? uploadedKey;
    const metadata = await admin.database.from("file_metadata").insert([{
      organization_id: context.organizationId,
      bucket: "gisp-confidential",
      object_key: uploadedKey,
      url: storageData.url ?? null,
      original_name: file.name,
      mime_type: mimeType,
      size_bytes: file.size,
      visibility: "CONFIDENTIAL",
      entity_type: "CATALOG_IMPORT",
      entity_id: jobId,
      uploaded_by: context.userId,
    }]).select("id").single();
    if (metadata.error || !metadata.data) throw metadata.error ?? new Error("FILE_METADATA_FAILED");
    fileMetadataId = metadata.data.id;

    const invalidRows = validated.filter((row) => row.errors.length > 0).length;
    const job = await insforge.database.from("catalog_import_jobs").insert([{
      id: jobId,
      source_file_id: fileMetadataId,
      source_type: extension.toUpperCase(),
      status: "READY_FOR_REVIEW",
      total_rows: validated.length,
      valid_rows: validated.length - invalidRows,
      invalid_rows: invalidRows,
      created_by: context.userId,
    }]);
    if (job.error) throw job.error;

    const stagedRows = validated.map((row) => ({
      id: randomUUID(),
      import_job_id: jobId,
      row_number: row.rowNumber,
      source_data: row.source,
      validation_status: row.errors.length ? "INVALID" : "VALID",
    }));
    for (const batch of chunks(stagedRows)) {
      const inserted = await insforge.database.from("catalog_import_rows").insert(batch);
      if (inserted.error) throw inserted.error;
    }
    const rowIdByNumber = new Map(stagedRows.map((row) => [row.row_number, row.id]));
    const errors = validated.flatMap((row) => row.errors.map((error) => ({
      import_row_id: rowIdByNumber.get(row.rowNumber),
      field_name: error.fieldName,
      error_code: error.code,
      error_message: error.message,
    })));
    for (const batch of chunks(errors)) {
      const inserted = await insforge.database.from("catalog_import_errors").insert(batch);
      if (inserted.error) throw inserted.error;
    }
    return NextResponse.json({ data: { id: jobId }, message: `ตรวจแล้ว ${validated.length} แถว: พร้อม ${validated.length - invalidRows}, ต้องแก้ ${invalidRows}` }, { status: 201 });
  } catch (error) {
    const admin = createInsForgeAdminClient();
    if (fileMetadataId) await admin.database.from("file_metadata").delete().eq("id", fileMetadataId);
    if (uploadedKey) await admin.storage.from("gisp-confidential").remove(uploadedKey);
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("IMPORT_MISSING_HEADERS:")) {
      return NextResponse.json({ code: "INVALID_TEMPLATE", message: `ไฟล์ขาดคอลัมน์บังคับ: ${message.split(":")[1]}` }, { status: 400 });
    }
    if (message === "IMPORT_EMPTY_FILE") return NextResponse.json({ code: "INVALID_TEMPLATE", message: "ไฟล์ไม่มีรายการสินค้า" }, { status: 400 });
    if (message === "IMPORT_ROW_LIMIT") return NextResponse.json({ code: "INVALID_TEMPLATE", message: "หนึ่งไฟล์รองรับสูงสุด 1,000 รายการ" }, { status: 400 });
    return apiError(error);
  }
}
