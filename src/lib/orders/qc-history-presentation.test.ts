import { describe, expect, it } from "vitest";
import { isMemberReviewEvent, qcHistoryTimeline, qcHistoryTitle, qcReworkNoteLabel } from "./qc-history-presentation";
import type { QcInspection, QcReopenEvent } from "./types";

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

  it("labels a passed-parent reinspection distinctly from failed-parent reinspection", () => {
    const reinspection = {
      checklist_version: "QC-V1", inspection_type: "REINSPECTION" as const,
      result: "FAILED" as const,
    };
    expect(qcHistoryTitle(reinspection, "PASSED")).toBe("ตรวจซ้ำหลังผ่าน · ไม่ผ่าน QC");
    expect(qcHistoryTitle(reinspection, "FAILED")).toBe("ตรวจซ้ำ · ไม่ผ่าน QC");
  });

  it("merges pass, reopen and failed reinspection into actual time order", () => {
    const first = {
      id: "pass", order_item_id: "item", result: "PASSED",
      inspection_type: "INITIAL", parent_inspection_id: null,
      inspected_at: "2026-09-18T01:00:00Z",
    } as QcInspection;
    const failed = {
      id: "fail", order_item_id: "item", result: "FAILED",
      inspection_type: "REINSPECTION", parent_inspection_id: "pass",
      inspected_at: "2026-09-18T03:00:00Z",
    } as QcInspection;
    const reopen = {
      id: "reopen", order_item_id: "item", parent_inspection_id: "pass",
      created_at: "2026-09-18T02:00:00Z", reason: "test", actor_user_id: "actor",
    } as QcReopenEvent;
    expect(qcHistoryTimeline([first, failed], [reopen]).map((entry) => `${entry.kind}:${entry.id}`))
      .toEqual(["inspection:pass", "reopen:reopen", "inspection:fail"]);
  });
});
