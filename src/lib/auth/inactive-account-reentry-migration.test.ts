import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "migrations/20260915103614_block-inactive-account-reentry.sql"),
  "utf8",
);

function functionBody(name: string, nextName: string) {
  const start = migration.indexOf(`CREATE OR REPLACE FUNCTION public.${name}`);
  const end = migration.indexOf(`CREATE OR REPLACE FUNCTION public.${nextName}`, start + 1);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return migration.slice(start, end);
}

describe("inactive account re-entry migration contract", () => {
  it("adds a private, exclusively locked assertion while allowing missing profiles", () => {
    const body = functionBody("assert_account_not_inactive", "prevent_inactive_account_reentry");
    expect(body).toContain("SECURITY DEFINER");
    expect(body).toContain("SET search_path = pg_catalog, public, pg_temp");
    expect(body).toContain("FROM public.users u");
    expect(body).toContain("FOR UPDATE");
    expect(body).not.toContain("FOR SHARE");
    expect(body).toContain("IF FOUND AND account_status = 'INACTIVE'");
    expect(body).toContain("RAISE EXCEPTION 'ACCOUNT_INACTIVE'");
    expect(migration).toContain(
      "REVOKE ALL ON FUNCTION public.assert_account_not_inactive(UUID) FROM PUBLIC, anon, authenticated",
    );
    expect(migration).not.toContain(
      "GRANT EXECUTE ON FUNCTION public.assert_account_not_inactive(UUID)",
    );
  });

  it("guards session creation, onboarding, submission, approval, and the legacy registration path", () => {
    for (const [name, nextName] of [
      ["register_app_session", "get_app_access_context"],
      ["save_member_onboarding", "submit_member_application"],
      ["submit_member_application", "approve_member_application"],
      ["approve_member_application", "register_member_profile"],
      ["register_member_profile", "assert_account_not_inactive"],
    ] as const) {
      const body = name === "register_member_profile"
        ? migration.slice(
            migration.indexOf("CREATE OR REPLACE FUNCTION public.register_member_profile"),
            migration.indexOf("REVOKE ALL ON FUNCTION public.assert_account_not_inactive"),
          )
        : functionBody(name, nextName);
      expect(body).toContain("PERFORM public.assert_account_not_inactive(");
    }
  });

  it("uses an exclusive user lock before every application lock", () => {
    const assertion = functionBody("assert_account_not_inactive", "prevent_inactive_account_reentry");
    expect(assertion).toContain("FROM public.users u");
    expect(assertion).toContain("FOR UPDATE");

    const submit = functionBody("submit_member_application", "approve_member_application");
    expect(submit.indexOf("assert_account_not_inactive(current_user_id)")).toBeLessThan(
      submit.indexOf("FOR UPDATE OF ma"),
    );
    expect(submit).toContain("mp.user_id = current_user_id AND ma.user_id = current_user_id");

    const approve = functionBody("approve_member_application", "register_member_profile");
    expect(approve.indexOf("SELECT ma.user_id INTO target_user_id")).toBeLessThan(
      approve.indexOf("assert_account_not_inactive(target_user_id)"),
    );
    expect(approve.indexOf("assert_account_not_inactive(target_user_id)")).toBeLessThan(
      approve.indexOf("FOR UPDATE"),
    );
  });

  it("filters inactive access contexts and prevents session touches", () => {
    const context = functionBody("get_app_access_context", "touch_app_session");
    expect(context).toContain("AND (u.id IS NULL OR u.status <> 'INACTIVE')");

    const touch = functionBody("touch_app_session", "save_member_onboarding");
    expect(touch).toContain("NOT EXISTS (");
    expect(touch).toContain("u.status = 'INACTIVE'");
  });

  it("enforces permanent INACTIVE status with a database trigger", () => {
    const trigger = functionBody("prevent_inactive_account_reentry", "register_app_session");
    expect(trigger).toContain(
      "OLD.status = 'INACTIVE' AND NEW.status IS DISTINCT FROM 'INACTIVE'",
    );
    expect(trigger).toContain("RAISE EXCEPTION 'ACCOUNT_INACTIVE'");
    expect(migration).toContain("BEFORE UPDATE ON public.users");
    expect(migration).toContain("EXECUTE FUNCTION public.prevent_inactive_account_reentry()");
  });

  it("keeps public RPC grants explicit and does not delete retained accounts", () => {
    expect(migration).toContain(
      "GRANT EXECUTE ON FUNCTION public.register_app_session(TEXT,TIMESTAMPTZ,TEXT,TEXT) TO authenticated",
    );
    expect(migration).toContain(
      "GRANT EXECUTE ON FUNCTION public.approve_member_application(UUID,TEXT) TO authenticated",
    );
    expect(migration).not.toMatch(/DELETE\s+FROM\s+(?:auth\.)?users/i);
    expect(migration).not.toMatch(/DROP\s+TABLE/i);
  });
});
