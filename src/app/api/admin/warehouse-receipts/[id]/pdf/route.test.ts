import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ load: vi.fn(), build: vi.fn() }));
vi.mock("@/lib/orders/warehouse-receipt", () => ({ loadWarehouseReceiptDocument: mocks.load, buildWarehouseReceiptPdf: mocks.build, WarehouseReceiptError: class extends Error { constructor(public status: 404, message: string) { super(message); } } }));
vi.mock("@/lib/api/response", () => ({ apiError: () => new Response(null, { status: 500 }) }));
import { GET } from "./route";
describe("warehouse receipt PDF route", () => {
  beforeEach(() => { mocks.load.mockReset(); mocks.build.mockReset(); });
  it("returns an on-demand no-store PDF", async () => {
    mocks.load.mockResolvedValue({ receipt: { receipt_number: "WRC-2026-1" } }); mocks.build.mockResolvedValue(new Uint8Array([37, 80, 68, 70]));
    const response = await GET(new Request("http://localhost"), { params: Promise.resolve({ id: "receipt" }) });
    expect(response.status).toBe(200); expect(response.headers.get("content-type")).toBe("application/pdf"); expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
  it("returns 404 without exposing cross-organization existence", async () => {
    const { WarehouseReceiptError } = await import("@/lib/orders/warehouse-receipt"); mocks.load.mockRejectedValue(new WarehouseReceiptError(404, "ไม่พบใบรับเข้าคลัง"));
    expect((await GET(new Request("http://localhost"), { params: Promise.resolve({ id: "other-org" }) })).status).toBe(404);
  });
});
