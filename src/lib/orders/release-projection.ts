import type { LogisticsDetail, OrderDetail, OrderItem } from "./types";

function emptyLogistics(): LogisticsDetail {
  return {
    prerequisites: { warehouses: [], receiptSources: [] },
    receipts: [], consolidations: [], shipments: [], costs: [], invoice: null,
  };
}

/** Final serialization boundary shared by Member and Admin Order APIs. */
export function projectOrderDetailForRelease(
  detail: OrderDetail,
  enabled: { productionQc: boolean; logistics: boolean },
): OrderDetail {
  const leanDetail = { ...detail } as OrderDetail & {
    paymentAdjustments?: unknown;
    paymentWorkflowHolds?: unknown;
  };
  delete leanDetail.paymentAdjustments;
  delete leanDetail.paymentWorkflowHolds;
  return {
    ...leanDetail,
    items: enabled.productionQc ? detail.items : detail.items.map((item) => {
      const orderItem = { ...item };
      delete (orderItem as Partial<OrderItem>).qc_status;
      delete (orderItem as Partial<OrderItem>).custom_member_approved_at;
      // These fields are only consumed by the D7 panel, which is unavailable in C.
      return orderItem;
    }),
    schedules: enabled.logistics ? detail.schedules
      : detail.schedules.filter((schedule) => schedule.schedule_type !== "FREIGHT"),
    productionUpdates: enabled.productionQc ? detail.productionUpdates : [],
    qcInspections: enabled.productionQc ? detail.qcInspections : [],
    qcReopenEvents: enabled.productionQc ? detail.qcReopenEvents : [],
    dispatchGates: enabled.productionQc ? detail.dispatchGates : [],
    logistics: enabled.logistics ? detail.logistics : emptyLogistics(),
    supplierOrders: detail.supplierOrders?.map((supplierOrder) => ({
      id: supplierOrder.id,
      supplier_order_number: supplierOrder.supplier_order_number,
      po_number: supplierOrder.po_number,
      status: supplierOrder.status,
      supplier_currency: supplierOrder.supplier_currency,
      total_factory_cost: supplierOrder.total_factory_cost,
      supplier: supplierOrder.supplier,
      orderItemIds: supplierOrder.orderItemIds,
      productionUpdates: enabled.productionQc ? supplierOrder.productionUpdates : [],
    })),
    capabilities: detail.capabilities ? {
      ...detail.capabilities,
      manageProduction: enabled.productionQc && detail.capabilities.manageProduction,
      manageQc: enabled.productionQc && detail.capabilities.manageQc,
      manageLogistics: enabled.logistics && detail.capabilities.manageLogistics,
      manageWarehouseAndShipment: enabled.logistics && detail.capabilities.manageWarehouseAndShipment,
      manageFreight: enabled.logistics && detail.capabilities.manageFreight,
    } : undefined,
  };
}
