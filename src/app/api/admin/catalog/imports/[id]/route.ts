import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError, invalidInput } from "@/lib/api/response";
import { requireAppAccess } from "@/lib/auth/session";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { createInsForgeAdminClient } from "@/lib/insforge/admin";
import { safePage, safePageSize } from "@/lib/catalog/pdf-import";
import { isCatalogExcelRoundtripEnabled } from "@/lib/catalog/excel-roundtrip";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return invalidInput();
  try {
    await requireAppAccess({ permissions: ["catalog.import"] });
    const insforge = await createInsForgeServerClient();
    const url = new URL(request.url);
    const page = safePage(url.searchParams.get("page"));
    const pageSize = safePageSize(url.searchParams.get("pageSize"));
    const job = await insforge.database.from("catalog_import_jobs").select("*").eq("id", id).maybeSingle();
    if (job.error) throw job.error;
    if (!job.data) return NextResponse.json({ code: "NOT_FOUND", message: "ไม่พบ Import Job" }, { status: 404 });
    const sourceFile = job.data.source_file_id
      ? await insforge.database.from("file_metadata").select("original_name")
        .eq("id", job.data.source_file_id)
        .eq("entity_type", "CATALOG_IMPORT")
        .eq("entity_id", id)
        .eq("visibility", "CONFIDENTIAL")
        .eq("bucket", "gisp-confidential")
        .maybeSingle()
      : { data: null, error: null };
    if (sourceFile.error) throw sourceFile.error;
    const sourceFileName = sourceFile.data?.original_name ?? "—";
    const isPdf = job.data.source_type === "PDF";
    const from = isPdf ? (page - 1) * pageSize : 0;
    const to = isPdf ? from + pageSize - 1 : 999;
    const rows = await insforge.database
      .from("catalog_import_rows")
      .select("*")
      .eq("import_job_id", id).order("row_number").range(from, to);
    if (rows.error) throw rows.error;
    const rowIdsForImages = (rows.data ?? []).map((row) => row.id);
    const [pages, candidateImages, categories, countries, computeUsage] = isPdf ? await Promise.all([
      insforge.database.from("catalog_import_pages").select("page_number,status,extraction_method,attempts,failure_code,failure_message,rendered_file_id").eq("import_job_id", id).order("page_number").limit(100),
      rowIdsForImages.length
        ? insforge.database.from("catalog_import_candidate_images").select("id,import_row_id,file_id,source_page_number,confidence").in("import_row_id", rowIdsForImages).limit(1000)
        : Promise.resolve({ data: [], error: null }),
      insforge.database.from("categories").select("id,code,name_th,name_en").eq("status", "ACTIVE").order("sort_order").limit(500),
      insforge.database.from("countries").select("code,name_th,name_en").eq("status", "ACTIVE").order("sort_order").limit(300),
      insforge.database.from("catalog_import_compute_monthly_usage").select("usage_month,reserved_usd,actual_usd").order("usage_month", { ascending: false }).limit(1).maybeSingle(),
    ]) : [{ data: [], error: null }, { data: [], error: null }, { data: [], error: null }, { data: [], error: null }, { data: null, error: null }];
    if (pages.error || candidateImages.error || categories.error || countries.error || computeUsage.error) throw pages.error ?? candidateImages.error ?? categories.error ?? countries.error ?? computeUsage.error;
    let sourceUrl: string | null = null;
    const securityFailure = ["MALWARE_DETECTED", "MALWARE_SCAN_UNAVAILABLE", "ENCRYPTED_PDF", "MALFORMED_PDF", "PDF_PORTFOLIO_NOT_ALLOWED"].includes(job.data.failure_code ?? "");
    if (isPdf && !securityFailure && job.data.security_status === "VERIFIED" && job.data.security_verified_at) {
      const admin = createInsForgeAdminClient();
      const file = await admin.database.from("file_metadata").select("bucket,object_key").eq("id", job.data.source_file_id).maybeSingle();
      if (file.error) throw file.error;
      if (file.data) {
        const signed = await admin.storage.from(file.data.bucket).createSignedUrl(file.data.object_key, 300);
        if (!signed.error && signed.data) sourceUrl = signed.data.signedUrl;
      }
    }
    const rowIds = (rows.data ?? []).map((row) => row.id);
    const errors = rowIds.length
      ? await insforge.database.from("catalog_import_errors").select("import_row_id,field_name,error_code,error_message").in("import_row_id", rowIds).limit(5000)
      : { data: [], error: null };
    if (errors.error) throw errors.error;
    const enrichmentBatch=isPdf&&isCatalogExcelRoundtripEnabled()?await insforge.database.from("catalog_import_enrichment_batches").select("id,status,updated_at").eq("import_job_id",id).order("created_at",{ascending:false}).limit(1).maybeSingle():{data:null,error:null};
    if(enrichmentBatch.error)throw enrichmentBatch.error;
    const errorByRow = new Map<string, typeof errors.data>();
    for (const error of errors.data ?? []) {
      const current = errorByRow.get(error.import_row_id) ?? [];
      current.push(error);
      errorByRow.set(error.import_row_id, current);
    }
    return NextResponse.json({
      data: {
        job: { ...job.data, file_name: sourceFileName },
        rows: (rows.data ?? []).map((row) => ({ ...row, errors: errorByRow.get(row.id) ?? [] })),
        pages: pages.data ?? [],
        candidateImages: candidateImages.data ?? [],
        categories: categories.data ?? [],
        countries: countries.data ?? [],
        computeBudget: computeUsage.data ? { ...computeUsage.data, limitUsd: 20, warning80Percent: Number(computeUsage.data.actual_usd) + Number(computeUsage.data.reserved_usd) >= 16 } : { reserved_usd: 0, actual_usd: 0, limitUsd: 20, warning80Percent: false },
        sourceUrl,
        enrichmentBatch:enrichmentBatch.data,
        pagination: { page, pageSize, total: job.data.total_rows, totalPages: Math.max(1, Math.ceil(job.data.total_rows / pageSize)) },
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
