import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rows: {} as Record<string, Record<string, unknown> | null>,
  calls: [] as string[],
  permission: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "raw-session" }) }) }));
vi.mock("@/lib/auth/session", () => ({
  APP_SESSION_COOKIE: "gisp_session", AppAccessError: class extends Error { status = 401; },
  hashSessionToken: (token: string) => `hashed-${token}`,
}));
vi.mock("@/lib/insforge/admin", () => ({ createInsForgeAdminClient: () => ({ database: { from: (table: string) => {
  mocks.calls.push(table);
  const query = { select: () => query, eq: () => query,
    maybeSingle: async () => ({ data: mocks.rows[table] ?? null, error: null }) };
  return query;
} } }) }));
vi.mock("@/lib/insforge/server", () => ({ createInsForgeServerClient: async () => ({ database: { rpc: mocks.permission } }) }));

import { currentFinanceSessionHash, loadAuthorizedFinanceTransfer } from "./finance-access";

describe("target-scoped Finance access", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.calls = [];
    mocks.rows = {
      payment_transfers: { id: "transfer", organization_id: "target-org", payment_schedule_id: "schedule", status: "SUBMITTED" },
      payment_schedules: { id: "schedule", organization_id: "target-org", schedule_type: "DEPOSIT" },
    };
    mocks.permission.mockResolvedValue({ data: true, error: null });
  });

  it("uses the transfer's non-null organization rather than a staff profile organization", async () => {
    expect(await loadAuthorizedFinanceTransfer("transfer")).toMatchObject({ organizationId: "target-org", scheduleType: "DEPOSIT" });
    expect(mocks.permission).toHaveBeenCalledWith("has_permission", {
      permission_code: "payments.verify", target_organization_id: "target-org",
    });
    expect(await currentFinanceSessionHash()).toBe("hashed-raw-session");
  });

  it("does not inspect a schedule for another organization when permission is denied", async () => {
    mocks.permission.mockResolvedValueOnce({ data: false, error: null });
    expect(await loadAuthorizedFinanceTransfer("transfer")).toBeNull();
    expect(mocks.calls).toEqual(["payment_transfers"]);
  });

  it("fails closed for missing organization or inconsistent schedule tenant", async () => {
    mocks.rows.payment_transfers = { ...mocks.rows.payment_transfers, organization_id: null };
    expect(await loadAuthorizedFinanceTransfer("transfer")).toBeNull();
    expect(mocks.permission).not.toHaveBeenCalled();
    mocks.rows.payment_transfers = { ...mocks.rows.payment_transfers, organization_id: "target-org" };
    mocks.rows.payment_schedules = { ...mocks.rows.payment_schedules, organization_id: "other-org" };
    expect(await loadAuthorizedFinanceTransfer("transfer")).toBeNull();
  });
});
