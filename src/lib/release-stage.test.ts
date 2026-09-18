import { describe, expect, it } from "vitest";
import { enabledReleaseDSlices, isOrderOperationSliceVisible, isPendingProductionFeature, isReleaseAPathAllowed, isReleaseBPathAllowed, isReleaseStagePathAllowed, isStagedReleaseEnabled } from "./release-stage";

describe("Release A route gate", () => {
  it("allows the internal catalog and administration scope", () => {
    expect(isReleaseAPathAllowed("/login")).toBe(true);
    expect(isReleaseAPathAllowed("/api/auth/sign-in")).toBe(true);
    expect(isReleaseAPathAllowed("/admin/catalog/imports")).toBe(true);
    expect(isReleaseAPathAllowed("/api/admin/catalog/imports")).toBe(true);
    expect(isReleaseAPathAllowed("/api/admin/products")).toBe(true);
    expect(isReleaseAPathAllowed("/admin/members")).toBe(true);
    expect(isReleaseAPathAllowed("/api/admin/members")).toBe(true);
    expect(isReleaseAPathAllowed("/api/admin/member-applications/approve")).toBe(true);
  });

  it("blocks signup and later releases", () => {
    expect(isReleaseAPathAllowed("/register")).toBe(false);
    expect(isReleaseAPathAllowed("/api/auth/sign-up")).toBe(false);
    expect(isReleaseAPathAllowed("/member/catalog")).toBe(false);
    expect(isReleaseAPathAllowed("/admin/orders")).toBe(false);
    expect(isReleaseAPathAllowed("/api/admin/orders/1")).toBe(false);
    expect(isReleaseAPathAllowed("/payment")).toBe(false);
  });
});

