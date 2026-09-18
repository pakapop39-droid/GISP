import { describe, expect, it } from "vitest";
import {
  adminOrderCapabilitiesForPermissions,
  projectLogisticsReceiptSources,
} from "./admin-access";

describe("admin order capabilities", () => {
  it("keeps operations away from approvals and logistics actions", () => {
    const result = adminOrderCapabilitiesForPermissions([
      "orders.manage",
      "supplier_payments.request",
      "production.manage",
      "qc.manage",
    ]);
    expect(result).toMatchObject({
      manageOrder: true,
      viewSalesAmounts: true,
      requestSupplierPayment: true,
      manageSupplierPayments: false,
      manageCustomerPayments: false,
      manageLogistics: false,
    });
  });

  it("allows finance to verify and pay without operations controls", () => {
    const result = adminOrderCapabilitiesForPermissions([
      "payments.verify",
      "supplier_payments.manage",
      "freight.manage",
    ]);
    expect(result).toMatchObject({
      manageOrder: false,
      viewSalesAmounts: true,
      manageCustomerPayments: true,
      requestSupplierPayment: false,
      manageSupplierPayments: true,
      manageProduction: false,
      manageQc: false,
      manageFreight: true,
      manageWarehouseAndShipment: false,
    });
  });

  it("redacts financial areas for logistics", () => {
    const result = adminOrderCapabilitiesForPermissions([
      "shipments.manage",
      "deliveries.manage",
    ]);
    expect(result).toMatchObject({
      viewSalesAmounts: false,
      viewCustomerPaymentStatus: false,
      manageCustomerPayments: false,
      requestSupplierPayment: false,
      manageSupplierPayments: false,
      manageLogistics: true,
      manageWarehouseAndShipment: true,
      manageFreight: false,
    });
  });

  it("lets delivery-only staff view delivery logistics without warehouse write actions", () => {
    expect(adminOrderCapabilitiesForPermissions(["deliveries.manage"])).toMatchObject({
      manageLogistics: true,
      manageWarehouseAndShipment: false,
    });
  });

  it("projects only safe inbound references for logistics", () => {
    const unsafeSupplierItem = {
      id: "supplier-item-1",
      supplier_order_id: "supplier-order-1",
      order_item_id: "item-1",
      quantity: 3,
      factory_unit_cost_snapshot: 999,
    };
    const unsafeSupplierOrder = {
      id: "supplier-order-1",
      supplier_order_number: "SO-2026-000008",
      po_number: "PO-2026-000003",
      status: "PRODUCTION_COMPLETED",
      paid_factory_amount: 999,
    };
    const result = projectLogisticsReceiptSources({
      orderItems: [{ id: "item-1", item_name_snapshot: "CN01-Y105" }],
      supplierItems: [unsafeSupplierItem],
      supplierOrders: [unsafeSupplierOrder],
      receivedItems: [{ supplier_order_item_id: "supplier-item-1", received_quantity: 1 }],
    });

    expect(result).toEqual([expect.objectContaining({
      item_name: "CN01-Y105",
      expected_quantity: 3,
      received_quantity: 1,
      remaining_quantity: 2,
    })]);
    expect(result[0]).not.toHaveProperty("factory_unit_cost_snapshot");
    expect(result[0]).not.toHaveProperty("paid_factory_amount");
    expect(result[0]).not.toHaveProperty("supplier");
  });
});
