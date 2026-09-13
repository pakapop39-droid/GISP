import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(join(process.cwd(), "migrations/20260912122859_pdf-catalog-import-v1.sql"), "utf8");
const confirmAliasFixMigration = readFileSync(join(process.cwd(), "migrations/20260912234654_fix-pdf-confirm-selection-alias.sql"), "utf8");
const claimNormalizingFixMigration = readFileSync(join(process.cwd(), "migrations/20260913075421_fix-pdf-claim-normalizing.sql"), "utf8");
const azureReservationHardeningMigration = readFileSync(join(process.cwd(), "migrations/20260913091000_harden-pdf-ai-reservation-azure.sql"), "utf8");
const uploadRoute = readFileSync(join(process.cwd(), "src/app/api/admin/catalog/imports/route.ts"), "utf8");
const wakeRoute = readFileSync(join(process.cwd(), "src/app/api/internal/catalog-pdf-worker/wake/route.ts"), "utf8");
const detailRoute = readFileSync(join(process.cwd(), "src/app/api/admin/catalog/imports/[id]/route.ts"), "utf8");
const artifactRoute = readFileSync(join(process.cwd(), "src/app/api/admin/catalog/imports/[id]/artifacts/[fileId]/route.ts"), "utf8");
const genericDownloadRoute = readFileSync(join(process.cwd(), "src/app/api/files/[id]/download/route.ts"), "utf8");
const confirmRoute = readFileSync(join(process.cwd(), "src/app/api/admin/catalog/imports/[id]/confirm/route.ts"), "utf8");
const reviewComponent = readFileSync(join(process.cwd(), "src/components/pdf-catalog-review.tsx"), "utf8");

