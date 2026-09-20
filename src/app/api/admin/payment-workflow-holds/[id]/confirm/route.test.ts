import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const route = readFileSync(new URL("./route.ts", import.meta.url), "utf8");

describe("payment workflow hold confirm route", () => {
  it("authorizes the target organization before using the private executor", () => {
    const authorization = route.indexOf("loadAuthorizedPaymentWorkflowHold(id, parsed.data.role)");
    const session = route.indexOf("currentFinanceSessionHash()");
    const executor = route.indexOf('rpc("confirm_payment_workflow_hold_private"');
    expect(authorization).toBeGreaterThan(-1);
    expect(session).toBeGreaterThan(authorization);
    expect(executor).toBeGreaterThan(session);
  });

  it("accepts only the approved two incident roles and a documented note", () => {
    expect(route).toContain('z.enum(["FINANCE", "ORDER_ADMIN"])');
    expect(route).toContain("z.string().trim().min(3).max(1000)");
  });
});
