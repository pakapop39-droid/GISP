import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "migrations/20260912092303_door-finish-library.sql"),
  "utf8",
);
const memberRoute = readFileSync(
  join(process.cwd(), "src/app/api/member/catalog/[id]/route.ts"),
  "utf8",
);

describe("Door Catalog finish library contract", () => {
  it("creates an additive supplier-scoped library with stable duplicate guards", () => {
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.finish_collections");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.finishes");
    expect(migration).toContain("finish_collections_supplier_code_unique");
    expect(migration).toContain("finishes_collection_code_unique");
    expect(migration).toContain("DUPLICATE_FINISH_CODE");
  });

  it("keeps writes behind permission-checked trusted functions and RLS", () => {
    expect(migration).toContain("ALTER TABLE public.finishes ENABLE ROW LEVEL SECURITY");
    expect(migration).toContain("REVOKE ALL ON public.finish_collections, public.finishes");
    expect(migration).toContain("IF NOT public.has_permission('catalog.manage')");
    expect(migration).toContain("SECURITY DEFINER");
    expect(migration).toContain("SET search_path = pg_catalog, public, pg_temp");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.save_finish_collection");
  });

  it("imports reviewed manifest rows as Draft without price or publish mutations", () => {
    const importFunction = migration.slice(migration.indexOf("CREATE OR REPLACE FUNCTION public.import_finish_manifest"));
    expect(importFunction).toContain("'DRAFT'");
    expect(importFunction).not.toContain("product_prices");
    expect(importFunction).not.toContain("PUBLISHED");
    expect(importFunction).not.toContain("factory_cost");
    expect(importFunction).toContain("collection_code', ''))) > 80");
    expect(importFunction).toContain("collection_name_th', ''))) > 240");
    expect(importFunction).toContain("collection_name_zh', ''))) > 240");
    expect(importFunction).toContain("finish_code', ''))) > 80");
    expect(importFunction).toContain("finish_name_th', ''))) > 240");
    expect(importFunction).toContain("finish_name_zh', ''))) > 240");
    expect(importFunction).toContain("material', ''))) > 240");
    expect(importFunction).toContain("source_document', ''))) > 500");
    expect(importFunction).toContain("source_version', ''))) > 120");
    expect(importFunction).toContain("source_page', ''))) > 80");
  });

  it("filters inactive option groups and values before member serialization", () => {
    expect(memberRoute).toMatch(/from\("product_options"\)[\s\S]*?eq\("status", "ACTIVE"\)/);
    expect(memberRoute).toMatch(/from\("product_option_values"\)[\s\S]*?eq\("status", "ACTIVE"\)/);
    expect(memberRoute).toContain("signedMemberOptionFinishes");
    expect(memberRoute).not.toContain("source_document");
    expect(memberRoute).not.toContain("supplier_id");
  });
});
