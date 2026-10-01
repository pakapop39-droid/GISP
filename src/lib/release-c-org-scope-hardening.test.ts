import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readNormalized = (url: URL) => readFileSync(url, "utf8").replace(/\r\n/g, "\n");

const sql = readNormalized(
  new URL("../../migrations/20260918133857_release-c-org-scope-hardening.sql", import.meta.url),
);
const packagedSql = readNormalized(
  new URL(
    "../../release-candidates/rlc-harden-01/migrations/20260920010250_release-c-org-scope-hardening.sql",
    import.meta.url,
  ),
);
const fullFlowPackagedSql = readNormalized(
  new URL(
    "../../release-candidates/full-flow-go-live-01/migrations/20260920010250_release-c-org-scope-hardening.sql",
    import.meta.url,
  ),
);
const migration = (name: string) => readNormalized(
  new URL(`../../migrations/${name}`, import.meta.url),
);

function body(functionName: string) {
  const start = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${functionName}`);
  expect(start).toBeGreaterThan(-1);
  const end = sql.indexOf("\n$$;", start);
  expect(end).toBeGreaterThan(start);
  return sql.slice(start, end);
}

type Scope = { code: string; organizationId: string | null };
const hasTargetPermission = (scopes: Scope[], code: string, organizationId: string) =>
  scopes.some((scope) => scope.code === code
    && (scope.organizationId === null || scope.organizationId === organizationId));

function canReadFileMetadata(input: {
  authenticated: boolean;
  visibility: "PUBLIC" | "MEMBER_PRIVATE" | "CONFIDENTIAL";
  ownMemberProfile: boolean;
  organizationId: string;
  scopes: Scope[];
}) {
  if (!input.authenticated) return false;
  if (input.visibility === "CONFIDENTIAL") {
    return hasTargetPermission(input.scopes, "files.confidential.read", input.organizationId);
  }
  return input.visibility === "PUBLIC"
    || input.ownMemberProfile
    || hasTargetPermission(input.scopes, "files.member.manage", input.organizationId);
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

  it("replaces quotation-cost and file metadata policies with row-targeted checks", () => {
    expect(sql).toContain("DROP POLICY IF EXISTS custom_quotation_costs_internal");
    expect(sql).toContain("cq.id = custom_quotation_costs.quotation_id");
    expect(sql).toContain("public.has_permission('quotations.manage', cq.organization_id)");
    expect(sql).toContain("DROP POLICY IF EXISTS file_metadata_select");
    expect(sql).toContain("visibility <> 'CONFIDENTIAL'");
    expect(sql).toContain("public.has_permission('files.member.manage', organization_id)");
    expect(sql).toContain("public.has_permission('files.confidential.read', organization_id)");
    expect(sql).not.toMatch(/has_permission\('(quotations\.manage|files\.member\.manage|files\.confidential\.read)'\s*\)/);
    const filePolicy = sql.slice(
      sql.indexOf("CREATE POLICY file_metadata_select"),
      sql.indexOf("-- Explicitly revoke", sql.indexOf("CREATE POLICY file_metadata_select")),
    );
    expect(filePolicy).toContain("visibility <> 'CONFIDENTIAL'\n    AND (\n      visibility = 'PUBLIC'\n      OR member_profile_id IN");
    expect(filePolicy).toContain("visibility = 'CONFIDENTIAL'\n    AND organization_id IS NOT NULL\n    AND public.has_permission('files.confidential.read', organization_id)");
  });

  it("denies direct authenticated cross-org RLS while preserving same-org and global staff", () => {
    const sameOrg: Scope[] = [{ code: "quotations.manage", organizationId: "org-a" }];
    const global: Scope[] = [{ code: "quotations.manage", organizationId: null }];
    expect(hasTargetPermission(sameOrg, "quotations.manage", "org-a")).toBe(true);
    expect(hasTargetPermission(sameOrg, "quotations.manage", "org-b")).toBe(false);
    expect(hasTargetPermission(global, "quotations.manage", "org-b")).toBe(true);
    expect(hasTargetPermission([], "quotations.manage", "org-a")).toBe(false);
  });

  it("preserves authenticated public/member-own file reads and targets staff file scopes", () => {
    const base = {
      authenticated: true,
      visibility: "MEMBER_PRIVATE" as const,
      ownMemberProfile: false,
      organizationId: "org-a",
    };
    expect(canReadFileMetadata({ ...base, visibility: "PUBLIC", scopes: [] })).toBe(true);
    expect(canReadFileMetadata({ ...base, ownMemberProfile: true, scopes: [] })).toBe(true);
    expect(canReadFileMetadata({
      ...base,
      scopes: [{ code: "files.member.manage", organizationId: "org-a" }],
    })).toBe(true);
    expect(canReadFileMetadata({
      ...base,
      scopes: [{ code: "files.member.manage", organizationId: "org-b" }],
    })).toBe(false);
    expect(canReadFileMetadata({
      ...base,
      scopes: [{ code: "files.member.manage", organizationId: null }],
    })).toBe(true);
    expect(canReadFileMetadata({ ...base, authenticated: false, scopes: [] })).toBe(false);
    expect(canReadFileMetadata({
      ...base,
      visibility: "CONFIDENTIAL",
      scopes: [{ code: "files.member.manage", organizationId: "org-a" }],
    })).toBe(false);
    expect(canReadFileMetadata({
      ...base,
      visibility: "CONFIDENTIAL",
      ownMemberProfile: true,
      scopes: [],
    })).toBe(false);
    expect(canReadFileMetadata({
      ...base,
      visibility: "CONFIDENTIAL",
      ownMemberProfile: true,
      scopes: [{ code: "files.confidential.read", organizationId: "org-a" }],
    })).toBe(true);
    expect(canReadFileMetadata({
      ...base,
      visibility: "CONFIDENTIAL",
      scopes: [{ code: "files.confidential.read", organizationId: "org-a" }],
    })).toBe(true);
  });

  it.each([
    ["public file", "PUBLIC", false, [], true],
    ["member-private owner", "MEMBER_PRIVATE", true, [], true],
    ["member-private staff", "MEMBER_PRIVATE", false, [{ code: "files.member.manage", organizationId: "org-a" }], true],
    ["confidential owner without confidential permission", "CONFIDENTIAL", true, [], false],
    ["confidential member manager without confidential permission", "CONFIDENTIAL", false, [{ code: "files.member.manage", organizationId: "org-a" }], false],
    ["confidential cross-org reader", "CONFIDENTIAL", true, [{ code: "files.confidential.read", organizationId: "org-b" }], false],
    ["confidential same-org reader", "CONFIDENTIAL", false, [{ code: "files.confidential.read", organizationId: "org-a" }], true],
    ["confidential global reader", "CONFIDENTIAL", false, [{ code: "files.confidential.read", organizationId: null }], true],
  ] as const)("file metadata truth table: %s", (_label, visibility, ownMemberProfile, scopes, expected) => {
    expect(canReadFileMetadata({
      authenticated: true,
      visibility,
      ownMemberProfile,
      organizationId: "org-a",
      scopes: [...scopes],
    })).toBe(expected);
  });

  it("audits adjacent Release C SELECT policies for target organization checks", () => {
    const rfq = migration("20260824134357_slice-4-custom-rfq.sql");
    const quotation = migration("20260828132933_slice-5-custom-quotation.sql");
    const orders = migration("20260828154027_slice-6-orders-payments.sql");
    const supplierPayments = migration("20260905120500_staff-job-groups.sql");
    expect(rfq).toContain("public.has_permission('rfq.manage',organization_id)");
    expect(rfq).toContain("public.has_permission('rfq.manage',cr.organization_id)");
    expect(quotation).toContain("public.has_permission('quotations.manage', organization_id)");
    expect(quotation).toContain("public.has_permission('quotations.manage', quotation.organization_id)");
    expect(orders).toContain("public.has_permission('orders.manage', organization_id)");
    expect(orders).toContain("public.has_permission('payments.verify', co.organization_id)");
    expect(supplierPayments).toContain("public.has_permission('supplier_payments.request', organization_id)");
    expect(supplierPayments).toContain("public.has_permission('supplier_payments.manage', organization_id)");
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
    expect(normalize(fullFlowPackagedSql)).toBe(normalize(sql));
  });
});
