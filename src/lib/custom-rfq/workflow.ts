import type { CustomRequestStatus } from "./types";

export const adminCustomRequestActionFeedback = {
  START_REVIEW: "เริ่มตรวจสอบแล้ว · สถานะใหม่: กำลังตรวจสอบ",
  REQUEST_INFO: "ส่งคำขอข้อมูลเพิ่มแล้ว · สถานะใหม่: รอข้อมูลเพิ่ม",
  READY_FOR_QUOTE: "ส่งต่อเพื่อทำใบเสนอราคาแล้ว · สถานะใหม่: พร้อมทำใบเสนอราคา",
  CANCEL: "ยกเลิกคำขอแล้ว · สถานะใหม่: ยกเลิก",
  SAVE_NOTE: "บันทึกหมายเหตุภายในแล้ว · สถานะไม่เปลี่ยน",
} as const;

export type AdminCustomRequestAction = keyof typeof adminCustomRequestActionFeedback;

export function getAdminCustomRequestActionFeedback(action: AdminCustomRequestAction) {
  return adminCustomRequestActionFeedback[action];
}

const transitions: Record<CustomRequestStatus, readonly CustomRequestStatus[]> = {
  DRAFT: ["SUBMITTED", "CANCELLED"],
  SUBMITTED: ["UNDER_REVIEW", "CANCELLED"],
  UNDER_REVIEW: ["NEED_INFO", "READY_FOR_QUOTE", "CANCELLED"],
  NEED_INFO: ["SUBMITTED", "CANCELLED"],
  READY_FOR_QUOTE: ["CONVERTED", "CANCELLED"],
  CONVERTED: [],
  CANCELLED: [],
};

export function canTransitionCustomRequest(from: CustomRequestStatus, to: CustomRequestStatus) {
  return transitions[from].includes(to);
}

export function canCancelCustomRequest(status: CustomRequestStatus) {
  return status !== "CONVERTED" && status !== "CANCELLED";
}
