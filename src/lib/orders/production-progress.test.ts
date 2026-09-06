import { describe, expect, it } from "vitest";
import {
  latestProductionProgress,
  latestProductionStatus,
  suggestedProductionProgress,
} from "./production-progress";

describe("production progress", () => {
  it("suggests the minimum overall progress for each production status", () => {
    expect(suggestedProductionProgress("ACKNOWLEDGED", 0)).toBe(0);
    expect(suggestedProductionProgress("MATERIAL_PREPARATION", 0)).toBe(10);
    expect(suggestedProductionProgress("IN_PRODUCTION", 10)).toBe(30);
    expect(suggestedProductionProgress("ASSEMBLY", 30)).toBe(60);
    expect(suggestedProductionProgress("FINISHING", 60)).toBe(85);
    expect(suggestedProductionProgress("PRODUCTION_COMPLETED", 85)).toBe(100);
  });

  it("never suggests a value lower than the latest overall progress", () => {
    expect(suggestedProductionProgress("IN_PRODUCTION", 50)).toBe(50);
    expect(suggestedProductionProgress("DELAYED", 50)).toBe(50);
  });

  it("reads the latest saved status and progress", () => {
    const updates = [
      { status: "ACKNOWLEDGED", progress_percent: 0 },
      { status: "IN_PRODUCTION", progress_percent: 50 },
    ];
    expect(latestProductionStatus(updates)).toBe("IN_PRODUCTION");
    expect(latestProductionProgress(updates)).toBe(50);
  });
});
