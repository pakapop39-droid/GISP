import { describe, expect, it } from "vitest";
import { enabledReleaseDSlices, isCoreParityEnabled, isOrderOperationSliceVisible, isPendingProductionFeature, isReleaseAPathAllowed, isReleaseBPathAllowed, isReleaseStagePathAllowed, isStagedReleaseEnabled } from "./release-stage";

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

describe("Production core parity release gate", () => {
  it("allows only the exact release attestation health route at every staged gate", () => {
    for (const stage of ["A", "B", "C", "D"]) {
      expect(isReleaseStagePathAllowed("/api/health/release-attestation", stage, false)).toBe(true);
      expect(isReleaseStagePathAllowed("/api/health/release-attestation-extra", stage, false)).toBe(false);
    }
  });

  it("fails closed for every C/D transaction and operations route when the emergency switch is off", () => {
    for (const route of ["/member/orders/123", "/api/member/payment-transfers", "/admin/orders/123", "/api/admin/payment-transfers/123/evidence", "/api/admin/supplier-disclosures/123/revoke", "/api/admin/dashboard", "/api/admin/supplier-payments", "/api/admin/payment-transfers/123/adjustments", "/api/admin/payment-adjustments/123/review", "/api/admin/payment-workflow-holds/123/confirm", "/api/admin/qc-inspections", "/api/admin/production-updates", "/api/admin/logistics/actions", "/api/admin/shipments", "/api/member/claims", "/admin/reports", "/member/reports"]) {
      expect(isReleaseStagePathAllowed(route, "C", true)).toBe(false);
      expect(isReleaseStagePathAllowed(route, "D", true)).toBe(false);
    }
    expect(isReleaseStagePathAllowed("/member/projects", "D", true)).toBe(true);
  });

  it("parses only contiguous D slice declarations", () => {
    expect(enabledReleaseDSlices("7")).toEqual([7]);
    expect(enabledReleaseDSlices("7,8,9,10")).toEqual([7, 8, 9, 10]);
    for (const invalid of ["", "8", "7,9", "7,8,8", "7,8,9,11", "7,8,9,10,11"]) {
      expect(enabledReleaseDSlices(invalid)).toEqual([]);
    }
  });

  it("opens accepted core routes only for the exact D + 7-10 + true combination", () => {
    const previous = { stage: process.env.RELEASE_STAGE, slices: process.env.RELEASE_D_ENABLED_SLICES, enabled: process.env.PRODUCTION_CORE_PARITY_ENABLED };
    try {
      process.env.RELEASE_STAGE = "D";
      process.env.RELEASE_D_ENABLED_SLICES = "7,8,9,10";
      process.env.PRODUCTION_CORE_PARITY_ENABLED = "false";
      expect(isCoreParityEnabled()).toBe(false);
      process.env.PRODUCTION_CORE_PARITY_ENABLED = "true";
      expect(isCoreParityEnabled()).toBe(true);
      for (const route of ["/api/admin/supplier-payments", "/api/admin/supplier-orders/id/po/pdf", "/api/admin/production-updates", "/api/admin/logistics/actions", "/member/claims", "/admin/reports"]) {
        expect(isReleaseStagePathAllowed(route, "D", true)).toBe(true);
      }
      expect(isOrderOperationSliceVisible(7)).toBe(true);
      expect(isOrderOperationSliceVisible(8)).toBe(true);
      for (const invalid of [
        { stage: "C", slices: "7,8,9,10", enabled: "true" },
        { stage: "D", slices: "7,8,9", enabled: "true" },
        { stage: "D", slices: "7,8,9,10", enabled: "false" },
      ]) {
        process.env.RELEASE_STAGE = invalid.stage;
        process.env.RELEASE_D_ENABLED_SLICES = invalid.slices;
        process.env.PRODUCTION_CORE_PARITY_ENABLED = invalid.enabled;
        expect(isCoreParityEnabled()).toBe(false);
        expect(isReleaseStagePathAllowed("/api/admin/supplier-payments", invalid.stage, true)).toBe(false);
      }
    } finally {
      if (previous.stage === undefined) delete process.env.RELEASE_STAGE; else process.env.RELEASE_STAGE = previous.stage;
      if (previous.slices === undefined) delete process.env.RELEASE_D_ENABLED_SLICES; else process.env.RELEASE_D_ENABLED_SLICES = previous.slices;
      if (previous.enabled === undefined) delete process.env.PRODUCTION_CORE_PARITY_ENABLED; else process.env.PRODUCTION_CORE_PARITY_ENABLED = previous.enabled;
    }
  });

  it("hides D order controls for incomplete combinations and fails closed for invalid hosted Production stages", () => {
    const previousStage = process.env.RELEASE_STAGE;
    const previousVercel = process.env.VERCEL_ENV;
    const previousSlices = process.env.RELEASE_D_ENABLED_SLICES;
    const previousEnabled = process.env.PRODUCTION_CORE_PARITY_ENABLED;
    try {
      process.env.VERCEL_ENV = "production";
      process.env.RELEASE_STAGE = "C";
      expect(isOrderOperationSliceVisible(7)).toBe(false);
      expect(isOrderOperationSliceVisible(8)).toBe(false);
      process.env.RELEASE_STAGE = "D";
      process.env.RELEASE_D_ENABLED_SLICES = "7";
      process.env.PRODUCTION_CORE_PARITY_ENABLED = "true";
      expect(isOrderOperationSliceVisible(7)).toBe(false);
      expect(isOrderOperationSliceVisible(8)).toBe(false);
      process.env.RELEASE_STAGE = "INVALID";
      expect(isStagedReleaseEnabled()).toBe(true);
      expect(isReleaseStagePathAllowed("/api/admin/orders", "INVALID", true)).toBe(false);
    } finally {
      if (previousStage === undefined) delete process.env.RELEASE_STAGE; else process.env.RELEASE_STAGE = previousStage;
      if (previousVercel === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = previousVercel;
      if (previousSlices === undefined) delete process.env.RELEASE_D_ENABLED_SLICES; else process.env.RELEASE_D_ENABLED_SLICES = previousSlices;
      if (previousEnabled === undefined) delete process.env.PRODUCTION_CORE_PARITY_ENABLED; else process.env.PRODUCTION_CORE_PARITY_ENABLED = previousEnabled;
    }
  });
});

describe("Production MVP publication boundary", () => {
  it("opens approved staff operations without opening member or pending routes", () => {
    for (const route of ["/admin/orders", "/api/admin/orders/123", "/api/admin/payment-transfers/123/verify"]) {
      expect(isReleaseAPathAllowed(route, true)).toBe(false);
      expect(isReleaseAPathAllowed(route, false)).toBe(false);
    }
    for (const route of ["/api/admin/shipments", "/admin/claims", "/api/admin/supplier-payments"]) {
      expect(isReleaseAPathAllowed(route, true)).toBe(false);
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