describe("Release C/D progressive gate", () => {
  it("opens C transactions but blocks every D slice even with the staff rehearsal flag", () => {
    for (const route of ["/member/orders/123", "/api/member/payment-transfers", "/admin/orders/123", "/api/admin/payment-transfers/123/evidence", "/api/admin/supplier-disclosures/123/revoke", "/api/admin/dashboard"]) {
      expect(isReleaseStagePathAllowed(route, "C", true)).toBe(true);
    }
    for (const route of ["/api/admin/qc-inspections", "/api/admin/logistics/actions", "/api/member/claims", "/admin/reports", "/member/reports"]) {
      expect(isReleaseStagePathAllowed(route, "C", true)).toBe(false);
    }
  });

  it("only enables contiguous owner-authorized D slices", () => {
    const previous = process.env.RELEASE_D_ENABLED_SLICES;
    try {
      process.env.RELEASE_D_ENABLED_SLICES = "7";
      expect(isReleaseStagePathAllowed("/api/admin/qc-inspections", "D", true)).toBe(true);
      expect(isReleaseStagePathAllowed("/api/admin/logistics/actions", "D", true)).toBe(false);
      process.env.RELEASE_D_ENABLED_SLICES = "7,8";
      expect(isReleaseStagePathAllowed("/api/admin/logistics/actions", "D", true)).toBe(true);
      expect(isReleaseStagePathAllowed("/member/claims", "D", true)).toBe(false);
      process.env.RELEASE_D_ENABLED_SLICES = "7,8,9";
      expect(isReleaseStagePathAllowed("/member/claims", "D", true)).toBe(true);
      expect(isReleaseStagePathAllowed("/member/reports", "D", true)).toBe(false);
      process.env.RELEASE_D_ENABLED_SLICES = "7,8,9,10";
      expect(isReleaseStagePathAllowed("/member/reports", "D", true)).toBe(true);
      for (const invalid of ["", "8", "7,9", "7,8,8", "7,8,9,10,11"]) {
        expect(enabledReleaseDSlices(invalid)).toEqual([]);
      }
    } finally {
      if (previous === undefined) delete process.env.RELEASE_D_ENABLED_SLICES;
      else process.env.RELEASE_D_ENABLED_SLICES = previous;
    }
  });

  it("hides D order controls in C and fails closed for invalid hosted Production stages", () => {
    const previousStage = process.env.RELEASE_STAGE;
    const previousVercel = process.env.VERCEL_ENV;
    const previousSlices = process.env.RELEASE_D_ENABLED_SLICES;
    try {
      process.env.VERCEL_ENV = "production";
      process.env.RELEASE_STAGE = "C";
      expect(isOrderOperationSliceVisible(7)).toBe(false);
      expect(isOrderOperationSliceVisible(8)).toBe(false);
      process.env.RELEASE_STAGE = "D";
      process.env.RELEASE_D_ENABLED_SLICES = "7";
      expect(isOrderOperationSliceVisible(7)).toBe(true);
      expect(isOrderOperationSliceVisible(8)).toBe(false);
      process.env.RELEASE_STAGE = "INVALID";
      expect(isStagedReleaseEnabled()).toBe(true);
      expect(isReleaseStagePathAllowed("/api/admin/orders", "INVALID", true)).toBe(false);
    } finally {
      if (previousStage === undefined) delete process.env.RELEASE_STAGE; else process.env.RELEASE_STAGE = previousStage;
      if (previousVercel === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = previousVercel;
      if (previousSlices === undefined) delete process.env.RELEASE_D_ENABLED_SLICES; else process.env.RELEASE_D_ENABLED_SLICES = previousSlices;
    }
  });
});

describe("Production MVP publication boundary", () => {
  it("opens approved staff operations without opening member or pending routes", () => {
    for (const route of ["/admin/orders", "/api/admin/orders/123", "/api/admin/shipments", "/api/admin/payment-transfers/123/verify", "/admin/claims"]) {
      expect(isReleaseAPathAllowed(route, true)).toBe(true);
      expect(isReleaseAPathAllowed(route, false)).toBe(false);
    }
    for (const route of ["/register", "/api/auth/sign-up", "/member/orders", "/api/member/orders", "/admin/sourcing-requests", "/api/admin/sourcing-requests/options", "/administrator"]) {
      expect(isReleaseAPathAllowed(route, true)).toBe(false);
    }
  });
  it("serves only the approved sale page assets in Release A", () => {
    expect(isReleaseAPathAllowed("/demo-assets/riverstone-lobby.png")).toBe(true);
    expect(isReleaseAPathAllowed("/demo-assets/riverstone-product-board.png")).toBe(true);
    expect(isReleaseAPathAllowed("/demo-assets/unapproved.png")).toBe(false);
  });

  it.each(["A", "B", "C", "D"])("blocks pending features and direct APIs at stage %s", (stage) => {
    for (const route of ["/member/shared-catalogs", "/api/member/shared-catalogs/123/publish", "/catalog/share/token", "/api/public/catalogs/token", "/member/sourcing-requests/new", "/api/member/sourcing-requests/123", "/admin/sourcing-requests", "/api/admin/sourcing-requests/options"]) {
      expect(isPendingProductionFeature(route, stage, false)).toBe(true);
    }
    expect(isPendingProductionFeature("/member/projects", stage, false)).toBe(false);
    expect(isPendingProductionFeature("/api/member/custom-requests", stage, false)).toBe(false);
  });

  it("preserves explicitly enabled branch previews", () => {
    expect(isPendingProductionFeature("/api/member/shared-catalogs", "D", true)).toBe(false);
    expect(isPendingProductionFeature("/api/member/shared-catalogs", "", false)).toBe(false);
    expect(isPendingProductionFeature("/api/member/sourcing-requests", "", false)).toBe(true);
  });

  it("can release shared catalogs without exposing product sourcing", () => {
    const previousCatalog = process.env.NEXT_PUBLIC_ENABLE_SHARED_CATALOGS;
    const previousSourcing = process.env.NEXT_PUBLIC_ENABLE_PRODUCT_SOURCING;
    process.env.NEXT_PUBLIC_ENABLE_SHARED_CATALOGS = "true";
    process.env.NEXT_PUBLIC_ENABLE_PRODUCT_SOURCING = "false";
    try {
      expect(isPendingProductionFeature("/catalog/share/token", "B", false)).toBe(false);
      expect(isPendingProductionFeature("/member/shared-catalogs", "B", false)).toBe(false);
      expect(isPendingProductionFeature("/member/sourcing-requests", "B", false)).toBe(true);
      expect(isPendingProductionFeature("/admin/sourcing-requests", "B", false)).toBe(true);
    } finally {
      if (previousCatalog === undefined) delete process.env.NEXT_PUBLIC_ENABLE_SHARED_CATALOGS;
      else process.env.NEXT_PUBLIC_ENABLE_SHARED_CATALOGS = previousCatalog;
      if (previousSourcing === undefined) delete process.env.NEXT_PUBLIC_ENABLE_PRODUCT_SOURCING;
      else process.env.NEXT_PUBLIC_ENABLE_PRODUCT_SOURCING = previousSourcing;
    }
  });

  it("limits Release B to member pilot routes", () => {
    for (const route of [
      "/register",
      "/api/auth/sign-up",
      "/member/dashboard",
      "/member/profile",
      "/member/catalog",
      "/member/projects/123",
      "/member/shared-catalogs",
      "/member/sourcing-requests/new",
      "/catalog/share/token",
      "/api/public/catalogs/token",
      "/admin/showroom-visits",
      "/admin/sourcing-requests",
    ]) expect(isReleaseBPathAllowed(route, true)).toBe(true);

    for (const route of [
      "/member/custom-requests",
      "/api/member/custom-requests",
      "/member/custom-quotations",
      "/api/member/custom-quotations",
      "/member/orders",
      "/api/member/orders",
      "/api/member/payment-transfers",
      "/member/claims",
      "/api/member/claims",
      "/member/reports",
      "/api/member/reports",
    ]) {
      expect(isReleaseBPathAllowed(route, true)).toBe(false);
      expect(isReleaseStagePathAllowed(route, "B", true)).toBe(false);
    }
  });
});
