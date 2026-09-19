import { describe, expect, it, vi } from "vitest";
import { readOnlyRpcWithSocketRetry } from "./read-only-rpc";

describe("read-only RPC transport retry", () => {
  it("retries socket hang up once and returns the successful read", async () => {
    const operation = vi.fn()
      .mockResolvedValueOnce({ data: null, error: { message: "socket hang up" } })
      .mockResolvedValueOnce({ data: true, error: null });

    await expect(readOnlyRpcWithSocketRetry(operation)).resolves.toEqual({ data: true, error: null });
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("does not retry a non-transient backend error", async () => {
    const denied = { data: null, error: { message: "permission denied" } };
    const operation = vi.fn().mockResolvedValue(denied);

    await expect(readOnlyRpcWithSocketRetry(operation)).resolves.toBe(denied);
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("returns the second socket error without a third attempt", async () => {
    const operation = vi.fn().mockResolvedValue({ data: null, error: { message: "socket hang up" } });

    await expect(readOnlyRpcWithSocketRetry(operation)).resolves.toEqual({
      data: null,
      error: { message: "socket hang up" },
    });
    expect(operation).toHaveBeenCalledTimes(2);
  });
});
