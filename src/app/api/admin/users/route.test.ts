import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ guard: vi.fn(), list: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireSuperAdmin: mocks.guard }));
vi.mock("@/lib/auth/internal-users", () => ({ listInternalUsers: mocks.list }));
vi.mock("@/lib/auth/internal-user-schema", () => ({ internalUserCreateSchema: {} }));
vi.mock("@/lib/auth/staff-job-groups", () => ({ rolesForStaffJobGroup: vi.fn() }));
vi.mock("@/lib/insforge/admin", () => ({ createInsForgeAdminClient: vi.fn() }));
vi.mock("@/lib/insforge/server", () => ({ createInsForgeServerClient: vi.fn() }));
vi.mock("@/lib/api/response", () => ({ apiError: (error: { status?: number }) => Response.json({}, { status: error.status ?? 500 }), invalidInput: vi.fn() }));
import { GET } from "./route";
beforeEach(() => { vi.resetAllMocks(); mocks.list.mockResolvedValue([{ id: "staff", email: "staff@example.test" }]); });
it.each([401, 403])("blocks listing before any data access (%s)", async (status) => {
  mocks.guard.mockRejectedValue({ status });
  expect((await GET()).status).toBe(status);
  expect(mocks.list).not.toHaveBeenCalled();
});
it("returns the list without allowing caches", async () => {
  const response = await GET();
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toEqual({ data: [{ id: "staff", email: "staff@example.test" }] });
});
it("reports a database failure instead of an empty list", async () => {
  mocks.list.mockRejectedValue(new Error("offline"));
  expect((await GET()).status).toBe(500);
});
