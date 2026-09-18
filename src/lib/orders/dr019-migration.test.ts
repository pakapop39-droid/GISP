import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "migrations/20260916090000_fix-consolidate-all-shipment-type.sql",
);

describe("DR-019 shipment type migration", () => {
  it("changes only the function and maps CONSOLIDATE_ALL to CONSOLIDATED", () => {
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.create_shipment_v2");
    expect(sql).toMatch(/WHEN\s+'CONSOLIDATE_ALL'\s+THEN\s+'CONSOLIDATED'/);
    expect(sql).not.toMatch(/\b(?:CREATE|ALTER|DROP)\s+TABLE\b/i);
    expect(sql).not.toMatch(/\b(?:GRANT|REVOKE|CREATE\s+POLICY|ALTER\s+POLICY)\b/i);
    expect(sql).not.toMatch(/\b(?:UPDATE|DELETE)\s+public\.(?!consolidation_groups\b)/i);
  });
});
