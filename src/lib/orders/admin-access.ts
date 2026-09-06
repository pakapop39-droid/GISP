import type { AdminOrderCapabilities } from "@/lib/orders/types";

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
    manageFreight: has("freight.manage"),
  };
}
