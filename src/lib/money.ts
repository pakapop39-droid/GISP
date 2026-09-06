import Decimal from "decimal.js";

Decimal.set({
  precision: 24,
  rounding: Decimal.ROUND_HALF_UP,
});

export type MoneyBreakdown = {
  subtotal: string;
  vatRate: string;
  vatAmount: string;
  grandTotal: string;
  deposit: string;
  balance: string;
};

const money = (value: Decimal.Value) => new Decimal(value).toDecimalPlaces(2);

export function calculateMoney(
  subtotalInput: Decimal.Value,
  vatRateInput: Decimal.Value = 7,
): MoneyBreakdown {
  const subtotal = money(subtotalInput);
  const vatRate = new Decimal(vatRateInput);
  const vatAmount = money(subtotal.mul(vatRate).div(100));
  const grandTotal = money(subtotal.add(vatAmount));
  const deposit = money(grandTotal.mul("0.5"));
  const balance = money(grandTotal.minus(deposit));

  return {
    subtotal: subtotal.toFixed(2),
    vatRate: vatRate.toFixed(2),
    vatAmount: vatAmount.toFixed(2),
    grandTotal: grandTotal.toFixed(2),
    deposit: deposit.toFixed(2),
    balance: balance.toFixed(2),
  };
}

export function sumVerifiedPayments(
  amounts: Decimal.Value[],
  dueAmount: Decimal.Value,
) {
  const verified = money(
    amounts.reduce<Decimal>(
      (sum, amount) => sum.add(amount),
      new Decimal(0),
    ),
  );
  const due = money(dueAmount);

  return {
    verifiedAmount: verified.toFixed(2),
    outstandingAmount: Decimal.max(due.minus(verified), 0).toFixed(2),
    isVerified: verified.greaterThanOrEqualTo(due),
    isOverpaid: verified.greaterThan(due),
  };
}
