import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError, invalidInput } from "@/lib/api/response";
import { requireAppAccess } from "@/lib/auth/session";
import { createInsForgeServerClient } from "@/lib/insforge/server";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return invalidInput();
  try {
    await requireAppAccess({ permissions: ["catalog.import"] });
    const insforge = await createInsForgeServerClient();
    const [job, rows] = await Promise.all([
      insforge.database.from("catalog_import_jobs").select("*").eq("id", id).maybeSingle(),
      insforge.database.from("catalog_import_rows").select("id,row_number,source_data,validation_status,product_id").eq("import_job_id", id).order("row_number").limit(1000),
    ]);
    if (job.error || rows.error) throw job.error ?? rows.error;
    if (!job.data) return NextResponse.json({ code: "NOT_FOUND", message: "ไม่พบ Import Job" }, { status: 404 });
    const rowIds = (rows.data ?? []).map((row) => row.id);
    const errors = rowIds.length
      ? await insforge.database.from("catalog_import_errors").select("import_row_id,field_name,error_code,error_message").in("import_row_id", rowIds).limit(5000)
      : { data: [], error: null };
    if (errors.error) throw errors.error;
    const errorByRow = new Map<string, typeof errors.data>();
    for (const error of errors.data ?? []) {
      const current = errorByRow.get(error.import_row_id) ?? [];
      current.push(error);
      errorByRow.set(error.import_row_id, current);
    }
    return NextResponse.json({
      data: {
        job: job.data,
        rows: (rows.data ?? []).map((row) => ({ ...row, errors: errorByRow.get(row.id) ?? [] })),
      },
    });
  } catch (error) {
    return apiError(error);
  }
}

