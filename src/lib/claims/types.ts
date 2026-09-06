export const claimStatusLabels: Record<string, string> = {
  SUBMITTED: "ส่งคำขอแล้ว",
  UNDER_REVIEW: "กำลังตรวจสอบ",
  WAITING_INFORMATION: "รอข้อมูลเพิ่มเติม",
  COORDINATING_SUPPLIER: "กำลังประสานผู้รับผิดชอบ",
  REPAIR_APPROVED: "อนุมัติซ่อม",
  REPLACEMENT_APPROVED: "อนุมัติเปลี่ยนสินค้า",
  COMPENSATION_PROPOSED: "เสนอแนวทางชดเชย",
  IN_PROGRESS: "กำลังดำเนินการ",
  RESOLVED: "ดำเนินการแล้ว รอยืนยัน",
  CLOSED: "ปิดเคสแล้ว",
  REJECTED: "ไม่รับ Claim",
};

export const claimIssueLabels: Record<string, string> = {
  MISSING: "สินค้าไม่ครบ/สูญหาย",
  WRONG_ITEM: "รุ่น สี หรือขนาดไม่ถูกต้อง",
  DAMAGED: "สินค้าเสียหาย",
  PRODUCTION_QUALITY: "คุณภาพการผลิต",
  TRANSIT_DAMAGE: "เสียหายระหว่างขนส่ง",
  INSTALLATION: "ปัญหาจากการติดตั้ง",
  OTHER: "อื่น ๆ",
};

export const responsibilityLabels: Record<string, string> = {
  SUPPLIER: "Supplier / โรงงาน",
  LOGISTICS_INSURANCE: "ขนส่ง / ประกันภัย",
  INSTALLER: "ผู้ติดตั้ง",
  GISP: "GISP",
  MEMBER: "สมาชิก",
  UNDETERMINED: "รอตรวจสอบ",
};

export const resolutionLabels: Record<string, string> = {
  REPAIR: "ซ่อม",
  REPLACEMENT: "เปลี่ยนสินค้า",
  SPARE_PART: "ส่งอะไหล่",
  REWORK: "แก้ไขงาน",
  COMPENSATION: "ชดเชย",
  CREDIT: "เครดิต",
  NO_ACTION: "ไม่ต้องดำเนินการเพิ่มเติม",
};

export type ClaimRow = {
  id: string;
  organization_id: string;
  member_profile_id: string;
  delivery_item_id: string;
  order_item_id: string;
  claim_number: string;
  issue_type: string;
  subject: string;
  description: string;
  claimed_quantity: number;
  severity: string;
  discovered_at: string;
  packaging_condition: string | null;
  temporary_action: string | null;
  status: string;
  suggested_responsibility: string;
  confirmed_responsibility: string | null;
  responsibility_confirmed_at: string | null;
  warranty_snapshot: Record<string, unknown>;
  assigned_to: string | null;
  target_resolution_at: string | null;
  information_request: string | null;
  resolution_type: string | null;
  resolution_details: string | null;
  resolution_executed_at: string | null;
  member_response: string | null;
  member_response_note: string | null;
  member_responded_at: string | null;
  member_confirmed_at: string | null;
  rejection_reason: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  item_name?: string;
  order_number?: string;
  company_name?: string;
};

export type ClaimEvidence = {
  id: string;
  claim_id: string;
  file_id: string;
  evidence_type: string;
  note: string | null;
  is_member_visible: boolean;
  created_at: string;
  file?: { id: string; original_name: string; mime_type: string } | null;
};

export type ClaimEvent = {
  id: string;
  action: string;
  note: string | null;
  is_member_visible: boolean;
  created_at: string;
};

export type ClaimDetail = {
  claim: ClaimRow;
  evidence: ClaimEvidence[];
  events: ClaimEvent[];
  internalCosts?: Array<{ id: string; cost_type: string; amount: number; currency: string; internal_note: string | null; created_at: string }>;
};

export type EligibleDeliveryItem = {
  delivery_item_id: string;
  order_item_id: string;
  item_name: string;
  order_number: string;
  quantity_delivered: number;
  delivered_at: string | null;
};

export function claimTone(status: string) {
  if (["CLOSED"].includes(status)) return "good";
  if (["REJECTED"].includes(status)) return "bad";
  if (["WAITING_INFORMATION", "COMPENSATION_PROPOSED", "RESOLVED"].includes(status)) return "warn";
  return "info";
}
