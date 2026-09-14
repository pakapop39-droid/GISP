import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ guard: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireAppAccess: mocks.guard }));
vi.mock("@/lib/catalog/finish-schema", () => ({ finishLibraryActionSchema: { safeParse: (value: { action?: string }) => value?.action
  ? { success: true, data: value }
  : { success: false, error: { flatten: () => ({ fieldErrors: {} }) } } } }));
vi.mock("@/lib/insforge/server", () => ({ createInsForgeServerClient: async () => ({ database: { rpc: mocks.rpc } }) }));
vi.mock("@/lib/insforge/admin", () => ({ createInsForgeAdminClient: vi.fn() }));
vi.mock("@/lib/api/response", () => ({
  apiError: (error: { status?: number }) => Response.json({}, { status: error.status ?? 500 }),
  invalidInput: (details?: unknown) => Response.json({ details }, { status: 400 }),
}));

import { POST } from "./route";

const uuid = "11111111-1111-4111-8111-111111111111";
const collection = {
  action: "CREATE_COLLECTION", supplierId: uuid, code: "A9", nameTh: "ชุดสี A9",
  nameZh: null, materialCategory: null, sourceDocument: "catalog.pdf", sourceVersion: null,
};

describe("admin finish mutation route", () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.guard.mockResolvedValue({}); });

  it.each([401, 403])("returns %s before calling the RPC", async (status) => {
    mocks.guard.mockRejectedValue({ status });
    const response = await POST(new Request("http://local/api", { method: "POST", body: JSON.stringify(collection), headers: { "Content-Type": "application/json" } }) as never);
    expect(response.status).toBe(status);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid action payload", async () => {
    const response = await POST(new Request("http://local/api", { method: "POST", body: "{}", headers: { "Content-Type": "application/json" } }) as never);
    expect(response.status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it.each([
    ["DUPLICATE_FINISH_CODE", { ...collection }],
    ["FINISH_NOT_AVAILABLE", { action: "MAP_FINISH", optionValueId: uuid, finishId: "22222222-2222-4222-8222-222222222222" }],
  ])("returns 409 for %s", async (message, payload) => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message } });
    const response = await POST(new Request("http://local/api", { method: "POST", body: JSON.stringify(payload), headers: { "Content-Type": "application/json" } }) as never);
    expect(response.status).toBe(409);
  });
});
