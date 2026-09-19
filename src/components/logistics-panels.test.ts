import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";

vi.mock("@/lib/orders/admin-access", () => ({
  allAdminOrderCapabilities: {},
}));

vi.mock("@/lib/orders/types", () => ({
  formatOrderMoney: (value: number | string) => String(value),
}));

import {
  AdminLogisticsPanel,
  MemberLogisticsPanel,
  consolidationReadyBatches,
  defaultShipmentName,
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
      id: "shipment-1", consolidation_group_id: "other-group-1", consolidation_number: "CNS-2026-000011", shipment_number: "SHP-2026-000001", shipment_name: "ชื่อซ้ำ",
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
        productionTimeline: [{ supplier_order_id: "supplier-order-1", supplier_order_number: "SO-1", po_number: "PO-1", status: "IN_PRODUCTION", updates: [{ id: "update-1", status: "DELAYED", note: "รอวัสดุ", estimated_completion_at: null, progress_percent: 40, started_at: null, actual_completed_at: null, delay_reason: "วัสดุล่าช้า", created_at: "2026-09-19T00:00:00Z", files: [{ id: "file-1", original_name: "progress.jpg", mime_type: "image/jpeg" }] }] }],
        prerequisites: { warehouses: [], receiptSources: [] }, receipts: [{ id: "receipt-1", warehouse_id: "warehouse-1", supplier_order_id: "supplier-order-1", receipt_number: "WRC-1", status: "RECEIVED_COMPLETE", received_at: "2026-09-19T00:00:00Z", package_count: 1, actual_weight_kg: 5, actual_cbm: 1, note: null, items: [] }],
        consolidations: [{ id: "group-1", consolidation_number: "CNS-2026-000001", status: "CONFIRMED", strategy: "CONSOLIDATE_ALL", items: [] }],
        shipments: [shipment, { ...shipment, id: "shipment-2", consolidation_group_id: "other-group-2", consolidation_number: "CNS-2026-000012", shipment_number: "SHP-2026-000002", status: "OUT_FOR_DELIVERY", deliveries: [delivery] },
          { ...shipment, id: "shipment-3", consolidation_group_id: "other-group-3", consolidation_number: "CNS-2026-000013", shipment_number: "SHP-2026-000003", status: "DELIVERED", deliveries: [{ ...delivery, status: "DELIVERED" }] }],
        costs: [], invoice: null,
      },
    } as unknown as OrderDetail;
    const markup = renderToStaticMarkup(createElement(AdminLogisticsPanel, {
      data, busy: false, post: async () => true,
      capabilities: { manageLogistics: true, manageWarehouseAndShipment: true, manageFreight: true, viewProductionTimeline: true } as never,
    }));
    for (const field of ["shipmentName", "etd", "eta", "scheduledAt", "scheduledEnd", "contact", "phone", "recipient", "supplierCost", "memberCharge"]) {
      expect(markup).toContain(`name="${field}"`);
    }
    expect(markup).not.toMatch(/DRYRUN|UAT|0800000000|0811111111|value="8000"|value="10000"/);
    expect(markup).toContain("Timeline การผลิตสำหรับ Logistics");
    expect(markup).toContain("/api/admin/logistics/production-media/supplier-order-1/file-1");
    expect(markup).toContain("/api/admin/warehouse-receipts/receipt-1/pdf");
    expect(markup).not.toContain("factory_cost");
    expect(markup).toContain('value="ORD-2026-000001 / CNS-2026-000001"');
    expect(markup).toContain("เที่ยวที่ 1 · CNS-2026-000011");
    expect(markup).toContain("SHP-2026-000001");
    expect(markup).toContain("SHP-2026-000002");
    expect(markup.match(/ชื่อ: ชื่อซ้ำ/g)).toHaveLength(3);

    const memberMarkup = renderToStaticMarkup(createElement(MemberLogisticsPanel, {
      data, busy: false, post: async () => true,
    }));
    expect(memberMarkup).toContain("เที่ยวที่ 1 · CNS-2026-000011 · รวมเที่ยว");
    expect(memberMarkup).toContain("SHP-2026-000001");
    expect(memberMarkup).not.toMatch(/factory_cost|paid_factory_amount|supplier_payments/);
  });

  it("loads only safe consolidation references for Member shipment projection", () => {
    const server = readFileSync(path.join(process.cwd(), "src", "lib", "orders", "server.ts"), "utf8");
    expect(server).toContain('mode === "member" ? logisticsDatabase.from("consolidation_groups")');
    expect(server).toContain('.select("id,consolidation_number").eq("customer_order_id", id)');
    expect(server).toContain('consolidations: mode === "admin" ? consolidations.map');
    expect(server).toContain('shipment_type,shipping_method,status,tracking_number');
  });

  it("uses order and consolidation references for a new shipment name", () => {
    expect(defaultShipmentName("ORD-2026-000001", "CNS-2026-000009")).toBe("ORD-2026-000001 / CNS-2026-000009");
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
      productionTimeline: [],
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
