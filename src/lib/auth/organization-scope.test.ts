import { describe, expect, it } from "vitest";
import {
  hasAllPermissionsForOrganization,
  hasAnyPermissionForOrganization,
  organizationScopeForPermissions,
  permissionsForOrganization,
} from "./organization-scope";

const global = {
  permissionScopes: [
    { code: "orders.manage", organizationId: null },
    { code: "supplier_payments.manage", organizationId: null },
  ],
};
const scoped = {
  permissionScopes: [
    { code: "orders.manage", organizationId: "org-a" },
    { code: "supplier_payments.request", organizationId: "org-a" },
    { code: "qc.manage", organizationId: "org-b" },
  ],
};

describe("organization-scoped staff permissions", () => {
  it("preserves global permissions for every target organization", () => {
    expect(organizationScopeForPermissions(global, ["orders.manage"])).toEqual({
      global: true,
      organizationIds: [],
    });
    expect(hasAllPermissionsForOrganization(global, ["orders.manage"], "org-b")).toBe(true);
  });

  it("allows the assigned organization and denies another organization", () => {
    expect(permissionsForOrganization(scoped, "org-a")).toEqual([
      "orders.manage",
      "supplier_payments.request",
    ]);
    expect(hasAnyPermissionForOrganization(scoped, ["orders.manage"], "org-a")).toBe(true);
    expect(hasAnyPermissionForOrganization(scoped, ["orders.manage"], "org-b")).toBe(false);
    expect(organizationScopeForPermissions(scoped, ["orders.manage", "qc.manage"])).toEqual({
      global: false,
      organizationIds: ["org-a", "org-b"],
    });
  });

  it("fails closed for anonymous/no-role and pre-migration contexts", () => {
    expect(hasAnyPermissionForOrganization({}, ["orders.manage"], "org-a")).toBe(false);
    expect(organizationScopeForPermissions({}, ["orders.manage"])).toEqual({
      global: false,
      organizationIds: [],
    });
  });
});

