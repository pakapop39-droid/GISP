import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ guard: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireAppAccess: mocks.guard }));
vi.mock("@/lib/env", () => ({ getServerEnv: () => ({ INSFORGE_API_KEY: "server-only-preview-signing-key" }) }));
vi.mock("@/lib/api/response", () => ({ apiError: (error: { status?: number }) => Response.json({}, { status: error.status ?? 500 }) }));
vi.mock("@/lib/catalog/finish-import", () => ({
  readFinishImportFile: async () => [{ rowNumber: 2, source: {
    collection_code: "A9", collection_name_th: "ชุดสี A9", collection_name_zh: "",
    finish_code: "A9-1", finish_name_th: "สี A9-1", finish_name_zh: "", material: "",
    color_hex: "", source_document: "catalog.pdf", source_version: "", source_page: "1",
  } }],
  validateFinishImportRows: ({ rows }: { rows: unknown[] }) => rows.map((row) => ({ ...(row as object), errors: [] })),
}));
vi.mock("@/lib/catalog/finish-import-preview", () => ({
  createFinishImportPreviewToken: ({ fileBytes, supplierId }: { fileBytes: Uint8Array; supplierId: string }) => ({
    previewToken: `${supplierId}:${Buffer.from(fileBytes).toString("base64")}`, expiresAt: Date.now() + 60_000,
  }),
  verifyFinishImportPreviewToken: ({ previewToken, fileBytes, supplierId }: { previewToken: string; fileBytes: Uint8Array; supplierId: string }) =>
    previewToken === `${supplierId}:${Buffer.from(fileBytes).toString("base64")}`,
}));

vi.mock("@/lib/insforge/server", () => ({ createInsForgeServerClient: async () => ({ database: { from: (table: string) => {
  const result = table === "suppliers"
    ? { data: { id: "11111111-1111-4111-8111-111111111111" }, error: null }
    : { data: [], error: null };
  const chain = { select: () => chain, eq: () => chain, in: () => chain, order: () => chain,
    limit: async () => result, maybeSingle: async () => result };
  return chain;
}, rpc: mocks.rpc } }) }));

import { POST } from "./route";

const supplierId = "11111111-1111-4111-8111-111111111111";
const csv = "collection_code,collection_name_th,finish_code,finish_name_th,source_document,source_page\r\nA9,ชุดสี A9,A9-1,สี A9-1,catalog.pdf,1";
function request(input: { confirmed?: boolean; token?: string; supplier?: string; body?: string } = {}) {
  const form = new FormData();
  form.set("file", new File([input.body ?? csv], "finishes.csv", { type: "text/csv" }));
  form.set("supplierId", input.supplier ?? supplierId);
  form.set("confirmed", String(input.confirmed ?? false));
  if (input.token) form.set("previewToken", input.token);
  return new Request("http://local/api/admin/catalog/finishes/import", { method: "POST", body: form }) as never;
}

describe("finish manifest two-step route", () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.guard.mockResolvedValue({}); mocks.rpc.mockResolvedValue({ data: { imported: 1, status: "DRAFT" }, error: null }); });

  it.each([401, 403])("returns %s before reading or importing the manifest", async (status) => {
    mocks.guard.mockRejectedValue({ status });
    const response = await POST(new Request("http://local/api/admin/catalog/finishes/import", { method: "POST" }) as never);
    expect(response.status).toBe(status);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("does not allow confirmed=true on the first request", async () => {
    const response = await POST(request({ confirmed: true }));
    expect(response.status).toBe(409);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("issues a preview token and imports only the exact same file and supplier", async () => {
    const previewResponse = await POST(request());
    const preview = await previewResponse.json();
    expect(preview.data.previewToken).toEqual(expect.any(String));

    const mismatch = await POST(request({ confirmed: true, token: preview.data.previewToken, body: `${csv}\r\n` }));
    expect(mismatch.status).toBe(409);
    expect(mocks.rpc).not.toHaveBeenCalled();

    const confirmed = await POST(request({ confirmed: true, token: preview.data.previewToken }));
    expect(confirmed.status).toBe(201);
    expect(mocks.rpc).toHaveBeenCalledOnce();
  });
});