describe("PDF Catalog Import migration contract", () => {
  it("hardens the active Azure reservation identity checks without weakening its locks, budgets or grants", () => {
    expect(azureReservationHardeningMigration).toContain("pricing_snapshot_input->>'model' IS DISTINCT FROM 'openai/gpt-4o-mini'");
    expect(azureReservationHardeningMigration).toContain("pricing_snapshot_input->>'provider' IS DISTINCT FROM 'azure'");
    expect(azureReservationHardeningMigration).not.toMatch(/pricing_snapshot_input->>'(?:model|provider)'<>/);
    expect(azureReservationHardeningMigration).toContain("month_key DATE:=date_trunc('month',CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Bangkok')::DATE");
    expect(azureReservationHardeningMigration).toContain("pg_advisory_xact_lock(hashtextextended(page_record.import_job_id::TEXT,0))");
    expect(azureReservationHardeningMigration).toContain("AI_CALL_ALREADY_ATTEMPTED");
    expect(azureReservationHardeningMigration).toContain("job_actual+job_reserved+estimated_cost_usd_input>1");
    expect(azureReservationHardeningMigration).toContain("month_record.actual_usd+month_record.reserved_usd+estimated_cost_usd_input>50");
    expect(azureReservationHardeningMigration).toContain("'azure','openai/gpt-4o-mini','RESERVED'");
    expect(azureReservationHardeningMigration).toContain("LANGUAGE PLPGSQL SECURITY DEFINER");
    expect(azureReservationHardeningMigration).toContain("SET search_path = pg_catalog, public, pg_temp");
    expect(azureReservationHardeningMigration).toContain("REVOKE ALL ON FUNCTION public.reserve_catalog_pdf_ai_call(UUID,NUMERIC,TEXT,JSONB,INTEGER,INTEGER) FROM PUBLIC,anon,authenticated");
    expect(azureReservationHardeningMigration).toContain("GRANT EXECUTE ON FUNCTION public.reserve_catalog_pdf_ai_call(UUID,NUMERIC,TEXT,JSONB,INTEGER,INTEGER) TO project_admin");
    expect(existsSync(join(process.cwd(), "migrations/20260913084744_switch-pdf-provider-openai.sql"))).toBe(false);
  });

  it("continues claiming pending pages while a PDF job is normalizing", () => {
    const claimableStatuses = claimNormalizingFixMigration.match(/j\.status IN \(([^)]+)\)/)?.[1];
    expect(claimNormalizingFixMigration).toContain("j.status IN ('QUEUED','EXTRACTING','NORMALIZING')");
    expect(claimableStatuses).toBe("'QUEUED','EXTRACTING','NORMALIZING'");
    for (const terminalStatus of ["READY_FOR_REVIEW", "IMPORTING", "COMPLETED", "COMPLETED_WITH_ISSUES", "FAILED", "CANCELLED"]) {
      expect(claimableStatuses).not.toContain(terminalStatus);
    }
    expect(claimNormalizingFixMigration).toContain("p.attempts<3");
    expect(claimNormalizingFixMigration).toContain("limit_input IS NULL OR limit_input<1 OR limit_input>4");
    expect(claimNormalizingFixMigration).toContain("lease_expires_at=NOW()+INTERVAL '10 minutes'");
    expect(claimNormalizingFixMigration).toContain("ORDER BY j.created_at,p.page_number FOR UPDATE OF p SKIP LOCKED LIMIT limit_input");
    expect(claimNormalizingFixMigration).toContain("SET search_path = pg_catalog, public, pg_temp");
    expect(claimNormalizingFixMigration).toContain("GRANT EXECUTE ON FUNCTION public.claim_catalog_pdf_pages(TEXT,INTEGER) TO project_admin");
  });

  it("uses a non-conflicting SQL alias when validating explicit confirm rows", () => {
    expect(confirmAliasFixMigration).toContain("COUNT(DISTINCT selected_row.id)");
    expect(confirmAliasFixMigration).toContain("catalog_import_rows selected_row");
    expect(confirmAliasFixMigration).not.toContain("COUNT(DISTINCT row_record.id)");
    expect(confirmAliasFixMigration).toContain("THEN RAISE EXCEPTION 'SELECTION_NOT_VALID'");
    expect(confirmAliasFixMigration).toContain(
      "GRANT EXECUTE ON FUNCTION public.execute_catalog_pdf_import_job(UUID,UUID[]) TO authenticated",
    );
  });

  it("keeps the trigger size-limit CASE unambiguous to the PL/pgSQL parser", () => {
    const guardTrigger = migration.slice(
      migration.indexOf("CREATE OR REPLACE FUNCTION public.guard_file_metadata_v2"),
      migration.indexOf("CREATE OR REPLACE FUNCTION public.review_catalog_pdf_candidate"),
    );

    expect(guardTrigger).toContain("NEW.size_bytes > (CASE WHEN NEW.entity_type='CATALOG_IMPORT'");
    expect(guardTrigger).toContain("THEN 26214400 ELSE 10485760 END) THEN");
    expect(guardTrigger).not.toMatch(/NEW\.size_bytes > CASE[\s\S]*?END THEN/);
  });

  it("extends rather than replaces the spreadsheet workflow", () => {
    expect(migration).toContain("source_type IN ('CSV','XLSX','PDF')");
    expect(migration).toContain("'UPLOADED','VALIDATING','QUEUED','EXTRACTING','NORMALIZING'");
    expect(migration).not.toContain("DROP TABLE public.catalog_import");
  });

  it("enforces page leases, retry bounds and AI budgets in the database", () => {
    expect(migration).toContain("lease_expires_at=NOW()+INTERVAL '10 minutes'");
    expect(migration).toContain("p.attempts<3");
    expect(migration).toContain("AI_CALL_ALREADY_ATTEMPTED");
    expect(migration).toContain("SELECT ai_cost_usd INTO job_actual");
    expect(migration).toContain("SUM(reserved_cost_usd)");
    expect(migration).toContain("job_actual+job_reserved+estimated_cost_usd_input>1");
    expect(migration).toContain("status='RESERVED'");
    expect(migration).toContain("month_record.actual_usd+month_record.reserved_usd+estimated_cost_usd_input>50");
    expect(migration).toContain("CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Bangkok'");
  });

  it("requires both permissions and creates Draft products only", () => {
    const confirm = migration.slice(migration.indexOf("CREATE OR REPLACE FUNCTION public.execute_catalog_pdf_import_job"), migration.indexOf("CREATE OR REPLACE FUNCTION public.rollback_catalog_pdf_drafts"));
    expect(confirm).toContain("public.has_permission('catalog.import')");
    expect(confirm).toContain("public.has_permission('catalog.manage')");
    expect(confirm).toContain("'DRAFT','NOT_REVIEWED'");
    expect(confirm).toContain("review_status='APPROVED'");
    expect(confirm).not.toContain("product_prices");
    expect(confirm).not.toContain("product_variants");
    expect(confirm).not.toContain("product_options");
    expect(confirm).not.toContain("'PUBLISHED'");
    expect(confirm).not.toContain("factory_cost");
    expect(migration).toContain("warnings:=array_append(warnings,'PRODUCT_TYPE_REQUIRED')");
    expect(migration).toContain("warnings:=array_append(warnings,'COUNTRY_REQUIRED')");
    expect(migration).not.toContain("COALESCE(NULLIF(UPPER(BTRIM(candidate->>'productType')),''),'STANDARD')");
    expect(migration).not.toContain("COALESCE(NULLIF(UPPER(BTRIM(candidate->>'countryCode')),''),'CN')");
  });

  it("blocks duplicate replacement and keeps source documents confidential", () => {
    expect(migration).toContain("existing_product_id=product_id_value");
    expect(migration).toContain("'DUPLICATE_SKU'");
    expect(migration).toContain("'CATALOG',row_record.source_page_number::TEXT,FALSE");
    expect(migration).toContain("NEW.visibility<>'CONFIDENTIAL'");
    expect(migration).toContain("'DUPLICATE_SKU_IN_FILE'");
  });

  it("keeps worker mutations unavailable to browser roles", () => {
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.claim_catalog_pdf_pages(TEXT,INTEGER) FROM PUBLIC,anon,authenticated");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.claim_catalog_pdf_pages(TEXT,INTEGER) TO project_admin");
    expect(migration).toContain("ALTER TABLE public.catalog_import_ai_calls ENABLE ROW LEVEL SECURITY");
    expect(migration).toContain("rendered_file_id=rendered_file_id_input");
    expect(uploadRoute).toContain('admin.database.from("catalog_import_pages").insert(batch)');
  });

  it("stages both PDF and spreadsheet imports only through the trusted server path", () => {
    expect(uploadRoute).toContain('requireAppAccess({ permissions: ["catalog.import"] })');
    expect(uploadRoute.match(/admin\.database\.from\("catalog_import_jobs"\)\.insert/g)).toHaveLength(2);
    expect(uploadRoute).toContain('admin.database.from("catalog_import_pages").insert(batch)');
    expect(uploadRoute).toContain('admin.database.from("catalog_import_rows").insert(batch)');
    expect(uploadRoute).toContain('admin.database.from("catalog_import_errors").insert(batch)');
    expect(uploadRoute).not.toMatch(/insforge\.database\.from\("catalog_import_(jobs|pages|rows|errors)"\)\.insert/);
    expect(migration).toContain("REVOKE INSERT,UPDATE,DELETE ON public.catalog_import_jobs,public.catalog_import_rows,public.catalog_import_errors FROM authenticated");
  });

  it("restricts trusted rollback to completed PDF jobs with no downstream references", () => {
    const rollback = migration.slice(migration.indexOf("CREATE OR REPLACE FUNCTION public.rollback_catalog_pdf_drafts"), migration.indexOf("CREATE OR REPLACE FUNCTION public.cancel_catalog_pdf_import"));
    expect(rollback).toContain("source_type='PDF'");
    expect(rollback).toContain("job_record.status NOT IN ('COMPLETED','COMPLETED_WITH_ISSUES','READY_FOR_REVIEW')");
    expect(rollback).toContain("constraint_record.confrelid='public.products'::regclass");
    expect(rollback).toContain("p.status='DRAFT' AND p.qa_status='NOT_REVIEWED'");
    expect(rollback).toContain("current_product_snapshot IS DISTINCT FROM row_record.imported_product_snapshot");
    expect(rollback).toContain("id=row_record.imported_media_id");
  });

  it("reserves compute budget before the application gateway wakes the worker", () => {
    expect(migration).toContain("reserved_usd+actual_usd<=20");
    expect(migration).toContain("MONTHLY_COMPUTE_BUDGET_EXCEEDED");
    expect(migration).toContain("warning80Percent");
    expect(migration).toContain("COMPUTE_RUN_ALREADY_ACTIVE");
    expect(wakeRoute.indexOf("reserve_catalog_pdf_compute_run")).toBeLessThan(wakeRoute.indexOf("fetch(`${workerUrl}/${action}`"));
    expect(wakeRoute).toContain("COMPUTE_CAP_UNVERIFIED");
  });

  it("stores extraction artifacts outside database text/json columns and requires durable reviewed images", () => {
    expect(migration).not.toContain("native_text TEXT");
    expect(migration).not.toContain("ocr_text TEXT");
    expect(migration).not.toContain("output_json JSONB");
    expect(migration).toContain("native_text_file_id UUID");
    expect(migration).toContain("raw_ai_file_id UUID");
    expect(migration).toContain("stage_catalog_pdf_product_image");
    expect(migration).toContain("row_record.category_id IS NULL OR row_record.selected_image_file_id IS NULL");
    expect(migration).toContain("approved_image_file_id IS NOT NULL");
    expect(migration).toContain("IF remaining_count=0 THEN");
    expect(migration).toContain("UPDATE public.catalog_import_ai_calls SET purge_after=NOW()+INTERVAL '30 days'");
  });

  it("makes security verification failures terminal and non-retryable", () => {
    expect(migration).toContain("fail_catalog_pdf_job_security");
    expect(migration).toContain("PDF_PORTFOLIO_NOT_ALLOWED");
    expect(migration).toContain("entity_type='CATALOG_IMPORT_QUARANTINE'");
    expect(migration).toContain("reserved_total:=reserved_total+ai_call_record.reserved_cost_usd");
    expect(migration).toContain("COALESCE(failure_code,'') NOT IN ('MALWARE_DETECTED'");
  });

  it("keeps every PDF and derived artifact inaccessible until trusted verification", () => {
    expect(migration).toContain("security_status TEXT NOT NULL DEFAULT 'PENDING'");
    expect(migration).toContain("mark_catalog_pdf_job_verified");
    expect(migration).toContain("security_status='REJECTED',security_verified_at=NULL");
    expect(migration).toContain("IF page_record.security_status<>'VERIFIED' THEN RAISE EXCEPTION 'SECURITY_NOT_VERIFIED'");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.mark_catalog_pdf_job_verified(UUID,UUID,UUID,TEXT) TO project_admin");
    expect(detailRoute).toContain('job.data.security_status === "VERIFIED" && job.data.security_verified_at');
    expect(artifactRoute).toContain('job.data.security_status !== "VERIFIED" || !job.data.security_verified_at');
    expect(genericDownloadRoute).toContain('file.entity_type.startsWith("CATALOG_IMPORT")');
    expect(genericDownloadRoute).toContain('job.data.security_status !== "VERIFIED" || !job.data.security_verified_at');
    expect(reviewComponent).toContain("รอตรวจความปลอดภัยด้วย qpdf และ ClamAV ก่อนเปิดเอกสาร");
  });

  it("binds a durable image to the exact currently selected candidate image", () => {
    expect(migration).toContain("approved_image_source_file_id UUID");
    expect(migration).toContain("approved_image_source_file_id=CASE WHEN patch_input?'selectedImageFileId'");
    expect(migration).toContain("approved_image_source_file_id=source_file_id_input");
    expect(migration).toContain("row_record.approved_image_source_file_id=row_record.selected_image_file_id");
    expect(confirmRoute).toContain("approved_image_source_file_id");
    expect(confirmRoute).toContain("row.approved_image_source_file_id === row.selected_image_file_id");
  });

  it("releases rejected staged images only for terminal-job retention cleanup", () => {
    const review = migration.slice(migration.indexOf("CREATE OR REPLACE FUNCTION public.review_catalog_pdf_candidate"), migration.indexOf("CREATE OR REPLACE FUNCTION public.update_catalog_pdf_candidate"));
    const cleanup = migration.slice(migration.indexOf("CREATE OR REPLACE FUNCTION public.list_catalog_pdf_expired_files"), migration.indexOf("CREATE OR REPLACE FUNCTION public.finalize_catalog_pdf_expired_file"));
    expect(review).toContain("approved_image_file_id=NULL,approved_image_source_file_id=NULL");
    expect(cleanup).toContain("JOIN public.catalog_import_jobs orphan_job ON orphan_job.id=f.entity_id");
    expect(cleanup).toContain("orphan_job.status IN ('COMPLETED','COMPLETED_WITH_ISSUES','FAILED','CANCELLED')");
    expect(cleanup).toContain("COALESCE(orphan_job.completed_at,orphan_job.cancelled_at,orphan_job.updated_at)<NOW()-INTERVAL '30 days'");
    expect(cleanup).toContain("NOT EXISTS(SELECT 1 FROM public.product_media pm WHERE pm.file_id=f.id)");
  });

  it("derives every AI reservation from a persisted worst-case pricing snapshot", () => {
    expect(migration).toContain("pricing_snapshot JSONB NOT NULL");
    expect(migration).toContain("reserved_cost_usd NUMERIC(12,6) NOT NULL");
    expect(migration).toContain("calculated_cost:=CEIL");
    expect(migration).toContain("calculated_cost<>estimated_cost_usd_input");
    expect(migration).toContain("reserve_catalog_pdf_ai_call(UUID,NUMERIC,TEXT,JSONB,INTEGER,INTEGER)");
    expect(migration).toContain("ai_cost_usd_input>reserved_cost");
    expect(migration).toContain("provider TEXT NOT NULL CHECK (provider='azure')");
    expect(migration).toContain("pricing_snapshot_input->>'provider'<>'azure'");
    expect(migration).not.toContain("provider TEXT NOT NULL CHECK (provider='openai')");
  });
});
