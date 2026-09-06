import { describe, expect, it } from "vitest";
import { isMemberReviewEvent, qcHistoryTitle, qcReworkNoteLabel } from "./qc-history-presentation";

describe("QC history presentation", () => {
  it("shows member additional review as a business event instead of an initial QC result", () => {
    const inspection = {
      checklist_version: "MEMBER-REVIEW",
      inspection_type: "INITIAL" as const,
      result: "REWORK_REQUIRED" as const,
    };

    expect(isMemberReviewEvent(inspection)).toBe(true);
    expect(qcHistoryTitle(inspection)).toBe("Member ขอตรวจเพิ่มเติม");
    expect(qcReworkNoteLabel(inspection)).toBe("สิ่งที่ขอตรวจเพิ่ม:");
  });

  it("translates normal QC results and keeps the inspection round clear", () => {
    const inspection = {
      checklist_version: "QC-V1",
      inspection_type: "REINSPECTION" as const,
      result: "PASSED" as const,
    };

    expect(isMemberReviewEvent(inspection)).toBe(false);
    expect(qcHistoryTitle(inspection)).toBe("ตรวจซ้ำ · ผ่าน QC");
    expect(qcReworkNoteLabel(inspection)).toBe("การแก้ไข:");
  });
});
