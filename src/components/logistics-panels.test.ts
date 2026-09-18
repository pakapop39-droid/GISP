import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/lib/orders/admin-access", () => ({
  allAdminOrderCapabilities: {},
}));

vi.mock("@/lib/orders/types", () => ({
  formatOrderMoney: (value: number | string) => String(value),
}));

import {
  AdminLogisticsPanel,
  consolidationReadyBatches,
  shipmentStatusLabel,
  trackingStatusLabel,
  warehouseReleaseAvailable,
} from "./logistics-panels";
import type { LogisticsDetail, OrderDetail, WarehouseReceiptItem } from "@/lib/orders/types";

const receiptItem: WarehouseReceiptItem = {
  id: "receipt-item-1",
  supplier_order_item_id: "supplier-item-1",
  order_item_id: "order-item-1",
  expected_quantity: 3,
  received_quantity: 3,
  released_quantity: 2,
  blocked_quantity: 1,
  condition: "GOOD",
};

describe("DR-019 logistics presentation helpers", () => {
  it("requires real shipment, contact, driver, POD and freight input without UAT prefills", () => {
    const shipment = {
      id: "shipment-1", shipment_number: "SHP-2026-000001", shipment_name: "Current",
      shipment_type: "CONSOLIDATED", status: "READY_FOR_DELIVERY", tracking_number: null,
      estimated_arrival_at: null, items: [], history: [], deliveries: [], partialDecision: null,
    };
    const delivery = {
      id: "delivery-1", delivery_number: "DLV-2026-000001", status: "OUT_FOR_DELIVERY",
      scheduled_at: null, contact_name: "Actual contact", items: [], reschedules: [], evidence: [],
    };
    const data = {
      order: { id: "order-1", order_number: "ORD-2026-000001", currency: "THB" },
      logistics: {
        prerequisites: { warehouses: [], receiptSources: [] }, receipts: [],
        consolidations: [{ id: "group-1", status: "CONFIRMED", strategy: "CONSOLIDATE_ALL", items: [] }],
        shipments: [shipment, { ...shipment, id: "shipment-2", status: "OUT_FOR_DELIVERY", deliveries: [delivery] },
          { ...shipment, id: "shipment-3", status: "DELIVERED", deliveries: [{ ...delivery, status: "DELIVERED" }] }],
        costs: [], invoice: null,
      },
    } as unknown as OrderDetail;
    const markup = renderToStaticMarkup(createElement(AdminLogisticsPanel, {
      data, busy: false, post: async () => true,
      capabilities: { manageLogistics: true, manageWarehouseAndShipment: true, manageFreight: true } as never,
    }));
    for (const field of ["shipmentName", "etd", "eta", "scheduledAt", "scheduledEnd", "contact", "phone", "recipient", "supplierCost", "memberCharge"]) {
      expect(markup).toContain(`name="${field}"`);
    }
    expect(markup).not.toMatch(/DRYRUN|UAT|0800000000|0811111111|value="8000"|value="10000"/);
  });
  it("describes IMPORT_CUSTOMS as in progress for admin and member views", () => {
    expect(trackingStatusLabel("IMPORT_CUSTOMS")).toBe("อยู่ระหว่างพิธีการนำเข้า");
    expect(shipmentStatusLabel("IMPORT_CUSTOMS")).toBe("อยู่ระหว่างพิธีการนำเข้า");
    expect(shipmentStatusLabel("IMPORT_CUSTOMS")).not.toContain("ผ่าน");
  });
  it("calculates only unblocked, unreleased receipt quantity", () => {
    expect(warehouseReleaseAvailable(receiptItem)).toBe(0);
    expect(warehouseReleaseAvailable({ ...receiptItem, released_quantity: 1 })).toBe(1);
  });

  it("groups released and unallocated quantities by warehouse", () => {
    const logistics: LogisticsDetail = {
      prerequisites: { warehouses: [], receiptSources: [] },
      receipts: [{
        id: "receipt-1",
        warehouse_id: "warehouse-1",
        supplier_order_id: "supplier-order-1",
        receipt_number: "WRC-2026-000001",
        status: "READY_FOR_CONSOLIDATION",
        received_at: "2026-09-16T09:00:00.000Z",
        package_count: 1,
        actual_weight_kg: null,
        actual_cbm: null,
        note: null,
        items: [{ ...receiptItem, released_quantity: 2, blocked_quantity: 0 }],
      }],
      consolidations: [{
        id: "group-1",
        consolidation_number: "CNS-2026-000001",
        warehouse_id: "warehouse-1",
        strategy: "CONSOLIDATE_ALL",
        status: "DRAFT",
        reason: null,
        items: [{
          id: "consolidation-item-1",
          warehouse_receipt_item_id: "receipt-item-1",
          order_item_id: "order-item-1",
          quantity: 1,
        }],
      }],
      shipments: [],
      costs: [],
      invoice: null,
    };

    expect(consolidationReadyBatches(logistics)).toEqual([{
      warehouseId: "warehouse-1",
      items: [{ warehouse_receipt_item_id: "receipt-item-1", quantity: 1 }],
    }]);
  });
});
