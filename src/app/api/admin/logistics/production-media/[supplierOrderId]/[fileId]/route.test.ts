import { beforeEach, describe, expect, it, vi } from "vitest";

const fixtures = vi.hoisted(() => ({
  authorizedOrg: "org-1",
  supplierOrg: "org-1",
  fileOrg: "org-1",
  linkUpdateIds: ["up-1"] as string[],
  matchingUpdateIds: ["up-1"] as string[],
}));
const permission = vi.hoisted(() => vi.fn(async (_permission: string, targetOrg: string) => targetOrg === fixtures.authorizedOrg));
vi.mock("@/lib/auth/session", () => ({ requireAppAccess: vi.fn(async () => ({ active: true })) }));
vi.mock("@/lib/orders/organization-access", () => ({ hasTargetOrganizationPermission: permission }));
vi.mock("@/lib/api/response", async () => { const { NextResponse } = await import("next/server"); return { apiError: (error: { status?: number; code?: string; message?: string }) => NextResponse.json({ code: error.code, message: error.message }, { status: error.status ?? 500 }) }; });
vi.mock("@/lib/insforge/admin", () => ({ createInsForgeAdminClient: () => ({
  database: { from: (table: string) => {
    const query = {
      select: () => query,
      eq: () => query,
      in: () => query,
      limit: async () => ({ data: table === "production_update_files"
        ? fixtures.linkUpdateIds.map((production_update_id) => ({ production_update_id, file_id: "file-1" }))
        : table === "production_updates"
          ? fixtures.matchingUpdateIds.map((id) => ({ id, supplier_order_id: "so-1" }))
          : [], error: null }),
      maybeSingle: async () => ({ data: table === "supplier_orders" ? { id: "so-1", organization_id: fixtures.supplierOrg, customer_order_id: "order-1" }
        : table === "customer_orders" ? { id: "order-1", organization_id: fixtures.supplierOrg }
          : table === "file_metadata" ? { id: "file-1", organization_id: fixtures.fileOrg, bucket: "private", object_key: "progress.jpg" }
            : null, error: null }),
    };
    return query;
  } },
  storage: { from: () => ({ createSignedUrl: async () => ({ data: { signedUrl: "https://signed.example/progress.jpg" }, error: null }) }) },
}) }));
import { GET, productionMediaReferencesMatch } from "./route";

describe("Logistics production media", () => {
  beforeEach(() => {
    fixtures.authorizedOrg = "org-1";
    fixtures.supplierOrg = "org-1";
    fixtures.fileOrg = "org-1";
    fixtures.linkUpdateIds = ["up-1"];
    fixtures.matchingUpdateIds = ["up-1"];
    permission.mockClear();
  });

  it("requires every related record and a linked update for the target Supplier Order", () => {
    expect(productionMediaReferencesMatch({ supplierOrderOrganizationId: "org-1", customerOrderOrganizationId: "org-1", hasMatchingProductionUpdate: true, fileOrganizationId: "org-1" })).toBe(true);
    expect(productionMediaReferencesMatch({ supplierOrderOrganizationId: "org-1", customerOrderOrganizationId: "org-1", hasMatchingProductionUpdate: false, fileOrganizationId: "org-1" })).toBe(false);
  });

  it("redirects when shipments.manage is granted for the target organization", async () => {
    const response = await GET(new Request("http://localhost"), { params: Promise.resolve({ supplierOrderId: "so-1", fileId: "file-1" }) });
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://signed.example/progress.jpg");
    expect(permission).toHaveBeenCalledWith("shipments.manage", "org-1");
  });

  it("selects the target Supplier Order safely when the same file has multiple links", async () => {
    fixtures.linkUpdateIds = ["up-other-order", "up-1"];
    fixtures.matchingUpdateIds = ["up-1"];
    const response = await GET(new Request("http://localhost"), { params: Promise.resolve({ supplierOrderId: "so-1", fileId: "file-1" }) });
    expect(response.status).toBe(307);
  });

  it("returns 404 when none of a file's links belongs to the requested Supplier Order", async () => {
    fixtures.linkUpdateIds = ["up-other-1", "up-other-2"];
    fixtures.matchingUpdateIds = [];
    const response = await GET(new Request("http://localhost"), { params: Promise.resolve({ supplierOrderId: "so-1", fileId: "file-1" }) });
    expect(response.status).toBe(404);
  });

  it("does not let an org A logistics role download an org B file", async () => {
    fixtures.supplierOrg = "org-b";
    const response = await GET(new Request("http://localhost"), { params: Promise.resolve({ supplierOrderId: "so-1", fileId: "file-1" }) });
    expect(response.status).toBe(404);
    expect(permission).toHaveBeenCalledWith("shipments.manage", "org-b");
  });

  it("returns 404 for file metadata from another organization", async () => {
    fixtures.fileOrg = "org-2";
    const response = await GET(new Request("http://localhost"), { params: Promise.resolve({ supplierOrderId: "so-1", fileId: "file-1" }) });
    expect(response.status).toBe(404);
  });
});
