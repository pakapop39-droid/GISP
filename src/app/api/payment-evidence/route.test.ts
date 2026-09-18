import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  guard: vi.fn(), upload: vi.fn(), insertPayload: null as null | Record<string, unknown>,
}));
vi.mock("@/lib/auth/session", () => ({
  AppAccessError: class AppAccessError extends Error {
    constructor(public code: string, public status: number, message: string) { super(message); }
  },
  requireAppAccess: mocks.guard,
}));
vi.mock("@/lib/api/response", () => ({
  apiError: (error: { status?: number }) => Response.json({}, { status: error.status ?? 500 }),
}));
vi.mock("@/lib/insforge/admin", () => ({ createInsForgeAdminClient: () => ({
  storage: { from: () => ({ upload: mocks.upload }) },
  database: { from: () => {
    const query = {
      insert: (rows: Record<string, unknown>[]) => { mocks.insertPayload = rows[0]; return query; },
      select: () => query,
      single: async () => ({ data: { id: "file-id" }, error: null }),
    };
    return query;
  } },
}) }));

import { POST } from "./route";

function request(purpose?: string) {
  const form = new FormData();
  form.set("file", new File([new Uint8Array([1])], "proof.png", { type: "image/png" }));
  if (purpose) form.set("purpose", purpose);
  return new Request("https://gisp.example.test/api/payment-evidence", { method: "POST", body: form }) as never;
}

describe("customer payment evidence", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.insertPayload = null;
    mocks.guard.mockResolvedValue({
      roles: ["MEMBER"], memberProfileId: "member-profile", organizationId: "member-org", userId: "member-user",
    });
    mocks.upload.mockResolvedValue({ data: { key: "payments/member/file.png", url: "private" }, error: null });
  });

  it("keeps the member customer-evidence flow", async () => {
    expect((await POST(request())).status).toBe(201);
    expect(mocks.insertPayload).toMatchObject({
      organization_id: "member-org",
      member_profile_id: "member-profile",
      bucket: "gisp-member-private",
      visibility: "MEMBER_PRIVATE",
      entity_type: "CUSTOMER_PAYMENT_EVIDENCE",
    });
  });

  it("rejects the old supplier upload path before uploading", async () => {
    expect((await POST(request("SUPPLIER"))).status).toBe(400);
    expect(mocks.upload).not.toHaveBeenCalled();
  });
});
