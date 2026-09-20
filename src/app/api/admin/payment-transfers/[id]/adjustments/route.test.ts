import { beforeEach, describe, expect, it, vi } from "vitest";

const transferId = "11111111-1111-4111-8111-111111111111";
const adjustmentId = "22222222-2222-4222-8222-222222222222";
const mocks = vi.hoisted(() => ({
  access: vi.fn(),
  target: vi.fn(),
  sessionHash: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ requireAppAccess: mocks.access }));
vi.mock("@/lib/payments/finance-access", () => ({
  loadAuthorizedPaymentTransfer: mocks.target,
  currentFinanceSessionHash: mocks.sessionHash,
}));
vi.mock("@/lib/insforge/admin", () => ({
  createInsForgeAdminClient: () => ({ database: { rpc: mocks.rpc } }),
}));
vi.mock("@/lib/api/response", () => ({
  invalidInput: () => Response.json({ code: "INVALID_INPUT" }, { status: 400 }),
  apiError: (error: { status?: number }) =>
    Response.json({ code: "FAILED" }, { status: error.status ?? 500 }),
}));

import { POST } from "./route";

function request(body: Record<string, unknown>) {
  return new Request("https://gisp.test/api/admin/payment-transfers/id/adjustments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as never;
}

const params = { params: Promise.resolve({ id: transferId }) };

describe("payment adjustment request", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.access.mockResolvedValue({ userId: "finance-user" });
    mocks.target.mockResolvedValue({
      organizationId: "org-a",
      scheduleType: "DEPOSIT",
      status: "VERIFIED",
    });
    mocks.sessionHash.mockResolvedValue("a".repeat(64));
    mocks.rpc.mockResolvedValue({ data: adjustmentId, error: null });
  });

  it("creates a negative append-only adjustment through the private executor", async () => {
    const response = await POST(request({
      adjustment_type: "ADJUSTMENT",
      amount: 125.5,
      reason: "แก้ยอดที่บันทึกเกิน",
    }), params);

    expect(response.status).toBe(201);
    expect(mocks.target).toHaveBeenCalledWith(transferId, "payments.adjust");
    expect(mocks.rpc).toHaveBeenCalledWith(
      "create_payment_adjustment_private",
      expect.objectContaining({
        transfer_id_input: transferId,
        adjustment_type_input: "ADJUSTMENT",
        amount_input: -125.5,
        session_token_hash_input: "a".repeat(64),
      }),
    );
  });

  it("requests a full reversal without trusting a client amount", async () => {
    const response = await POST(request({
      adjustment_type: "REVERSAL",
      amount: 1,
      reason: "รับเงินผิด Order",
    }), params);

    expect(response.status).toBe(201);
    expect(mocks.rpc).toHaveBeenCalledWith(
      "create_payment_adjustment_private",
      expect.objectContaining({ amount_input: -1, adjustment_type_input: "REVERSAL" }),
    );
  });

  it("fails closed for cross-organization or non-verified transfers", async () => {
    mocks.target.mockResolvedValueOnce(null);
    expect((await POST(request({
      adjustment_type: "REVERSAL",
      reason: "ผิดรายการ",
    }), params)).status).toBe(404);
    expect(mocks.rpc).not.toHaveBeenCalled();

    mocks.target.mockResolvedValueOnce({
      organizationId: "org-a",
      scheduleType: "DEPOSIT",
      status: "SUBMITTED",
    });
    expect((await POST(request({
      adjustment_type: "REVERSAL",
      reason: "ผิดรายการ",
    }), params)).status).toBe(409);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("requires a reason and amount for a partial adjustment", async () => {
    expect((await POST(request({
      adjustment_type: "ADJUSTMENT",
      reason: "แก้",
    }), params)).status).toBe(400);
    expect(mocks.target).not.toHaveBeenCalled();
  });
});

