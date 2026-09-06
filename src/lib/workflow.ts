export const quotationTransitions = {
  DRAFT: ["SENT", "CANCELLED", "SUPERSEDED"],
  SENT: ["ACCEPTED", "REJECTED", "EXPIRED", "CANCELLED", "SUPERSEDED"],
  ACCEPTED: [],
  REJECTED: ["SUPERSEDED"],
  EXPIRED: ["SUPERSEDED"],
  CANCELLED: ["SUPERSEDED"],
  SUPERSEDED: [],
} as const;

export type QuotationStatus = keyof typeof quotationTransitions;

export function canTransitionQuotation(
  from: QuotationStatus,
  to: QuotationStatus,
) {
  return (quotationTransitions[from] as readonly string[]).includes(to);
}

export type DispatchGate = {
  qcPassed: boolean;
  isCustom: boolean;
  memberApproved: boolean;
  customerBalanceVerified: boolean;
  supplierBalancePaid: boolean;
};

export function evaluateDispatchGate(input: DispatchGate) {
  const failures: string[] = [];
  if (!input.qcPassed) failures.push("QC_NOT_PASSED");
  if (input.isCustom && !input.memberApproved) {
    failures.push("CUSTOM_MEMBER_APPROVAL_REQUIRED");
  }
  if (!input.customerBalanceVerified) {
    failures.push("CUSTOMER_BALANCE_NOT_VERIFIED");
  }
  if (!input.supplierBalancePaid) {
    failures.push("SUPPLIER_BALANCE_NOT_PAID");
  }
  return { allowed: failures.length === 0, failures };
}

export const workflowSteps = [
  "Project",
  "RFQ",
  "Quotation",
  "Order",
  "Payment",
  "Production",
  "QC",
  "Shipment",
  "Delivery",
  "Claim",
] as const;
