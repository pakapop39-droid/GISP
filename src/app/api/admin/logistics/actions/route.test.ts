import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  permissions: ["shipments.manage"] as string[],
  rpc: vi.fn(),
  from: vi.fn(),
  consolidationStrategy: "CONSOLIDATE_ALL",
  shipmentStatus: "THAILAND_WAREHOUSE",
}));

vi.mock("@/lib/auth/session", () => {
  class AppAccessError extends Error {
    constructor(public code: string, public status: number, message: string) {
      super(message);
    }
  }
  return {
    AppAccessError,
    requireAppAccess: vi.fn(async () => ({ permissions: mocks.permissions })),
  };
});

vi.mock("@/lib/insforge/server", () => ({
  createInsForgeServerClient: vi.fn(async () => ({
    database: { rpc: mocks.rpc, from: mocks.from },
  })),
}));

vi.mock("@/lib/api/response", async () => {
  const { NextResponse } = await import("next/server");
  return {
    apiError: (error: { status?: number; code?: string; message?: string }) => NextResponse.json({
      code: error.code ?? "SERVER_ERROR",
      message: error.message ?? "error",
    }, { status: error.status ?? 500 }),
  };
});

import { logisticsActionSchema, logisticsRpc, POST } from "./route";

const supplierOrderId = "00000000-0000-4000-8000-000000000001";
const warehouseId = "00000000-0000-4000-8000-000000000002";
const supplierItemId = "00000000-0000-4000-8000-000000000003";
const shipmentId = "00000000-0000-4000-8000-000000000004";
const evidenceFileId = "00000000-0000-4000-8000-000000000005";

