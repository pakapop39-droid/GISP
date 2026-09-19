import { beforeEach, describe, expect, it, vi } from "vitest";

const fixtures = vi.hoisted(() => ({ authorizedOrg: "org-1", supplierOrg: "org-1", updateSupplierOrderId: "so-1", fileOrg: "org-1" }));
const permission = vi.hoisted(() => vi.fn(async (_permission: string, targetOrg: string) => targetOrg === fixtures.authorizedOrg));
vi.mock("@/lib/auth/session", () => ({ requireAppAccess: vi.fn(async () => ({ active: true })) }));
vi.mock("@/lib/orders/organization-access", () => ({ hasTargetOrganizationPermission: permission }));
vi.mock("@/lib/api/response", async () => { const { NextResponse } = await import("next/server"); return { apiError: (error: { status?: number; code?: string; message?: string }) => NextResponse.json({ code: error.code, message: error.message }, { status: error.status ?? 500 }) }; });
vi.mock("@/lib/insforge/admin", () => ({ createInsForgeAdminClient: () => ({
  database: { from: (table: string) => { const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: table === "supplier_orders" ? { id: "so-1", organization_id: fixtures.supplierOrg, customer_order_id: "order-1" } : table === "customer_orders" ? { id: "order-1", organization_id: fixtures.supplierOrg } : table === "production_update_files" ? { production_update_id: "up-1", file_id: "file-1" } : table === "production_updates" ? { id: "up-1", supplier_order_id: fixtures.updateSupplierOrderId } : { id: "file-1", organization_id: fixtures.fileOrg, bucket: "private", object_key: "progress.jpg" }, error: null }) }; return query; } },
  storage: { from: () => ({ createSignedUrl: async () => ({ data: { signedUrl: "https://signed.example/progress.jpg" }, error: null }) }) },
}) }));
import { GET, productionMediaReferencesMatch } from "./route";

describe("Logistics production media", () => {
  beforeEach(() => {
    fixtures.authorizedOrg = "org-1";
    fixtures.supplierOrg = "org-1";
    fixtures.updateSupplierOrderId = "so-1";
    fixtures.fileOrg = "org-1";
    permission.mockClear();
  });

  it("requires every related record to match the Supplier Order organization", () => {
    expect(productionMediaReferencesMatch({ supplierOrderOrganizationId: "org-1", customerOrderOrganizationId: "org-1", supplierOrderId: "so-1", updateSupplierOrderId: "so-1", fileOrganizationId: "org-1" })).toBe(true);
    expect(productionMediaReferencesMatch({ supplierOrderOrganizationId: "org-1", customerOrderOrganizationId: "org-2", supplierOrderId: "so-1", updateSupplierOrderId: "so-1", fileOrganizationId: "org-1" })).toBe(false);
  });

  it("redirects when shipments.manage is granted for the target organization", async () => {
    const response = await GET(new Request("http://localhost"), { params: Promise.resolve({ supplierOrderId: "so-1", fileId: "file-1" }) });
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://signed.example/progress.jpg");
    expect(permission).toHaveBeenCalledWith("shipments.manage", "org-1");
  });

  it("does not let an org A logistics role download an org B file", async () => {
    fixtures.supplierOrg = "org-b";
    const response = await GET(new Request("http://localhost"), { params: Promise.resolve({ supplierOrderId: "so-1", fileId: "file-1" }) });
    expect(response.status).toBe(404);
    expect(permission).toHaveBeenCalledWith("shipments.manage", "org-b");
  });

  it("returns 404 for a file linked to another organization", async () => {
    fixtures.fileOrg = "org-2";
    const response = await GET(new Request("http://localhost"), { params: Promise.resolve({ supplierOrderId: "so-1", fileId: "file-1" }) });
    expect(response.status).toBe(404);
  });
});
