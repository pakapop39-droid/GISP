const RELEASE_A_PAGE_PREFIXES = [
  "/admin/guide",
  "/admin/catalog",
  "/admin/dashboard",
  "/admin/logs",
  "/admin/members",
  "/admin/roles",
  "/admin/settings",
  "/admin/users",
];

const RELEASE_A_API_PREFIXES = [
  "/api/admin/catalog",
  "/api/admin/catalog-options",
  "/api/admin/logs",
  "/api/admin/members",
  "/api/admin/member-applications/approve",
  "/api/admin/pricing-formulas",
  "/api/admin/products",
  "/api/admin/roles",
  "/api/admin/settings",
  "/api/admin/suppliers",
  "/api/admin/users",
  "/api/files",
];

const RELEASE_A_PUBLIC_PATHS = new Set([
  "/",
  "/login",
  "/forgot-password",
  "/reset-password",
  "/member-guide.html",
  "/account-suspended",
  "/api/health",
  "/api/health/release-attestation",
  "/demo-assets/riverstone-lobby.png",
  "/demo-assets/riverstone-product-board.png",
]);

const RELEASE_A_AUTH_PATHS = new Set([
  "/api/auth/sign-in",
  "/api/auth/sign-out",
  "/api/auth/session",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/auth/refresh",
]);

function matchesPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isReleaseAEnabled() {
  return process.env.RELEASE_STAGE === "A";
}

export function isStagedReleaseEnabled() {
  return ["A", "B", "C", "D"].includes(process.env.RELEASE_STAGE ?? "") ||
    process.env.VERCEL_ENV === "production" || process.env.APP_ENV === "production";
}

// One fail-closed switch exposes the already accepted core flow. Removing or
// setting it to anything except the literal string "true" hides the added
// routes immediately without changing data or rolling back a deployment.
export function isCoreParityEnabled(
  raw = process.env.PRODUCTION_CORE_PARITY_ENABLED,
  stage = process.env.RELEASE_STAGE,
  rawSlices = process.env.RELEASE_D_ENABLED_SLICES,
) {
  return raw === "true" && stage === "D" && enabledReleaseDSlices(rawSlices).join(",") === "7,8,9,10";
}

// A hidden menu alone must not expose features whose database release is pending.
const SHARED_CATALOG_PREFIXES = [
  "/member/shared-catalogs", "/api/member/shared-catalogs",
  "/catalog/share", "/api/public/catalogs",
];

const PRODUCT_SOURCING_PREFIXES = [
  "/member/sourcing-requests", "/api/member/sourcing-requests",
  "/admin/sourcing-requests", "/api/admin/sourcing-requests",
];

const POST_GO_LIVE_PREFIXES = [...SHARED_CATALOG_PREFIXES, ...PRODUCT_SOURCING_PREFIXES];

export function isPendingProductionFeature(
  pathname: string,
  stage = process.env.RELEASE_STAGE,
  enabled = process.env.NEXT_PUBLIC_ENABLE_POST_GO_LIVE_FEATURES === "true",
) {
  if (enabled) return false;
  if (PRODUCT_SOURCING_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix)) &&
      process.env.NEXT_PUBLIC_ENABLE_PRODUCT_SOURCING !== "true") {
    return true;
  }
  if (!stage || !["A", "B", "C", "D"].includes(stage)) return false;
  if (SHARED_CATALOG_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix))) {
    return process.env.NEXT_PUBLIC_ENABLE_SHARED_CATALOGS !== "true";
  }
  if (PRODUCT_SOURCING_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix))) {
    return process.env.NEXT_PUBLIC_ENABLE_PRODUCT_SOURCING !== "true";
  }
  return false;
}

