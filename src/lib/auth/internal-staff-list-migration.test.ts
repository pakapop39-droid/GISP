import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "migrations/20260915170000_list-internal-staff-users.sql"),
  "utf8",
);

describe("internal staff list migration contract", () => {
  it("creates one hardened, authenticated-only SECURITY DEFINER RPC", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.list_internal_staff_users()");
    expect(migration).toMatch(/RETURNS TABLE\s*\(\s*id UUID,\s*full_name TEXT,\s*email TEXT,\s*status TEXT,\s*roles TEXT\[\]/s);
    expect(migration).toMatch(/STABLE\s+SECURITY DEFINER\s+SET search_path = pg_catalog, public, pg_temp/s);
    expect(migration).toContain("public.is_active_super_admin_user((SELECT auth.uid()))");
    expect(migration).toContain("RAISE EXCEPTION 'PERMISSION_DENIED'");
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.list_internal_staff_users() FROM PUBLIC, anon, authenticated");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.list_internal_staff_users() TO authenticated");
  });

  it("keeps current eligibility while retaining inactive historical staff", () => {
    expect(migration).toContain("u.primary_organization_id IS NULL");
    expect(migration).toContain("FROM public.user_roles AS historical_assignment");
    expect(migration).toContain("historical_assignment.organization_id IS NULL");
    expect(migration).toContain("historical_role.code IN (");
    expect(migration).not.toMatch(/historical_assignment\.revoked_at\s+IS\s+NULL/i);
    expect(migration).not.toMatch(/u\.status\s+(?:=|IN)\s*\(/i);
    expect(migration).not.toMatch(/historical_role\.code\s*=\s*'MEMBER'/i);
  });

  it("returns only active global staff roles and an empty array after deactivation", () => {
    expect(migration).toContain("active_assignment.organization_id IS NULL");
    expect(migration).toContain("active_assignment.revoked_at IS NULL");
    expect(migration).toContain("ARRAY_AGG(DISTINCT active_role.code ORDER BY active_role.code)");
    expect(migration).toContain("ARRAY[]::TEXT[]");
  });

  it("projects only the required auth email and is read-only", () => {
    expect(migration).toContain("LEFT JOIN auth.users AS auth_user");
    expect(migration).toContain("COALESCE(auth_user.email, '')::TEXT AS email");
    expect(migration).not.toMatch(/auth_user\.(?:profile|password|metadata|phone)/i);
    expect(migration).not.toMatch(/\b(?:INSERT|UPDATE|DELETE|ALTER|DROP|TRUNCATE)\b/i);
    expect(migration).not.toMatch(/\b(?:BEGIN|COMMIT|ROLLBACK)\s*;/i);
  });
});
