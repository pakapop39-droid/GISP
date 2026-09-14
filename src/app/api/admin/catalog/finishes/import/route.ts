import { NextResponse, type NextRequest } from "next/server";
import { apiError } from "@/lib/api/response";
import { requireAppAccess } from "@/lib/auth/session";
import { readFinishImportFile, validateFinishImportRows } from "@/lib/catalog/finish-import";
import { createFinishImportPreviewToken, verifyFinishImportPreviewToken } from "@/lib/catalog/finish-import-preview";
import { getServerEnv } from "@/lib/env";
import { createInsForgeServerClient } from "@/lib/insforge/server";

const maxBytes = 10 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    await requireAppAccess({ permissions: ["catalog.import", "catalog.manage"] });
    const form = await request.formData();
    const file = form.get("file");
    const supplierId = String(form.get("supplierId") ?? "");
    const confirmed = form.get("confirmed") === "true";
    const previewToken = String(form.get("previewToken") ?? "");
    const extension = file instanceof File ? file.name.split(".").pop()?.toLowerCase() : "";
    if (!(file instanceof File) || !supplierId || file.size <= 0 || file.size > maxBytes || !["csv", "xlsx"].includes(extension ?? "")) {
      return NextResponse.json({ code: "INVALID_FILE", message: "เลือก Supplier และไฟล์ .csv/.xlsx ขนาดไม่เกิน 10 MB" }, { status: 400 });
    }
    const fileBytes = new Uint8Array(await file.arrayBuffer());
    const rows = await readFinishImportFile(new File([fileBytes], file.name, { type: file.type }));
    const insforge = await createInsForgeServerClient();
    const [supplier, collections, finishes] = await Promise.all([
      insforge.database.from("suppliers").select("id").eq("id", supplierId).in("status", ["PROSPECT", "ACTIVE"]).maybeSingle(),
      insforge.database.from("finish_collections").select("id,code").eq("supplier_id", supplierId).limit(1000),
      insforge.database.from("finishes").select("id,collection_id,code").limit(5000),
    ]);
    if (supplier.error || collections.error || finishes.error) throw supplier.error ?? collections.error ?? finishes.error;
    if (!supplier.data) return NextResponse.json({ code: "INVALID_INPUT", message: "ไม่พบ Supplier ที่เลือก" }, { status: 400 });
    const collectionCodeById = new Map((collections.data ?? []).map((collection) => [collection.id, collection.code]));
    const validated = validateFinishImportRows({
      rows,
      existing: (finishes.data ?? []).flatMap((finish) => {
        const collectionCode = collectionCodeById.get(finish.collection_id);
        return collectionCode ? [{ collectionCode, finishCode: finish.code }] : [];
      }),
    });
    const invalidRows = validated.filter((row) => row.errors.length > 0).length;
    if (invalidRows > 0) {
      return NextResponse.json({ data: {
        totalRows: validated.length,
        validRows: validated.length - invalidRows,
        invalidRows,
        rows: validated,
        dryRun: true,
      }, message: invalidRows ? `ตรวจแล้ว ${validated.length} แถว พบ ${invalidRows} แถวที่ต้องแก้` : `ตรวจแล้ว ${validated.length} แถว พร้อม Import เป็น Draft` });
    }
    const normalizedRows = validated.map(({ rowNumber, source }) => ({ rowNumber, source }));
    const signingKey = getServerEnv().INSFORGE_API_KEY;
    if (!confirmed) {
      const preview = createFinishImportPreviewToken({ fileBytes, supplierId, rows: normalizedRows, signingKey });
      return NextResponse.json({ data: {
        totalRows: validated.length,
        validRows: validated.length,
        invalidRows: 0,
        rows: validated,
        dryRun: true,
        ...preview,
      }, message: `ตรวจแล้ว ${validated.length} แถว พร้อม Import เป็น Draft` });
    }
    if (!previewToken || !verifyFinishImportPreviewToken({
      previewToken, fileBytes, supplierId, rows: normalizedRows, signingKey,
    })) {
      return NextResponse.json({
        code: "IMPORT_PREVIEW_REQUIRED",
        message: "ต้อง Dry-run ไฟล์และ Supplier เดียวกันใหม่ก่อนยืนยัน Import",
      }, { status: 409 });
    }
    const payload = validated.map((row) => ({
      ...row.source,
      metadata: { importedFromReviewedManifest: true, importRowNumber: row.rowNumber },
    }));
    const imported = await insforge.database.rpc("import_finish_manifest", {
      supplier_id_input: supplierId,
      rows_input: payload,
    });
    if (imported.error) throw imported.error;
    return NextResponse.json({ data: imported.data, message: `Import สีเป็น Draft แล้ว ${validated.length} รายการ` }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("FINISH_IMPORT_MISSING_HEADERS:")) {
      return NextResponse.json({ code: "INVALID_TEMPLATE", message: `ไฟล์ขาดคอลัมน์บังคับ: ${message.split(":")[1]}` }, { status: 400 });
    }
    if (message === "FINISH_IMPORT_EMPTY_FILE") return NextResponse.json({ code: "INVALID_TEMPLATE", message: "ไฟล์ไม่มีรายการสี" }, { status: 400 });
    if (message === "FINISH_IMPORT_ROW_LIMIT") return NextResponse.json({ code: "INVALID_TEMPLATE", message: "หนึ่งไฟล์รองรับสูงสุด 1,000 รายการ" }, { status: 400 });
    if (message.includes("DUPLICATE_FINISH_CODE")) {
      return NextResponse.json({ code: "DUPLICATE_FINISH_CODE", message: "พบรหัสสีซ้ำระหว่างยืนยัน Import กรุณา Dry-run ใหม่" }, { status: 409 });
    }
    return apiError(error);
  }
}
