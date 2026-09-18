import { describe, expect, it } from "vitest";
import type { OrderDetail } from "./types";
import { projectOrderDetailForRelease } from "./release-projection";

const detail = {
  order: { id: "order-1", status: "DEPOSIT_VERIFIED" },
  items: [{ id: "item-1", item_name_snapshot: "Desk", qc_status: "QC_SECRET", custom_member_approved_at: "QC_APPROVAL_SECRET" }],
  schedules: [
    { id: "deposit-1", schedule_type: "DEPOSIT", transfers: [] },
    { id: "freight-1", schedule_type: "FREIGHT", transfers: [{ transfer_number: "FREIGHT_TRANSFER_SECRET" }] },
  ],
  cancellations: [], events: [],
  productionUpdates: [{ note: "PRODUCTION_SECRET" }],
  qcInspections: [{ note: "QC_INSPECTION_SECRET" }],
  qcReopenEvents: [{ reason: "QC_REOPEN_SECRET" }],
  dispatchGates: [{ status: "DISPATCH_GATE_SECRET" }],
  logistics: {
    prerequisites: { warehouses: [{ warehouse_name: "WAREHOUSE_SECRET" }], receiptSources: [] },
    receipts: [], consolidations: [], shipments: [{ shipment_name: "SHIPMENT_SECRET" }],
    costs: [], invoice: { invoice_number: "FREIGHT_INVOICE_SECRET" },
  },
  supplierOrders: [{ id: "po-1", productionUpdates: [{ note: "NESTED_PRODUCTION_SECRET" }] }],
  capabilities: {
    manageOrder: true, viewSalesAmounts: true, viewCustomerPaymentStatus: true,
    manageCustomerPayments: true, requestSupplierPayment: true, manageSupplierPayments: true,
    manageProduction: true, manageQc: true, manageLogistics: true,
    manageWarehouseAndShipment: true, manageFreight: true,
  },
} as unknown as OrderDetail;

describe("shared Member/Admin Order release projection", () => {
  it("exposes only C Order/Payment and hides D7/D8 data and Freight schedule", () => {
    const c = projectOrderDetailForRelease(detail, { productionQc: false, logistics: false });
    expect(c.schedules.map((schedule) => schedule.schedule_type)).toEqual(["DEPOSIT"]);
    expect(c.productionUpdates).toEqual([]);
    expect(c.qcInspections).toEqual([]);
    expect(c.qcReopenEvents).toEqual([]);
    expect(c.dispatchGates).toEqual([]);
    expect(c.logistics.shipments).toEqual([]);
    expect(c.logistics.invoice).toBeNull();
    expect(c.supplierOrders?.[0].productionUpdates).toEqual([]);
    expect(c.capabilities).toMatchObject({ manageProduction: false, manageQc: false, manageLogistics: false, manageFreight: false });
    expect(c.items[0]).not.toHaveProperty("qc_status");
    expect(c.items[0]).not.toHaveProperty("custom_member_approved_at");
    expect(JSON.stringify(c)).not.toMatch(/SECRET/);
    expect(detail.schedules).toHaveLength(2); // projection never mutates loaded data
  });

  it("shows D7 QC while keeping D8 Shipment/Freight closed", () => {
    const d7 = projectOrderDetailForRelease(detail, { productionQc: true, logistics: false });
    expect(d7.productionUpdates).toHaveLength(1);
    expect(d7.qcInspections).toHaveLength(1);
    expect(d7.schedules.map((schedule) => schedule.schedule_type)).toEqual(["DEPOSIT"]);
    expect(d7.logistics.shipments).toEqual([]);
    expect(d7.capabilities).toMatchObject({ manageQc: true, manageLogistics: false });
  });

  it("shows D8 logistics and Freight only after D8", () => {
    const d8 = projectOrderDetailForRelease(detail, { productionQc: true, logistics: true });
    expect(d8.schedules.map((schedule) => schedule.schedule_type)).toEqual(["DEPOSIT", "FREIGHT"]);
    expect(d8.logistics.shipments).toHaveLength(1);
    expect(d8.logistics.invoice?.invoice_number).toBe("FREIGHT_INVOICE_SECRET");
    expect(d8.capabilities).toMatchObject({ manageQc: true, manageLogistics: true, manageFreight: true });
  });
});
