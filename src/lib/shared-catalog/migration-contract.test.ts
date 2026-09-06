import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const slice12 = readFileSync(join(process.cwd(), "migrations/20260905120000_slice-12-shared-catalog.sql"), "utf8");
const slice121 = readFileSync(join(process.cwd(), "migrations/20260905120600_slice-12-1-customer-browse-catalog.sql"), "utf8");
const slice13 = readFileSync(join(process.cwd(), "migrations/20260905121000_slice-13-visual-sourcing.sql"), "utf8");
const proxy = readFileSync(join(process.cwd(), "src/proxy.ts"), "utf8");

describe("Slice 12–13 database security contract", () => {
  it("keeps public catalog snapshots and history append-only", () => {
    expect(slice12).toContain("shared_catalog_versions_append_only");
    expect(slice12).toContain("shared_catalog_version_items_append_only");
    expect(slice12).toContain("shared_catalog_events_append_only");
    expect(slice12).toContain("CONTACT_CHANNEL_REQUIRED");
    expect(slice12).toContain("REVOKE ALL ON public.shared_catalogs");
    expect(slice12).toContain("JOIN public.member_applications ma ON ma.member_profile_id=mp.id");
  });

  it("allows customers to open catalog pages and APIs without an app session", () => {
    expect(proxy).toContain('"/catalog/share"');
    expect(proxy).toContain('"/api/public/catalogs"');
  });

  it("adds four no-price customer browse scopes with project privacy", () => {
    expect(slice121).toContain("'CURATED','PRODUCT','PROJECT','FULL_CATALOG'");
    expect(slice121).toContain("price_mode='HIDDEN'");
    expect(slice121).toContain("source_project_item_id");
    expect(slice121).toContain("project_area_name");
    expect(slice121).toContain("PROJECT_HAS_NO_SHAREABLE_PRODUCT");
    expect(slice121).toContain("public.is_customer_browse_product_eligible");
    expect(slice121).not.toContain("site_address");
    expect(slice121).not.toContain("end_customer_id");
  });

  it("keeps sourcing workflow and history behind trusted functions", () => {
    expect(slice13).toContain("sourcing_history_append_only");
    expect(slice13).toContain("REFERENCE_IMAGE_REQUIRED");
    expect(slice13).toMatch(/REVOKE ALL ON FUNCTION[\s\S]*public\.can_access_sourcing_request\(UUID\)/);
    expect(slice13).not.toContain("GRANT SELECT ON public.product_sourcing");
    expect(slice13).not.toContain("GRANT INSERT ON public.product_sourcing_requests TO authenticated");
  });
});
