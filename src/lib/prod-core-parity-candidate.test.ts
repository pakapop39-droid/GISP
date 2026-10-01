import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const migration = readFileSync(path.join(root, "migrations", "20261001203111_prod-core-parity-direct-prod.sql"), "utf8");
const stop = readFileSync(path.join(root, "release-candidates", "prod-core-parity-direct-prod-02", "emergency", "stop-core-parity.sql"), "utf8");
const supplierPaymentPdf = readFileSync(path.join(root, "src", "lib", "orders", "supplier-payment-pdf.ts"), "utf8");

describe("PROD-CORE-PARITY-DIRECT-PROD v0.2 release contract", () => {
  it("restores supplier payment wrappers without replacing private hardened implementations", () => {
    expect(migration).toContain("create_supplier_payment_rlc_impl");
    expect(migration).toContain("review_supplier_payment_rlc_impl");
    expect(migration).toContain("mark_supplier_payment_paid_rlc_impl");
    expect(migration).not.toMatch(/ALTER FUNCTION[\s\S]+RENAME TO .*rlc_impl/i);
  });

  it("enforces target organization access and both maker-checker boundaries", () => {
    expect(migration).toContain("has_permission('supplier_payments.request', target_organization_id)");
    expect(migration).toContain("has_permission('supplier_payments.manage', target_organization_id)");
    expect(migration).toContain("request_actor = (SELECT auth.uid())");
    expect(migration).toContain("approval_actor = (SELECT auth.uid())");
  });

  it("contains no business-row DML at apply time and ships a no-data emergency stop", () => {
    const outsideBodies = migration.replace(/AS \$\$[\s\S]*?\$\$;/g, "");
    expect(outsideBodies).not.toMatch(/\b(?:INSERT|UPDATE|DELETE)\s+(?:INTO|public\.)/i);
    expect(stop).not.toMatch(/\b(?:INSERT|UPDATE|DELETE|TRUNCATE|DROP)\b/i);
    expect(stop).toContain("REVOKE ALL ON FUNCTION public.create_supplier_payment");
    expect(stop).toContain("REVOKE ALL ON FUNCTION public.create_claim");
    expect(stop).toContain("REVOKE ALL ON FUNCTION public.get_fixed_report");
  });

  it("uses the persisted supplier payment timestamp columns in the PDF loader", () => {
    expect(supplierPaymentPdf).toContain("created_at,reviewed_at,paid_at");
    expect(supplierPaymentPdf).not.toContain("requested_at,approved_at");
  });
});
