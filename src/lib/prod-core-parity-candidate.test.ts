import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const migration = readFileSync(path.join(root, "migrations", "20261001203111_prod-core-parity-direct-prod.sql"), "utf8");
const stop = readFileSync(path.join(root, "release-candidates", "prod-core-parity-direct-prod-02", "emergency", "stop-core-parity.sql"), "utf8");
const supplierPaymentPdf = readFileSync(path.join(root, "src", "lib", "orders", "supplier-payment-pdf.ts"), "utf8");
const compact = (value: string) => value.replace(/\s+/g, " ").trim();
const wrapperSignatures = [
  "create_supplier_payment(UUID,TEXT,NUMERIC,TEXT)",
  "review_supplier_payment(UUID,BOOLEAN,TEXT)",
  "mark_supplier_payment_paid(UUID,UUID)",
];
const privateSignatures = wrapperSignatures.map((signature) => signature.replace("(", "_rlc_impl("));

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

  it("bootstraps owner EXECUTE before replacing wrappers and preserves private runtime access only for the owner", () => {
    const normalized = compact(migration);
    wrapperSignatures.forEach((signature) => {
      const ownerGrant = `GRANT EXECUTE ON FUNCTION public.${signature} TO project_admin;`;
      const create = `CREATE OR REPLACE FUNCTION public.${signature.slice(0, signature.indexOf("("))}`;
      expect(normalized.indexOf(ownerGrant)).toBeGreaterThan(-1);
      expect(normalized.indexOf(ownerGrant)).toBeLessThan(normalized.indexOf(create));
      expect(normalized.lastIndexOf(ownerGrant)).toBeGreaterThan(normalized.indexOf(create));
      expect(normalized).toContain(`REVOKE ALL ON FUNCTION public.${signature} FROM PUBLIC, anon, authenticated;`);
      expect(normalized).toContain(`GRANT EXECUTE ON FUNCTION public.${signature} TO authenticated;`);
      expect(normalized).not.toContain(`REVOKE ALL ON FUNCTION public.${signature} FROM PUBLIC, anon, authenticated, project_admin;`);
    });
    privateSignatures.forEach((signature) => {
      const privateRevoke = `REVOKE ALL ON FUNCTION public.${signature} FROM PUBLIC, anon, authenticated;`;
      const privateOwnerGrant = `GRANT EXECUTE ON FUNCTION public.${signature} TO project_admin;`;
      expect(normalized).toContain(privateRevoke);
      expect(normalized).toContain(privateOwnerGrant);
      expect(normalized.indexOf(privateOwnerGrant)).toBeLessThan(normalized.indexOf("CREATE OR REPLACE FUNCTION public.create_supplier_payment"));
      expect(normalized).not.toContain(`GRANT EXECUTE ON FUNCTION public.${signature} TO authenticated;`);
    });
  });

  it("asserts the final wrapper/private ACL matrices inside the migration transaction", () => {
    expect(migration).toContain("CORE_PARITY_PRIVATE_ACL_INVALID");
    expect(migration).toContain("CORE_PARITY_WRAPPER_ACL_INVALID");
    expect(migration).toContain("acl.grantee = 0");
    expect(migration).toContain("has_function_privilege('anon', signature, 'EXECUTE')");
    expect(migration).toContain("has_function_privilege('authenticated', signature, 'EXECUTE')");
    expect(migration).toContain("has_function_privilege('project_admin', signature, 'EXECUTE')");
  });

  it("contains no business-row DML at apply time and ships a no-data emergency stop", () => {
    const outsideBodies = migration.replace(/AS \$\$[\s\S]*?\$\$;/g, "");
    expect(outsideBodies).not.toMatch(/\b(?:INSERT|UPDATE|DELETE)\s+(?:INTO|public\.)/i);
    expect(stop).not.toMatch(/\b(?:INSERT|UPDATE|DELETE|TRUNCATE|DROP)\b/i);
    expect(stop).toContain("REVOKE ALL ON FUNCTION public.create_supplier_payment");
    expect(stop).toContain("REVOKE ALL ON FUNCTION public.create_claim");
    expect(stop).toContain("REVOKE ALL ON FUNCTION public.get_fixed_report");
  });

  it("keeps the emergency stop fail-closed to clients while preserving owner recovery EXECUTE", () => {
    const normalized = compact(stop);
    [...wrapperSignatures, ...privateSignatures].forEach((signature) => {
      expect(normalized).toContain(`REVOKE ALL ON FUNCTION public.${signature} FROM PUBLIC,anon,authenticated;`);
      expect(normalized).toContain(`GRANT EXECUTE ON FUNCTION public.${signature} TO project_admin;`);
      expect(normalized).not.toContain(`GRANT EXECUTE ON FUNCTION public.${signature} TO authenticated;`);
      expect(normalized).not.toContain(`FROM PUBLIC,anon,authenticated,project_admin;`);
    });
    expect(stop).toContain("CORE_PARITY_STOP_ACL_INVALID");
  });

  it("uses the persisted supplier payment timestamp columns in the PDF loader", () => {
    expect(supplierPaymentPdf).toContain("created_at,reviewed_at,paid_at");
    expect(supplierPaymentPdf).not.toContain("requested_at,approved_at");
  });
});
