export const customRequestTypes = [
  "RESIZE",
  "COLOR_MATERIAL",
  "HARDWARE",
  "MADE_TO_DRAWING",
  "PROJECT_SPECIFIC",
  "BUILT_IN",
  "CAD_PDF",
  "OTHER",
] as const;

export type CustomRequestType = (typeof customRequestTypes)[number];

export const customRequestTypeLabels: Record<CustomRequestType, string> = {
  RESIZE: "เปลี่ยนขนาด",
  COLOR_MATERIAL: "เปลี่ยนสีหรือวัสดุ",
  HARDWARE: "เปลี่ยนอุปกรณ์",
  MADE_TO_DRAWING: "ผลิตตามแบบ",
  PROJECT_SPECIFIC: "งานเฉพาะโครงการ",
  BUILT_IN: "งานบิลท์อิน",
  CAD_PDF: "ผลิตจากแบบ CAD/PDF",
  OTHER: "อื่น ๆ",
};

export const customRequestStatuses = [
  "DRAFT",
  "SUBMITTED",
  "UNDER_REVIEW",
  "NEED_INFO",
  "READY_FOR_QUOTE",
  "CONVERTED",
  "CANCELLED",
] as const;

export type CustomRequestStatus = (typeof customRequestStatuses)[number];

export const customRequestStatusLabels: Record<string, string> = {
  DRAFT: "ร่าง",
  SUBMITTED: "ส่งแล้ว",
  UNDER_REVIEW: "กำลังตรวจสอบ",
  NEED_INFO: "รอข้อมูลเพิ่ม",
  READY_FOR_QUOTE: "พร้อมทำใบเสนอราคา",
  CONVERTED: "สร้างรายการสินค้าแล้ว",
  CANCELLED: "ยกเลิก",
};

export const customRequestFileRoles = [
  "REFERENCE_IMAGE",
  "PDF",
  "CAD",
  "DIMENSION_DRAWING",
  "MATERIAL_REFERENCE",
] as const;

export type CustomRequestFileRole = (typeof customRequestFileRoles)[number];

export const customRequestFileRoleLabels: Record<CustomRequestFileRole, string> = {
  REFERENCE_IMAGE: "รูปภาพอ้างอิง",
  PDF: "เอกสาร PDF",
  CAD: "ไฟล์ CAD",
  DIMENSION_DRAWING: "แบบระบุขนาด",
  MATERIAL_REFERENCE: "วัสดุอ้างอิง",
};

export type CustomRequestRow = {
  id: string;
  organization_id: string;
  member_profile_id: string;
  project_id: string;
  area_id: string | null;
  base_product_id: string | null;
  request_number: string;
  request_type: CustomRequestType;
  item_name: string;
  specification: string;
  description: string | null;
  width_mm: number | null;
  depth_mm: number | null;
  height_mm: number | null;
  quantity: number;
  unit: string;
  requested_material: string | null;
  requested_color: string | null;
  requested_function: string | null;
  requested_options_json: Record<string, string>;
  member_note: string | null;
  admin_note?: string | null;
  status: CustomRequestStatus;
  submitted_by: string;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CustomRequestFile = {
  id: string;
  file_role: CustomRequestFileRole;
  original_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  version_number: number;
  created_at: string;
};

export type CustomRequestHistory = {
  id: string;
  action: string;
  from_status: string | null;
  to_status: string | null;
  message: string | null;
  visibility: "MEMBER" | "INTERNAL";
  created_at: string;
};
