import { describe, expect, it } from "vitest";
import {
  canTransitionQuotation,
  evaluateDispatchGate,
} from "./workflow";

describe("quotation transitions", () => {
  it("does not allow editing accepted quotations", () => {
    expect(canTransitionQuotation("DRAFT", "SENT")).toBe(true);
    expect(canTransitionQuotation("REJECTED", "SUPERSEDED")).toBe(true);
    expect(canTransitionQuotation("ACCEPTED", "DRAFT")).toBe(false);
  });
});

describe("dispatch gate", () => {
  it("requires all four approved conditions for custom items", () => {
    expect(
      evaluateDispatchGate({
        qcPassed: true,
        isCustom: true,
        memberApproved: false,
        customerBalanceVerified: true,
        supplierBalancePaid: true,
      }),
    ).toEqual({
      allowed: false,
      failures: ["CUSTOM_MEMBER_APPROVAL_REQUIRED"],
    });
  });

  it("does not require member approval for standard items", () => {
    expect(
      evaluateDispatchGate({
        qcPassed: true,
        isCustom: false,
        memberApproved: false,
        customerBalanceVerified: true,
        supplierBalancePaid: true,
      }).allowed,
    ).toBe(true);
  });
});
