import { describe, expect, it } from "vitest";
import { sumVerifiedPayments } from "../lib/money";
import {
  advanceDemoState,
  buildDemoState,
  demoOrderMoney,
  getDashboardSummary,
  getDispatchGateResults,
  getExecutiveSummary,
  getMemberView,
  getProjectItemsSubtotal,
  resetDemoState,
  switchDemoRole,
} from ".";

describe("GISP demo story", () => {
  it("builds one cumulative story from project to closed claim", () => {
    const welcome = buildDemoState("WELCOME");
    expect(welcome.dataset.project).toBeNull();

    const project = buildDemoState("PROJECT_CATALOG");
    expect(project.dataset.project?.code).toBe("PRJ-2026-000001");
    expect(project.dataset.projectItems).toHaveLength(4);
    expect(
      project.dataset.projectItems.every(
        (item) => item.kind === "STANDARD" && item.status === "READY_TO_ORDER",
      ),
    ).toBe(true);
    expect(getProjectItemsSubtotal(project)).toBe("510000.00");

    const rfq = buildDemoState("CUSTOM_RFQ");
    expect(rfq.dataset.projectItems).toHaveLength(6);
    expect(rfq.dataset.quotations).toHaveLength(0);
    expect(
      rfq.dataset.projectItems
        .filter((item) => item.kind === "CUSTOM")
        .every((item) => item.status === "WAITING_QUOTATION"),
    ).toBe(true);

    const quotation = buildDemoState("QUOTATION");
    expect(getProjectItemsSubtotal(quotation)).toBe("900000.00");
    expect(quotation.dataset.quotations).toMatchObject([
      { version: 1, status: "SUPERSEDED" },
      { version: 2, status: "ACCEPTED" },
    ]);
    expect(
      quotation.dataset.projectItems
        .filter((item) => item.kind === "CUSTOM")
        .every(
          (item) =>
            item.status === "READY_TO_ORDER" &&
            item.customQuotationId === "quotation-riverstone-v2",
        ),
    ).toBe(true);

    const delivery = buildDemoState("DELIVERY_CLAIM");
    expect(delivery.dataset.shipments).toHaveLength(2);
    expect(delivery.dataset.claims[0]).toMatchObject({
      claimNumber: "CLM-2026-000001",
      status: "SUBMITTED",
    });

    const completed = buildDemoState("EXECUTIVE_SUMMARY");
    expect(completed.dataset.orders[0].status).toBe("COMPLETED");
    expect(completed.dataset.project?.status).toBe("COMPLETED");
    expect(completed.dataset.claims[0].status).toBe("CLOSED");
    expect(
      completed.dataset.paymentSchedules.find(
        (schedule) => schedule.type === "FREIGHT",
      ),
    ).toMatchObject({
      dueAmount: "96300.00",
      status: "VERIFIED",
      subtotalBeforeVat: "90000.00",
      vatAmount: "6300.00",
    });
  });

  it("keeps order VAT and partial 50/50 payments mathematically consistent", () => {
    expect(demoOrderMoney).toEqual({
      subtotal: "900000.00",
      vatRate: "7.00",
      vatAmount: "63000.00",
      grandTotal: "963000.00",
      deposit: "481500.00",
      balance: "481500.00",
    });

    const deposit = sumVerifiedPayments(
      ["300000.00", "181500.00"],
      demoOrderMoney.deposit,
    );
    const balance = sumVerifiedPayments(
      ["200000.00", "281500.00"],
      demoOrderMoney.balance,
    );
    expect(deposit).toMatchObject({
      verifiedAmount: "481500.00",
      outstandingAmount: "0.00",
      isVerified: true,
      isOverpaid: false,
    });
    expect(balance).toMatchObject({
      verifiedAmount: "481500.00",
      outstandingAmount: "0.00",
      isVerified: true,
      isOverpaid: false,
    });
  });

  it("blocks dispatch before all four gates and allows it after approval", () => {
    const beforeApproval = getDispatchGateResults(
      buildDemoState("PRODUCTION_QC"),
    );
    expect(beforeApproval.every((result) => !result.allowed)).toBe(true);
    expect(
      beforeApproval.find(
        (result) => result.projectItemId === "item-reception-counter",
      )?.failures,
    ).toEqual([
      "CUSTOM_MEMBER_APPROVAL_REQUIRED",
      "CUSTOMER_BALANCE_NOT_VERIFIED",
      "SUPPLIER_BALANCE_NOT_PAID",
    ]);

    const afterApproval = getDispatchGateResults(
      buildDemoState("APPROVAL_BALANCE"),
    );
    expect(afterApproval).toHaveLength(6);
    expect(afterApproval.every((result) => result.allowed)).toBe(true);
  });

  it("never exposes internal cost, supplier payment or internal notes to members", () => {
    const memberView = getMemberView(buildDemoState("EXECUTIVE_SUMMARY"));
    const serialized = JSON.stringify(memberView);

    expect(serialized).not.toContain("factoryUnitCost");
    expect(serialized).not.toContain("factoryCostTotal");
    expect(serialized).not.toContain("internalNote");
    expect(serialized).not.toContain("supplierBalancePaid");
    expect(
      memberView.documents.every(
        (document) =>
          document.visibility === "MEMBER" && document.watermark === "DEMO",
      ),
    ).toBe(true);
  });

  it("derives dashboard and executive figures from the same fixture state", () => {
    const delivery = buildDemoState("DELIVERY_CLAIM");
    expect(getDashboardSummary(delivery)).toMatchObject({
      projects: 1,
      activeOrders: 1,
      paymentActions: 1,
      productionDelays: 1,
      deliveries: 2,
      openClaims: 1,
      actionRequired: 2,
    });

    const completed = buildDemoState("EXECUTIVE_SUMMARY");
    expect(getDashboardSummary(completed)).toMatchObject({
      activeOrders: 0,
      paymentActions: 0,
      openClaims: 0,
      actionRequired: 0,
    });
    expect(getExecutiveSummary(completed)).toEqual({
      grossSalesBeforeVat: "900000.00",
      factoryCost: "519000.00",
      grossProductMargin: "381000.00",
      grossProductMarginPercent: "42.33",
      freightRevenueBeforeVat: "90000.00",
      paymentVerified: "1059300.00",
    });
  });

  it("supports next, role switch and a deterministic reset", () => {
    const started = advanceDemoState(buildDemoState("WELCOME"));
    expect(started.sceneId).toBe("PROJECT_CATALOG");

    const financeView = switchDemoRole(started, "FINANCE");
    expect(financeView.activeRole).toBe("FINANCE");
    expect(financeView.sceneId).toBe("PROJECT_CATALOG");

    expect(resetDemoState()).toEqual(buildDemoState("WELCOME", "MEMBER"));
  });
});
