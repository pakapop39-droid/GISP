import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Production Core Parity Order surface", () => {
  it("loads the accepted supplier finance tables and keeps deferred adjustments absent", () => {
    const server = read("src/lib/orders/server.ts");
    expect(server).toMatch(/supplier_payment_schedules/);
    expect(server).toMatch(/supplier_payments/);
    expect(server).not.toMatch(/payment_adjustments|payment_workflow_holds/);
    expect(server).toContain("isCoreParityEnabled()");
  });

  it("renders supplier payment controls only through permission capabilities", () => {
    const ui = read("src/components/admin-order-detail.tsx");
    expect(ui).toContain("requestSupplierPayment || capabilities.manageSupplierPayments");
    expect(ui).toContain("สร้างคำขอจ่าย");
    expect(ui).toContain("หลักฐานจ่าย");
    expect(ui).not.toMatch(/managePaymentAdjustments|paymentAdjustments|paymentWorkflowHolds/);
  });

  it("keeps DB row locking in the immutable order implementation", () => {
    const source = read("migrations/20260828154027_slice-6-orders-payments.sql");
    expect(source).toMatch(/create_customer_order[\s\S]*FOR UPDATE/i);
  });
});
