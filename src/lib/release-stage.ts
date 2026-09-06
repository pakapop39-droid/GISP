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
