import { describe, expect, it } from "vitest";
import { canCloseClaim, claimedQuantityIsAvailable, suggestClaimResponsibility } from "./policy";

describe("Slice 9 claim responsibility", () => {
  it.each([
    ["PRODUCTION_QUALITY", "SUPPLIER"],
    ["WRONG_ITEM", "SUPPLIER"],
    ["TRANSIT_DAMAGE", "LOGISTICS_INSURANCE"],
    ["MISSING", "LOGISTICS_INSURANCE"],
    ["INSTALLATION", "INSTALLER"],
    ["OTHER", "UNDETERMINED"],
  ])("maps %s to %s", (issue, expected) => {
    expect(suggestClaimResponsibility(issue)).toBe(expected);
  });
});

describe("Slice 9 close gate", () => {
  it("requires resolution, execution evidence and member confirmation", () => {
    expect(canCloseClaim({ status: "RESOLVED", resolutionDetails: "ซ่อมแล้ว", resolutionEvidenceFileId: "file", memberConfirmedAt: "2026-08-30" })).toBe(true);
    expect(canCloseClaim({ status: "RESOLVED", resolutionDetails: "ซ่อมแล้ว", resolutionEvidenceFileId: null, memberConfirmedAt: "2026-08-30" })).toBe(false);
    expect(canCloseClaim({ status: "RESOLVED", resolutionDetails: "ซ่อมแล้ว", resolutionEvidenceFileId: "file", memberConfirmedAt: null })).toBe(false);
  });
});

describe("Slice 9 claimed quantity", () => {
  it("never exceeds delivered quantity", () => {
    expect(claimedQuantityIsAvailable(2, 1, 1)).toBe(true);
    expect(claimedQuantityIsAvailable(2, 1, 1.001)).toBe(false);
    expect(claimedQuantityIsAvailable(2, 0, 0)).toBe(false);
  });
});
