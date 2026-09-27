import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "migrations/20260920110000_internal-staff-display-name.sql"),
  "utf8",
);

describe("STAFF-RENAME-01 migration contract", () => {
  it("limits execution to an active SUPER_ADMIN and internal active or suspended staff", () => {
    expect(migration).toContain("public.is_active_super_admin_user(actor_user_id_value)");
    expect(migration).toContain("target_record.primary_organization_id IS NOT NULL");
    expect(migration).toContain("target_record.status NOT IN ('ACTIVE', 'SUSPENDED')");
    expect(migration).toContain("ur.organization_id IS NOT NULL");
    expect(migration).toContain("r.code <> 'MEMBER'");
  });

  it("validates and changes only the display name with before and after audit values", () => {
    expect(migration).toContain("CHAR_LENGTH(normalized_full_name) NOT BETWEEN 2 AND 120");
    expect(migration).toContain("SET full_name = normalized_full_name");
    expect(migration).toContain("'INTERNAL_USER_RENAMED'");
    expect(migration).toContain("jsonb_build_object('fullName', target_record.full_name)");
    expect(migration).toContain("jsonb_build_object('fullName', normalized_full_name)");
    expect(migration).not.toMatch(/UPDATE\s+(?:public\.)?(?:user_roles|app_sessions|auth\.users)/i);
  });

  it("exposes only the guarded RPC to authenticated callers", () => {
    expect(migration).toContain("SECURITY DEFINER");
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.rename_internal_staff_user(UUID, TEXT) FROM PUBLIC, anon");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.rename_internal_staff_user(UUID, TEXT) TO authenticated");
  });
});
