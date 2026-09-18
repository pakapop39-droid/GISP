import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ guard: vi.fn(), rpc: vi.fn(), sendReset: vi.fn() }));
vi.mock("@insforge/sdk/ssr", () => ({ createServerClient: () => ({ auth: { sendResetPasswordEmail: mocks.sendReset } }) }));
vi.mock("@/lib/auth/session", () => ({ requireAppAccess: mocks.guard }));
vi.mock("@/lib/auth/auth-route", () => ({ requestNetworkData: () => ({ requestId: "request", ip: null, userAgent: "test" }) }));
vi.mock("@/lib/insforge/server", () => ({ createInsForgeServerClient: async () => ({ database: { rpc: mocks.rpc } }) }));
vi.mock("@/lib/api/response", () => ({
  apiError: (error: { status?: number }) => Response.json({}, { status: error.status ?? 500 }),
  invalidInput: () => Response.json({}, { status: 400 }),
}));

import { POST } from "./route";

const id = "4f5f9785-8f6b-448b-becb-376911a36a14";
const request = (body: unknown) => new NextRequest("https://gisp.example.test/api/admin/members/id/action", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
});
const params = { params: Promise.resolve({ id }) };
const protectedActions = [
  { action: "suspend", reason: "ตรวจสอบบัญชี" },
  { action: "reactivate" },
  { action: "force-logout" },
  { action: "send-reset" },
] as const;

describe("member action target isolation", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.guard.mockResolvedValue({ userId: "member-admin" });
    mocks.rpc.mockImplementation(async (name: string) => name === "admin_get_user_email"
      ? { data: "member@example.test", error: null }
      : { data: id, error: null });
    mocks.sendReset.mockResolvedValue({ error: null });
  });

  it.each(["FINANCE", "SUPER_ADMIN"])("blocks a MEMBER_ADMIN targeting %s before every account action", async (targetRole) => {
    for (const body of protectedActions) {
      mocks.rpc.mockClear();
      mocks.rpc.mockResolvedValueOnce({ data: null, error: { status: 404, message: `NOT_FOUND:${targetRole}` } });
      expect((await POST(request(body), params)).status).toBe(404);
      expect(mocks.rpc).toHaveBeenCalledTimes(1);
      expect(mocks.rpc).toHaveBeenCalledWith("assert_member_management_target", { target_user_id_input: id });
      expect(mocks.rpc).not.toHaveBeenCalledWith("suspend_user", expect.anything());
      expect(mocks.rpc).not.toHaveBeenCalledWith("reactivate_user", expect.anything());
      expect(mocks.rpc).not.toHaveBeenCalledWith("revoke_all_app_sessions", expect.anything());
      expect(mocks.rpc).not.toHaveBeenCalledWith("admin_get_user_email", expect.anything());
      expect(mocks.sendReset).not.toHaveBeenCalled();
    }
  });

  it.each([
    [{ action: "suspend", reason: "ตรวจสอบบัญชี" }, "suspend_user"],
    [{ action: "reactivate" }, "reactivate_user"],
    [{ action: "force-logout" }, "revoke_all_app_sessions"],
  ])("preserves an approved member lifecycle action %j", async (body, rpcName) => {
    expect((await POST(request(body), params)).status).toBe(200);
    expect(mocks.rpc).toHaveBeenNthCalledWith(1, "assert_member_management_target", { target_user_id_input: id });
    expect(mocks.rpc).toHaveBeenCalledWith(rpcName, expect.objectContaining({ target_user_id_input: id }));
  });

  it("preserves member reset after target validation", async () => {
    expect((await POST(request({ action: "send-reset" }), params)).status).toBe(200);
    expect(mocks.rpc).toHaveBeenNthCalledWith(1, "assert_member_management_target", { target_user_id_input: id });
    expect(mocks.rpc).toHaveBeenCalledWith("admin_get_user_email", { target_user_id_input: id });
    expect(mocks.sendReset).toHaveBeenCalledWith(expect.objectContaining({ email: "member@example.test" }));
  });

  it("does not apply member-target validation to application approve/reject IDs", async () => {
    expect((await POST(request({ action: "approve", note: "ผ่าน" }), params)).status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("approve_member_application", expect.anything());
    expect(mocks.rpc).not.toHaveBeenCalledWith("assert_member_management_target", expect.anything());
  });
});
