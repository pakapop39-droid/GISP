import type { QcInspection, QcReopenEvent } from "./types";

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

export function qcHistoryTitle(
  inspection: QcHistoryInspection,
  parentResult?: QcInspection["result"],
) {
  if (isMemberReviewEvent(inspection)) return "Member ขอตรวจเพิ่มเติม";

  const roundLabel = inspection.inspection_type === "REINSPECTION"
    ? parentResult === "PASSED" ? "ตรวจซ้ำหลังผ่าน" : "ตรวจซ้ำ"
    : "ตรวจครั้งแรก";
  return `${roundLabel} · ${qcResultLabels[inspection.result]}`;
}

export type QcHistoryTimelineEntry =
  | { kind: "inspection"; id: string; at: string; inspection: QcInspection }
  | { kind: "reopen"; id: string; at: string; reopen: QcReopenEvent };

export function qcHistoryTimeline(
  inspections: QcInspection[],
  reopenEvents: QcReopenEvent[],
): QcHistoryTimelineEntry[] {
  const entries: QcHistoryTimelineEntry[] = [
    ...inspections.map((inspection) => ({
      kind: "inspection" as const,
      id: inspection.id,
      at: inspection.inspected_at,
      inspection,
    })),
    ...reopenEvents.map((reopen) => ({
      kind: "reopen" as const,
      id: reopen.id,
      at: reopen.created_at,
      reopen,
    })),
  ];
  return entries.sort((a, b) => {
    const timeOrder = Date.parse(a.at) - Date.parse(b.at);
    if (timeOrder) return timeOrder;
    // On equal timestamps, retain the causal order PASS -> reopen -> new result.
    const rank = (entry: QcHistoryTimelineEntry) => entry.kind === "reopen"
      ? 1 : entry.inspection.inspection_type === "REINSPECTION" ? 2 : 0;
    return rank(a) - rank(b) || a.id.localeCompare(b.id);
  });
}

export function qcReworkNoteLabel(inspection: QcHistoryInspection) {
  return isMemberReviewEvent(inspection)
    ? "สิ่งที่ขอตรวจเพิ่ม:"
    : "การแก้ไข:";
}