export function isReleaseAPathAllowed(pathname: string, staffOperations = false) {
  // Internal staff rehearsal opens only staff routes. Authentication and each
  // endpoint's permissions still apply; member signup and transactions stay gated.
  if (staffOperations && (matchesPrefix(pathname, "/admin") || matchesPrefix(pathname, "/api/admin"))) {
    if (!isCoreParityEnabled() && isCoreParityPath(pathname)) return false;
    return !POST_GO_LIVE_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));
  }
  if (RELEASE_A_PUBLIC_PATHS.has(pathname) || RELEASE_A_AUTH_PATHS.has(pathname)) {
    return true;
  }

  if (
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname.startsWith("/api/internal/notifications")
  ) {
    return true;
  }

  const prefixes = pathname.startsWith("/api/")
    ? RELEASE_A_API_PREFIXES
    : RELEASE_A_PAGE_PREFIXES;

  return prefixes.some((prefix) => matchesPrefix(pathname, prefix));
}

const RELEASE_B_PAGE_PREFIXES = [
  "/dashboard",
  "/onboarding",
  "/pending-approval",
  "/application-rejected",
  "/member/dashboard",
  "/member/profile",
  "/member/catalog",
  "/member/projects",
  "/member/shared-catalogs",
  "/member/sourcing-requests",
  "/catalog/share",
  "/admin/showroom-visits",
  "/admin/sourcing-requests",
];

const RELEASE_B_API_PREFIXES = [
  "/api/auth/sign-up",
  "/api/auth/verify-email",
  "/api/auth/resend-verification",
  "/api/member/onboarding",
  "/api/member/application/resubmit",
  "/api/member/profile",
  "/api/member/catalog",
  "/api/member/projects",
  "/api/member/shared-catalogs",
  "/api/member/sourcing-requests",
  "/api/public/catalogs",
  "/api/admin/showroom-visits",
  "/api/admin/sourcing-requests",
];

const RELEASE_B_PUBLIC_PATHS = new Set(["/register"]);

export function isReleaseBPathAllowed(pathname: string, staffOperations = false) {
  if (isReleaseAPathAllowed(pathname, staffOperations) || RELEASE_B_PUBLIC_PATHS.has(pathname)) {
    return true;
  }

  const prefixes = pathname.startsWith("/api/")
    ? RELEASE_B_API_PREFIXES
    : RELEASE_B_PAGE_PREFIXES;

  return prefixes.some((prefix) => matchesPrefix(pathname, prefix));
}

// A positive route list is essential here: the Release A/B staff rehearsal
// shortcut intentionally allows /api/admin/* and must not turn on D writes in C.
const RELEASE_C_PAGE_PREFIXES = [
  "/member/custom-requests", "/member/custom-quotations", "/member/orders",
  "/admin/custom-requests", "/admin/custom-quotations",
  "/admin/orders",
];
const RELEASE_C_API_PREFIXES = [
  "/api/member/custom-requests", "/api/member/custom-quotations",
  "/api/member/orders", "/api/member/payment-transfers", "/api/payment-evidence",
  "/api/admin/custom-requests", "/api/admin/custom-quotations",
  "/api/admin/orders", "/api/admin/payment-transfers",
  "/api/admin/cancellations",
  "/api/admin/supplier-disclosures", "/api/admin/dashboard",
  "/api/custom-quotations",
];
const RELEASE_C_DEFERRED_API_PREFIXES = [
  "/api/admin/supplier-payments",
  "/api/admin/payment-adjustments",
  "/api/admin/payment-workflow-holds",
];

export function isReleaseCPathAllowed(pathname: string) {
  if (isReleaseBPathAllowed(pathname, false)) return true;
  if (RELEASE_C_DEFERRED_API_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix))) return false;
  if (/^\/api\/admin\/payment-transfers\/[^/]+\/adjustments(?:\/|$)/.test(pathname)) return false;
  const prefixes = pathname.startsWith("/api/") ? RELEASE_C_API_PREFIXES : RELEASE_C_PAGE_PREFIXES;
  return prefixes.some((prefix) => matchesPrefix(pathname, prefix));
}