describe("DR-019 logistics actions", () => {
  beforeEach(() => {
    mocks.permissions = ["shipments.manage"];
    mocks.consolidationStrategy = "CONSOLIDATE_ALL";
    mocks.shipmentStatus = "THAILAND_WAREHOUSE";
    mocks.rpc.mockReset();
    mocks.rpc.mockResolvedValue({ data: warehouseId, error: null });
    mocks.from.mockReset();
    mocks.from.mockImplementation((table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: table === "shipments"
              ? { status: mocks.shipmentStatus }
              : { strategy: mocks.consolidationStrategy },
            error: null,
          }),
        }),
      }),
    }));
  });

  it("validates and maps a GOOD warehouse receipt without evidence or blocked quantity", () => {
    const input = logisticsActionSchema.parse({
      action: "CREATE_WAREHOUSE_RECEIPT",
      supplier_order_id: supplierOrderId,
      warehouse_id: warehouseId,
      received_at: "2026-09-16T09:00:00.000Z",
      package_count: 1,
      items: [{ supplier_order_item_id: supplierItemId, received_quantity: 1, condition: "GOOD" }],
    });

    expect(logisticsRpc(input)).toEqual([
      "create_warehouse_receipt",
      expect.objectContaining({
        supplier_order_id_input: supplierOrderId,
        warehouse_id_input: warehouseId,
        package_count_input: 1,
        evidence_file_ids_input: [],
        items_input: [{
          supplier_order_item_id: supplierItemId,
          received_quantity: 1,
          condition: "GOOD",
          blocked_quantity: 0,
          discrepancy_note: null,
        }],
      }),
      "บันทึกรับสินค้าเข้าคลังแล้ว",
    ]);
  });

  it("maps consolidate-all and confirm to the existing RPC contracts", () => {
    const create = logisticsActionSchema.parse({
      action: "CREATE_CONSOLIDATION",
      customer_order_id: supplierOrderId,
      warehouse_id: warehouseId,
      strategy: "CONSOLIDATE_ALL",
      items: [{ warehouse_receipt_item_id: supplierItemId, quantity: 1 }],
    });
    const confirm = logisticsActionSchema.parse({
      action: "CONFIRM_CONSOLIDATION",
      consolidation_id: supplierItemId,
    });

    expect(logisticsRpc(create)[0]).toBe("create_consolidation");
    expect(logisticsRpc(create)[1]).toMatchObject({ strategy_input: "CONSOLIDATE_ALL", reason_input: null });
    expect(logisticsRpc(confirm)).toEqual([
      "confirm_consolidation",
      { consolidation_id_input: supplierItemId },
      "ยืนยันแผนรวมสินค้าแล้ว",
    ]);
  });

  it("defaults a shipment to zero additional charge borne by GISP", () => {
    const input = logisticsActionSchema.parse({
      action: "CREATE_SHIPMENT",
      consolidation_id: supplierItemId,
      shipment_name: "DRYRUN-SHP-001",
      shipping_method: "LCL",
    });

    expect(logisticsRpc(input)[1]).toMatchObject({
      additional_member_charge_input: 0,
      charge_bearer_input: "GISP",
    });
  });

  it("rejects non-GOOD receipt conditions in the DR-019 pilot", () => {
    expect(logisticsActionSchema.safeParse({
      action: "CREATE_WAREHOUSE_RECEIPT",
      supplier_order_id: supplierOrderId,
      warehouse_id: warehouseId,
      received_at: "2026-09-16T09:00:00.000Z",
      package_count: 1,
      items: [{ supplier_order_item_id: supplierItemId, received_quantity: 1, condition: "DAMAGED" }],
    }).success).toBe(false);
  });

  it("rejects 500/MEMBER before RPC for a consolidate-all shipment", async () => {
    const request = new NextRequest("http://localhost/api/admin/logistics/actions", {
      method: "POST",
      body: JSON.stringify({
        action: "CREATE_SHIPMENT",
        consolidation_id: supplierItemId,
        shipment_name: "DRYRUN-SHP-001",
        shipping_method: "LCL",
        additional_member_charge: 500,
        charge_bearer: "MEMBER",
      }),
      headers: { "content-type": "application/json" },
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "INVALID_CONSOLIDATED_SHIPMENT_CHARGE" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("preserves the existing member-charge behavior for a PARTIAL consolidation", async () => {
    mocks.consolidationStrategy = "PARTIAL";
    const request = new NextRequest("http://localhost/api/admin/logistics/actions", {
      method: "POST",
      body: JSON.stringify({
        action: "CREATE_SHIPMENT",
        consolidation_id: supplierItemId,
        shipment_name: "Legacy partial shipment",
        shipping_method: "LCL",
        remaining_plan: "ส่งส่วนที่เหลือในเที่ยวถัดไป",
        additional_member_charge: 500,
        charge_bearer: "MEMBER",
      }),
      headers: { "content-type": "application/json" },
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("create_shipment_v2", expect.objectContaining({
      additional_member_charge_input: 500,
      charge_bearer_input: "MEMBER",
    }));
  });

  it("blocks warehouse writes at the route when shipments.manage is missing", async () => {
    mocks.permissions = ["deliveries.manage"];
    const request = new NextRequest("http://localhost/api/admin/logistics/actions", {
      method: "POST",
      body: JSON.stringify({
        action: "RELEASE_WAREHOUSE_RECEIPT_ITEM",
        warehouse_receipt_item_id: supplierItemId,
        release_quantity: 1,
      }),
      headers: { "content-type": "application/json" },
    });

    const response = await POST(request);

    expect(response.status).toBe(403);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("calls the release RPC once for an authorized request", async () => {
    const request = new NextRequest("http://localhost/api/admin/logistics/actions", {
      method: "POST",
      body: JSON.stringify({
        action: "RELEASE_WAREHOUSE_RECEIPT_ITEM",
        warehouse_receipt_item_id: supplierItemId,
        release_quantity: 1,
      }),
      headers: { "content-type": "application/json" },
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith("release_warehouse_receipt_item", {
      warehouse_receipt_item_id_input: supplierItemId,
      release_quantity_input: 1,
    });
  });

  it("requires customs evidence before confirming the Thailand warehouse milestone", async () => {
    const request = new NextRequest("http://localhost/api/admin/logistics/actions", {
      method: "POST",
      body: JSON.stringify({
        action: "ADD_TRACKING",
        shipment_id: shipmentId,
        status: "THAILAND_WAREHOUSE",
        event_at: "2026-09-16T12:00:00.000Z",
      }),
      headers: { "content-type": "application/json" },
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      code: "CUSTOMS_EVIDENCE_REQUIRED",
      message: "กรุณาแนบหลักฐานพิธีการนำเข้าก่อนยืนยันถึงคลังไทย",
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("passes the bound customs evidence to add_shipment_event", async () => {
    const request = new NextRequest("http://localhost/api/admin/logistics/actions", {
      method: "POST",
      body: JSON.stringify({
        action: "ADD_TRACKING",
        shipment_id: shipmentId,
        status: "THAILAND_WAREHOUSE",
        event_at: "2026-09-16T12:00:00.000Z",
        evidence_file_id: evidenceFileId,
      }),
      headers: { "content-type": "application/json" },
    });

    expect((await POST(request)).status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("add_shipment_event", expect.objectContaining({
      shipment_id_input: shipmentId,
      status_input: "THAILAND_WAREHOUSE",
      evidence_file_id_input: evidenceFileId,
    }));
  });

  it.each([
    ["INVALID_CUSTOMS_EVIDENCE", "หลักฐานพิธีการนำเข้าไม่ตรงกับ Shipment หรือไม่ได้จัดเก็บเป็นข้อมูลลับ"],
    ["THAILAND_WAREHOUSE_REQUIRED", "ต้องยืนยันผ่านพิธีการและถึงคลังไทยพร้อมหลักฐานก่อนเปลี่ยนเป็นพร้อมนัดส่ง"],
    ["DUPLICATE_SHIPMENT_MILESTONE", "สถานะนี้ถูกบันทึกแล้ว กรุณาเลือกสถานะถัดไป"],
  ])("translates %s to an actionable Thai error", async (code, message) => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: new Error(code) });
    const request = new NextRequest("http://localhost/api/admin/logistics/actions", {
      method: "POST",
      body: JSON.stringify({
        action: "ADD_TRACKING",
        shipment_id: shipmentId,
        status: "THAILAND_WAREHOUSE",
        event_at: "2026-09-16T12:00:00.000Z",
        evidence_file_id: evidenceFileId,
      }),
      headers: { "content-type": "application/json" },
    });

    const response = await POST(request);
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ code, message });
  });

  it("blocks a direct READY_FOR_DELIVERY jump from IMPORT_CUSTOMS before RPC", async () => {
    mocks.shipmentStatus = "IMPORT_CUSTOMS";
    const request = new NextRequest("http://localhost/api/admin/logistics/actions", {
      method: "POST",
      body: JSON.stringify({
        action: "ADD_TRACKING",
        shipment_id: shipmentId,
        status: "READY_FOR_DELIVERY",
        event_at: "2026-09-16T12:10:00.000Z",
      }),
      headers: { "content-type": "application/json" },
    });

    const response = await POST(request);

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      code: "THAILAND_WAREHOUSE_REQUIRED",
      message: "ต้องยืนยันผ่านพิธีการและถึงคลังไทยพร้อมหลักฐานก่อนเปลี่ยนเป็นพร้อมนัดส่ง",
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("allows READY_FOR_DELIVERY after the shipment reached the Thailand warehouse", async () => {
    const request = new NextRequest("http://localhost/api/admin/logistics/actions", {
      method: "POST",
      body: JSON.stringify({
        action: "ADD_TRACKING",
        shipment_id: shipmentId,
        status: "READY_FOR_DELIVERY",
        event_at: "2026-09-16T12:10:00.000Z",
      }),
      headers: { "content-type": "application/json" },
    });

    expect((await POST(request)).status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("add_shipment_event", expect.objectContaining({
      shipment_id_input: shipmentId,
      status_input: "READY_FOR_DELIVERY",
      evidence_file_id_input: null,
    }));
  });
});
