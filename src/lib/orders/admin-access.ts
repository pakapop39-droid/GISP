import type {
  AdminOrderCapabilities,
  LogisticsReceiptSource,
} from "@/lib/orders/types";

export const adminOrderAccessPermissions = [
  "orders.manage",
  "payments.verify",
  "supplier_payments.request",
  "supplier_payments.manage",
  "production.manage",
  "qc.manage",
  "shipments.manage",
  "deliveries.manage",
  "freight.manage",
] as const;

export const allAdminOrderCapabilities: AdminOrderCapabilities = {
  manageOrder: true,
  viewSalesAmounts: true,
  viewCustomerPaymentStatus: true,
  manageCustomerPayments: true,
  requestSupplierPayment: true,
  manageSupplierPayments: true,
  manageProduction: true,
  manageQc: true,
  manageLogistics: true,
  manageWarehouseAndShipment: true,
  manageFreight: true,
};

export function adminOrderCapabilitiesForPermissions(
  permissions: readonly string[],
): AdminOrderCapabilities {
  const permissionSet = new Set(permissions);
  const has = (permission: string) => permissionSet.has(permission);

  return {
    manageOrder: has("orders.manage"),
    viewSalesAmounts: has("orders.manage") || has("payments.verify"),
    viewCustomerPaymentStatus: has("orders.manage") || has("payments.verify"),
    manageCustomerPayments: has("payments.verify"),
    requestSupplierPayment: has("supplier_payments.request"),
    manageSupplierPayments: has("supplier_payments.manage"),
    manageProduction: has("production.manage"),
    manageQc: has("qc.manage"),
    manageLogistics: has("shipments.manage") || has("deliveries.manage"),
    manageWarehouseAndShipment: has("shipments.manage"),
    manageFreight: has("freight.manage"),
  };
}

type LogisticsOrderItemProjection = {
  id: string;
  item_name_snapshot: string;
};

type LogisticsSupplierItemProjection = {
  id: string;
  supplier_order_id: string;
  order_item_id: string;
  quantity: number | string;
};

type LogisticsSupplierOrderProjection = {
  id: string;
  supplier_order_number: string;
  po_number: string | null;
  status: string;
};

type LogisticsReceivedProjection = {
  supplier_order_item_id: string;
  received_quantity: number | string;
};

/**
 * Builds the Logistics-only inbound projection. The explicit return shape is a
 * privacy boundary: supplier cost, payment, supplier identity, and internal
 * finance fields cannot pass through to the Logistics UI.
 */
export function projectLogisticsReceiptSources(input: {
  orderItems: LogisticsOrderItemProjection[];
  supplierItems: LogisticsSupplierItemProjection[];
  supplierOrders: LogisticsSupplierOrderProjection[];
  receivedItems: LogisticsReceivedProjection[];
}): LogisticsReceiptSource[] {
  const orderItemMap = new Map(input.orderItems.map((item) => [item.id, item]));
  const supplierOrderMap = new Map(input.supplierOrders.map((order) => [order.id, order]));
  const receivedBySupplierItem = new Map<string, number>();

  for (const item of input.receivedItems) {
    receivedBySupplierItem.set(
      item.supplier_order_item_id,
      (receivedBySupplierItem.get(item.supplier_order_item_id) ?? 0) + Number(item.received_quantity),
    );
  }

  return input.supplierItems.flatMap((supplierItem) => {
    const orderItem = orderItemMap.get(supplierItem.order_item_id);
    const supplierOrder = supplierOrderMap.get(supplierItem.supplier_order_id);
    if (!orderItem || !supplierOrder) return [];
    const expectedQuantity = Number(supplierItem.quantity);
    const receivedQuantity = receivedBySupplierItem.get(supplierItem.id) ?? 0;
    return [{
      supplier_order_id: supplierOrder.id,
      supplier_order_item_id: supplierItem.id,
      supplier_order_number: supplierOrder.supplier_order_number,
      po_number: supplierOrder.po_number,
      supplier_order_status: supplierOrder.status,
      order_item_id: orderItem.id,
      item_name: orderItem.item_name_snapshot,
      expected_quantity: expectedQuantity,
      received_quantity: receivedQuantity,
      remaining_quantity: Math.max(0, expectedQuantity - receivedQuantity),
    }];
  });
}