const RELEASE_D_SLICE_PREFIXES: Record<number, { pages: string[]; apis: string[] }> = {
  7: { pages: [], apis: ["/api/admin/production-updates", "/api/admin/qc-inspections", "/api/admin/operations-media", "/api/member/order-items"] },
  8: { pages: [], apis: ["/api/admin/logistics", "/api/admin/deliveries", "/api/admin/shipments", "/api/member/logistics"] },
  9: { pages: ["/member/claims", "/admin/claims"], apis: ["/api/member/claims", "/api/admin/claims", "/api/claims/evidence"] },
  10: { pages: ["/member/reports", "/admin/reports", "/admin/executive"], apis: ["/api/member/reports", "/api/admin/reports", "/api/admin/executive"] },
};

// D is released slice-by-slice under DEC-049. Invalid or missing configuration
// enables no D routes; gaps (for example 7,9) cannot skip an earlier gate.
export function enabledReleaseDSlices(raw = process.env.RELEASE_D_ENABLED_SLICES): number[] {
  if (!raw) return [];
  const values = raw.split(",").map((value) => Number(value.trim()));
  if (!values.length || values.length > 4 || values.some((value, index) => value !== index + 7)) return [];
  return values;
}

export function isOrderOperationSliceVisible(slice: 7 | 8) {
  return (slice === 7 || slice === 8) && isCoreParityEnabled();
}

export function isReleaseDPathAllowed(pathname: string, rawSlices = process.env.RELEASE_D_ENABLED_SLICES) {
  if (isReleaseCPathAllowed(pathname)) return true;
  return enabledReleaseDSlices(rawSlices).some((slice) => {
    const prefixes = pathname.startsWith("/api/")
      ? RELEASE_D_SLICE_PREFIXES[slice].apis : RELEASE_D_SLICE_PREFIXES[slice].pages;
    return prefixes.some((prefix) => matchesPrefix(pathname, prefix));
  });
}

export function isReleaseStagePathAllowed(
  pathname: string,
  stage = process.env.RELEASE_STAGE,
  staffOperations = process.env.ENABLE_STAFF_OPERATIONS === "true",
) {
  const coreParityEnabled = isCoreParityEnabled(
    process.env.PRODUCTION_CORE_PARITY_ENABLED,
    stage,
    process.env.RELEASE_D_ENABLED_SLICES,
  );
  if (coreParityEnabled) {
    if (RELEASE_C_DEFERRED_API_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix))) return true;
    if (matchesPrefix(pathname, "/api/admin/supplier-orders")) return true;
    if (/^\/api\/admin\/payment-transfers\/[^/]+\/adjustments(?:\/|$)/.test(pathname)) return true;
    return isReleaseDPathAllowed(pathname, "7,8,9,10");
  }
  // The parity switch is the emergency brake for the complete C/D transaction
  // and operations surface. An incomplete combination must not fall back to a
  // progressive C/D release, even when staff rehearsal is enabled.
  if (isCoreParityPath(pathname)) return false;
  if (stage === "A") return isReleaseAPathAllowed(pathname, staffOperations);
  if (stage === "B") return isReleaseBPathAllowed(pathname, staffOperations);
  if (stage === "C" || stage === "D") return isReleaseBPathAllowed(pathname, false);
  // Local Development remains unstaged, but hosted Production must fail closed.
  return process.env.VERCEL_ENV !== "production" && process.env.APP_ENV !== "production";
}

function isCoreParityPath(pathname: string) {
  if (/^\/api\/admin\/payment-transfers\/[^/]+\/adjustments(?:\/|$)/.test(pathname)) return true;
  if (matchesPrefix(pathname, "/api/admin/supplier-orders")) return true;
  const prefixes = [
    ...RELEASE_C_PAGE_PREFIXES,
    ...RELEASE_C_API_PREFIXES,
    ...RELEASE_C_DEFERRED_API_PREFIXES,
    ...Object.values(RELEASE_D_SLICE_PREFIXES).flatMap(({ pages, apis }) => [...pages, ...apis]),
  ];
  return prefixes.some((prefix) => matchesPrefix(pathname, prefix));
}
