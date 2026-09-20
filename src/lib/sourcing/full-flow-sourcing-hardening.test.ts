import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(new URL("../../../migrations/20260920092000_full-flow-sourcing-scope-hardening.sql", import.meta.url), "utf8");
const packagedSql = readFileSync(new URL("../../../release-candidates/full-flow-go-live-01/migrations/20260920011200_full-flow-sourcing-scope-hardening.sql", import.meta.url), "utf8");
const server = readFileSync(new URL("./server.ts", import.meta.url), "utf8");
const route = (path: string) => readFileSync(new URL(`../../app/api/admin/sourcing-requests/${path}`, import.meta.url), "utf8");

function body(name: string) {
  const start = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${name}`);
  expect(start).toBeGreaterThan(-1);
  const end = sql.indexOf("\n$$;", start);
  return sql.slice(start, end);
}

describe("FULL-FLOW Product Sourcing organization boundary", () => {
  it.each([
    "save_sourcing_candidate",
    "admin_product_sourcing_action",
    "delete_sourcing_candidate",
    "create_sourcing_product_draft",
    "link_sourcing_product",
  ])("resolves the request organization before calling private %s", (name) => {
    const functionSql = body(name);
    const target = functionSql.indexOf("sourcing_request_organization(request_id_input)");
    const permission = functionSql.indexOf("has_permission('sourcing.manage', target_organization_id)");
    const executor = functionSql.indexOf(`${name}_ffgl_impl`);
    expect(target).toBeGreaterThan(-1);
    expect(permission).toBeGreaterThan(target);
    expect(executor).toBeGreaterThan(permission);
    expect(sql).toContain(`REVOKE ALL ON FUNCTION public.${name}_ffgl_impl`);
  });

  it("requires organization-scoped catalog permission for draft creation", () => {
    expect(body("create_sourcing_product_draft")).toContain("has_permission('catalog.manage', target_organization_id)");
  });

  it("filters Admin Client list and authorizes detail/mutation targets", () => {
    expect(server).toContain("organizationScopeForPermissions(context,[\"sourcing.manage\"])");
    expect(route("route.ts")).toContain('query.in("organization_id",scope.organizationIds)');
    for (const path of ["[id]/route.ts", "[id]/action/route.ts", "[id]/candidates/route.ts", "[id]/create-product/route.ts", "[id]/link-product/route.ts"]) {
      expect(route(path)).toContain("loadAuthorizedSourcingRequest(id,context)");
    }
  });

  it("authorizes candidate-file upload before reading candidate or request state", () => {
    const upload = route("[id]/candidates/[candidateId]/files/route.ts");
    const target = upload.indexOf("loadAuthorizedSourcingTarget(id,context)");
    const candidateState = upload.indexOf('.from("product_sourcing_candidates")');
    const requestState = upload.indexOf('.select("organization_id,member_profile_id,status")');
    expect(target).toBeGreaterThan(-1);
    expect(candidateState).toBeGreaterThan(target);
    expect(requestState).toBeGreaterThan(target);
    expect(upload).toContain('{message:"ไม่พบคำขอหรือไม่มีสิทธิ์"},{status:404}');
    expect(upload).toContain('.eq("organization_id",target.organization_id)');
    expect(server).toContain('.select("id,organization_id").eq("id",requestId).maybeSingle()');
  });

  it("is forward-only and pins every security-definer search path", () => {
    expect(sql).not.toMatch(/\b(DELETE FROM|TRUNCATE|DROP TABLE)\b/i);
    const definitions = sql.match(/CREATE OR REPLACE FUNCTION/g) ?? [];
    const pinned = sql.match(/SET search_path = pg_catalog, public, pg_temp/g) ?? [];
    expect(pinned).toHaveLength(definitions.length);
  });

  it("packages the exact normalized forward migration", () => {
    const normalize = (value: string) => value.replace(/\r\n/g, "\n").trimEnd();
    expect(normalize(packagedSql)).toBe(normalize(sql));
  });
});
