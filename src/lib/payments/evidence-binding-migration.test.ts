import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(resolve(
  process.cwd(), "migrations/20260918211000_payment-evidence-binding.sql",
), "utf8").replace(/\r\n?/g, "\n");
const submit = sql.split("CREATE OR REPLACE FUNCTION public.submit_payment_transfer(")[1]
  ?.split("CREATE OR REPLACE FUNCTION public.verify_payment_transfer(")[0] ?? "";
const verify = sql.split("CREATE OR REPLACE FUNCTION public.verify_payment_transfer(")[1] ?? "";

describe("customer Payment evidence binding migration contract", () => {
  it("replaces only the two existing function signatures without schema, ACL, or historical data changes", () => {
    expect(sql.match(/CREATE OR REPLACE FUNCTION public\./g)).toHaveLength(2);
    expect(sql).toContain("submit_payment_transfer(\n  payment_schedule_id_input UUID,\n  amount_input NUMERIC,\n  transferred_at_input TIMESTAMPTZ,\n  evidence_file_id_input UUID");
    expect(sql).toContain("verify_payment_transfer(\n  transfer_id_input UUID,\n  approve_input BOOLEAN,\n  finance_note_input TEXT DEFAULT NULL");
    expect(sql).not.toMatch(/\b(?:CREATE|ALTER|DROP|TRUNCATE)\s+TABLE\b/i);
    expect(sql).not.toMatch(/\b(?:GRANT|REVOKE|CREATE\s+POLICY|ALTER\s+POLICY)\b/i);
    expect(sql).not.toMatch(/\b(?:DELETE\s+FROM|UPDATE\s+public\.payment_transfers\s+SET\s+evidence_file_id)\b/i);
    expect(sql).not.toMatch(/\b(?:BEGIN|COMMIT|ROLLBACK)\s*;/i);
  });

  it("serializes the file claim, rejects every previous reference including rejected transfers, then binds atomically", () => {
    expect(submit).toMatch(/FROM public\.file_metadata\s+WHERE id = evidence_file_id_input FOR UPDATE;/);
    expect(submit).toMatch(/FROM public\.payment_transfers previous_transfer\s+WHERE previous_transfer\.evidence_file_id = evidence_record\.id/);
    expect(submit).not.toMatch(/previous_transfer\.status\s*(?:=|<>|IN)/);
    expect(submit).toContain("PAYMENT_EVIDENCE_ALREADY_USED");
    expect(submit).toMatch(/INSERT INTO public\.payment_transfers\([\s\S]*RETURNING id INTO transfer_id_value;[\s\S]*UPDATE public\.file_metadata SET entity_id = transfer_id_value/);
    expect(submit.indexOf("FOR UPDATE;")).toBeLessThan(submit.indexOf("PAYMENT_EVIDENCE_ALREADY_USED"));
    expect(submit.indexOf("PAYMENT_EVIDENCE_ALREADY_USED")).toBeLessThan(submit.indexOf("INSERT INTO public.payment_transfers"));
    expect(submit).toContain("PAYMENT_EVIDENCE_BIND_FAILED");
    expect(submit).toContain("PERFORM public.write_audit_event");
  });

  it("requires the correct tenant, member, customer evidence type, private bucket, and object metadata", () => {
    for (const clause of [
      "evidence_record.organization_id IS DISTINCT FROM schedule_record.organization_id",
      "evidence_record.member_profile_id IS DISTINCT FROM order_record.member_profile_id",
      "evidence_record.entity_type IS DISTINCT FROM 'CUSTOMER_PAYMENT_EVIDENCE'",
      "evidence_record.entity_id IS NOT NULL",
      "evidence_record.visibility IS DISTINCT FROM 'MEMBER_PRIVATE'",
      "evidence_record.bucket IS DISTINCT FROM 'gisp-member-private'",
      "NULLIF(BTRIM(evidence_record.object_key), '') IS NULL",
      "evidence_record.mime_type IS NULL",
      "evidence_record.size_bytes NOT BETWEEN 1 AND 10485760",
    ]) expect(submit).toContain(clause);
  });

  it("scopes Finance permission to the transfer organization and fails closed on null or reused binding", () => {
    expect(verify).toContain("public.has_permission('payments.verify', t.organization_id)");
    expect(verify).not.toContain("public.has_permission('payments.verify')");
    expect(verify).toContain("ps.organization_id IS DISTINCT FROM t.organization_id");
    expect(verify).toContain("order_record.organization_id IS DISTINCT FROM t.organization_id");
    expect(verify).toContain("evidence_record.entity_id IS DISTINCT FROM t.id");
    expect(verify).toContain("other_transfer.id <> t.id");
    expect(verify).toContain("PAYMENT_EVIDENCE_NOT_BOUND");
    expect(verify.indexOf("IF NOT approve_input THEN")).toBeLessThan(verify.indexOf("SELECT * INTO evidence_record"));
  });

  it("preserves rejection and Deposit, Balance, Freight reconciliation and audit", () => {
    for (const clause of [
      "REJECTION_REASON_REQUIRED", "status='REJECTED'", "'REJECTED',NULL",
      "status='VERIFIED'", "OVERPAYMENT_REVIEW", "PARTIALLY_VERIFIED",
      "ps.schedule_type='DEPOSIT'", "ps.schedule_type='BALANCE'", "ps.schedule_type='FREIGHT'",
      "UPDATE public.freight_invoices", "PERFORM public.maybe_complete_order(ps.order_id)",
      "INSERT INTO public.payment_verification_logs", "PERFORM public.write_audit_event",
    ]) expect(verify).toContain(clause);
  });
});
