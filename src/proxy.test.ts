import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  updateSession: vi.fn(),
  createAdmin: vi.fn(),
}));

vi.mock("@insforge/sdk/ssr/middleware", () => ({ updateSession: mocks.updateSession }));
vi.mock("@/lib/insforge/admin", () => ({ createInsForgeAdminClient: mocks.createAdmin }));
vi.mock("@/lib/auth/cookies", () => ({
  APP_SESSION_COOKIE: "app-session",
  secureAuthCookieOptions: {},
}));
vi.mock("@/lib/release-stage", () => ({
  isPendingProductionFeature: () => false,
  isReleaseStagePathAllowed: () => true,
  isStagedReleaseEnabled: () => false,
}));
vi.mock("@/lib/catalog/pdf-import", () => ({
  isPdfCatalogImportEnabled: () => process.env.ENABLE_PDF_CATALOG_IMPORT === "true",
}));

import { proxy } from "./proxy";
import { POST as wakePdfWorker } from "./app/api/internal/catalog-pdf-worker/wake/route";

function request(path: string, authorization?: string) {
  return new NextRequest(`http://localhost${path}`, {
    method: "POST",
    headers: authorization ? { authorization } : undefined,
  });
}

describe("proxy internal PDF worker boundary", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("APP_MODE", "app");
    vi.stubEnv("NEXT_PUBLIC_INSFORGE_URL", "https://example.insforge.test");
    vi.stubEnv("NEXT_PUBLIC_INSFORGE_ANON_KEY", "test-anon-key");
    vi.stubEnv("RELEASE_STAGE", "");
    vi.stubEnv("NEXT_PUBLIC_ENABLE_POST_GO_LIVE_FEATURES", "false");
    mocks.updateSession.mockResolvedValue({ accessToken: null });
  });

  afterEach(() => vi.unstubAllEnvs());

  it.each([
    "/api/internal/catalog-pdf-worker/wake",
    "/api/internal/catalog-pdf-worker/cleanup",
  ])("lets the exact bearer-secured worker prefix reach its route: %s", async (path) => {
    const response = await proxy(request(path));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it.each([
    "/api/admin/catalog/imports",
    "/api/internal/catalog-pdf-worker-evil/wake",
    "/api/internal/unrelated/process",
  ])("keeps unrelated APIs session-protected: %s", async (path) => {
    const response = await proxy(request(path));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ code: "UNAUTHENTICATED" });
  });
});

describe("PDF worker wake route guards", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("PDF_WORKER_WAKE_SECRET", "expected-secret");
    vi.stubEnv("ENABLE_PDF_CATALOG_IMPORT", "false");
  });

  afterEach(() => vi.unstubAllEnvs());

  it.each([undefined, "Bearer wrong-secret"])("returns 401 for a missing or wrong bearer token", async (authorization) => {
    const response = await wakePdfWorker(request("/api/internal/catalog-pdf-worker/wake", authorization));

    expect(response.status).toBe(401);
    expect(mocks.createAdmin).not.toHaveBeenCalled();
  });

  it("keeps the feature disabled by default after valid bearer authentication", async () => {
    const response = await wakePdfWorker(request("/api/internal/catalog-pdf-worker/wake", "Bearer expected-secret"));

    expect(response.status).toBe(404);
    expect(mocks.createAdmin).not.toHaveBeenCalled();
  });

  it("fails closed before data access when compute configuration is incomplete", async () => {
    vi.stubEnv("ENABLE_PDF_CATALOG_IMPORT", "true");
    vi.stubEnv("PDF_WORKER_URL", "");
    vi.stubEnv("PDF_WORKER_TOKEN", "");
    vi.stubEnv("PDF_COMPUTE_USD_PER_HOUR", "");

    const response = await wakePdfWorker(request("/api/internal/catalog-pdf-worker/wake", "Bearer expected-secret"));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ code: "COMPUTE_CAP_UNVERIFIED" });
    expect(mocks.createAdmin).not.toHaveBeenCalled();
  });
});
