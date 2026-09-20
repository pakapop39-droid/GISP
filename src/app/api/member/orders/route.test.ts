import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./route.ts", import.meta.url), "utf8");

describe("member Order duplicate integrity", () => {
  it("rejects duplicate project items before invoking the Order RPC", () => {
    const duplicateCheck = source.indexOf("new Set(selections.map");
    const duplicateError = source.indexOf("DUPLICATE_PROJECT_ITEM");
    const rpcCall = source.indexOf("return runRpcRoute");

    expect(duplicateCheck).toBeGreaterThan(-1);
    expect(duplicateError).toBeGreaterThan(duplicateCheck);
    expect(rpcCall).toBeGreaterThan(duplicateError);
  });
});
