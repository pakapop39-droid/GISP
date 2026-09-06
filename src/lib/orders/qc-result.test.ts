import { describe, expect, it } from "vitest";
import { deriveQcOverallResult } from "./qc-result";

describe("QC overall result", () => {
  it("passes automatically when every checklist item passes", () => {
    expect(deriveQcOverallResult(["PASSED", "PASSED", "PASSED"])).toBe("PASSED");
  });

  it("fails automatically when inspection is complete and any item fails", () => {
    expect(deriveQcOverallResult(["PASSED", "FAILED", "PASSED"])).toBe("FAILED");
  });

  it("allows a failed inspection to be marked for rework", () => {
    expect(deriveQcOverallResult(
      ["PASSED", "FAILED", "PASSED"],
      "REWORK_REQUIRED",
    )).toBe("REWORK_REQUIRED");
  });

  it("does not produce an overall result before every item is inspected", () => {
    expect(deriveQcOverallResult(["PASSED", "NOT_INSPECTED", "PASSED"])).toBeNull();
  });
});
