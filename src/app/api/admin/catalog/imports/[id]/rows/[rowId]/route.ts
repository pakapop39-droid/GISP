import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError, invalidInput } from "@/lib/api/response";
import { requireAppAccess } from "@/lib/auth/session";
import { isPdfCatalogImportEnabled, pdfCandidatePatchSchema } from "@/lib/catalog/pdf-import";
import { createInsForgeServerClient } from "@/lib/insforge/server";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; rowId: string }> }) {
  const { id, rowId } = await params;
  if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(rowId).success) return invalidInput();
  try {
    await requireAppAccess({ permissions: ["catalog.import"] });
    if (!isPdfCatalogImportEnabled()) return NextResponse.json({ code: "FEATURE_DISABLED", message: "PDF Catalog Import ยังไม่ได้เปิดใน Environment นี้" }, { status: 404 });
    const parsed = pdfCandidatePatchSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ code: "INVALID_INPUT", message: "ข้อมูลสินค้าบางช่องไม่ถูกต้อง", details: parsed.error.issues }, { status: 400 });
    const insforge = await createInsForgeServerClient();
    const result = await insforge.database.rpc("update_catalog_pdf_candidate", { import_job_id_input: id, import_row_id_input: rowId, patch_input: parsed.data });
    if (result.error) throw result.error;
    return NextResponse.json({ data: result.data, message: "บันทึกร่างแล้ว กรุณาตรวจและอนุมัติอีกครั้ง" });
  } catch (error) { return apiError(error); }
}
