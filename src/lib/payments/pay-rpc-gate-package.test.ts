import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const directory = resolve(process.cwd(), "release-candidates/pay-rpc-gate-001/migrations");
const names = readdirSync(directory).filter((name) => name.endsWith(".sql")).sort();
const sql = (name: string) => readFileSync(resolve(directory, name), "utf8");

describe("PAY-RPC-GATE-001 isolated ordered candidate", () => {
  it("contains only the twelve enumerated forward SQL stages in safety-first order", () => {
    expect(names).toEqual([
      "20260920010000_pay-close-legacy-entry.sql",
      "20260920010100_pay-evidence-binding.sql",
      "20260920010200_pay-private-executor.sql",
      "20260920010300_release-c-privileges.sql",
      "20260920010400_d7-qc-reopen-prerequisite.sql",
      "20260920010500_release-d7-privileges.sql",
      "20260920010600_d8-consolidation-prerequisite.sql",
      "20260920010700_d8-customs-prerequisite.sql",
      "20260920010800_release-d8-privileges.sql",
      "20260920010900_d8-freight-payment-enable.sql",
      "20260920011000_release-d9-privileges.sql",
      "20260920011100_release-d10-privileges.sql",
    ]);
  });

  it("closes direct Finance writes before installing the bound functions and C grants", () => {
    expect(sql(names[0])).toContain("REVOKE ALL ON FUNCTION public.verify_payment_transfer");
    expect(sql(names[0])).toContain("REVOKE ALL ON FUNCTION public.submit_payment_transfer");
    expect(sql(names[1])).toContain("PAYMENT_EVIDENCE_ALREADY_USED");
    expect(sql(names[2])).toContain("PRIVATE_PAYMENT_VERIFICATION_REQUIRED");
    expect(sql(names[3])).toContain("GRANT EXECUTE ON FUNCTION public.submit_payment_transfer");
  });

  it("does not expose QC Reopen before D7 and keeps Freight closed until D8", () => {
    const qc = sql(names[4]);
    expect(qc.lastIndexOf("REVOKE ALL ON FUNCTION public.reopen_qc_inspection"))
      .toBeGreaterThan(qc.lastIndexOf("GRANT EXECUTE ON FUNCTION public.reopen_qc_inspection"));
    expect(sql(names[5])).toContain("GRANT EXECUTE ON FUNCTION public.reopen_qc_inspection");
    expect(sql(names[2])).toContain("AS $$ SELECT FALSE $$");
    expect(sql(names[9])).toContain("AS $$ SELECT TRUE $$");
  });
});
