import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const files = {
  c: "20260918133858_release-c-transaction-privileges.sql",
  d7: "20260918133905_release-d7-production-qc-privileges.sql",
  d8: "20260918133916_release-d8-logistics-privileges.sql",
  d9: "20260918133927_release-d9-claim-privileges.sql",
  d10: "20260918133933_release-d10-report-privileges.sql",
};
const sql = Object.fromEntries(Object.entries(files).map(([stage, name]) => [
  stage, readFileSync(resolve(process.cwd(), "migrations", name), "utf8"),
]));
const grants = (source: string) => [...source.matchAll(/GRANT EXECUTE ON FUNCTION (public\.[^(]+\([^;]+?\)) TO authenticated;/g)]
  .map((match) => match[1]);

describe("Release C/D privilege migration boundary", () => {
  it("restores only the nine C member transaction RPCs revoked by Release B", () => {
    const cGrants = grants(sql.c);
    expect(cGrants).toHaveLength(9);
    expect(cGrants).toContain("public.create_customer_order(UUID,JSONB)");
    expect(cGrants).toContain("public.submit_payment_transfer(UUID,NUMERIC,TIMESTAMPTZ,UUID)");
    expect(cGrants.some((signature) => /claim|shipment|qc/.test(signature))).toBe(false);
  });

  it("closes every existing D direct-RPC grant before C opens", () => {
    for (const stage of ["d7", "d8", "d9", "d10"]) {
      for (const signature of grants(sql[stage])) {
        // QC Reopen is introduced later by the already-approved D7 function migration.
        if (["public.reopen_qc_inspection(UUID,TEXT)", "public.get_dispatch_gate(UUID)", "public.can_dispatch_order_item(UUID)"].includes(signature)) continue;
        expect(sql.c).toContain(`REVOKE ALL ON FUNCTION ${signature} FROM PUBLIC,anon,authenticated;`);
      }
    }
  });

  it("conditionally closes Development-only QC Reopen without requiring it on Production B", () => {
    expect(sql.c).toContain("to_regprocedure('public.reopen_qc_inspection(uuid,text)')");
    expect(sql.c).toContain("REVOKE ALL ON FUNCTION public.reopen_qc_inspection(UUID,TEXT)");
    expect(sql.c).not.toContain("REVOKE ALL ON FUNCTION public.get_dispatch_gate(UUID)");
  });

  it("contains only function privileges, not schema/data mutations or broad grants", () => {
    for (const source of Object.values(sql)) {
      expect(source).not.toMatch(/\b(?:CREATE|ALTER|DROP|TRUNCATE|INSERT|UPDATE|DELETE)\s+(?:TABLE|INTO|public\.)/i);
      expect(source).not.toMatch(/GRANT\s+ALL|TO\s+PUBLIC\s*;/i);
      expect(source).not.toMatch(/\b(?:BEGIN|COMMIT|ROLLBACK)\s*;/i);
    }
  });
});
