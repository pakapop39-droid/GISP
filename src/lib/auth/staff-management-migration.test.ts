import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "migrations/20260915040310_employee-management.sql"),
  "utf8",
);

describe("EMPLOYEE-MGMT-S1-v1.1 migration contract", () => {
  it("keeps group replacement atomic and limited to approved groups", () => {
    expect(migration).toContain("replace_internal_staff_job_groups");
    expect(migration).toContain("'OPERATIONS', 'FINANCE', 'LOGISTICS'");
    expect(migration).toContain("role_codes_input @> expected_role_codes");
    expect(migration).toContain("r.code = 'SUPER_ADMIN'");
  });

  it("protects self, owner, organization, and special-role targets", () => {
    expect(migration).toContain("target_user_id_input = actor_user_id_value");
    expect(migration).toContain("WHERE u.id = target_user_id_input");
    expect(migration).toContain("target_record.primary_organization_id IS NOT NULL");
    expect(migration).toContain("r.code NOT IN ('MEMBER_ADMIN','PRODUCT_ADMIN','ORDER_ADMIN','PURCHASING','QC','FINANCE','LOGISTICS')");
    expect(migration).toContain("active_role_codes <@ ARRAY['MEMBER_ADMIN','PRODUCT_ADMIN','ORDER_ADMIN','PURCHASING','QC','FINANCE','LOGISTICS']::TEXT[]");
    expect(migration).toContain("active_role_codes @> ARRAY['MEMBER_ADMIN','PRODUCT_ADMIN','ORDER_ADMIN','PURCHASING','QC']::TEXT[]");
    expect(migration).toContain(") <> 5");
  });

  it("soft-deactivates with roles, sessions, security, and audit in one RPC", () => {
    expect(migration).toContain("SET status = 'INACTIVE'");
    expect(migration).toContain("SET revoked_at = NOW()");
    expect(migration).toContain("revoke_all_app_sessions(target_user_id_input, 'ACCOUNT_DEACTIVATED')");
    expect(migration).toContain("write_security_event('FORCE_LOGOUT'");
    expect(migration).toContain("'source', 'ACCOUNT_DEACTIVATED'");
    expect(migration).toContain("'revokedRoles', revoked_role_count");
    expect(migration).toContain("write_audit_event(NULL, 'user', target_user_id_input, 'DEACTIVATED'");
    expect(migration).not.toMatch(/DELETE\s+FROM\s+(?:auth\.)?users/i);
  });

  it("reuses owner-managed security infrastructure without altering it", () => {
    expect(migration).not.toMatch(/ALTER\s+TABLE\s+public\.security_events/i);
    expect(migration).not.toMatch(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.write_security_event/i);
    expect(migration).not.toContain("write_security_event('ACCOUNT_DEACTIVATED'");
  });

  it("prevents MEMBER_ADMIN from using legacy RPCs against staff or owners", () => {
    expect(migration).toContain("is_member_management_target");
    expect(migration).toContain("mp.user_id = u.id AND mp.organization_id = u.primary_organization_id");
    expect(migration).toContain("staff_ur.organization_id IS NULL");
    expect(migration).toContain("ELSIF NOT public.is_member_management_target(target_user_id_input)");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.admin_get_user_email");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.admin_get_staff_user_email");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.revoke_all_app_sessions");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.suspend_user");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.reactivate_user");
    expect(migration).toContain("r.code = 'SUPER_ADMIN'");
  });

  it("retires raw role RPC access and hardens internal provisioning", () => {
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.assign_production_role(UUID, TEXT) FROM PUBLIC, anon, authenticated");
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.revoke_production_role(UUID, TEXT) FROM PUBLIC, anon, authenticated");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.provision_internal_user");
    expect(migration).toContain("NOT public.is_active_super_admin_user(actor_user_id_value)");
    expect(migration).toContain("target_user_id_input = actor_user_id_value");
    expect(migration).toContain("role_codes_input <@ ARRAY['MEMBER_ADMIN','PRODUCT_ADMIN','ORDER_ADMIN','PURCHASING','QC','FINANCE','LOGISTICS']::TEXT[]");
    expect(migration).toContain("cardinality(role_codes_input) <> (SELECT COUNT(DISTINCT code)");
  });
});
