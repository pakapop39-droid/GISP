import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  attach: vi.fn(),
  clear: vi.fn(),
  log: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@insforge/sdk/ssr", () => ({
  clearAuthCookies: mocks.clear,
  createAuthActions: () => ({
    signInWithPassword: mocks.signIn,
    signOut: mocks.signOut,
  }),
}));
vi.mock("@/lib/auth/auth-route", () => ({
  attachAppSession: mocks.attach,
  isAccountInactiveError: (error: unknown) =>
    Boolean(error && typeof error === "object" && "message" in error && String(error.message).includes("ACCOUNT_INACTIVE")),
  logAnonymousSecurityEvent: mocks.log,
  secureAuthCookieOptions: { options: {} },
}));
vi.mock("@/lib/auth/session", () => ({ APP_SESSION_COOKIE: "gisp_app_session" }));

import { POST } from "./route";

function request() {
  return new NextRequest("http://localhost/api/auth/sign-in", {
    method: "POST",
    body: JSON.stringify({ email: "inactive@example.test", password: "correct-password" }),
    headers: { "content-type": "application/json" },
  });
}

describe("sign-in inactive account handling", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.signIn.mockResolvedValue({
      data: { user: { id: "user-1", email: "inactive@example.test" } },
      error: null,
    });
    mocks.signOut.mockResolvedValue(undefined);
    mocks.attach.mockResolvedValue(undefined);
  });

  it("returns 403 and clears both auth and app cookies for an inactive account", async () => {
    mocks.attach.mockRejectedValue({ message: "ACCOUNT_INACTIVE" });

    const response = await POST(request());

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "ACCOUNT_INACTIVE" });
    expect(mocks.signOut).toHaveBeenCalledOnce();
    expect(mocks.clear).toHaveBeenCalledTimes(2);
    expect(response.headers.get("set-cookie")).toContain("gisp_app_session=");
  });

  it("preserves normal sign-in when session attachment succeeds", async () => {
    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      user: { id: "user-1", email: "inactive@example.test" },
    });
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it("clears cookies and keeps generic attachment failures distinct", async () => {
    mocks.attach.mockRejectedValue({ message: "database unavailable" });

    const response = await POST(request());

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "SESSION_REVOKED" });
    expect(mocks.signOut).toHaveBeenCalledOnce();
    expect(mocks.clear).toHaveBeenCalledTimes(2);
  });
});
