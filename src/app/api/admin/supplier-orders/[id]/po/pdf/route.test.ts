import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ load: vi.fn(), build: vi.fn() }));
vi.mock("@/lib/orders/supplier-po", () => ({
  loadSupplierPoDocument: mocks.load,
  buildSupplierPoPdf: mocks.build,
  SupplierPoError: class SupplierPoError extends Error { constructor(public status: number, public code: string, message: string) { super(message); } },
}));
vi.mock("@/lib/api/response", () => ({ apiError: () => new Response(null, { status: 500 }) }));
import { GET } from "./route";

describe("Supplier PO PDF route", () => {
  beforeEach(() => { mocks.load.mockReset(); mocks.build.mockReset(); });
  it("returns an on-demand PDF with private no-store headers", async () => {
    mocks.load.mockResolvedValue({ supplierOrder: { po_number: "PO-2026-1" } });
    mocks.build.mockResolvedValue(new Uint8Array([37, 80, 68, 70]));
    const response = await GET(new Request("http://localhost"), { params: Promise.resolve({ id: "supplier-order" }) });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
  it("preserves the 409 response when PO is not issued", async () => {
    const { SupplierPoError } = await import("@/lib/orders/supplier-po");
    mocks.load.mockRejectedValue(new SupplierPoError(409, "PO_NOT_ISSUED", "ยังไม่ออก PO"));
    const response = await GET(new Request("http://localhost"), { params: Promise.resolve({ id: "draft" }) });
    expect(response.status).toBe(409);
  });
});
