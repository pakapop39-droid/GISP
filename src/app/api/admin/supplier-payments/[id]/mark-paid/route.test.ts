import { beforeEach, describe, expect, it, vi } from "vitest";

const paymentId = "11111111-1111-4111-8111-111111111111";
const supplierOrderId = "22222222-2222-4222-8222-222222222222";
const organizationId = "33333333-3333-4333-8333-333333333333";
const metadataId = "44444444-4444-4444-8444-444444444444";

const mocks = vi.hoisted(() => ({
  guard: vi.fn(),
  payment: null as null | { id: string; supplier_order_id: string; status: string },
  paymentError: null as Error | null,
  reconciliationPayment: undefined as undefined | null | { status: string; evidence_file_id: string | null },
  reconciliationError: null as Error | null,
  reconciliationThrows: false,
  paymentReadCount: 0,
  supplierOrder: null as null | { id: string; organization_id: string | null },
  supplierOrderError: null as Error | null,
  upload: vi.fn(),
  remove: vi.fn(),
  metadataInsert: vi.fn(),
  metadataError: null as Error | null,
  metadataDeleteEq: vi.fn(),
  rpc: vi.fn(),
  getCurrentUser: vi.fn(),
  insertPayload: null as null | Record<string, unknown>,
  queriedTables: [] as string[],
}));

vi.mock("@/lib/auth/session", () => ({
  AppAccessError: class AppAccessError extends Error {
    constructor(public code: string, public status: number, message: string) { super(message); }
  },
  requireAppAccess: mocks.guard,
}));
vi.mock("@/lib/api/response", () => ({
  apiError: (error: { status?: number; message?: string }) => Response.json(
    { message: error.message },
    { status: error.status ?? 500 },
  ),
  invalidInput: () => Response.json({}, { status: 400 }),
}));
vi.mock("@/lib/insforge/server", () => ({
  createInsForgeServerClient: async () => ({
    auth: { getCurrentUser: mocks.getCurrentUser },
    database: { rpc: mocks.rpc },
  }),
}));
vi.mock("@/lib/insforge/admin", () => ({
  createInsForgeAdminClient: () => ({
    storage: { from: () => ({ upload: mocks.upload, remove: mocks.remove }) },
    database: { from: (table: string) => {
      mocks.queriedTables.push(table);
      if (table === "supplier_payments") {
        const query = {
          select: () => query,
          eq: () => query,
          maybeSingle: async () => {
            const isReconciliation = mocks.paymentReadCount++ > 0;
            if (isReconciliation && mocks.reconciliationThrows) throw new Error("reconciliation transport failed");
            if (isReconciliation && (mocks.reconciliationPayment !== undefined || mocks.reconciliationError)) {
              return { data: mocks.reconciliationPayment ?? null, error: mocks.reconciliationError };
            }
            return { data: mocks.payment, error: mocks.paymentError };
          },
        };
        return query;
      }
      if (table === "supplier_orders") {
        const query = {
          select: () => query,
          eq: () => query,
          maybeSingle: async () => ({ data: mocks.supplierOrder, error: mocks.supplierOrderError }),
        };
        return query;
      }
      const query = {
        insert: (rows: Record<string, unknown>[]) => {
          mocks.insertPayload = rows[0];
          mocks.metadataInsert(rows);
          return query;
        },
        select: () => query,
        single: async () => ({
          data: mocks.metadataError ? null : { id: metadataId, visibility: "CONFIDENTIAL" },
          error: mocks.metadataError,
        }),
        delete: () => query,
        eq: mocks.metadataDeleteEq,
      };
      return query;
    } },
  }),
}));

import { POST } from "./route";

const params = (id = paymentId) => ({ params: Promise.resolve({ id }) });
function request(file = new File([
  new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
], "proof.png", { type: "image/png" })) {
  const form = new FormData();
  form.set("file", file);
  form.set("organization_id", "browser-controlled-value");
  return new Request("https://gisp.example.test/api/admin/supplier-payments/id/mark-paid", {
    method: "POST",
    body: form,
  }) as never;
}

