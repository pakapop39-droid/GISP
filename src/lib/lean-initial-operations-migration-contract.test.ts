import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
const sql=readFileSync(resolve(process.cwd(),"migrations/20260923090000_startup_initial_operations_guard.sql"),"utf8");
const qcFunction=sql.match(/CREATE OR REPLACE FUNCTION public\.record_qc_inspection\([\s\S]*?\n\$\$;/)?.[0] ?? "";
describe("Lean initial-operations guard migration",()=>{
  it("uses no explicit transaction wrapper or destructive schema operation",()=>{expect(sql).not.toMatch(/^\s*(BEGIN|COMMIT|ROLLBACK)\s*;/gim);expect(sql).not.toMatch(/DROP\s+(TABLE|SCHEMA)|CASCADE|CREATE\s+TABLE/i);});
  it("fails Supplier Payment closed and closes exact deferred signatures",()=>{for(const name of ["create_supplier_payment","review_supplier_payment","mark_supplier_payment_paid"]){expect(sql).toContain(`FUNCTION public.${name}`);}expect(sql.match(/LEAN_SCOPE_DEFERRED/g)).toHaveLength(3);for(const name of ["open_claim","resolve_claim","create_claim","member_claim_action","admin_claim_action","record_claim_internal_cost","append_claim_event","get_executive_dashboard","get_fixed_report","record_fixed_report_export","queue_current_user_notification"]){expect(sql).toContain(`public.${name}(`);}});
  it("redefines dispatch without Supplier balance and preserves partial quantity",()=>{expect(sql).toContain("all_supplier_pos_issued");expect(sql).toContain("quantity_ready");expect(sql).toContain("ci.quantity > 0");expect(sql).toContain("('CONFIRMED','SHIPMENT_CREATED')");expect(sql).not.toContain("supplier_balance_paid");});
  it("counts issue deliveries as progress but blocks COMPLETED",()=>{expect(sql).toContain("'DELIVERED_WITH_ISSUE'");expect(sql).toContain("delivery_has_issue");expect(sql).toContain("all_delivered AND NOT delivery_has_issue AND freight_verified");});
  it("preserves the exact QC RPC contract and business/audit behavior without a direct notification insert",()=>{
    expect(qcFunction).toContain("order_item_id_input UUID");
    expect(qcFunction).toContain("file_ids_input JSONB DEFAULT '[]'::JSONB");
    expect(qcFunction).toContain("public.has_permission('qc.manage', item_record.organization_id)");
    expect(qcFunction).toContain("production must be completed before QC");
    expect(qcFunction).toContain("INSERT INTO public.qc_inspections");
    expect(qcFunction).toContain("INSERT INTO public.qc_checklist_items");
    expect(qcFunction).toContain("INSERT INTO public.qc_inspection_files");
    expect(qcFunction).toContain("UPDATE public.order_items SET");
    expect(qcFunction).toContain("PERFORM public.write_audit_event");
    expect(qcFunction).not.toContain("INSERT INTO public.notifications");
  });
  it("keeps protected formulas and private verifier outside the change",()=>{expect(sql).not.toMatch(/vat_rate|deposit_amount|balance_amount|verify_payment_transfer_private|freight_invoices\s+SET/i);});
});
