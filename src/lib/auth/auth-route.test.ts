import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@insforge/sdk/ssr", () => ({ createServerClient: vi.fn() }));
vi.mock("@/lib/insforge/admin", () => ({ createInsForgeAdminClient: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({
  APP_SESSION_COOKIE: "gisp_app_session",
  APP_SESSION_MAX_AGE: 604800,
  appSessionCookieOptions: vi.fn(),
  createSessionToken: vi.fn(),
  hashSessionToken: vi.fn(),
}));
vi.mock("@/lib/auth/cookies", () => ({ secureAuthCookieOptions: { options: {} } }));

import { isAccountInactiveError } from "./auth-route";

describe("auth route errors", () => {
  it.each([
    "ACCOUNT_INACTIVE",
    new Error("database error: ACCOUNT_INACTIVE"),
    { code: "ACCOUNT_INACTIVE" },
    { details: "RPC failed with ACCOUNT_INACTIVE" },
  ])("recognizes an inactive account error", (error) => {
    expect(isAccountInactiveError(error)).toBe(true);
  });

  it("does not classify unrelated session failures as inactive", () => {
    expect(isAccountInactiveError({ message: "network unavailable" })).toBe(false);
    expect(isAccountInactiveError(null)).toBe(false);
  });
});
