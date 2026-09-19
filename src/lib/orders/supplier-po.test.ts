import { beforeEach, describe, expect, it, vi } from "vitest";
import { PDFArray, PDFDocument, PDFRawStream, decodePDFRawStream } from "pdf-lib";

const fixture = vi.hoisted(() => ({
  targetOrganization: "org-b",
  authorizedOrganization: "org-a",
}));
const targetPermissions = vi.hoisted(() => vi.fn(async (_permissions: string[], organizationId: string) => (
  organizationId === fixture.authorizedOrganization ? ["supplier_payments.request"] : []
)));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ requireAppAccess: vi.fn(async () => ({ active: true })) }));
vi.mock("./organization-access", () => ({ targetOrganizationPermissions: targetPermissions }));
vi.mock("@/lib/insforge/admin", () => ({ createInsForgeAdminClient: () => ({
  database: { from: (table: string) => {
    const query = {
      select: () => query,
      eq: () => query,
      in: () => query,
      order: () => query,
      limit: async () => ({ data: [], error: null }),
      maybeSingle: async () => ({ data: table === "supplier_orders" ? {
        id: "so-1", organization_id: fixture.targetOrganization, customer_order_id: "order-1", supplier_id: "supplier-1",
        supplier_order_number: "SO-1", po_number: "PO-1", status: "PO_ISSUED", supplier_currency: "CNY",
        total_factory_cost: 100, po_issued_at: "2026-09-19T00:00:00Z",
      } : table === "customer_orders" ? { id: "order-1", order_number: "ORD-1" }
        : table === "suppliers" ? { id: "supplier-1", code: "SUP-1", name: "Supplier" }
          : table === "company_settings" ? { company_name: "GISP" } : null, error: null }),
    };
    return query;
  } },
}) }));

import { buildSupplierPoPdf, loadSupplierPoDocument, SupplierPoError } from "./supplier-po";

function extractedPoMarkers(pdf: PDFDocument) {
  return pdf.getPages().flatMap((page) => {
    const contents = page.node.Contents();
    if (!contents) return [];
    const refs = contents instanceof PDFArray ? contents.asArray() : [contents];
    return refs.flatMap((ref) => {
      const stream = pdf.context.lookup(ref) as PDFRawStream;
      const content = new TextDecoder().decode(decodePDFRawStream(stream).decode());
      return [...content.matchAll(/<([0-9A-F]+)> Tj/g)]
        .map((match) => Buffer.from(match[1], "hex").toString("latin1"))
        .filter((value) => value.startsWith("PO-ROW-"));
    });
  });
}

describe("Supplier PO target-organization access", () => {
  beforeEach(() => {
    fixture.targetOrganization = "org-b";
    fixture.authorizedOrganization = "org-a";
    targetPermissions.mockClear();
  });

  it("does not let an org A role read an org B PO", async () => {
    await expect(loadSupplierPoDocument("so-1")).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" } satisfies Partial<SupplierPoError>);
    expect(targetPermissions).toHaveBeenCalledWith(["supplier_payments.request", "supplier_payments.manage"], "org-b");
  });

  it("loads the PO when has_permission grants access to the record organization", async () => {
    fixture.authorizedOrganization = "org-b";
    await expect(loadSupplierPoDocument("so-1")).resolves.toMatchObject({ supplierOrder: { id: "so-1", organization_id: "org-b" } });
  });

  it("renders all 72 PO rows into the generated PDF", async () => {
    const expected = Array.from({ length: 72 }, (_, index) => `PO-ROW-${String(index + 1).padStart(3, "0")}`);
    const bytes = await buildSupplierPoPdf({
      supplierOrder: { po_number: "PO-72", po_issued_at: "2026-09-19T00:00:00Z", supplier_order_number: "SO-1", supplier_currency: "CNY", total_factory_cost: 7200 },
      supplier: { code: "SUP-1", name: "โรงงาน", legal_name: "Factory", contact_name: "A", contact_phone: "1", contact_email: "a@example.com" },
      customerOrder: { order_number: "ORD-1" },
      company: { company_name: "GISP", company_legal_name: "GISP", tax_id: "1", address: "Bangkok", company_email: "a@example.com" },
      items: expected.map((_, index) => ({ id: `link-${index}`, order_item_id: `item-${index}`, quantity: 1, factory_unit_cost_snapshot: 100, factory_line_total: 100, orderItem: { id: `item-${index}`, item_name_snapshot: `สินค้า ${index + 1}`, specification_snapshot: "รายละเอียดภาษาไทย".repeat(8), options_snapshot: [{ label: "สีไม้ธรรมชาติ" }], unit: "ชิ้น" } })),
    } as never);
    const pdf = await PDFDocument.load(bytes);
    expect(extractedPoMarkers(pdf)).toEqual(expected);
  }, 20_000);
});
