import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ access: vi.fn(), rpc: vi.fn(), sliceVisible: vi.fn(), scheduleType: "DEPOSIT" }));
vi.mock("@/lib/api/rpc-route", () => ({ runRpcRoute: mocks.rpc }));
vi.mock("@/lib/api/response", () => ({ apiError: (error: { status?: number }) => Response.json({ code: "DENIED" }, { status: error.status ?? 500 }) }));
vi.mock("@/lib/auth/session", () => ({ requireAppAccess: mocks.access }));
vi.mock("@/lib/release-stage", () => ({ isOrderOperationSliceVisible: mocks.sliceVisible }));
vi.mock("@/lib/insforge/server", () => ({ createInsForgeServerClient: async () => ({ database: { from: () => {
  const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: { schedule_type: mocks.scheduleType }, error: null }) };
  return query;
} } }) }));

import { POST } from "./route";

function request() {
  return new Request("https://gisp.test/api/member/payment-transfers", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      payment_schedule_id: "11111111-1111-4111-8111-111111111111",
      amount: 100, transferred_at: "2026-09-18T12:00:00Z",
      evidence_file_id: "22222222-2222-4222-8222-222222222222",
    }),
  }) as never;
}

describe("Member payment route C/D freight boundary", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.access.mockResolvedValue({ memberProfileId: "member-1" });
    mocks.rpc.mockResolvedValue(Response.json({ message: "ok" }));
    mocks.sliceVisible.mockReturnValue(false);
    mocks.scheduleType = "DEPOSIT";
  });

  it("allows existing deposit/balance workflow before D8", async () => {
    expect((await POST(request())).status).toBe(200);
    mocks.scheduleType = "BALANCE";
    expect((await POST(request())).status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
  });

  it("blocks Freight submission before D8 without invoking the payment RPC", async () => {
    mocks.scheduleType = "FREIGHT";
    const response = await POST(request());
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: "RELEASE_NOT_ENABLED" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("uses the normal route once D8 is enabled", async () => {
    mocks.scheduleType = "FREIGHT";
    mocks.sliceVisible.mockReturnValue(true);
    expect((await POST(request())).status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledOnce();
  });
});
