import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({
  guard: vi.fn(), from: vi.fn(), send: vi.fn(), rpc: vi.fn(), roles: ["FINANCE"],
  target: { id: "", status: "ACTIVE", primary_organization_id: null as string | null },
}));
vi.mock("@/lib/auth/session", () => ({ requireSuperAdmin: mocks.guard }));
vi.mock("@/lib/auth/types", () => ({ productionRoles: ["MEMBER", "PRODUCT_ADMIN", "FINANCE", "EXECUTIVE_VIEWER", "SUPER_ADMIN"] }));
vi.mock("@/lib/auth/staff-job-groups", () => ({
  staffJobGroupsForRoles: (roles: string[]) => roles.length === 1 && roles[0] === "FINANCE" ? ["FINANCE"] : null,
}));
vi.mock("@/lib/insforge/admin", () => ({ createInsForgeAdminClient: () => ({ database: { from: mocks.from }, auth: { sendResetPasswordEmail: mocks.send } }) }));
vi.mock("@/lib/insforge/server", () => ({ createInsForgeServerClient: async () => ({ database: { rpc: mocks.rpc } }) }));
vi.mock("@/lib/api/response", () => ({ apiError: (error: { status?: number }) => Response.json({}, { status: error.status ?? 500 }), invalidInput: () => Response.json({}, { status: 400 }) }));
import { POST } from "./route";
const id = "4f5f9785-8f6b-448b-becb-376911a36a14";
const adminId = "11111111-1111-4111-8111-111111111111";
const request = () => new NextRequest("https://gisp.example.test/api/admin/users/reset-password", { method: "POST" });
const params = (value = id) => ({ params: Promise.resolve({ id: value }) });
beforeEach(() => {
  vi.resetAllMocks(); mocks.roles = ["FINANCE"];
  mocks.guard.mockResolvedValue({ userId: adminId });
  mocks.target = { id, status: "ACTIVE", primary_organization_id: null };
  mocks.from.mockImplementation(() => {
    const query = {
      select: () => query, eq: () => query, is: () => query,
      maybeSingle: () => Promise.resolve({ data: mocks.target, error: null }),
      then: (resolve: (value: unknown) => void) => resolve({ data: mocks.roles.map((code) => ({ roles: { code } })), error: null }),
    };
    return query;
  });
  mocks.rpc.mockResolvedValue({ data: "staff@example.test" });
  mocks.send.mockResolvedValue({ error: null });
});
it.each([401, 403])("blocks resets before data access (%s)", async (status) => {
  mocks.guard.mockRejectedValue({ status });
  expect((await POST(request(), params())).status).toBe(status);
  expect(mocks.from).not.toHaveBeenCalled(); expect(mocks.send).not.toHaveBeenCalled();
});
it("rejects malformed IDs", async () => { expect((await POST(request(), params("bad"))).status).toBe(400); expect(mocks.from).not.toHaveBeenCalled(); });
it("rejects member accounts", async () => { mocks.roles = ["MEMBER"]; expect((await POST(request(), params())).status).toBe(409); expect(mocks.send).not.toHaveBeenCalled(); });
it("blocks the current account", async () => { expect((await POST(request(), params(adminId))).status).toBe(409); expect(mocks.from).not.toHaveBeenCalled(); });
it("blocks every SUPER_ADMIN account", async () => { mocks.roles = ["SUPER_ADMIN"]; expect((await POST(request(), params())).status).toBe(409); expect(mocks.send).not.toHaveBeenCalled(); });
it.each(["EXECUTIVE_VIEWER", "PRODUCT_ADMIN"])("blocks special or incomplete role set %s", async (role) => {
  mocks.roles = [role];
  expect((await POST(request(), params())).status).toBe(409);
  expect(mocks.rpc).not.toHaveBeenCalled();
  expect(mocks.send).not.toHaveBeenCalled();
});
it("rejects organization accounts", async () => { mocks.target.primary_organization_id = "member-org"; expect((await POST(request(), params())).status).toBe(404); expect(mocks.send).not.toHaveBeenCalled(); });
it("uses only the email resolved by the server", async () => {
  const response = await POST(request(), params());
  expect(response.status).toBe(200);
  expect(mocks.rpc).toHaveBeenCalledWith("admin_get_staff_user_email", { target_user_id_input: id });
  expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({ email: "staff@example.test" }));
});
it("reports provider failures", async () => { mocks.send.mockResolvedValue({ error: new Error("provider failed") }); expect((await POST(request(), params())).status).toBe(500); });
it("does not send when email lookup fails", async () => { mocks.rpc.mockResolvedValue({ error: new Error("lookup failed") }); expect((await POST(request(), params())).status).toBe(500); expect(mocks.send).not.toHaveBeenCalled(); });
