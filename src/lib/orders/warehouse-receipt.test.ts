import { PDFArray, PDFDocument, PDFRawStream, decodePDFRawStream } from "pdf-lib";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({ targetOrganization: "org-b", authorizedOrganization: "org-a" }));
const permission = vi.hoisted(() => vi.fn(async (_permission: string, organizationId: string) => organizationId === fixture.authorizedOrganization));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ requireAppAccess: vi.fn(async () => ({ active: true })) }));
vi.mock("./organization-access", () => ({ hasTargetOrganizationPermission: permission }));
vi.mock("@/lib/insforge/admin", () => ({ createInsForgeAdminClient: () => ({
  database: { from: (table: string) => {
    const query = {
      select: () => query,
      eq: () => query,
      in: () => query,
      order: () => query,
      limit: async () => ({ data: [], error: null }),
      maybeSingle: async () => ({ data: table === "warehouse_receipts" ? {
        id: "receipt-1", organization_id: fixture.targetOrganization, warehouse_id: "warehouse-1", supplier_order_id: "so-1", customer_order_id: "order-1", receipt_number: "WRC-1", status: "RECEIVED", received_at: "2026-09-19T00:00:00Z", package_count: 1, actual_weight_kg: 1, actual_cbm: 1, note: null,
      } : table === "warehouses" ? { id: "warehouse-1", warehouse_code: "WH-1", warehouse_name: "Warehouse" }
        : table === "supplier_orders" ? { id: "so-1", supplier_order_number: "SO-1", po_number: "PO-1" }
          : table === "customer_orders" ? { id: "order-1", order_number: "ORD-1" }
            : table === "company_settings" ? { company_name: "GISP" } : null, error: null }),
    };
    return query;
  } },
}) }));

import { buildWarehouseReceiptPdf, loadWarehouseReceiptDocument } from "./warehouse-receipt";

function extractedReceiptMarkers(pdf: PDFDocument) {
  return pdf.getPages().flatMap((page) => {
    const contents = page.node.Contents();
    if (!contents) return [];
    const refs = contents instanceof PDFArray ? contents.asArray() : [contents];
    return refs.flatMap((ref) => {
      const stream = pdf.context.lookup(ref) as PDFRawStream;
      const content = new TextDecoder().decode(decodePDFRawStream(stream).decode());
      return [...content.matchAll(/<([0-9A-F]+)> Tj/g)]
        .map((match) => Buffer.from(match[1], "hex").toString("latin1"))
        .filter((value) => value.startsWith("WRC-ROW-"));
    });
  });
}

describe("warehouse receipt target-organization access", () => {
  beforeEach(() => {
    fixture.targetOrganization = "org-b";
    fixture.authorizedOrganization = "org-a";
    permission.mockClear();
  });

  it("does not let an org A role read an org B receipt", async () => {
    await expect(loadWarehouseReceiptDocument("receipt-1")).rejects.toMatchObject({ status: 404 });
    expect(permission).toHaveBeenCalledWith("shipments.manage", "org-b");
  });

  it("loads the receipt when shipments.manage is granted for its organization", async () => {
    fixture.authorizedOrganization = "org-b";
    await expect(loadWarehouseReceiptDocument("receipt-1")).resolves.toMatchObject({ receipt: { id: "receipt-1", organization_id: "org-b" } });
  });

  it("renders all 72 receipt rows into the generated PDF", async () => {
    const expected = Array.from({ length: 72 }, (_, index) => `WRC-ROW-${String(index + 1).padStart(3, "0")}`);
    const bytes = await buildWarehouseReceiptPdf({
      receipt: { receipt_number: "WRC-72", received_at: "2026-09-19T00:00:00Z", status: "RECEIVED", package_count: 72, actual_weight_kg: 100, actual_cbm: 10, note: "ครบ" },
      warehouse: { warehouse_code: "WH-1", warehouse_name: "คลัง", country_code: "TH", address: { city: "Bangkok" } },
      supplierOrder: { supplier_order_number: "SO-1", po_number: "PO-1" },
      customerOrder: { order_number: "ORD-1" },
      company: { company_name: "GISP", company_legal_name: "GISP", tax_id: "1", address: "Bangkok", company_email: "a@example.com" },
      items: expected.map((_, index) => ({ id: `receipt-item-${index}`, order_item_id: `item-${index}`, expected_quantity: 1, received_quantity: 1, released_quantity: 0, blocked_quantity: 0, condition: "GOOD", discrepancy_note: null, orderItem: { id: `item-${index}`, item_name_snapshot: `สินค้า ${index + 1}`, specification_snapshot: "รายละเอียดภาษาไทย".repeat(8), options_snapshot: [{ label: "สีไม้ธรรมชาติ" }], unit: "ชิ้น" } })),
    } as never);
    const pdf = await PDFDocument.load(bytes);
    expect(extractedReceiptMarkers(pdf)).toEqual(expected);
  }, 20_000);
});
