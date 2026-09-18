import { beforeEach, describe, expect, it, vi } from "vitest";

const shipmentId = "11111111-1111-4111-8111-111111111111";
const organizationId = "22222222-2222-4222-8222-222222222222";
const orderId = "33333333-3333-4333-8333-333333333333";
const memberProfileId = "44444444-4444-4444-8444-444444444444";
const fileId = "55555555-5555-4555-8555-555555555555";

const mocks = vi.hoisted(() => ({
  guard: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
  metadataError: null as Error | null,
  insertPayload: null as null | Record<string, unknown>,
  buckets: [] as string[],
  tables: [] as string[],
  sliceVisible: vi.fn(),
}));

vi.mock("@/lib/release-stage", () => ({ isOrderOperationSliceVisible: mocks.sliceVisible }));

vi.mock("@/lib/auth/session", () => ({
  AppAccessError: class AppAccessError extends Error {
    constructor(public code: string, public status: number, message: string) { super(message); }
  },
  requireAppAccess: mocks.guard,
}));

vi.mock("@/lib/api/response", () => ({
  apiError: (error: { status?: number; code?: string; message?: string }) => Response.json({
    code: error.code ?? "SERVER_ERROR",
    message: error.message ?? "error",
  }, { status: error.status ?? 500 }),
}));

vi.mock("@/lib/insforge/admin", () => ({
  createInsForgeAdminClient: () => ({
    storage: { from: (bucket: string) => {
      mocks.buckets.push(bucket);
      return { upload: mocks.upload, remove: mocks.remove };
    } },
    database: { from: (table: string) => {
      mocks.tables.push(table);
      if (table === "shipments") {
        const query = {
          select: () => query,
          eq: () => query,
          maybeSingle: async () => ({
            data: { id: shipmentId, organization_id: organizationId, customer_order_id: orderId },
            error: null,
          }),
        };
        return query;
      }
      if (table === "customer_orders") {
        const query = {
          select: () => query,
          eq: () => query,
          maybeSingle: async () => ({ data: { member_profile_id: memberProfileId }, error: null }),
        };
        return query;
      }
      const query = {
        insert: (rows: Record<string, unknown>[]) => {
          mocks.insertPayload = rows[0];
          return query;
        },
        select: () => query,
        single: async () => ({
          data: mocks.metadataError ? null : {
            id: fileId,
            original_name: "customs.pdf",
            mime_type: "application/pdf",
            size_bytes: 5,
          },
          error: mocks.metadataError,
        }),
      };
      return query;
    } },
  }),
}));

import { POST } from "./route";

function request(options?: { type?: string; scopedOrganizationId?: string | null }) {
  mocks.guard.mockResolvedValue({
    userId: "logistics-user",
    organizationId: options?.scopedOrganizationId ?? null,
    permissions: ["shipments.manage"],
  });
  const type = options?.type ?? "application/pdf";
  const name = type === "image/webp" ? "customs.webp" : "customs.pdf";
  const form = new FormData();
  form.set("file", new File(["proof"], name, { type }));
  form.set("kind", "CUSTOMS_ENTRY");
  form.set("entityId", shipmentId);
  return new Request("http://localhost/api/admin/operations-media", { method: "POST", body: form }) as never;
}

describe("ISS-02 customs evidence upload", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.metadataError = null;
    mocks.insertPayload = null;
    mocks.buckets = [];
    mocks.tables = [];
    mocks.sliceVisible.mockReturnValue(true);
    mocks.upload.mockResolvedValue({ data: { key: "server-key.pdf", url: null }, error: null });
    mocks.remove.mockResolvedValue({ data: null, error: null });
  });

  it("stores customs evidence confidentially and binds it to the member through the shipment", async () => {
    const response = await POST(request());

    expect(response.status).toBe(201);
    expect(mocks.upload).toHaveBeenCalledWith(
      expect.stringMatching(new RegExp(`^${organizationId}/operations/customs-entry/${shipmentId}/.+\\.pdf$`)),
      expect.any(File),
    );
    expect(mocks.buckets).toContain("gisp-confidential");
    expect(mocks.insertPayload).toMatchObject({
      organization_id: organizationId,
      member_profile_id: null,
      bucket: "gisp-confidential",
      visibility: "CONFIDENTIAL",
      entity_type: "CUSTOMS_ENTRY",
      entity_id: shipmentId,
      uploaded_by: "logistics-user",
    });
    expect(mocks.tables).toContain("customer_orders");
  });

  it("blocks D8 customs evidence during D7 before reading a shipment or uploading", async () => {
    mocks.sliceVisible.mockImplementation((slice: number) => slice === 7);
    const response = await POST(request());
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: "RELEASE_NOT_ENABLED" });
    expect(mocks.tables).toEqual([]);
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("rejects users without shipments.manage before reading the shipment or uploading", async () => {
    const req = request();
    mocks.guard.mockResolvedValue({ userId: "qc-user", organizationId: null, permissions: ["qc.manage"] });

    expect((await POST(req)).status).toBe(403);
    expect(mocks.tables).toEqual([]);
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("rejects a staff user scoped to another organization", async () => {
    expect((await POST(request({ scopedOrganizationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }))).status).toBe(403);
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("allows only PDF, JPG, and PNG for customs evidence", async () => {
    expect((await POST(request({ type: "image/webp" }))).status).toBe(400);
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("removes the confidential object if metadata creation fails", async () => {
    mocks.metadataError = new Error("metadata failed");

    expect((await POST(request())).status).toBe(500);
    expect(mocks.remove).toHaveBeenCalledWith("server-key.pdf");
  });
});
