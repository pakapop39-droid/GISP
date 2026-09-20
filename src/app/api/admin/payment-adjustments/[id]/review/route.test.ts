import { beforeEach, describe, expect, it, vi } from "vitest";

const adjustmentId = "22222222-2222-4222-8222-222222222222";
const mocks = vi.hoisted(() => ({
  access: vi.fn(),
  target: vi.fn(),
  sessionHash: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ requireAppAccess: mocks.access }));
vi.mock("@/lib/payments/finance-access", () => ({
  loadAuthorizedPaymentAdjustment: mocks.target,
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
  return new Request("https://gisp.test/api/admin/payment-adjustments/id/review", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as never;
}

const params = { params: Promise.resolve({ id: adjustmentId }) };

describe("payment adjustment review", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.access.mockResolvedValue({ userId: "finance-user" });
    mocks.target.mockResolvedValue({
      organizationId: "org-a",
      status: "PENDING",
      transferId: "transfer-a",
    });
    mocks.sessionHash.mockResolvedValue("b".repeat(64));
    mocks.rpc.mockResolvedValue({ data: adjustmentId, error: null });
  });

  it("approves only through the private recalculation executor", async () => {
    const response = await POST(request({
      approve: true,
      decision_note: "ตรวจสอบเหตุผลและยอดแล้ว",
    }), params);
    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith(
      "review_payment_adjustment_private",
      expect.objectContaining({
        adjustment_id_input: adjustmentId,
        approve_input: true,
        session_token_hash_input: "b".repeat(64),
      }),
    );
  });

  it("requires a reason when rejecting", async () => {
    expect((await POST(request({ approve: false }), params)).status).toBe(400);
    expect(mocks.target).not.toHaveBeenCalled();
  });

  it("denies unavailable and replayed adjustments before the executor", async () => {
    mocks.target.mockResolvedValueOnce(null);
    expect((await POST(request({ approve: true }), params)).status).toBe(404);
    expect(mocks.rpc).not.toHaveBeenCalled();

    mocks.target.mockResolvedValueOnce({
      organizationId: "org-a",
      status: "APPROVED",
      transferId: "transfer-a",
    });
    expect((await POST(request({ approve: true }), params)).status).toBe(409);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});

