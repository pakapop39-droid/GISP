import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(resolve(process.cwd(), "migrations/20260918050000_qc-reopen-before-dispatch.sql"), "utf8");

describe("QC reopen function-only migration", () => {
  it("changes only the approved public functions and a narrow execute grant", () => {
    expect([...sql.matchAll(/CREATE OR REPLACE FUNCTION public\.(\w+)/g)].map((match) => match[1]))
      .toEqual(["reopen_qc_inspection", "record_qc_inspection", "dispatch_shipment"]);
    expect(sql).not.toMatch(/\b(?:CREATE|ALTER|DROP)\s+(?:TABLE|COLUMN|ROLE)\b/i);
    expect(sql).not.toMatch(/\b(?:CREATE|ALTER|DROP)\s+POLICY\b/i);
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.reopen_qc_inspection/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.reopen_qc_inspection\(UUID, TEXT\)\s+TO authenticated/);
  });

  it("requires organization-scoped qc.manage and a mandatory reason before writing audit", () => {
    expect(sql).toContain("LENGTH(clean_reason) < 3");
    expect(sql).toContain("public.has_permission('qc.manage', item_organization_id)");
    expect(sql).toContain("public.has_permission('qc.manage', item_record.organization_id)");
    expect(sql).toContain("'QC_REOPENED'");
    expect(sql).toContain("'parent_inspection_id', latest_inspection_record.id");
    expect(sql).toContain("'reason', clean_reason");
    expect(sql).toContain("item_record.qc_status = 'IN_PROGRESS'");
    expect(sql).toContain("ae.after_data->>'parent_inspection_id' = latest_inspection_record.id::TEXT");
    expect(sql).toContain("ae.created_at >= latest_inspection_record.inspected_at");
  });

  it("serializes reopen and dispatch and rechecks the gate under item locks", () => {
    expect(sql).toMatch(/ORDER BY s\.id\s+FOR UPDATE OF s/);
    expect(sql).toMatch(/WHERE id = order_item_id_input FOR UPDATE/);
    expect(sql).toMatch(/ORDER BY oi\.id FOR UPDATE OF oi/);
    expect(sql).toMatch(/FOR locked_item IN[\s\S]*FOR UPDATE OF oi[\s\S]*public\.can_dispatch_order_item/);
    expect(sql).toContain("DISPATCH_GATE_CHANGED");
    expect(sql).toContain("QC cannot reopen after dispatch");
  });

  it("only records a passed-parent reinspection after reopening and keeps inspection history append-only", () => {
    expect(sql).toContain("parent_inspection_id_input IS DISTINCT FROM latest_inspection_record.id");
    expect(sql).toContain("latest_inspection_record.result <> 'PASSED'");
    expect(sql).toMatch(/item_record\.qc_status = 'IN_PROGRESS'\s+AND latest_inspection_record\.result = 'PASSED'/);
    expect(sql).toContain("'QC_REOPENED'");
    expect(sql).toContain("INSERT INTO public.qc_inspections");
    expect(sql).not.toMatch(/\bUPDATE\s+public\.qc_inspections\b/i);
    expect(sql).not.toMatch(/\bDELETE\s+FROM\s+public\.qc_inspections\b/i);
  });
});
