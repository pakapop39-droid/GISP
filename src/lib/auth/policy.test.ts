import { describe, expect, it } from "vitest";
import { accessHome, hasAllPermissions, isStaffRole } from "./policy";
import type { AppAccessContext } from "./types";

const base: AppAccessContext = {
  userId: "00000000-0000-4000-8000-000000000001", sessionId: "00000000-0000-4000-8000-000000000002",
  sessionExpiresAt: "2026-08-19T00:00:00.000Z", userStatus: "PENDING", statusReason: null,
  applicationStatus: "DRAFT", applicationReason: null, memberProfileId: null, organizationId: null,
  displayName: "Test", companyName: null, roles: [], permissions: [],
};

describe("Slice 1 access policy",()=>{
  it("redirects each account lifecycle state",()=>{
    expect(accessHome(base)).toBe("/onboarding");
    expect(accessHome({...base,memberProfileId:"p",applicationStatus:"PENDING"})).toBe("/pending-approval");
    expect(accessHome({...base,memberProfileId:"p",applicationStatus:"REJECTED"})).toBe("/application-rejected");
    expect(accessHome({...base,userStatus:"SUSPENDED",applicationStatus:"APPROVED",roles:["MEMBER"]})).toBe("/account-suspended");
    expect(accessHome({...base,userStatus:"ACTIVE",applicationStatus:"APPROVED",roles:["MEMBER"]})).toBe("/member/dashboard");
    expect(accessHome({...base,userStatus:"ACTIVE",roles:["FINANCE"]})).toBe("/admin/dashboard");
  });
  it("distinguishes staff roles and requires the complete permission set",()=>{
    expect(isStaffRole("MEMBER")).toBe(false); expect(isStaffRole("ORDER_ADMIN")).toBe(true);
    expect(hasAllPermissions({permissions:["a","b"]},["a","b"])).toBe(true);
    expect(hasAllPermissions({permissions:["a"]},["a","b"])).toBe(false);
  });
});
