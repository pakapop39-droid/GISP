import { beforeEach, describe, expect, it, vi } from "vitest";

class MockAppAccessError extends Error {
  constructor(public code: string, public status: number, message: string) { super(message); }
}

const mocks = vi.hoisted(() => ({
  guard: vi.fn(), assertOrganizationPermission: vi.fn(), admin: vi.fn(), server: vi.fn(),
  upload: vi.fn(), remove: vi.fn(), metadataInsert: vi.fn(), metadataDelete: vi.fn(),
  markPaid: vi.fn(), notify: vi.fn(), getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  AppAccessError: class AppAccessError extends Error {
    constructor(public code: string, public status: number, message: string) { super(message); }
  },
  requireAppAccess: mocks.guard,
  assertOrganizationPermission: mocks.assertOrganizationPermission,
}));
vi.mock("@/lib/insforge/admin", () => ({ createInsForgeAdminClient: mocks.admin }));
vi.mock("@/lib/insforge/server", () => ({ createInsForgeServerClient: mocks.server }));
vi.mock("@/lib/api/response", () => ({
  invalidInput: () => Response.json({ code: "INVALID_INPUT" }, { status: 400 }),
  apiError: (error: unknown) => {
    const structured = error && typeof error === "object" && "status" in error && "code" in error
      ? error as { status: number; code: string }
      : null;
    return Response.json({ code: structured?.code ?? "ERROR" }, { status: structured?.status ?? 500 });
  },
}));

import { POST } from "./route";

const paymentId = "11111111-1111-4111-8111-111111111111";
const orderId = "22222222-2222-4222-8222-222222222222";
const organizationId = "33333333-3333-4333-8333-333333333333";
const metadataId = "44444444-4444-4444-8444-444444444444";

function requestWithEvidence() {
  const form = new FormData();
  form.set("file", new File([new TextEncoder().encode("%PDF-1.7 test")], "evidence.pdf", { type: "application/pdf" }));
  return new Request("https://example.test/api/admin/supplier-payments/mark-paid", { method: "POST", body: form }) as never;
}

