import { beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({ authorizedOrganization: "org-a", permissions: new Set(["supplier_payments.request", "shipments.manage"]) }));
const rpc = vi.hoisted(() => vi.fn());
const clientFactory = vi.hoisted(() => vi.fn());
const concurrency = vi.hoisted(() => ({ active: 0, max: 0 }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/insforge/server", () => ({ createInsForgeServerClient: async () => {
  clientFactory();
  return { database: { rpc: async (name: string, args: { permission_code: string; target_organization_id: string }) => {
    rpc(name, args);
    concurrency.active += 1;
    concurrency.max = Math.max(concurrency.max, concurrency.active);
    await Promise.resolve();
    concurrency.active -= 1;
    return {
      data: args.target_organization_id === fixture.authorizedOrganization && fixture.permissions.has(args.permission_code),
      error: null,
    };
  } } };
} }));

import { hasTargetOrganizationPermission, targetOrganizationPermissions } from "./organization-access";

describe("target organization access", () => {
  beforeEach(() => {
    rpc.mockClear();
    clientFactory.mockClear();
    concurrency.active = 0;
    concurrency.max = 0;
  });

  it("allows the authenticated role only in its authorized organization", async () => {
    await expect(hasTargetOrganizationPermission("shipments.manage", "org-a")).resolves.toBe(true);
    await expect(hasTargetOrganizationPermission("shipments.manage", "org-b")).resolves.toBe(false);
    expect(rpc).toHaveBeenNthCalledWith(1, "has_permission", {
      permission_code: "shipments.manage",
      target_organization_id: "org-a",
    });
    expect(rpc).toHaveBeenNthCalledWith(2, "has_permission", {
      permission_code: "shipments.manage",
      target_organization_id: "org-b",
    });
    expect(clientFactory).toHaveBeenCalledTimes(2);
  });

  it("returns only permissions granted for the target record organization", async () => {
    await expect(targetOrganizationPermissions([
      "supplier_payments.request",
      "supplier_payments.manage",
      "shipments.manage",
    ], "org-a")).resolves.toEqual(["supplier_payments.request", "shipments.manage"]);
    await expect(targetOrganizationPermissions(["supplier_payments.request", "shipments.manage"], "org-b")).resolves.toEqual([]);
    expect(clientFactory).toHaveBeenCalledTimes(2);
    expect(concurrency.max).toBe(1);
  });
});
