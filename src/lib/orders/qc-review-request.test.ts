import { describe, expect, it } from "vitest";
import { buildAdditionalReviewNote } from "./qc-review-request";

describe("additional QC review request", () => {
  it("requires at least one reason", () => {
    expect(buildAdditionalReviewNote([], "")).toBeNull();
  });

  it("requires detail when Other is selected", () => {
    expect(buildAdditionalReviewNote(["OTHER"], "   ")).toBeNull();
  });

  it("builds a clear request from selected reasons", () => {
    expect(buildAdditionalReviewNote(["MORE_MEDIA", "ASSEMBLY_FINISH"], "ขอภาพรอยต่อด้านใน"))
      .toBe("Member ขอให้ตรวจเพิ่มเติม:\n• ขอรูปหรือวิดีโอเพิ่มเติม\n• ตรวจงานประกอบและผิวสำเร็จซ้ำ\nรายละเอียด: ขอภาพรอยต่อด้านใน");
  });
});
