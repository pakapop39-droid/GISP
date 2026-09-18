import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ guard: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireSuperAdmin: mocks.guard }));
vi.mock("@/lib/auth/internal-user-schema", () => ({
  internalUserLifecycleSchema: {
    safeParse: (value: unknown) => {
      if (!value || typeof value !== "object") return { success: false, error: { flatten: () => ({ fieldErrors: {} }) } };
      const input = value as Record<string, unknown>;
      const confirmed = input.confirmed === true;
      const reasonOkay = typeof input.reason === "string" && input.reason.trim().length >= 3;
      const success = confirmed && (input.action === "reactivate"
        || (input.action === "suspend" && reasonOkay)
        || (input.action === "deactivate" && reasonOkay && typeof input.confirmationEmail === "string" && input.confirmationEmail.includes("@")));
      return success
        ? { success: true, data: input }
        : { success: false, error: { flatten: () => ({ fieldErrors: {} }) } };
    },
  },
}));
vi.mock("@/lib/insforge/server", () => ({ createInsForgeServerClient: async () => ({ database: { rpc: mocks.rpc } }) }));
vi.mock("@/lib/api/response", () => ({
  apiError: (error: { status?: number }) => Response.json({}, { status: error.status ?? 500 }),
  invalidInput: () => Response.json({}, { status: 400 }),
}));

import { POST } from "./route";

const id = "4f5f9785-8f6b-448b-becb-376911a36a14";
const request = (body: unknown) => new NextRequest("https://gisp.example.test/api/admin/users/id/lifecycle", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
});
const params = { params: Promise.resolve({ id }) };

describe("internal staff lifecycle route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.guard.mockResolvedValue({ userId: "admin" });
    mocks.rpc.mockResolvedValue({ data: id, error: null });
  });

  it.each([401, 403])("authorizes before reading data or mutating (%s)", async (status) => {
    mocks.guard.mockRejectedValue({ status });
    expect((await POST(request({ action: "reactivate", confirmed: true }), params)).status).toBe(status);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("requires reason and explicit confirmation", async () => {
    expect((await POST(request({ action: "suspend", reason: "", confirmed: true }), params)).status).toBe(400);
    expect((await POST(request({ action: "reactivate" }), params)).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it.each([
    ["suspend", { action: "suspend", reason: "ตรวจสอบบัญชี", confirmed: true }, "SUSPEND", "ตรวจสอบบัญชี"],
    ["reactivate", { action: "reactivate", confirmed: true }, "REACTIVATE", null],
  ])("calls the atomic lifecycle RPC for %s", async (_label, body, action, reason) => {
    expect((await POST(request(body), params)).status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("manage_internal_staff_lifecycle", {
      target_user_id_input: id, action_input: action, reason_input: reason,
    });
  });

  it("requires the target email before deactivation", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: "staff@example.test", error: null });
    expect((await POST(request({ action: "deactivate", reason: "พ้นสภาพ", confirmationEmail: "wrong@example.test", confirmed: true }), params)).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalledWith("manage_internal_staff_lifecycle", expect.anything());
  });

  it("deactivates only after the server email matches", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: "staff@example.test", error: null }).mockResolvedValueOnce({ data: id, error: null });
    expect((await POST(request({ action: "deactivate", reason: "พ้นสภาพ", confirmationEmail: "STAFF@example.test", confirmed: true }), params)).status).toBe(200);
    expect(mocks.rpc).toHaveBeenLastCalledWith("manage_internal_staff_lifecycle", {
      target_user_id_input: id, action_input: "DEACTIVATE", reason_input: "พ้นสภาพ",
    });
  });

  it("does not report success when the lifecycle RPC fails", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: new Error("INVALID_TRANSITION") });
    expect((await POST(request({ action: "reactivate", confirmed: true }), params)).status).toBe(500);
  });

  it.each([
    ["EXECUTIVE_VIEWER", { action: "suspend", reason: "ตรวจสอบบัญชี", confirmed: true }],
    ["EXECUTIVE_VIEWER", { action: "reactivate", confirmed: true }],
    ["EXECUTIVE_VIEWER", { action: "deactivate", reason: "พ้นสภาพ", confirmationEmail: "staff@example.test", confirmed: true }],
    ["PRODUCT_ADMIN", { action: "suspend", reason: "ตรวจสอบบัญชี", confirmed: true }],
    ["PRODUCT_ADMIN", { action: "reactivate", confirmed: true }],
    ["PRODUCT_ADMIN", { action: "deactivate", reason: "พ้นสภาพ", confirmationEmail: "staff@example.test", confirmed: true }],
  ])("does not report success when DB blocks %s for %s", async (role, body) => {
    if (body.action === "deactivate") {
      mocks.rpc.mockResolvedValueOnce({ data: "staff@example.test", error: null });
    }
    mocks.rpc.mockResolvedValueOnce({ data: null, error: new Error(`INVALID_TRANSITION:${role}`) });
    expect((await POST(request(body), params)).status).toBe(500);
  });
});
