import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ guard: vi.fn(), assertOrganizationPermission: vi.fn(), admin: vi.fn(), server: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({
  AppAccessError: class AppAccessError extends Error { constructor(public code: string, public status: number, message: string) { super(message); } },
  requireAppAccess: mocks.guard,
  assertOrganizationPermission: mocks.assertOrganizationPermission,
}));
vi.mock("@/lib/insforge/admin", () => ({ createInsForgeAdminClient: mocks.admin }));
vi.mock("@/lib/insforge/server", () => ({ createInsForgeServerClient: mocks.server }));
vi.mock("@/lib/api/response", () => ({
  invalidInput: () => Response.json({ code: "INVALID_INPUT" }, { status: 400 }),
  apiError: () => Response.json({ code: "ERROR" }, { status: 500 }),
}));

import { POST } from "./route";

describe("supplier payment mark-paid route", () => {
  it("rejects a malformed payment id before access or backend reads", async () => {
    const response = await POST(new Request("https://example.test", { method: "POST" }) as never, { params: Promise.resolve({ id: "bad" }) });
    expect(response.status).toBe(400);
    expect(mocks.guard).not.toHaveBeenCalled();
    expect(mocks.admin).not.toHaveBeenCalled();
  });
});
