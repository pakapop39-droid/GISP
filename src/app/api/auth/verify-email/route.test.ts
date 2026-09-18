import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  attach: vi.fn(),
  clear: vi.fn(),
  signOut: vi.fn(),
  verify: vi.fn(),
}));

vi.mock("@insforge/sdk/ssr", () => ({
  clearAuthCookies: mocks.clear,
  createAuthActions: () => ({
    verifyEmail: mocks.verify,
    signOut: mocks.signOut,
  }),
}));
vi.mock("@/lib/auth/auth-route", () => ({
  attachAppSession: mocks.attach,
  isAccountInactiveError: (error: unknown) =>
    Boolean(error && typeof error === "object" && "message" in error && String(error.message).includes("ACCOUNT_INACTIVE")),
  secureAuthCookieOptions: { options: {} },
}));
vi.mock("@/lib/auth/session", () => ({ APP_SESSION_COOKIE: "gisp_app_session" }));

import { POST } from "./route";

function request() {
  return new NextRequest("http://localhost/api/auth/verify-email", {
    method: "POST",
    body: JSON.stringify({ email: "inactive@example.test", otp: "123456" }),
    headers: { "content-type": "application/json" },
  });
}

describe("verify-email inactive account handling", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.verify.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    mocks.signOut.mockResolvedValue(undefined);
    mocks.attach.mockResolvedValue(undefined);
  });

  it("returns 403, signs out, and clears cookies when the verified account is inactive", async () => {
    mocks.attach.mockRejectedValue({ message: "ACCOUNT_INACTIVE" });

    const response = await POST(request());

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "ACCOUNT_INACTIVE" });
    expect(mocks.signOut).toHaveBeenCalledOnce();
    expect(mocks.clear).toHaveBeenCalledOnce();
    expect(response.headers.get("set-cookie")).toContain("gisp_app_session=");
  });

  it("preserves the normal first-time verification and onboarding flow", async () => {
    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, next: "/onboarding" });
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it("also clears cookies after a generic session attachment failure", async () => {
    mocks.attach.mockRejectedValue({ message: "database unavailable" });

    const response = await POST(request());

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "SESSION_REVOKED" });
    expect(mocks.signOut).toHaveBeenCalledOnce();
    expect(mocks.clear).toHaveBeenCalledOnce();
  });
});
