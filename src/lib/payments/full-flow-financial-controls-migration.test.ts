import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const preSql = readFileSync(
  new URL(
    "../../../migrations/20260920092500_full-flow-financial-controls-pre-c.sql",
    import.meta.url,
  ),
  "utf8",
);
const postSql = readFileSync(
  new URL(
    "../../../migrations/20260920093000_full-flow-financial-controls.sql",
    import.meta.url,
  ),
  "utf8",
);
const packagedPreSql = readFileSync(
  new URL(
    "../../../release-candidates/full-flow-go-live-01/migrations/20260920010275_full-flow-financial-controls-pre-c.sql",
    import.meta.url,
  ),
  "utf8",
);
const packagedPostSql = readFileSync(
  new URL(
    "../../../release-candidates/full-flow-go-live-01/migrations/20260920011300_full-flow-financial-controls.sql",
    import.meta.url,
  ),
  "utf8",
);
const sql = `${preSql}\n${postSql}`;

function bodyFrom(source: string, functionName: string) {
  const start = source.indexOf(`CREATE OR REPLACE FUNCTION public.${functionName}`);
  expect(start).toBeGreaterThan(-1);
  const end = source.indexOf("\n$$;", start);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

function body(functionName: string) {
  return bodyFrom(sql, functionName);
}

describe("FULL-FLOW-GO-LIVE-01 financial controls migration", () => {
  it("keeps verified transfers immutable and adjustments append-only", () => {
    expect(sql).toContain("payment_transfers_verified_immutable");
    expect(sql).toContain("IF OLD.status = 'VERIFIED'");
    expect(sql).toContain("payment_adjustments_append_only");
    expect(sql).toContain("PAYMENT_ADJUSTMENT_APPEND_ONLY");
    expect(sql).not.toMatch(/\b(DELETE FROM|TRUNCATE|DROP TABLE)\b/i);
  });

  it("permits only negative corrections and calculates the effective verified total", () => {
    expect(sql).toContain("CHECK (amount_delta < 0)");
    expect(body("create_payment_adjustment_private")).toContain(
      "PAYMENT_ADJUSTMENT_EXCEEDS_TRANSFER",
    );
    expect(body("recalculate_customer_payment_schedule")).toContain(
      "verified_total + adjustment_total",
    );
    expect(body("recalculate_customer_payment_schedule")).toContain(
      "OVERPAYMENT_REVIEW",
    );
  });

  it("uses an active staff session with the dedicated organization-scoped permission", () => {
    const actor = body("payment_adjustment_actor");
    expect(actor).toContain("u.status = 'ACTIVE'");
    expect(actor).toContain("p.code = 'payments.adjust'");
    expect(actor).toContain(
      "ur.organization_id IS NULL OR ur.organization_id = target_organization_id_input",
    );
    expect(sql).toContain(
      "REVOKE ALL ON FUNCTION public.create_payment_adjustment_private",
    );
    expect(sql).toContain(
      "GRANT EXECUTE ON FUNCTION public.create_payment_adjustment_private",
    );
    expect(sql).toContain("TO project_admin");
  });

  it("creates an incident hold instead of silently continuing an advanced order", () => {
    const recalculate = body("recalculate_customer_payment_schedule");
    expect(recalculate).toContain("payment_workflow_holds");
    expect(recalculate).toContain("Finance and Order Admin review is required");
    expect(recalculate).toContain(
      "co.status NOT IN ('PENDING_DEPOSIT', 'DEPOSIT_VERIFIED', 'CANCELLATION_REQUESTED', 'CANCELLED')",
    );
    const blocker = bodyFrom(postSql, "block_order_operation_on_payment_hold");
    expect(blocker).toContain("PAYMENT_WORKFLOW_ON_HOLD");
    expect(blocker).toContain("SECURITY DEFINER");
    expect(blocker).toContain("TG_TABLE_NAME = 'qc_member_decisions'");
    expect(blocker).toContain("FROM public.order_items oi");
    expect(blocker).toContain("WHERE oi.id = NEW.order_item_id");
    expect(blocker).not.toContain("target_order_id := NEW.order_item_id");
    for (const trigger of [
      "order_items_payment_hold",
      "qc_member_decisions_payment_hold",
      "supplier_payments_payment_hold",
      "production_updates_payment_hold",
      "qc_inspections_payment_hold",
      "shipments_payment_hold",
      "deliveries_payment_hold",
      "freight_invoices_payment_hold",
    ]) {
      expect(sql).toContain(trigger);
    }
  });

  it("resumes only after restored payment and two different scoped actors confirm", () => {
    const actor = body("payment_hold_actor");
    const confirm = bodyFrom(postSql, "confirm_payment_workflow_hold_private");
    expect(actor).toContain("u.status = 'ACTIVE'");
    expect(actor).toContain("permission_code_input NOT IN ('payments.adjust', 'orders.manage')");
    expect(actor).toContain("ur.organization_id IS NULL OR ur.organization_id = target_organization_id_input");
    expect(confirm).toContain("PAYMENT_HOLD_BALANCE_NOT_RESTORED");
    expect(confirm).toContain("schedule_record.verified_amount <> schedule_record.due_amount");
    expect(confirm).toContain("PAYMENT_HOLD_MAKER_CHECKER_REQUIRED");
    expect(confirm).toContain("finance_confirmed_by");
    expect(confirm).toContain("order_admin_confirmed_by");
    expect(confirm).toContain("'RESOLVED'");
    expect(confirm).toContain("INSERT INTO public.audit_events");
    expect(confirm.indexOf("recalculate_customer_payment_schedule")).toBeLessThan(
      confirm.indexOf("schedule_record.status <> 'VERIFIED'"),
    );
    expect(confirm).toContain("maybe_complete_order(hold_record.customer_order_id)");
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.confirm_payment_workflow_hold_private");
    expect(sql).toContain("TO project_admin");
  });

  it("allows only derived freight settlement maintenance while the hold stays active", () => {
    const blocker = bodyFrom(postSql, "block_order_operation_on_payment_hold");
    const verifier = body("verify_payment_transfer_private");
    const preConfirm = bodyFrom(preSql, "confirm_payment_workflow_hold_private");
    const confirm = bodyFrom(postSql, "confirm_payment_workflow_hold_private");
    expect(blocker).toContain("TG_TABLE_NAME = 'freight_invoices'");
    expect(blocker).toContain("TG_OP = 'UPDATE'");
    expect(blocker).toContain("ARRAY['status', 'paid_at', 'updated_at']");
    expect(blocker).toContain("to_jsonb(NEW)");
    expect(blocker).toContain("to_jsonb(OLD)");
    expect(blocker).toContain("ps.id = NEW.payment_schedule_id");
    expect(blocker).toContain("ps.order_id = NEW.customer_order_id");
    expect(blocker).toContain("ps.organization_id = NEW.organization_id");
    expect(blocker).toContain("ps.schedule_type = 'FREIGHT'");
    expect(blocker).toContain("freight_schedule.status IN (");
    expect(blocker).toMatch(
      /NEW\.status IS NOT DISTINCT FROM \(CASE freight_schedule\.status[\s\S]*?END\)/,
    );
    expect(blocker).toMatch(
      /NEW\.paid_at IS NOT DISTINCT FROM \(CASE[\s\S]*?END\)/,
    );
    for (const mapping of [
      "WHEN 'VERIFIED' THEN 'PAID'",
      "WHEN 'PARTIALLY_VERIFIED' THEN 'PARTIALLY_PAID'",
      "WHEN 'OVERPAYMENT_REVIEW' THEN 'OVERPAYMENT_REVIEW'",
      "WHEN 'PENDING' THEN 'ISSUED'",
    ]) expect(blocker).toContain(mapping);
    expect(blocker).toContain("freight_schedule.status = 'VERIFIED' THEN freight_schedule.verified_at");
    expect(blocker.indexOf("RETURN NEW;")).toBeLessThan(
      blocker.lastIndexOf("PAYMENT_WORKFLOW_ON_HOLD"),
    );
    for (const blockedField of ["grand_total", "subtotal", "vat_amount", "due_at", "note"]) {
      expect("status,paid_at,updated_at").not.toContain(blockedField);
    }
    expect(verifier).toContain("verify_payment_transfer_private_ffgl_impl");
    expect(verifier).not.toMatch(/set_config|current_setting/);
    expect(preConfirm).toContain("PERFORM public.recalculate_customer_payment_schedule(");
    expect(preConfirm).not.toMatch(/set_config|current_setting/);
    expect(confirm).toContain("PERFORM public.recalculate_customer_payment_schedule(");
    expect(confirm).not.toMatch(/set_config|current_setting/);
    expect(`${preSql}\n${postSql}\n${packagedPreSql}\n${packagedPostSql}`)
      .not.toMatch(/set_config\s*\(|current_setting\s*\(/i);
    expect(preSql).toContain("REVOKE ALL ON FUNCTION public.verify_payment_transfer_private_ffgl_impl");
    expect(preSql).toContain("FROM PUBLIC, anon, authenticated, project_admin");
    expect(preSql).toMatch(/GRANT EXECUTE ON FUNCTION public\.verify_payment_transfer_private\([\s\S]*?\)\s+TO project_admin;/);
    expect(preSql).not.toMatch(/GRANT EXECUTE ON FUNCTION public\.verify_payment_transfer_private\([\s\S]*?\)\s+TO (PUBLIC|anon|authenticated);/);
    expect(postSql).toContain("REVOKE ALL ON FUNCTION public.block_order_operation_on_payment_hold()");
    expect(blocker).not.toContain("GRANT EXECUTE");
  });

  it("installs maker/checker before C without referencing Release D tables", () => {
    expect(preSql).toContain("CREATE OR REPLACE FUNCTION public.review_supplier_payment");
    expect(preSql).toContain("SUPPLIER_PAYMENT_MAKER_CHECKER_REQUIRED");
    for (const functionName of [
      "verify_payment_transfer_private",
      "create_payment_adjustment_private",
      "review_payment_adjustment_private",
      "recalculate_customer_payment_schedule",
      "confirm_payment_workflow_hold_private",
    ]) {
      expect(preSql).toContain(`CREATE OR REPLACE FUNCTION public.${functionName}`);
    }
    for (const trigger of [
      "order_items_payment_hold",
      "supplier_orders_payment_hold",
      "purchase_orders_payment_hold",
      "supplier_payments_payment_hold",
    ]) expect(preSql).toContain(trigger);
    expect(preSql).not.toMatch(/freight_invoices|qc_inspections|qc_member_decisions|production_updates|shipments|deliveries|warehouse_receipts|consolidation_groups|logistics_cost_items|maybe_complete_order/);
    expect(postSql).toContain("freight_invoices_payment_hold");
    expect(postSql).toContain("production_updates_payment_hold");
    expect(postSql).toContain("qc_member_decisions_payment_hold");
    expect(postSql).not.toContain("CREATE OR REPLACE FUNCTION public.review_supplier_payment");
  });

  it("enforces Supplier Payment maker/checker for review and evidence attachment", () => {
    const review = body("review_supplier_payment");
    const paid = body("mark_supplier_payment_paid");
    expect(review).toContain("sp.requested_by");
    expect(review).toContain("SUPPLIER_PAYMENT_MAKER_CHECKER_REQUIRED");
    expect(paid).toContain("sp.approved_by");
    expect(paid).toContain("SUPPLIER_PAYMENT_MAKER_CHECKER_REQUIRED");
    expect(review).toContain(
      "public.has_permission('supplier_payments.manage', target_organization_id)",
    );
    expect(paid).toContain(
      "public.has_permission('supplier_payments.manage', target_organization_id)",
    );
  });

  it("pins every security definer search path", () => {
    for (const migration of [preSql, postSql]) {
      const definitions = migration.match(/CREATE OR REPLACE FUNCTION/g) ?? [];
      const pinned = migration.match(/SET search_path = pg_catalog, public, pg_temp/g) ?? [];
      expect(pinned).toHaveLength(definitions.length);
    }
  });

  it("packages the exact normalized pre-C and post-D migrations", () => {
    const normalize = (value: string) => value.replace(/\r\n/g, "\n").trimEnd();
    expect(normalize(packagedPreSql)).toBe(normalize(preSql));
    expect(normalize(packagedPostSql)).toBe(normalize(postSql));
    expect(packagedPostSql).toBe(postSql);
  });
});
