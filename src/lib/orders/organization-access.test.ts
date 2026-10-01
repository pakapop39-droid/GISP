import { beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({ authorizedOrganization: "org-a", permissions: new Set(["supplier_payments.request", "shipments.manage"]) }));
const rpc = vi.hoisted(() => vi.fn());
vi.mock("server-only", () => ({}));
vi.mock("@/lib/insforge/server", () => ({ createInsForgeServerClient: async () => ({ database: { rpc: async (name: string, args: { permission_code: string; target_organization_id: string }) => {
  rpc(name, args);
  return { data: args.target_organization_id === fixture.authorizedOrganization && fixture.permissions.has(args.permission_code), error: null };
} } }) }));

import { hasTargetOrganizationPermission, targetOrganizationPermissions } from "./organization-access";

describe("target organization access", () => {
  beforeEach(() => rpc.mockClear());
  it("allows the role only in its authorized organization", async () => {
    await expect(hasTargetOrganizationPermission("shipments.manage", "org-a")).resolves.toBe(true);
    await expect(hasTargetOrganizationPermission("shipments.manage", "org-b")).resolves.toBe(false);
  });
  it("returns only permissions granted for the target organization", async () => {
    await expect(targetOrganizationPermissions(["supplier_payments.request", "supplier_payments.manage", "shipments.manage"], "org-a")).resolves.toEqual(["supplier_payments.request", "shipments.manage"]);
    await expect(targetOrganizationPermissions(["supplier_payments.request"], "org-b")).resolves.toEqual([]);
  });
});
