import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  path.join(process.cwd(), "migrations/20260905121000_slice-13-visual-sourcing.sql"),
  "utf8",
);

describe("Slice 13 database security contract", () => {
  it("keeps record sequence generation private when applied after hardening", () => {
    expect(migration).toContain(
      "REVOKE ALL ON FUNCTION public.next_record_reference(TEXT) FROM PUBLIC,anon,authenticated",
    );
  });

  it("validates both member reference images and candidate images in the database", () => {
    expect(migration).toContain("CREATE TRIGGER sourcing_reference_file_guard");
    expect(migration).toContain("CREATE TRIGGER sourcing_candidate_file_guard");
    expect(migration).toContain("f.size_bytes<=10485760");
    expect(migration).toContain("f.mime_type IN ('image/jpeg','image/png','image/webp')");
  });

  it("exposes writes only through trusted functions", () => {
    expect(migration).toContain(
      "REVOKE ALL ON public.product_sourcing_requests,public.product_sourcing_files,public.product_sourcing_candidates,public.product_sourcing_candidate_files,public.product_sourcing_history FROM PUBLIC,anon,authenticated",
    );
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.create_product_sourcing_draft");
  });

  it("keeps member drafts private until submission", () => {
    expect(migration).toContain("r.status<>'DRAFT' AND public.has_permission('sourcing.manage',r.organization_id)");
    expect(migration).toContain("status<>'DRAFT' AND public.has_permission('sourcing.manage',organization_id)");
  });
});
