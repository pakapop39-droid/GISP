import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./route.ts", import.meta.url), "utf8");

describe("member Order duplicate integrity", () => {
  it("rejects duplicate project items before invoking the Order RPC", () => {
    const normalization = source.indexOf("id.toLowerCase()");
    const duplicateCheck = source.indexOf("new Set(selections.map");
    const duplicateError = source.indexOf("DUPLICATE_PROJECT_ITEM");
    const rpcCall = source.indexOf("return runRpcRoute");

    expect(normalization).toBeGreaterThan(-1);
    expect(duplicateCheck).toBeGreaterThan(normalization);
    expect(duplicateError).toBeGreaterThan(duplicateCheck);
    expect(rpcCall).toBeGreaterThan(duplicateError);
  });

  it("normalizes a mixed-case UUID duplicate to the same Set key", () => {
    const lower = "abcdefab-cdef-4abc-8abc-abcdefabcdef";
    const upper = lower.toUpperCase();
    const normalized = [lower, upper].map((id) => id.toLowerCase());
    expect(new Set(normalized).size).toBe(1);
  });
});
