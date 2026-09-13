import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
const sql = readFileSync(
  join(process.cwd(), "migrations/20260913091001_pdf-excel-roundtrip-v1.sql"),
  "utf8",
);
const refreshSql = readFileSync(
  join(
    process.cwd(),
    "migrations/20260913091002_pdf-excel-roundtrip-refresh.sql",
  ),
  "utf8",
);
const storageSql = readFileSync(
  join(
    process.cwd(),
    "migrations/20260913091003_pdf-excel-roundtrip-storage-guard.sql",
  ),
  "utf8",
);
const lifecycleSql = readFileSync(
  join(
    process.cwd(),
    "migrations/20260913091004_pdf-excel-roundtrip-lifecycle-guard.sql",
  ),
  "utf8",
);
const lifecycleFixSql = readFileSync(
  join(
    process.cwd(),
    "migrations/20260913091005_fix-pdf-excel-roundtrip-lifecycle-trigger.sql",
  ),
  "utf8",
);
const productLinkSql = readFileSync(
  join(
    process.cwd(),
    "migrations/20260913091006_harden-pdf-excel-roundtrip-product-link.sql",
  ),
  "utf8",
);
const service = readFileSync(
  join(process.cwd(), "src/lib/catalog/enrichment-service.ts"),
  "utf8",
);
describe("PDF Catalog Excel Round-trip migration contract", () => {
  it("is additive, RLS protected and exposes only trusted apply RPCs", () => {
    expect(sql).toContain(
      "CREATE TABLE public.catalog_import_enrichment_batches",
    );
    expect(sql).toContain("CREATE TABLE public.catalog_import_enrichment_rows");
    expect(sql.match(/ENABLE ROW LEVEL SECURITY/g)?.length).toBe(3);
    expect(sql).toContain(
      "REVOKE ALL ON public.catalog_import_enrichment_batches",
    );
    expect(sql).toContain("SECURITY DEFINER");
    expect(sql).toContain("SET search_path=pg_catalog,public,pg_temp");
    expect(sql).toContain(
      "GRANT EXECUTE ON FUNCTION public.apply_catalog_enrichment_details",
    );
    expect(sql).not.toMatch(/DROP TABLE|TRUNCATE/i);
  });
  it("separates permissions, enforces PDF/lifecycle/idempotency and never activates Member Price", () => {
    expect(sql).toContain("public.has_permission('catalog.manage')");
    expect(sql).toContain("public.has_permission('catalog.cost.manage')");
    expect(sql).toContain("source_type<>'PDF'");
    expect(sql).toContain("status NOT IN ('DRAFT','REVIEW')");
    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql).toContain("UNIQUE(batch_id,action_type,idempotency_key)");
    expect(sql).toContain("public.create_product_cost_version");
    expect(sql).toContain("public.pricing_calculate_product_price");
    expect(sql).not.toContain("activate_calculated_product_price");
    expect(sql).not.toMatch(
      /product_variants|product_options|status='PUBLISHED'/,
    );
  });
  it("keeps files confidential and server staging revalidates metadata", () => {
    expect(service).toContain('storage.from("gisp-confidential")');
    expect(service).toContain('visibility: "CONFIDENTIAL"');
    expect(service).toContain('entity_type: "CATALOG_ENRICHMENT_EXPORT"');
    expect(service).toContain('entity_type: "CATALOG_ENRICHMENT_UPLOAD"');
    expect(service).toContain("WORKBOOK_TAMPERED");
    expect(service).toContain("DUPLICATE_SKU_IN_WORKBOOK");
  });
  it("refreshes a pre-Draft cost only after its PDF row links a Draft", () => {
    expect(refreshSql).toContain("refresh_catalog_enrichment_targets");
    expect(refreshSql).toContain("cost_status='WAITING_FOR_DRAFT'");
    expect(refreshSql).toContain("import_row.product_id IS NOT NULL");
    expect(refreshSql).toContain("COST_BASELINE_CHANGED");
    expect(refreshSql).toContain("public.has_permission('catalog.import')");
  });
  it("allows only confidential 10 MiB XLSX history for enrichment entities", () => {
    expect(storageSql).toContain("CATALOG_ENRICHMENT_EXPORT");
    expect(storageSql).toContain("CATALOG_ENRICHMENT_UPLOAD");
    expect(storageSql).toContain("10485760");
    expect(storageSql).toContain("gisp-confidential");
    expect(storageSql).toContain(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
  });
  it("blocks staging/apply when the parent PDF job leaves an exportable status", () => {
    expect(lifecycleSql).toContain("guard_catalog_enrichment_lifecycle");
    expect(lifecycleSql).toContain(
      "'READY_FOR_REVIEW','COMPLETED','COMPLETED_WITH_ISSUES'",
    );
    expect(lifecycleSql).toContain("INVALID_TRANSITION: PDF_JOB_STATUS");
    expect(lifecycleSql.match(/CREATE TRIGGER/g)?.length).toBe(2);
  });
  it("uses table-specific trigger fields without referencing an absent record field", () => {
    expect(lifecycleFixSql).toContain("target_batch:=NEW.id");
    expect(lifecycleFixSql).toContain("target_batch:=NEW.batch_id");
    expect(lifecycleFixSql).not.toContain("CASE WHEN TG_TABLE_NAME");
  });
  it("binds an imported Product target to the immutable PDF import snapshot", () => {
    expect(productLinkSql).toContain("imported_product_snapshot->>'id'");
    expect(productLinkSql).toContain("imported_at");
    expect(productLinkSql).toContain("CONFLICT: PDF_PRODUCT_LINKAGE");
  });
});
