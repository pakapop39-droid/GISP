import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "migrations/20260916123000_iss02-customs-evidence-binding.sql",
);

describe("ISS-02 customs evidence migration", () => {
  it("replaces only add_shipment_event and keeps schema and permissions unchanged", () => {
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.add_shipment_event");
    expect(sql).not.toMatch(/\b(?:CREATE|ALTER|DROP)\s+TABLE\b/i);
    expect(sql).not.toMatch(/\b(?:GRANT|REVOKE|CREATE\s+POLICY|ALTER\s+POLICY)\b/i);
    expect(sql).not.toMatch(/\b(?:UPDATE|DELETE)\s+public\.(?!shipments\b)/i);
  });

  it("requires a confidential CUSTOMS_ENTRY bound to shipment, organization, and its member order", () => {
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toContain("CUSTOMS_EVIDENCE_REQUIRED");
    expect(sql).toContain("INVALID_CUSTOMS_EVIDENCE");
    expect(sql).toMatch(/evidence_record\.organization_id IS DISTINCT FROM shipment_record\.organization_id/);
    expect(sql).toMatch(/order_member_profile_id IS NULL/);
    expect(sql).toMatch(/evidence_record\.member_profile_id IS NOT NULL/);
    expect(sql).toMatch(/evidence_record\.entity_type IS DISTINCT FROM 'CUSTOMS_ENTRY'/);
    expect(sql).toMatch(/evidence_record\.entity_id IS DISTINCT FROM shipment_record\.id/);
    expect(sql).toMatch(/evidence_record\.bucket IS DISTINCT FROM 'gisp-confidential'/);
    expect(sql).toMatch(/evidence_record\.visibility IS DISTINCT FROM 'CONFIDENTIAL'/);
  });

  it("writes an internal document and audit atomically and rejects an equal-rank milestone", () => {
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toContain("DUPLICATE_SHIPMENT_MILESTONE");
    expect(sql).toMatch(/new_rank > 0 AND new_rank = last_rank/);
    expect(sql).toContain("'CUSTOMS_ENTRY' ELSE 'TRACKING_EVIDENCE'");
    expect(sql).toContain("THEN FALSE ELSE is_member_visible_input");
    expect(sql).toContain("CUSTOMS_CLEARED_AND_ARRIVED_WAREHOUSE");
    expect(sql).toContain("PERFORM public.write_audit_event");
  });

  it("blocks READY_FOR_DELIVERY until the Thailand warehouse milestone and bound evidence exist", () => {
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toContain("THAILAND_WAREHOUSE_REQUIRED");
    expect(sql).toMatch(/status_input = 'READY_FOR_DELIVERY'[\s\S]*last_rank <> 110/);
    expect(sql).toMatch(/shipment_record\.status IS DISTINCT FROM 'THAILAND_WAREHOUSE'/);
    expect(sql).toMatch(/FROM public\.shipment_documents sd[\s\S]*JOIN public\.file_metadata fm/);
    expect(sql).toMatch(/sd\.document_type = 'CUSTOMS_ENTRY'/);
    expect(sql).toMatch(/fm\.entity_id = shipment_record\.id/);
  });
});
