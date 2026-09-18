import { beforeEach, describe, expect, it, vi } from "vitest";

const id = "11111111-1111-4111-8111-111111111111";
const fileId = "22222222-2222-4222-8222-222222222222";
const mocks = vi.hoisted(() => ({
  access: vi.fn(), target: vi.fn(), sessionHash: vi.fn(), evidence: vi.fn(), previewRpc: vi.fn(), sliceVisible: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({ requireAppAccess: mocks.access }));
vi.mock("@/lib/payments/finance-access", () => ({
  loadAuthorizedFinanceTransfer: mocks.target,
  currentFinanceSessionHash: mocks.sessionHash,
}));
vi.mock("@/lib/payments/bound-evidence", () => ({ loadBoundCustomerPaymentEvidence: mocks.evidence }));
vi.mock("@/lib/insforge/admin", () => ({ createInsForgeAdminClient: () => ({ database: { rpc: mocks.previewRpc } }) }));
vi.mock("@/lib/release-stage", () => ({ isOrderOperationSliceVisible: mocks.sliceVisible }));
vi.mock("@/lib/api/response", () => ({ apiError: (error: { status?: number }) => Response.json({ code: "DENIED" }, { status: error.status ?? 500 }) }));

import { GET } from "./route";

function request() {
  return new Request("https://gisp.test/evidence");
}

describe("Finance payment evidence preview", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.access.mockResolvedValue({ userId: "finance-user", organizationId: null });
    mocks.target.mockResolvedValue({ organizationId: "target-org", scheduleType: "DEPOSIT", status: "SUBMITTED" });
    mocks.sessionHash.mockResolvedValue("server-derived-hash");
    mocks.evidence.mockResolvedValue({ blob: new Blob(["%PDF-1.7"], { type: "application/pdf" }),
      mimeType: "application/pdf", fileId, sha256: "a".repeat(64), byteSize: 8 });
    mocks.previewRpc.mockResolvedValue({ data: "receipt-id", error: null });
    mocks.sliceVisible.mockReturnValue(false);
  });

  it("returns exact stored bytes only after target-org authorization and server-side audit receipt", async () => {
    const response = await GET(request(), { params: Promise.resolve({ id }) });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.text()).toBe("%PDF-1.7");
    expect(mocks.target).toHaveBeenCalledWith(id);
    expect(mocks.evidence).toHaveBeenCalledWith(id, "target-org");
    expect(mocks.previewRpc).toHaveBeenCalledWith("record_customer_payment_evidence_preview", expect.objectContaining({
      transfer_id_input: id, evidence_file_id_input: fileId,
      sha256_input: "a".repeat(64), session_token_hash_input: "server-derived-hash",
    }));
  });

  it("returns a generic not-found for another organization before storage or receipt access", async () => {
    mocks.target.mockResolvedValue(null);
    const response = await GET(request(), { params: Promise.resolve({ id }) });
    expect(response.status).toBe(404);
    expect(mocks.evidence).not.toHaveBeenCalled();
    expect(mocks.previewRpc).not.toHaveBeenCalled();
  });

  it("does not preview Freight evidence before D8", async () => {
    mocks.target.mockResolvedValue({ organizationId: "target-org", scheduleType: "FREIGHT", status: "SUBMITTED" });
    const response = await GET(request(), { params: Promise.resolve({ id }) });
    expect(response.status).toBe(404);
    expect(mocks.sliceVisible).toHaveBeenCalledWith(8);
    expect(mocks.evidence).not.toHaveBeenCalled();
    expect(mocks.previewRpc).not.toHaveBeenCalled();
  });

  it("rejects invalid IDs, missing bytes and failed audit receipt", async () => {
    expect((await GET(request(), { params: Promise.resolve({ id: "bad" }) })).status).toBe(400);
    mocks.evidence.mockResolvedValueOnce(null);
    expect((await GET(request(), { params: Promise.resolve({ id }) })).status).toBe(404);
    expect(mocks.previewRpc).not.toHaveBeenCalled();
    mocks.previewRpc.mockResolvedValueOnce({ data: null, error: new Error("audit unavailable") });
    expect((await GET(request(), { params: Promise.resolve({ id }) })).status).toBe(500);
  });

  it("denies missing Finance permission or session before file delivery", async () => {
    mocks.access.mockRejectedValueOnce({ status: 403 });
    expect((await GET(request(), { params: Promise.resolve({ id }) })).status).toBe(403);
    expect(mocks.evidence).not.toHaveBeenCalled();
    mocks.sessionHash.mockRejectedValueOnce({ status: 401 });
    expect((await GET(request(), { params: Promise.resolve({ id }) })).status).toBe(401);
  });
});
