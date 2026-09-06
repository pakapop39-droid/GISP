import { describe, expect, it } from "vitest";
import { adminOrderCapabilitiesForPermissions } from "./admin-access";

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
      manageFreight: false,
    });
  });
});
