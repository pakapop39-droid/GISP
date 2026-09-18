import { beforeEach, describe, expect, it, vi } from "vitest";

const transferId = "11111111-1111-4111-8111-111111111111";
const scheduleId = "22222222-2222-4222-8222-222222222222";
const orderId = "33333333-3333-4333-8333-333333333333";
const fileId = "44444444-4444-4444-8444-444444444444";
const organizationId = "55555555-5555-4555-8555-555555555555";
const memberId = "66666666-6666-4666-8666-666666666666";
const pdf = new Blob(["%PDF-1.7\nexample"], { type: "application/pdf" });

const mocks = vi.hoisted(() => ({
  rows: {} as Record<string, Record<string, unknown> | null>,
  download: vi.fn(),
  queries: [] as Array<{ table: string; field: string; value: unknown }>,
}));
vi.mock("@/lib/insforge/admin", () => ({
  createInsForgeAdminClient: () => ({
    database: { from: (table: string) => {
      const query = {
        select: () => query,
        eq: (field: string, value: unknown) => { mocks.queries.push({ table, field, value }); return query; },
        maybeSingle: async () => ({ data: mocks.rows[table] ?? null, error: null }),
      };
      return query;
    } },
    storage: { from: () => ({ download: mocks.download }) },
  }),
}));

import { loadBoundCustomerPaymentEvidence } from "./bound-evidence";

describe("customer payment evidence binding", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.queries = [];
    mocks.rows = {
      payment_transfers: { id: transferId, organization_id: organizationId, payment_schedule_id: scheduleId, evidence_file_id: fileId },
      payment_schedules: { id: scheduleId, organization_id: organizationId, order_id: orderId },
      customer_orders: { id: orderId, organization_id: organizationId, member_profile_id: memberId },
      file_metadata: { id: fileId, organization_id: organizationId, member_profile_id: memberId, entity_type: "CUSTOMER_PAYMENT_EVIDENCE", entity_id: transferId, visibility: "MEMBER_PRIVATE", bucket: "gisp-member-private", object_key: "payments/member/proof.pdf", mime_type: "application/pdf", size_bytes: pdf.size },
    };
    mocks.download.mockResolvedValue({ data: pdf, error: null });
  });

  it("returns the actual private stored bytes only for the exact transfer pointer and tenant", async () => {
    const result = await loadBoundCustomerPaymentEvidence(transferId, organizationId);
    expect(result?.blob).toBe(pdf);
    expect(result?.fileId).toBe(fileId);
    expect(result?.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result?.byteSize).toBe(pdf.size);
    expect(mocks.queries).toContainEqual({ table: "file_metadata", field: "id", value: fileId });
    expect(mocks.download).toHaveBeenCalledWith("payments/member/proof.pdf");
  });

  it.each([
    ["organization_id", "other-organization"],
    ["member_profile_id", "other-member"],
    ["entity_type", "SUPPLIER_PAYMENT_EVIDENCE"],
    ["entity_id", null],
    ["entity_id", "other-transfer"],
    ["visibility", "PUBLIC"],
    ["bucket", "other-bucket"],
  ])("rejects wrong file %s before storage access", async (field, value) => {
    mocks.rows.file_metadata = { ...mocks.rows.file_metadata, [field]: value };
    expect(await loadBoundCustomerPaymentEvidence(transferId, organizationId)).toBeNull();
    expect(mocks.download).not.toHaveBeenCalled();
  });

  it("rejects another staff organization's transfer before file lookup", async () => {
    expect(await loadBoundCustomerPaymentEvidence(transferId, "other-org")).toBeNull();
    expect(mocks.queries.some((query) => query.table === "file_metadata")).toBe(false);
  });

  it("rejects missing, corrupted or spoofed storage data", async () => {
    mocks.download.mockResolvedValueOnce({ data: null, error: new Error("not found") });
    expect(await loadBoundCustomerPaymentEvidence(transferId, organizationId)).toBeNull();
    mocks.download.mockResolvedValueOnce({ data: new Blob(["not a PDF"], { type: "application/pdf" }), error: null });
    expect(await loadBoundCustomerPaymentEvidence(transferId, organizationId)).toBeNull();
    mocks.rows.file_metadata = { ...mocks.rows.file_metadata, size_bytes: 11 * 1024 * 1024 };
    expect(await loadBoundCustomerPaymentEvidence(transferId, organizationId)).toBeNull();
  });
});
