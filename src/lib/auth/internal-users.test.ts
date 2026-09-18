import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  adminClient: vi.fn(),
  rpc: vi.fn(),
  serverClient: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/insforge/admin", () => ({
  createInsForgeAdminClient: mocks.adminClient,
}));
vi.mock("@/lib/insforge/server", () => ({
  createInsForgeServerClient: mocks.serverClient,
}));

import { listInternalUsers } from "./internal-users";

describe("listInternalUsers", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.serverClient.mockResolvedValue({ database: { rpc: mocks.rpc } });
    mocks.rpc.mockResolvedValue({ data: [], error: null });
  });

  it("uses one authenticated RPC, maps the stable response, and sorts names in Thai", async () => {
    mocks.rpc.mockResolvedValue({
      data: [
        { id: "user-c", full_name: "ขวัญ", email: null, status: "INACTIVE", roles: null },
        { id: "user-b", full_name: "กานต์", email: "b@example.test", status: "ACTIVE", roles: ["LOGISTICS"] },
        { id: "user-a", full_name: "กานต์", email: "a@example.test", status: "SUSPENDED", roles: ["FINANCE"] },
      ],
      error: null,
    });

    await expect(listInternalUsers()).resolves.toEqual([
      { id: "user-a", full_name: "กานต์", email: "a@example.test", status: "SUSPENDED", roles: ["FINANCE"] },
      { id: "user-b", full_name: "กานต์", email: "b@example.test", status: "ACTIVE", roles: ["LOGISTICS"] },
      { id: "user-c", full_name: "ขวัญ", email: "", status: "INACTIVE", roles: [] },
    ]);
    expect(mocks.serverClient).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith("list_internal_staff_users");
    expect(mocks.adminClient).not.toHaveBeenCalled();
  });

  it("propagates the RPC error instead of returning a partial or empty list", async () => {
    const failure = new Error("socket unavailable");
    mocks.rpc.mockResolvedValue({ data: null, error: failure });

    await expect(listInternalUsers()).rejects.toBe(failure);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.adminClient).not.toHaveBeenCalled();
  });
});
