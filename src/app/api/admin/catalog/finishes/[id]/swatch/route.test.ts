import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  guard: vi.fn(), rpc: vi.fn(), upload: vi.fn(), remove: vi.fn(), deleteEq: vi.fn(),
  oldFileId: null as string | null,
  references: [] as Array<{ id: string }>,
}));
vi.mock("@/lib/auth/session", () => ({ requireAppAccess: mocks.guard }));
vi.mock("@/lib/catalog/swatch-file", () => ({ validatedSwatchExtension: async () => "jpg" }));
vi.mock("@/lib/api/response", () => ({
  apiError: (error: { status?: number }) => Response.json({}, { status: error.status ?? 500 }),
  invalidInput: () => Response.json({}, { status: 400 }),
}));
vi.mock("@/lib/insforge/server", () => ({ createInsForgeServerClient: async () => ({ database: { rpc: mocks.rpc } }) }));
vi.mock("@/lib/insforge/admin", () => ({ createInsForgeAdminClient: () => ({
  storage: { from: () => ({ upload: mocks.upload, remove: mocks.remove }) },
  database: { from: (table: string) => {
    if (table === "finishes") {
      const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => ({ data: { id: "finish", swatch_file_id: mocks.oldFileId }, error: null }),
        limit: async () => ({ data: mocks.references, error: null }),
      };
      return chain;
    }
    const chain = {
      insert: () => chain, select: () => chain,
      single: async () => ({ data: { id: "33333333-3333-4333-8333-333333333333" }, error: null }),
      delete: () => chain, eq: mocks.deleteEq,
    };
    return chain;
  } },
}) }));

import { POST } from "./route";

describe("finish swatch upload cleanup", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.oldFileId = null;
    mocks.references = [];
    mocks.guard.mockResolvedValue({ organizationId: "org", userId: "user" });
    mocks.upload.mockResolvedValue({ data: { key: "catalog/finishes/key.jpg", url: "private" }, error: null });
    mocks.remove.mockResolvedValue({ data: null, error: null });
    mocks.deleteEq.mockResolvedValue({ data: null, error: null });
    mocks.rpc.mockResolvedValue({ data: null, error: new Error("attach failed") });
  });

  it.each([401, 403])("returns %s before uploading a swatch", async (status) => {
    mocks.guard.mockRejectedValue({ status });
    const response = await POST(new Request("http://local/swatch", { method: "POST" }) as never, {
      params: Promise.resolve({ id: "11111111-1111-4111-8111-111111111111" }),
    });
    expect(response.status).toBe(status);
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("removes the newly uploaded object and metadata when DB attach fails", async () => {
    const form = new FormData();
    form.set("file", new File([new Uint8Array([0xff, 0xd8, 0xff])], "swatch.jpg", { type: "image/jpeg" }));
    const response = await POST(new Request("http://local/swatch", { method: "POST", body: form }) as never, {
      params: Promise.resolve({ id: "11111111-1111-4111-8111-111111111111" }),
    });
    expect(response.status).toBe(500);
    expect(mocks.remove).toHaveBeenCalledWith("catalog/finishes/key.jpg");
    expect(mocks.deleteEq).toHaveBeenCalledWith("id", "33333333-3333-4333-8333-333333333333");
  });

  it("does not remove an old swatch file while another finish still references it", async () => {
    mocks.oldFileId = "44444444-4444-4444-8444-444444444444";
    mocks.references = [{ id: "other-finish" }];
    mocks.rpc.mockResolvedValue({ data: "finish", error: null });
    const form = new FormData();
    form.set("file", new File([new Uint8Array([0xff, 0xd8, 0xff])], "replacement.jpg", { type: "image/jpeg" }));
    const response = await POST(new Request("http://local/swatch", { method: "POST", body: form }) as never, {
      params: Promise.resolve({ id: "11111111-1111-4111-8111-111111111111" }),
    });
    expect(response.status).toBe(201);
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(mocks.deleteEq).not.toHaveBeenCalled();
  });
});
