import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  requireAppAccess: vi.fn(),
  getCurrentUser: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ requireAppAccess: mocks.requireAppAccess }));
vi.mock("@/lib/insforge/server", () => ({
  createInsForgeServerClient: vi.fn(async () => ({
    auth: { getCurrentUser: mocks.getCurrentUser },
    database: { rpc: mocks.rpc },
  })),
}));
vi.mock("@/lib/api/response", () => ({
  apiError: (error: { message?: string }) => NextResponse.json({ message: error.message ?? "error" }, { status: 403 }),
}));

import { POST, qcReopenSchema } from "./route";

const itemId = "00000000-0000-4000-8000-000000000001";
const request = (body: unknown) => new NextRequest("http://localhost/api/admin/qc-inspections/reopen", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
});

describe("QC reopen API contract", () => {
  beforeEach(() => {
    mocks.requireAppAccess.mockReset().mockResolvedValue({ userId: "qc-user" });
    mocks.getCurrentUser.mockReset().mockResolvedValue({ data: { user: { id: "qc-user" } }, error: null });
    mocks.rpc.mockReset().mockResolvedValue({ data: itemId, error: null });
  });

  it("requires a real item id and meaningful, bounded reason", async () => {
    expect(qcReopenSchema.safeParse({ order_item_id: itemId, reason: "  พบตำหนิ  " }).data)
      .toEqual({ order_item_id: itemId, reason: "พบตำหนิ" });
    expect((await POST(request({ order_item_id: itemId, reason: "  " }))).status).toBe(400);
    expect((await POST(request({ order_item_id: "bad", reason: "พบตำหนิ" }))).status).toBe(400);
    expect((await POST(request({ order_item_id: itemId, reason: "x".repeat(1201) }))).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("requires an active session and routes through the scoped RPC", async () => {
    const response = await POST(request({ order_item_id: itemId, reason: "พบตำหนิหลังตรวจผ่าน" }));
    expect(response.status).toBe(200);
    expect(mocks.requireAppAccess).toHaveBeenCalledWith({ active: true });
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("reopen_qc_inspection", {
      order_item_id_input: itemId,
      reason_input: "พบตำหนิหลังตรวจผ่าน",
    });
  });

  it("returns 401 without current user and never writes", async () => {
    mocks.getCurrentUser.mockResolvedValue({ data: null, error: { message: "revoked" } });
    const response = await POST(request({ order_item_id: itemId, reason: "พบตำหนิหลังตรวจผ่าน" }));
    expect(response.status).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("does not queue a notification on repeated successful calls", async () => {
    await POST(request({ order_item_id: itemId, reason: "พบตำหนิหลังตรวจผ่าน" }));
    await POST(request({ order_item_id: itemId, reason: "พบตำหนิหลังตรวจผ่าน" }));
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
    expect(mocks.rpc).not.toHaveBeenCalledWith("queue_current_user_notification", expect.anything());
  });
});
