import { beforeEach, describe, expect, it, vi } from "vitest";

const id = "11111111-1111-4111-8111-111111111111";
const fileId = "22222222-2222-4222-8222-222222222222";
const mocks = vi.hoisted(() => ({
  access: vi.fn(), target: vi.fn(), sessionHash: vi.fn(), evidence: vi.fn(),
  privateRpc: vi.fn(), notificationRpc: vi.fn(), auth: vi.fn(), sliceVisible: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({ requireAppAccess: mocks.access }));
vi.mock("@/lib/payments/finance-access", () => ({
  loadAuthorizedFinanceTransfer: mocks.target,
  currentFinanceSessionHash: mocks.sessionHash,
}));
vi.mock("@/lib/payments/bound-evidence", () => ({ loadBoundCustomerPaymentEvidence: mocks.evidence }));
vi.mock("@/lib/insforge/admin", () => ({ createInsForgeAdminClient: () => ({ database: { rpc: mocks.privateRpc } }) }));
vi.mock("@/lib/insforge/server", () => ({ createInsForgeServerClient: async () => ({
  auth: { getCurrentUser: mocks.auth }, database: { rpc: mocks.notificationRpc },
}) }));
vi.mock("@/lib/api/response", () => ({ apiError: (error: { status?: number }) => Response.json({ code: "DENIED" }, { status: error.status ?? 500 }) }));
vi.mock("@/lib/release-stage", () => ({ isOrderOperationSliceVisible: mocks.sliceVisible }));

import { POST } from "./route";

function request(approve: boolean, options: { confirmed?: boolean; note?: string } = {}) {
  return new Request("https://gisp.test/api/admin/payment-transfers/id/verify", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ approve, evidence_confirmed: options.confirmed,
      finance_note: options.note ?? (approve ? "checked" : "wrong evidence") }),
  }) as never;
}

describe("Finance private payment verification", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.access.mockResolvedValue({ userId: "finance-user", organizationId: null });
    mocks.target.mockResolvedValue({ organizationId: "target-org", scheduleType: "DEPOSIT", status: "SUBMITTED" });
    mocks.sessionHash.mockResolvedValue("server-derived-hash");
    mocks.evidence.mockResolvedValue({ blob: new Blob(["%PDF-"], { type: "application/pdf" }),
      mimeType: "application/pdf", fileId, sha256: "a".repeat(64), byteSize: 5 });
    mocks.privateRpc.mockResolvedValue({ data: id, error: null });
    mocks.auth.mockResolvedValue({ data: { user: { email: "finance@example.test" } }, error: null });
    mocks.notificationRpc.mockResolvedValue({ error: null });
    mocks.sliceVisible.mockReturnValue(true);
  });

  it("requires explicit Finance attestation and verified bytes before private executor", async () => {
    expect((await POST(request(true), { params: Promise.resolve({ id }) })).status).toBe(400);
    expect(mocks.target).not.toHaveBeenCalled();
    const response = await POST(request(true, { confirmed: true }), { params: Promise.resolve({ id }) });
    expect(response.status).toBe(200);
    expect(mocks.evidence).toHaveBeenCalledWith(id, "target-org");
    expect(mocks.privateRpc).toHaveBeenCalledWith("verify_payment_transfer_private", expect.objectContaining({
      transfer_id_input: id, approve_input: true, session_token_hash_input: "server-derived-hash",
      evidence_file_id_input: fileId, sha256_input: "a".repeat(64), size_bytes_input: 5,
    }));
    expect(mocks.notificationRpc).toHaveBeenCalledOnce();
  });

  it("rejects another organization's transfer before opening a file or invoking an admin RPC", async () => {
    mocks.target.mockResolvedValue(null);
    const response = await POST(request(true, { confirmed: true }), { params: Promise.resolve({ id }) });
    expect(response.status).toBe(404);
    expect(mocks.evidence).not.toHaveBeenCalled();
    expect(mocks.privateRpc).not.toHaveBeenCalled();
  });

  it("blocks missing or corrupt evidence for approval, but permits reasoned rejection without bytes", async () => {
    mocks.evidence.mockResolvedValue(null);
    expect((await POST(request(true, { confirmed: true }), { params: Promise.resolve({ id }) })).status).toBe(409);
    expect(mocks.privateRpc).not.toHaveBeenCalled();
    expect((await POST(request(false), { params: Promise.resolve({ id }) })).status).toBe(200);
    expect(mocks.evidence).toHaveBeenCalledTimes(1);
    expect(mocks.privateRpc).toHaveBeenCalledWith("verify_payment_transfer_private", expect.objectContaining({
      approve_input: false, evidence_file_id_input: null, sha256_input: null,
    }));
    expect((await POST(request(false, { note: "" }), { params: Promise.resolve({ id }) })).status).toBe(400);
  });

  it("fails closed on revoked session or a replayed/processed transfer", async () => {
    mocks.sessionHash.mockRejectedValueOnce({ status: 401 });
    expect((await POST(request(true, { confirmed: true }), { params: Promise.resolve({ id }) })).status).toBe(401);
    expect(mocks.privateRpc).not.toHaveBeenCalled();
    mocks.target.mockResolvedValueOnce({ organizationId: "target-org", scheduleType: "DEPOSIT", status: "VERIFIED" });
    expect((await POST(request(true, { confirmed: true }), { params: Promise.resolve({ id }) })).status).toBe(409);
  });

  it("blocks Freight before D8 and preserves Deposit verification", async () => {
    mocks.sliceVisible.mockReturnValue(false);
    mocks.target.mockResolvedValueOnce({ organizationId: "target-org", scheduleType: "FREIGHT", status: "SUBMITTED" });
    expect((await POST(request(true, { confirmed: true }), { params: Promise.resolve({ id }) })).status).toBe(404);
    expect(mocks.privateRpc).not.toHaveBeenCalled();
    expect((await POST(request(true, { confirmed: true }), { params: Promise.resolve({ id }) })).status).toBe(200);
  });

  it("does not send notification when private executor denies or fails", async () => {
    mocks.privateRpc.mockResolvedValueOnce({ data: null, error: { status: 403 } });
    expect((await POST(request(true, { confirmed: true }), { params: Promise.resolve({ id }) })).status).toBe(403);
    expect(mocks.notificationRpc).not.toHaveBeenCalled();
  });

  it("returns a conflict when Finance has not previewed this evidence", async () => {
    mocks.privateRpc.mockResolvedValueOnce({ data: null, error: { message: "EVIDENCE_PREVIEW_REQUIRED" } });
    const response = await POST(request(true, { confirmed: true }), { params: Promise.resolve({ id }) });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: "EVIDENCE_PREVIEW_REQUIRED" });
    expect(mocks.notificationRpc).not.toHaveBeenCalled();
  });
});
