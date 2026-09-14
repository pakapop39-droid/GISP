import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ roles: ["SUPER_ADMIN"], status: "ACTIVE", loggedIn: true }));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => state.loggedIn ? { value: "test-session" } : undefined }), headers: vi.fn() }));
vi.mock("@/lib/auth/cookies", () => ({ APP_SESSION_COOKIE: "gisp_app_session" }));
vi.mock("@/lib/auth/policy", () => ({ isStaffRole: (role: string) => role !== "MEMBER", hasAllPermissions: () => true, accessHome: vi.fn() }));
vi.mock("@/lib/insforge/server", () => ({ createInsForgeServerClient: async () => ({
  auth: { getCurrentUser: async () => ({ data: { user: { id: "owner" } } }) },
  database: { rpc: async () => ({ data: { roles: state.roles, userStatus: state.status, applicationStatus: "APPROVED" } }) },
}) }));
import { requireSuperAdmin } from "./session";
beforeEach(() => { state.roles = ["SUPER_ADMIN"]; state.status = "ACTIVE"; state.loggedIn = true; });
it("allows the owner", async () => { await expect(requireSuperAdmin()).resolves.toMatchObject({ roles: ["SUPER_ADMIN"] }); });
it.each(["MEMBER", "MEMBER_ADMIN", "PRODUCT_ADMIN", "ORDER_ADMIN", "PURCHASING", "FINANCE", "QC", "LOGISTICS", "EXECUTIVE_VIEWER"])("denies %s even with all permissions", async (role) => {
  state.roles = [role];
  await expect(requireSuperAdmin()).rejects.toMatchObject({ status: 403 });
});
it("denies signed-out users", async () => { state.loggedIn = false; await expect(requireSuperAdmin()).rejects.toMatchObject({ status: 401 }); });
it("denies suspended owners", async () => { state.status = "SUSPENDED"; await expect(requireSuperAdmin()).rejects.toMatchObject({ status: 403 }); });