describe("supplier payment evidence binding", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.payment = { id: paymentId, supplier_order_id: supplierOrderId, status: "APPROVED" };
    mocks.paymentError = null;
    mocks.reconciliationPayment = undefined;
    mocks.reconciliationError = null;
    mocks.reconciliationThrows = false;
    mocks.paymentReadCount = 0;
    mocks.supplierOrder = { id: supplierOrderId, organization_id: organizationId };
    mocks.supplierOrderError = null;
    mocks.insertPayload = null;
    mocks.metadataError = null;
    mocks.queriedTables = [];
    mocks.guard.mockResolvedValue({ userId: "finance-user", organizationId: null });
    mocks.upload.mockResolvedValue({ data: { key: "payments/supplier/server-key.png", url: "private" }, error: null });
    mocks.remove.mockResolvedValue({ data: null, error: null });
    mocks.metadataDeleteEq.mockResolvedValue({ data: null, error: null });
    mocks.getCurrentUser.mockResolvedValue({ data: { user: { email: "finance@example.test" } }, error: null });
    mocks.rpc.mockResolvedValue({ data: paymentId, error: null });
  });

  it.each([401, 403])("rejects access with %s before reading or uploading", async (status) => {
    mocks.guard.mockRejectedValue({ status, message: "denied" });
    expect((await POST(request(), params())).status).toBe(status);
    expect(mocks.queriedTables).toEqual([]);
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("rejects malformed payment IDs before checking access", async () => {
    expect((await POST(request(), params("bad"))).status).toBe(400);
    expect(mocks.guard).not.toHaveBeenCalled();
  });

  it("rejects missing and non-approved payments without uploading", async () => {
    mocks.payment = null;
    expect((await POST(request(), params())).status).toBe(404);
    mocks.payment = { id: paymentId, supplier_order_id: supplierOrderId, status: "REQUESTED" };
    expect((await POST(request(), params())).status).toBe(409);
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("rejects an invalid file without uploading", async () => {
    const invalid = new File([new Uint8Array([1])], "proof.txt", { type: "text/plain" });
    expect((await POST(request(invalid), params())).status).toBe(400);
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("rejects a supported MIME type with a spoofed file signature", async () => {
    const spoofed = new File(["MZ executable"], "proof.png", { type: "image/png" });
    expect((await POST(request(spoofed), params())).status).toBe(400);
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it.each([
    ["application/pdf", [0x25, 0x50, 0x44, 0x46, 0x2d], "proof.pdf"],
    ["image/jpeg", [0xff, 0xd8, 0xff, 0xe0], "proof.jpg"],
  ])("accepts a real %s signature", async (mime, bytes, name) => {
    const file = new File([new Uint8Array(bytes as number[])], name, { type: mime });
    expect((await POST(request(file), params())).status).toBe(200);
    expect(mocks.upload).toHaveBeenCalledOnce();
  });

  it("rejects files larger than 10 MB without uploading", async () => {
    const oversized = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "proof.png", { type: "image/png" });
    expect((await POST(request(oversized), params())).status).toBe(400);
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("does not upload when the supplier order is missing", async () => {
    mocks.supplierOrder = null;
    expect((await POST(request(), params())).status).toBe(404);
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("uses the supplier order organization and marks the payment paid", async () => {
    const response = await POST(request(), params());
    expect(response.status).toBe(200);
    expect(mocks.insertPayload).toMatchObject({
      organization_id: organizationId,
      member_profile_id: null,
      bucket: "gisp-confidential",
      visibility: "CONFIDENTIAL",
      entity_type: "SUPPLIER_PAYMENT_EVIDENCE",
      entity_id: paymentId,
      uploaded_by: "finance-user",
    });
    expect(mocks.insertPayload?.organization_id).not.toBe("browser-controlled-value");
    expect(mocks.upload).toHaveBeenCalledWith(
      expect.stringMatching(new RegExp(`^payments/supplier/${organizationId}/${paymentId}/.+\\.png$`)),
      expect.any(File),
    );
    expect(mocks.rpc).toHaveBeenCalledWith("mark_supplier_payment_paid", {
      supplier_payment_id_input: paymentId,
      evidence_file_id_input: metadataId,
    });
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(mocks.metadataDeleteEq).not.toHaveBeenCalled();
  });

  it("cleans up only the new metadata and object when mark-paid fails", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: new Error("mark paid failed") });
    expect((await POST(request(), params())).status).toBe(500);
    expect(mocks.metadataDeleteEq).toHaveBeenCalledWith("id", metadataId);
    expect(mocks.remove).toHaveBeenCalledWith("payments/supplier/server-key.png");
  });

  it("reconciles a committed payment when the RPC response is lost", async () => {
    mocks.rpc.mockRejectedValueOnce(new Error("network response lost"));
    mocks.reconciliationPayment = { status: "PAID", evidence_file_id: metadataId };
    const response = await POST(request(), params());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      data: { paymentId, evidence: { id: metadataId } },
      message: "บันทึก Supplier Payment เป็น Paid แล้ว",
      notificationWarning: "ยืนยันสถานะ Paid จากระบบแล้ว แต่ไม่ได้รับผลตอบกลับครั้งแรก กรุณาตรวจประวัติรายการ",
    });
    expect(mocks.paymentReadCount).toBe(2);
    expect(mocks.metadataDeleteEq).not.toHaveBeenCalled();
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("cleans up after reconciliation confirms the payment is not paid", async () => {
    mocks.rpc.mockRejectedValueOnce(new Error("mark paid rejected"));
    mocks.reconciliationPayment = { status: "APPROVED", evidence_file_id: null };
    expect((await POST(request(), params())).status).toBe(500);
    expect(mocks.metadataDeleteEq).toHaveBeenCalledWith("id", metadataId);
    expect(mocks.remove).toHaveBeenCalledWith("payments/supplier/server-key.png");
  });

  it("preserves evidence and returns an actionable response when reconciliation fails", async () => {
    mocks.rpc.mockRejectedValueOnce(new Error("network response lost"));
    mocks.reconciliationError = new Error("reconciliation unavailable");
    const response = await POST(request(), params());
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      code: "PAYMENT_STATUS_UNCONFIRMED",
      message: expect.stringContaining("กรุณาโหลดหน้าใหม่และตรวจสถานะก่อนทำซ้ำ"),
    });
    expect(mocks.metadataDeleteEq).not.toHaveBeenCalled();
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("preserves evidence when the reconciliation transport throws", async () => {
    mocks.rpc.mockRejectedValueOnce(new Error("network response lost"));
    mocks.reconciliationThrows = true;
    const response = await POST(request(), params());
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "PAYMENT_STATUS_UNCONFIRMED" });
    expect(mocks.metadataDeleteEq).not.toHaveBeenCalled();
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("logs cleanup failures without exposing file keys", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.rpc.mockRejectedValueOnce(new Error("mark paid rejected"));
    mocks.reconciliationPayment = { status: "APPROVED", evidence_file_id: null };
    mocks.metadataDeleteEq.mockResolvedValue({ error: new Error("delete failed") });
    mocks.remove.mockRejectedValue(new Error("storage unavailable"));
    expect((await POST(request(), params())).status).toBe(500);
    expect(log).toHaveBeenCalledWith("Supplier payment evidence cleanup incomplete", {
      supplierPaymentId: paymentId,
      metadataCleanupRequested: true,
      objectCleanupRequested: true,
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain("server-key.png");
    log.mockRestore();
  });

  it("keeps the paid evidence when only the notification job fails", async () => {
    mocks.rpc
      .mockResolvedValueOnce({ data: paymentId, error: null })
      .mockResolvedValueOnce({ data: null, error: new Error("notification failed") });
    const response = await POST(request(), params());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      notificationWarning: "ธุรกรรมสำเร็จ แต่สร้าง Email Job ไม่สำเร็จ ระบบต้องตรวจ Log",
    });
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(mocks.metadataDeleteEq).not.toHaveBeenCalled();
  });

  it("keeps the paid evidence when notification transport throws after commit", async () => {
    mocks.rpc
      .mockResolvedValueOnce({ data: paymentId, error: null })
      .mockRejectedValueOnce(new Error("notification transport failed"));
    const response = await POST(request(), params());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      data: { paymentId, evidence: { id: metadataId } },
      message: "บันทึก Supplier Payment เป็น Paid แล้ว",
      notificationWarning: "ธุรกรรมสำเร็จ แต่สร้าง Email Job ไม่สำเร็จ ระบบต้องตรวจ Log",
    });
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(mocks.metadataDeleteEq).not.toHaveBeenCalled();
  });

  it("cleans up the new evidence if the authenticated RPC session is unavailable", async () => {
    mocks.getCurrentUser.mockResolvedValue({ data: null, error: new Error("expired") });
    expect((await POST(request(), params())).status).toBe(401);
    expect(mocks.metadataDeleteEq).toHaveBeenCalledWith("id", metadataId);
    expect(mocks.remove).toHaveBeenCalledWith("payments/supplier/server-key.png");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("removes the new object when metadata creation fails", async () => {
    mocks.metadataError = new Error("metadata failed");
    expect((await POST(request(), params())).status).toBe(500);
    expect(mocks.metadataDeleteEq).not.toHaveBeenCalled();
    expect(mocks.remove).toHaveBeenCalledWith("payments/supplier/server-key.png");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("does not create metadata or call RPC when upload fails", async () => {
    mocks.upload.mockResolvedValue({ data: null, error: new Error("upload failed") });
    expect((await POST(request(), params())).status).toBe(500);
    expect(mocks.metadataInsert).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects a scoped staff user from another organization before uploading", async () => {
    mocks.guard.mockResolvedValue({ userId: "finance-user", organizationId: "other-org" });
    expect((await POST(request(), params())).status).toBe(403);
    expect(mocks.upload).not.toHaveBeenCalled();
  });
});
