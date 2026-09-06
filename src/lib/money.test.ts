import { describe, expect, it } from "vitest";
import { calculateMoney, sumVerifiedPayments } from "./money";

describe("calculateMoney", () => {
  it("snapshots VAT and derives balance from grand total minus deposit", () => {
    expect(calculateMoney("100.01", 7)).toEqual({
      subtotal: "100.01",
      vatRate: "7.00",
      vatAmount: "7.00",
      grandTotal: "107.01",
      deposit: "53.51",
      balance: "53.50",
    });
  });
});

describe("sumVerifiedPayments", () => {
  it("verifies only when cumulative finance-verified transfers reach due", () => {
    expect(sumVerifiedPayments(["20", "29.99"], "50")).toMatchObject({
      isVerified: false,
      isOverpaid: false,
      outstandingAmount: "0.01",
    });
    expect(sumVerifiedPayments(["20", "30"], "50")).toMatchObject({
      isVerified: true,
      isOverpaid: false,
    });
    expect(sumVerifiedPayments(["20", "31"], "50")).toMatchObject({
      isVerified: true,
      isOverpaid: true,
    });
  });
});
