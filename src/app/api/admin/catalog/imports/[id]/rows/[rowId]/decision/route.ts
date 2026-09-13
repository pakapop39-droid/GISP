import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError, invalidInput } from "@/lib/api/response";
import { requireAppAccess } from "@/lib/auth/session";
import { isPdfCatalogImportEnabled } from "@/lib/catalog/pdf-import";
import { createInsForgeServerClient } from "@/lib/insforge/server";

const schema = z.object({ decision: z.enum(["APPROVE", "REJECT"]), warningCodes: z.array(z.string().max(100)).default([]) });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; rowId: string }> }) {
  const { id, rowId } = await params;
  if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(rowId).success) return invalidInput();
  try {
    await requireAppAccess({ permissions: ["catalog.import"] });
    if (!isPdfCatalogImportEnabled()) return NextResponse.json({ code: "FEATURE_DISABLED", message: "PDF Catalog Import ยังไม่ได้เปิดใน Environment นี้" }, { status: 404 });
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return invalidInput();
    const insforge = await createInsForgeServerClient();
    const belongs = await insforge.database.from("catalog_import_rows").select("id").eq("id", rowId).eq("import_job_id", id).maybeSingle();
    if (belongs.error) throw belongs.error;
    if (!belongs.data) return NextResponse.json({ code: "NOT_FOUND", message: "ไม่พบ Candidate" }, { status: 404 });
    const result = await insforge.database.rpc("review_catalog_pdf_candidate", {
      import_row_id_input: rowId, decision_input: parsed.data.decision, warning_codes_input: parsed.data.warningCodes,
    });
    if (result.error) throw result.error;
    return NextResponse.json({ data: result.data, message: parsed.data.decision === "APPROVE" ? "อนุมัติ Candidate แล้ว" : "ปฏิเสธ Candidate แล้ว" });
  } catch (error) { return apiError(error); }
}
