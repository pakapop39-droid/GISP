import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const migration = read("migrations/20260926150000_order-cost-version-snapshot.sql");

describe("Order cost-version migration", () => {
  it("replaces only the existing private implementation without widening access", () => {
    expect(migration).toMatch(/to_regprocedure\('public\.create_customer_order_rlc_impl\(uuid,jsonb\)'\)/);
    expect(migration).toMatch(/CREATE OR REPLACE FUNCTION public\.create_customer_order_rlc_impl\(/);
    expect(migration).toMatch(/SECURITY DEFINER\s+SET search_path = pg_catalog, public, pg_temp/);
    expect(migration).not.toMatch(/CREATE OR REPLACE FUNCTION public\.create_customer_order\s*\(/);
    expect(migration).not.toMatch(/\bGRANT\b|\bREVOKE\b/);
  });

  it("uses the price-bound historical cost, including base fallback for a variant", () => {
    expect(migration).toMatch(/project_item_record\.variant_id IS NOT NULL AND NOT EXISTS \([\s\S]*?FROM public\.product_variants v[\s\S]*?v\.id = project_item_record\.variant_id[\s\S]*?v\.product_id = project_item_record\.product_id[\s\S]*?RAISE EXCEPTION 'SUPPLIER_COST_REQUIRED'/);
    expect(migration).toMatch(/pp\.id = project_item_record\.current_price_id/);
    expect(migration).toMatch(/pp\.product_id = p\.id/);
    expect(migration).toMatch(/pp\.variant_id IS NULL OR pp\.variant_id = project_item_record\.variant_id/);
    expect(migration).toMatch(/IF selected_price_id_value IS NULL THEN\s+RAISE EXCEPTION 'SUPPLIER_COST_REQUIRED'/);
    expect(migration).toMatch(/IF source_cost_version_id_value IS NOT NULL THEN[\s\S]*?c\.id = source_cost_version_id_value[\s\S]*?c\.product_id = project_item_record\.product_id[\s\S]*?c\.variant_id IS NULL OR c\.variant_id = selected_price_variant_id_value/);
    expect(migration).not.toMatch(/c\.status\s*=\s*'ACTIVE'/);
    expect(migration).not.toMatch(/p\.status\s*=\s*'PUBLISHED'/);
  });

  it("fails closed on invalid cost or currency and snapshots only rounded CNY", () => {
    expect(migration).toMatch(/factory_unit_cost_value IS NULL[\s\S]*?factory_unit_cost_value <= 0/);
    expect(migration).toMatch(/factory_currency_value IS DISTINCT FROM 'CNY'/);
    expect(migration).toMatch(/ROUND\(factory_unit_cost_value, 2\) <= 0/);
    expect(migration).toMatch(/factory_unit_cost_value := ROUND\(factory_unit_cost_value, 2\)/);
    expect(migration).toMatch(/factory_unit_cost_snapshot, factory_line_total[\s\S]*?factory_unit_cost_value, ROUND\(factory_unit_cost_value \* selection_record\.quantity, 2\)/);
  });

  it("keeps Custom sourcing, tenant check, row locks, and existing writes", () => {
    expect(migration).toMatch(/member_profile_id = public\.current_member_profile_id\(\)[\s\S]*?FOR UPDATE/);
    expect(migration).toMatch(/organization_id = project_record\.organization_id\s+FOR UPDATE/);
    expect(migration).toMatch(/ELSE\s+SELECT cqc\.\* INTO quotation_cost_record/);
    expect(migration).toMatch(/quotation_cost_record\.supplier_cost_total \/ cqi\.quantity/);
    expect(migration).toMatch(/INSERT INTO public\.customer_orders/);
    expect(migration).toMatch(/INSERT INTO public\.order_items/);
    expect(migration).toMatch(/INSERT INTO public\.supplier_order_items/);
    expect(migration).toMatch(/UPDATE public\.project_items/);
    expect(migration).toMatch(/INSERT INTO public\.payment_schedules/);
    expect(migration).toMatch(/PERFORM public\.write_audit_event/);
    const wrapper = read("migrations/20260918133857_release-c-org-scope-hardening.sql");
    expect(wrapper).toMatch(/RAISE EXCEPTION 'DUPLICATE_PROJECT_ITEM'/);
    expect(wrapper).toMatch(/RETURN public\.create_customer_order_rlc_impl\(project_id_input, selections_input\)/);
  });
});
