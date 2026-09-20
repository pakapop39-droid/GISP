import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  new URL("../../migrations/20260918133857_release-c-org-scope-hardening.sql", import.meta.url),
  "utf8",
);
const packagedSql = readFileSync(
  new URL(
    "../../release-candidates/rlc-harden-01/migrations/20260920010250_release-c-org-scope-hardening.sql",
    import.meta.url,
  ),
  "utf8",
);

function body(functionName: string) {
  const start = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${functionName}`);
  expect(start).toBeGreaterThan(-1);
  const end = sql.indexOf("\n$$;", start);
  expect(end).toBeGreaterThan(start);
  return sql.slice(start, end);
}

describe("RLC-HARDEN-01 migration contract", () => {
  it.each([
    ["issue_supplier_orders", "orders.manage", "customer_orders"],
    ["create_supplier_payment", "supplier_payments.request", "supplier_orders"],
    ["review_supplier_payment", "supplier_payments.manage", "supplier_payments"],
    ["mark_supplier_payment_paid", "supplier_payments.manage", "supplier_payments"],
    ["decide_order_cancellation", "orders.manage", "cancellation_requests"],
  ])("resolves target organization before %s mutation", (name, permission, targetTable) => {
    const functionSql = body(name);
    const resolveTarget = functionSql.indexOf(`public.${targetTable}`);
    const permissionCheck = functionSql.indexOf(
      `public.has_permission('${permission}', target_organization_id)`,
    );
    const implementationCall = functionSql.indexOf(`public.${name}_rlc_impl`);
    expect(resolveTarget).toBeGreaterThan(-1);
    expect(permissionCheck).toBeGreaterThan(resolveTarget);
    expect(implementationCall).toBeGreaterThan(permissionCheck);
    expect(sql).toContain(`REVOKE ALL ON FUNCTION public.${name}_rlc_impl`);
  });

  it("rejects duplicate project items before the private Order implementation", () => {
    const functionSql = body("create_customer_order");
    const duplicateCheck = functionSql.indexOf("HAVING COUNT(*) > 1");
    const implementationCall = functionSql.indexOf("create_customer_order_rlc_impl");
    expect(duplicateCheck).toBeGreaterThan(-1);
    expect(implementationCall).toBeGreaterThan(duplicateCheck);
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.create_customer_order_rlc_impl");
  });

  it("targets supplier-payment staff reads to the supplier Order organization", () => {
    const policy = sql.slice(sql.indexOf("CREATE POLICY supplier_payments_staff_read"));
    expect(policy).toContain("FROM public.supplier_orders");
    expect(policy).toContain("so.organization_id");
    expect(policy).not.toMatch(/has_permission\('[^']+'\s*\)/);
  });

  it("blocks inactive session registration, context, touch, and re-entry", () => {
    expect(body("register_app_session")).toContain("assert_account_not_inactive");
    expect(body("get_app_access_context")).toContain("u.status <> 'INACTIVE'");
    expect(body("touch_app_session")).toContain("u.status = 'INACTIVE'");
    expect(body("prevent_inactive_account_reentry")).toContain("OLD.status = 'INACTIVE'");
  });

  it("pins search paths and avoids destructive business-data operations", () => {
    const definitions = sql.match(/CREATE OR REPLACE FUNCTION/g) ?? [];
    const pinned = sql.match(/SET search_path = pg_catalog, public, pg_temp/g) ?? [];
    expect(pinned).toHaveLength(definitions.length);
    expect(sql).not.toMatch(/\b(DELETE FROM|TRUNCATE|DROP TABLE)\b/i);
  });

  it("packages the exact normalized forward migration", () => {
    const normalize = (value: string) => value.replace(/\r\n/g, "\n").trimEnd();
    expect(normalize(packagedSql)).toBe(normalize(sql));
  });
});