describe("supplier payment mark-paid route", () => {
  let paymentRead = 0;
  let initialPayment: { data: unknown; error: unknown };
  let reconciliation: { data: unknown; error: unknown };
  let supplierOrder: { data: unknown; error: unknown };

  beforeEach(() => {
    vi.resetAllMocks();
    paymentRead = 0;
    initialPayment = { data: { id: paymentId, supplier_order_id: orderId, status: "APPROVED" }, error: null };
    reconciliation = { data: { status: "APPROVED", evidence_file_id: null }, error: null };
    supplierOrder = { data: { id: orderId, organization_id: organizationId }, error: null };
    mocks.guard.mockResolvedValue({ userId: "user-maker", permissions: ["supplier_payments.manage"] });
    mocks.upload.mockResolvedValue({ data: { key: "payments/supplier/private/evidence.pdf", url: "https://storage.invalid/evidence.pdf" }, error: null });
    mocks.remove.mockResolvedValue({ data: null, error: null });
    mocks.metadataInsert.mockResolvedValue({ data: { id: metadataId, original_name: "evidence.pdf", mime_type: "application/pdf", size_bytes: 13, visibility: "CONFIDENTIAL" }, error: null });
    mocks.metadataDelete.mockResolvedValue({ data: null, error: null });
    mocks.getCurrentUser.mockResolvedValue({ data: { user: { id: "user-maker", email: "maker@example.test" } }, error: null });
    mocks.markPaid.mockResolvedValue({ data: { id: paymentId }, error: null });
    mocks.notify.mockResolvedValue({ data: null, error: null });

    const from = vi.fn((table: string) => {
      if (table === "supplier_payments") return {
        select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => (++paymentRead === 1 ? initialPayment : reconciliation)) })) })),
      };
      if (table === "supplier_orders") return {
        select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => supplierOrder) })) })),
      };
      if (table === "file_metadata") return {
        insert: vi.fn(() => ({ select: vi.fn(() => ({ single: mocks.metadataInsert })) })),
        delete: vi.fn(() => ({ eq: mocks.metadataDelete })),
      };
      throw new Error(`Unexpected table: ${table}`);
    });
    mocks.admin.mockReturnValue({ database: { from }, storage: { from: vi.fn(() => ({ upload: mocks.upload, remove: mocks.remove })) } });
    mocks.server.mockResolvedValue({
      auth: { getCurrentUser: mocks.getCurrentUser },
      database: { rpc: vi.fn((name: string, input: unknown) => name === "mark_supplier_payment_paid" ? mocks.markPaid(input) : mocks.notify(input)) },
    });
  });

  it("rejects a malformed payment id before access or backend reads", async () => {
    const response = await POST(new Request("https://example.test", { method: "POST" }) as never, { params: Promise.resolve({ id: "bad" }) });
    expect(response.status).toBe(400);
    expect(mocks.guard).not.toHaveBeenCalled();
    expect(mocks.admin).not.toHaveBeenCalled();
  });

  it.each([[401, "SESSION_REVOKED"], [403, "FORBIDDEN"]])("stops on access failure %s before uploading", async (status, code) => {
    mocks.guard.mockRejectedValue(new MockAppAccessError(code as string, status as number, "denied"));
    const response = await POST(requestWithEvidence(), { params: Promise.resolve({ id: paymentId }) });
    expect(response.status).toBe(status);
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("stops a cross-organization actor before uploading evidence", async () => {
    mocks.assertOrganizationPermission.mockImplementation(() => { throw new MockAppAccessError("FORBIDDEN", 403, "cross-org"); });
    const response = await POST(requestWithEvidence(), { params: Promise.resolve({ id: paymentId }) });
    expect(response.status).toBe(403);
    expect(mocks.assertOrganizationPermission).toHaveBeenCalledWith(expect.anything(), ["supplier_payments.manage"], organizationId);
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("does not create metadata or call the paid RPC when storage upload fails", async () => {
    mocks.upload.mockResolvedValue({ data: null, error: new Error("upload denied") });
    const response = await POST(requestWithEvidence(), { params: Promise.resolve({ id: paymentId }) });
    expect(response.status).toBe(500);
    expect(mocks.metadataInsert).not.toHaveBeenCalled();
    expect(mocks.markPaid).not.toHaveBeenCalled();
    expect(mocks.remove).toHaveBeenCalledOnce();
  });

  it("removes the uploaded object when file metadata creation fails", async () => {
    mocks.metadataInsert.mockResolvedValue({ data: null, error: new Error("metadata denied") });
    const response = await POST(requestWithEvidence(), { params: Promise.resolve({ id: paymentId }) });
    expect(response.status).toBe(500);
    expect(mocks.markPaid).not.toHaveBeenCalled();
    expect(mocks.remove).toHaveBeenCalledWith("payments/supplier/private/evidence.pdf");
    expect(mocks.metadataDelete).not.toHaveBeenCalled();
  });

  it("cleans evidence after a known maker-checker rejection that reconciles as not paid", async () => {
    mocks.markPaid.mockResolvedValue({ data: null, error: new Error("SUPPLIER_PAYMENT_MAKER_CHECKER_REQUIRED") });
    const response = await POST(requestWithEvidence(), { params: Promise.resolve({ id: paymentId }) });
    expect(response.status).toBe(500);
    expect(mocks.metadataDelete).toHaveBeenCalledWith("id", metadataId);
    expect(mocks.remove).toHaveBeenCalledWith("payments/supplier/private/evidence.pdf");
  });

  it("preserves evidence when an RPC failure cannot be reconciled safely", async () => {
    mocks.markPaid.mockRejectedValue(new Error("network lost"));
    reconciliation = { data: null, error: new Error("read unavailable") };
    const response = await POST(requestWithEvidence(), { params: Promise.resolve({ id: paymentId }) });
    expect(response.status).toBe(503);
    expect((await response.json()).code).toBe("PAYMENT_STATUS_UNCONFIRMED");
    expect(mocks.metadataDelete).not.toHaveBeenCalled();
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("treats a lost RPC response as success when reconciliation proves the same evidence is paid", async () => {
    mocks.markPaid.mockRejectedValue(new Error("response lost"));
    reconciliation = { data: { status: "PAID", evidence_file_id: metadataId }, error: null };
    const response = await POST(requestWithEvidence(), { params: Promise.resolve({ id: paymentId }) });
    expect(response.status).toBe(200);
    expect((await response.json()).notificationWarning).toContain("ไม่ได้รับผลตอบกลับ");
    expect(mocks.metadataDelete).not.toHaveBeenCalled();
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("logs only sanitized cleanup context when cleanup itself fails", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.markPaid.mockResolvedValue({ data: null, error: new Error("known failure") });
    mocks.remove.mockRejectedValue(new Error("storage unavailable"));
    const response = await POST(requestWithEvidence(), { params: Promise.resolve({ id: paymentId }) });
    expect(response.status).toBe(500);
    expect(log).toHaveBeenCalledWith("Supplier payment evidence cleanup incomplete", {
      supplierPaymentId: paymentId, metadataCleanupRequested: true, objectCleanupRequested: true,
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain("payments/supplier/private/evidence.pdf");
    log.mockRestore();
  });
});
