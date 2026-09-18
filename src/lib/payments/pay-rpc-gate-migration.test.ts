import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const guard = readFileSync(resolve(process.cwd(), "migrations/20260918223000_pay-rpc-gate-private-executor.sql"), "utf8");
const d8 = readFileSync(resolve(process.cwd(), "migrations/20260918223100_pay-rpc-gate-d8-freight-enable.sql"), "utf8");
const privateVerify = guard.split("CREATE OR REPLACE FUNCTION public.verify_payment_transfer_private(")[1] ?? "";

describe("PAY-RPC-GATE-001 function and privilege contract", () => {
  it("disables the legacy approval RPC and limits the new executor/preview to project_admin", () => {
    expect(guard).toMatch(/CREATE OR REPLACE FUNCTION public\.verify_payment_transfer\([\s\S]*PRIVATE_PAYMENT_VERIFICATION_REQUIRED/);
    expect(guard).toMatch(/REVOKE ALL ON FUNCTION public\.verify_payment_transfer\(UUID,BOOLEAN,TEXT\)\s+FROM PUBLIC, anon, authenticated/);
    expect(guard).toMatch(/REVOKE ALL ON FUNCTION public\.verify_payment_transfer_private\([\s\S]*FROM PUBLIC, anon, authenticated;\s*GRANT EXECUTE ON FUNCTION public\.verify_payment_transfer_private\([\s\S]*TO project_admin;/);
    expect(guard).toMatch(/REVOKE ALL ON FUNCTION public\.record_customer_payment_evidence_preview\([\s\S]*FROM PUBLIC, anon, authenticated;\s*GRANT EXECUTE ON FUNCTION public\.record_customer_payment_evidence_preview\([\s\S]*TO project_admin;/);
  });

  it("resolves a real active Finance actor from a locked, unexpired session and target-org role", () => {
    expect(guard).toContain("s.token_hash = session_token_hash_input");
    expect(guard).toContain("s.revoked_at IS NULL AND s.expires_at > NOW()");
    expect(guard).toContain("u.status = 'ACTIVE'");
    expect(guard).toContain("p.code = 'payments.verify'");
    expect(guard).toContain("ur.organization_id = target_organization_id_input");
    expect(guard).toContain("FOR SHARE OF s");
    expect(privateVerify).not.toContain("auth.uid()");
    expect(privateVerify).toContain("finance_verified_by=finance_actor");
    expect(privateVerify).toContain("BTRIM(finance_note_input),finance_actor");
    expect(privateVerify).toContain("public.audit_events(organization_id,actor_user_id");
  });

  it("ties a fresh server-file preview receipt to actor, session, transfer, file and digest without storing a token", () => {
    expect(guard).toContain("'EVIDENCE_PREVIEWED'");
    expect(guard).toContain("'sessionId',finance_session");
    expect(guard).not.toContain("'tokenHash'");
    expect(privateVerify).toContain("ae.created_at >= NOW() - INTERVAL '10 minutes'");
    for (const clause of ["ae.actor_user_id = finance_actor", "ae.entity_id = t.id", "ae.after_data->>'fileId' = fm.id::TEXT",
      "ae.after_data->>'sessionId' = finance_session::TEXT", "ae.after_data->>'sha256' = sha256_input",
      "ae.after_data->>'sizeBytes' = size_bytes_input::TEXT", "EVIDENCE_PREVIEW_REQUIRED"]) {
      expect(privateVerify).toContain(clause);
    }
    expect(privateVerify.indexOf("IF NOT approve_input THEN")).toBeLessThan(privateVerify.indexOf("SELECT * INTO fm"));
    expect(privateVerify).toContain("t.status <> 'SUBMITTED'");
  });

  it("keeps direct Freight submission and verification closed until the separate D8 flip", () => {
    expect(guard).toContain("AS $$ SELECT FALSE $$");
    expect(guard).toContain("RENAME TO submit_payment_transfer_bound_impl");
    expect(guard).toContain("PAYMENT_BINDING_PREREQUISITE_REQUIRED");
    expect(guard).toContain("FREIGHT_PAYMENT_NOT_RELEASED");
    expect(guard).toMatch(/REVOKE ALL ON FUNCTION public\.submit_payment_transfer_bound_impl\([\s\S]*FROM PUBLIC, anon, authenticated/);
    expect(privateVerify).toContain("ps.schedule_type = 'FREIGHT' AND NOT public.freight_payment_enabled()");
    expect(d8).toContain("AS $$ SELECT TRUE $$");
    expect(d8).toContain("REVOKE ALL ON FUNCTION public.freight_payment_enabled()");
  });

  it("preserves Deposit/Balance/Freight reconciliation, logs, audit, and makes no table/column or historical changes", () => {
    for (const text of ["OVERPAYMENT_REVIEW", "PARTIALLY_VERIFIED", "ps.schedule_type='DEPOSIT'",
      "ps.schedule_type='BALANCE'", "ps.schedule_type='FREIGHT'", "UPDATE public.freight_invoices",
      "PERFORM public.maybe_complete_order(ps.order_id)", "public.payment_verification_logs",
      "'REJECTED'", "'VERIFIED'"]) expect(privateVerify).toContain(text);
    for (const sql of [guard, d8]) {
      expect(sql).not.toMatch(/\b(?:CREATE|ALTER|DROP|TRUNCATE)\s+TABLE\b/i);
      expect(sql).not.toMatch(/\b(?:INSERT|UPDATE|DELETE)\s+public\.[a-z_]+\s*(?:SET|WHERE|VALUES)?\s*;/i);
    }
  });
});
