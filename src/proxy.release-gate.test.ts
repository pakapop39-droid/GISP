import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@insforge/sdk/ssr/middleware", () => ({ updateSession: vi.fn() }));
vi.mock("@/lib/auth/cookies", () => ({ APP_SESSION_COOKIE: "app-session", secureAuthCookieOptions: {} }));
vi.mock("@/lib/release-stage", async () => vi.importActual("./lib/release-stage"));
import { proxy } from "./proxy";

const request = (path: string) => new NextRequest(`https://gisp.example.test${path}`);

describe("hosted Release C/D proxy gate", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("opens C Payment and Order routes but blocks D actions even with staff rehearsal enabled", async () => {
    vi.stubEnv("APP_MODE", "app");
    vi.stubEnv("RELEASE_STAGE", "C");
    vi.stubEnv("ENABLE_STAFF_OPERATIONS", "true");
    vi.stubEnv("NEXT_PUBLIC_INSFORGE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_INSFORGE_ANON_KEY", "");
    expect((await proxy(request("/api/admin/payment-transfers/11111111-1111-4111-8111-111111111111/evidence"))).status).toBe(200);
    expect((await proxy(request("/member/orders"))).status).toBe(200);
    const blocked = await proxy(request("/api/admin/logistics/actions"));
    expect(blocked.status).toBe(404);
    expect(await blocked.json()).toMatchObject({ code: "RELEASE_NOT_ENABLED" });
  });

  it("requires D slices in order and fails closed on missing hosted Production stage", async () => {
    vi.stubEnv("APP_MODE", "app");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_INSFORGE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_INSFORGE_ANON_KEY", "");
    vi.stubEnv("RELEASE_STAGE", "D");
    vi.stubEnv("RELEASE_D_ENABLED_SLICES", "7");
    expect((await proxy(request("/api/admin/qc-inspections"))).status).toBe(200);
    expect((await proxy(request("/api/admin/logistics/actions"))).status).toBe(404);
    vi.stubEnv("RELEASE_D_ENABLED_SLICES", "7,8");
    expect((await proxy(request("/api/admin/logistics/actions"))).status).toBe(200);
    vi.stubEnv("RELEASE_STAGE", "");
    expect((await proxy(request("/api/admin/orders"))).status).toBe(404);
  });
});
