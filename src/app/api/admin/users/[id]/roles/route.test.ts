import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ guard: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireSuperAdmin: mocks.guard }));
vi.mock("@/lib/auth/internal-user-schema", () => ({
  internalUserJobGroupsSchema: {
    safeParse: (value: unknown) => {
      if (!value || typeof value !== "object") return { success: false };
      const input = value as Record<string, unknown>;
      const keys = Object.keys(input);
      const allowed = ["OPERATIONS", "FINANCE", "LOGISTICS"];
      if (keys.length !== 1 || keys[0] !== "jobGroups" || !Array.isArray(input.jobGroups)
        || input.jobGroups.length < 1 || input.jobGroups.length > 3
        || input.jobGroups.some((group) => !allowed.includes(String(group)))) return { success: false };
      return { success: true, data: { jobGroups: [...new Set(input.jobGroups)] } };
    },
  },
}));
vi.mock("@/lib/auth/staff-job-groups", () => ({
  rolesForStaffJobGroup: (group: string) => group === "OPERATIONS"
    ? ["MEMBER_ADMIN", "PRODUCT_ADMIN", "ORDER_ADMIN", "PURCHASING", "QC"]
    : [group],
}));
vi.mock("@/lib/insforge/server", () => ({ createInsForgeServerClient: async () => ({ database: { rpc: mocks.rpc } }) }));
vi.mock("@/lib/api/response", () => ({
  apiError: (error: { status?: number }) => Response.json({}, { status: error.status ?? 500 }),
  invalidInput: () => Response.json({}, { status: 400 }),
}));

import { POST } from "./route";

const id = "4f5f9785-8f6b-448b-becb-376911a36a14";
const request = (body: unknown) => new NextRequest("https://gisp.example.test/api/admin/users/id/roles", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
});
const params = (value = id) => ({ params: Promise.resolve({ id: value }) });

describe("internal staff job-group route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.guard.mockResolvedValue({ userId: "admin" });
    mocks.rpc.mockResolvedValue({ data: id, error: null });
  });

  it.each([401, 403])("authorizes before parsing or mutation (%s)", async (status) => {
    mocks.guard.mockRejectedValue({ status });
    expect((await POST(request({ roles: ["SUPER_ADMIN"] }), params())).status).toBe(status);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects raw roles, owner injection, empty groups, and malformed IDs", async () => {
    for (const [body, target] of [
      [{ roles: ["FINANCE"] }, id],
      [{ jobGroups: ["SUPER_ADMIN"] }, id],
      [{ jobGroups: [] }, id],
      [{ jobGroups: ["FINANCE"] }, "bad"],
    ] as const) {
      expect((await POST(request(body), params(target))).status).toBe(400);
    }
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("derives the exact technical roles on the server", async () => {
    expect((await POST(request({ jobGroups: ["OPERATIONS", "FINANCE"] }), params())).status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("replace_internal_staff_job_groups", {
      target_user_id_input: id,
      job_groups_input: ["OPERATIONS", "FINANCE"],
      role_codes_input: ["MEMBER_ADMIN", "PRODUCT_ADMIN", "ORDER_ADMIN", "PURCHASING", "QC", "FINANCE"],
    });
  });

  it("does not report success when the atomic RPC fails", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: new Error("INVALID_TRANSITION") });
    expect((await POST(request({ jobGroups: ["FINANCE"] }), params())).status).toBe(500);
  });
});
