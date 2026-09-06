import type { QcInspection } from "./types";

type QcHistoryInspection = Pick<
  QcInspection,
  "checklist_version" | "inspection_type" | "result"
>;

const qcResultLabels: Record<QcInspection["result"], string> = {
  PASSED: "ผ่าน QC",
  FAILED: "ไม่ผ่าน QC",
  REWORK_REQUIRED: "ต้องแก้ไข",
};

export function isMemberReviewEvent(inspection: QcHistoryInspection) {
  return inspection.checklist_version === "MEMBER-REVIEW";
}

export function qcHistoryTitle(inspection: QcHistoryInspection) {
  if (isMemberReviewEvent(inspection)) return "Member ขอตรวจเพิ่มเติม";

  const roundLabel = inspection.inspection_type === "REINSPECTION"
    ? "ตรวจซ้ำ"
    : "ตรวจครั้งแรก";
  return `${roundLabel} · ${qcResultLabels[inspection.result]}`;
}

export function qcReworkNoteLabel(inspection: QcHistoryInspection) {
  return isMemberReviewEvent(inspection)
    ? "สิ่งที่ขอตรวจเพิ่ม:"
    : "การแก้ไข:";
}
