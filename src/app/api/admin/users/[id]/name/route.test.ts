import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ guard: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireSuperAdmin: mocks.guard }));
vi.mock("@/lib/auth/internal-user-schema", () => ({
  internalUserNameSchema: {
    safeParse: (value: unknown) => {
      if (!value || typeof value !== "object") {
        return { success: false, error: { flatten: () => ({ fieldErrors: {} }) } };
      }
      const input = value as Record<string, unknown>;
      const keys = Object.keys(input);
      const name = typeof input.name === "string" ? input.name.trim() : "";
      return keys.length === 1 && keys[0] === "name" && name.length >= 2 && name.length <= 120
        ? { success: true, data: { name } }
        : { success: false, error: { flatten: () => ({ fieldErrors: {} }) } };
    },
  },
}));
vi.mock("@/lib/insforge/server", () => ({ createInsForgeServerClient: async () => ({ database: { rpc: mocks.rpc } }) }));
vi.mock("@/lib/api/response", () => ({
  apiError: (error: { status?: number }) => Response.json({}, { status: error.status ?? 500 }),
  invalidInput: () => Response.json({}, { status: 400 }),
}));

import { PATCH } from "./route";

const id = "4f5f9785-8f6b-448b-becb-376911a36a14";
const request = (body: unknown) => new NextRequest("https://gisp.example.test/api/admin/users/id/name", {
  method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
});
const params = (value = id) => ({ params: Promise.resolve({ id: value }) });

describe("internal staff display-name route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.guard.mockResolvedValue({ userId: "admin" });
    mocks.rpc.mockResolvedValue({ data: id, error: null });
  });

  it.each([401, 403])("authorizes before parsing or mutation (%s)", async (status) => {
    mocks.guard.mockRejectedValue({ status });
    expect((await PATCH(request({ name: "ชื่อใหม่" }), params())).status).toBe(status);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("accepts only a valid strict name payload and UUID", async () => {
    for (const [body, target] of [
      [{ name: "ก" }, id],
      [{ name: "ชื่อใหม่", roles: ["SUPER_ADMIN"] }, id],
      [{ name: "ชื่อใหม่" }, "bad"],
    ] as const) {
      expect((await PATCH(request(body), params(target))).status).toBe(400);
    }
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("trims the name and calls the atomic rename RPC", async () => {
    expect((await PATCH(request({ name: "  ภคภพ ช.เจริญยิ่ง  " }), params())).status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("rename_internal_staff_user", {
      target_user_id_input: id,
      full_name_input: "ภคภพ ช.เจริญยิ่ง",
    });
  });

  it("does not report success when the rename RPC fails", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: new Error("INVALID_TRANSITION") });
    expect((await PATCH(request({ name: "ชื่อใหม่" }), params())).status).toBe(500);
  });
});
