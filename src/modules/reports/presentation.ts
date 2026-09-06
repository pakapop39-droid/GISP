import {
  fixedReportTypes,
  type FixedReport,
  type FixedReportFilters,
  type FixedReportRow,
  type FixedReportType,
} from "./types";

export const reportLabels: Record<FixedReportType, string> = {
  order: "รายงาน Order",
  payment: "รายงานการชำระเงิน",
  delay: "รายงานความล่าช้า",
  delivery: "รายงานการส่งมอบ",
  claim: "รายงาน Claim",
};

type ReportColumn = {
  key: string;
  label: string;
  kind?: "money" | "date" | "datetime" | "boolean" | "status";
  currencyKey?: string;
};

export const reportColumns: Record<FixedReportType, ReportColumn[]> = {
  order: [
    { key: "order_number", label: "เลข Order" },
    { key: "member_company", label: "บริษัท" },
    { key: "project_name", label: "โครงการ" },
    { key: "status", label: "สถานะ", kind: "status" },
    {
      key: "grand_total",
      label: "ยอดรวม",
      kind: "money",
      currencyKey: "currency",
    },
    { key: "created_at", label: "วันที่สร้าง", kind: "datetime" },
  ],
  payment: [
    { key: "order_number", label: "เลข Order" },
    { key: "member_company", label: "บริษัท" },
    { key: "schedule_type", label: "ประเภทยอด", kind: "status" },
    { key: "status", label: "สถานะ", kind: "status" },
    {
      key: "due_amount",
      label: "ยอดที่ต้องชำระ",
      kind: "money",
      currencyKey: "currency",
    },
    {
      key: "verified_amount",
      label: "ตรวจรับแล้ว",
      kind: "money",
      currencyKey: "currency",
    },
    {
      key: "outstanding_amount",
      label: "ยอดคงเหลือ",
      kind: "money",
      currencyKey: "currency",
    },
    { key: "due_at", label: "ครบกำหนด", kind: "datetime" },
  ],
  delay: [
    { key: "delay_type", label: "ประเภท", kind: "status" },
    { key: "reference", label: "เลขอ้างอิง" },
    { key: "status", label: "สถานะ", kind: "status" },
    { key: "detail", label: "เหตุผล/รายละเอียด" },
    { key: "target_at", label: "กำหนดเดิม", kind: "datetime" },
    { key: "event_at", label: "เวลาที่บันทึก", kind: "datetime" },
  ],
  delivery: [
    { key: "delivery_number", label: "เลข Delivery" },
    { key: "order_number", label: "เลข Order" },
    { key: "member_company", label: "บริษัท" },
    { key: "status", label: "สถานะ", kind: "status" },
    { key: "scheduled_at", label: "วันนัด", kind: "datetime" },
    { key: "delivered_at", label: "ส่งมอบจริง", kind: "datetime" },
    { key: "issue_flag", label: "พบปัญหา", kind: "boolean" },
  ],
  claim: [
    { key: "claim_number", label: "เลข Claim" },
    { key: "order_number", label: "เลข Order" },
    { key: "member_company", label: "บริษัท" },
    { key: "subject", label: "หัวข้อ" },
    { key: "issue_type", label: "ประเภท", kind: "status" },
    { key: "severity", label: "ระดับ", kind: "status" },
    { key: "status", label: "สถานะ", kind: "status" },
    {
      key: "confirmed_responsibility",
      label: "ผู้รับผิดชอบ",
      kind: "status",
    },
    { key: "target_resolution_at", label: "กำหนดแก้ไข", kind: "datetime" },
  ],
};

export const reportStatusOptions: Record<FixedReportType, string[]> = {
  order: [
    "PENDING_DEPOSIT",
    "DEPOSIT_VERIFIED",
    "PO_ISSUED",
    "IN_PRODUCTION",
    "READY_TO_SHIP",
    "PARTIALLY_SHIPPED",
    "SHIPPED",
    "DELIVERED",
    "COMPLETED",
    "CANCELLED",
  ],
  payment: [
    "PENDING",
    "PARTIALLY_VERIFIED",
    "VERIFIED",
    "OVERPAYMENT_REVIEW",
    "CANCELLED",
  ],
  delay: ["DELAYED", "FAILED", "RESCHEDULE_REQUIRED"],
  delivery: [
    "PROPOSED",
    "MEMBER_CONFIRMED",
    "CONFIRMED",
    "OUT_FOR_DELIVERY",
    "ARRIVED",
    "DELIVERED",
    "PARTIALLY_DELIVERED",
    "DELIVERED_WITH_ISSUE",
    "FAILED",
    "RESCHEDULE_REQUIRED",
  ],
  claim: [
    "SUBMITTED",
    "UNDER_REVIEW",
    "WAITING_INFORMATION",
    "COORDINATING_SUPPLIER",
    "IN_PROGRESS",
    "RESOLVED",
    "CLOSED",
    "REJECTED",
  ],
};

const statusLabels: Record<string, string> = {
  PENDING_DEPOSIT: "รอชำระมัดจำ",
  DEPOSIT_VERIFIED: "ตรวจรับมัดจำแล้ว",
  PO_ISSUED: "ออก PO แล้ว",
  IN_PRODUCTION: "กำลังผลิต",
  READY_TO_SHIP: "พร้อมจัดส่ง",
  PARTIALLY_SHIPPED: "จัดส่งบางส่วน",
  SHIPPED: "จัดส่งแล้ว",
  DELIVERED: "ส่งมอบแล้ว",
  COMPLETED: "เสร็จสิ้น",
  CANCELLED: "ยกเลิก",
  PENDING: "รอดำเนินการ",
  PARTIALLY_VERIFIED: "ตรวจรับบางส่วน",
  VERIFIED: "ตรวจรับแล้ว",
  OVERPAYMENT_REVIEW: "รอตรวจยอดเกิน",
  DEPOSIT: "มัดจำ",
  BALANCE: "ยอดคงเหลือ",
  FREIGHT: "ค่าขนส่ง",
  PRODUCTION: "การผลิต",
  SHIPMENT: "การขนส่งระหว่างประเทศ",
  DELIVERY: "การส่งมอบ",
  DELAYED: "ล่าช้า",
  PROPOSED: "เสนอนัดส่ง",
  MEMBER_CONFIRMED: "สมาชิกยืนยันแล้ว",
  CONFIRMED: "ยืนยันนัดแล้ว",
  OUT_FOR_DELIVERY: "กำลังนำส่ง",
  ARRIVED: "ถึงจุดส่ง",
  PARTIALLY_DELIVERED: "ส่งมอบบางส่วน",
  DELIVERED_WITH_ISSUE: "ส่งมอบพร้อมปัญหา",
  FAILED: "ส่งไม่สำเร็จ",
  RESCHEDULE_REQUIRED: "ต้องเลื่อนนัด",
  SUBMITTED: "ส่ง Claim แล้ว",
  UNDER_REVIEW: "กำลังตรวจสอบ",
  WAITING_INFORMATION: "รอข้อมูลเพิ่มเติม",
  COORDINATING_SUPPLIER: "กำลังประสาน Partner",
  IN_PROGRESS: "กำลังดำเนินการ",
  RESOLVED: "ดำเนินการแก้ไขแล้ว",
  CLOSED: "ปิด Claim",
  REJECTED: "ไม่รับ Claim",
  MISSING: "สินค้าไม่ครบ/สูญหาย",
  WRONG_ITEM: "สินค้าไม่ตรงรายการ",
  DAMAGED: "สินค้าเสียหาย",
  PRODUCTION_QUALITY: "คุณภาพการผลิต",
  TRANSIT_DAMAGE: "เสียหายระหว่างขนส่ง",
  INSTALLATION: "งานติดตั้ง",
  OTHER: "อื่น ๆ",
  LOW: "ต่ำ",
  MEDIUM: "กลาง",
  HIGH: "สูง",
  CRITICAL: "วิกฤต",
  SUPPLIER: "Partner/โรงงาน",
  LOGISTICS_INSURANCE: "ขนส่ง/ประกันภัย",
  INSTALLER: "ผู้ติดตั้ง",
  GISP: "GISP",
  MEMBER: "สมาชิก",
};

export function translateStatus(value: unknown) {
  const text = String(value ?? "");
  return statusLabels[text] ?? text.replaceAll("_", " ");
}

function dateInBangkok(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function isValidDate(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

export function parseReportFilters(
  params: Record<string, string | string[] | undefined>,
): FixedReportFilters {
  const now = new Date();
  const fallbackTo = dateInBangkok(now);
  const fromDate = new Date(now);
  fromDate.setUTCDate(fromDate.getUTCDate() - 89);
  const fallbackFrom = dateInBangkok(fromDate);
  const requestedType = Array.isArray(params.type) ? params.type[0] : params.type;
  const type = fixedReportTypes.includes(requestedType as FixedReportType)
    ? (requestedType as FixedReportType)
    : "order";
  const requestedFrom = Array.isArray(params.from) ? params.from[0] : params.from;
  const requestedTo = Array.isArray(params.to) ? params.to[0] : params.to;
  const requestedStatus = Array.isArray(params.status)
    ? params.status[0]
    : params.status;

  let dateFrom = isValidDate(requestedFrom) ? requestedFrom : fallbackFrom;
  let dateTo = isValidDate(requestedTo) ? requestedTo : fallbackTo;
  if (dateFrom > dateTo) [dateFrom, dateTo] = [dateTo, dateFrom];
  const maxFrom = new Date(`${dateTo}T00:00:00Z`);
  maxFrom.setUTCDate(maxFrom.getUTCDate() - 366);
  if (dateFrom < maxFrom.toISOString().slice(0, 10)) {
    dateFrom = maxFrom.toISOString().slice(0, 10);
  }

  const status =
    requestedStatus &&
    reportStatusOptions[type].includes(requestedStatus.toUpperCase())
      ? requestedStatus.toUpperCase()
      : "";

  return { type, dateFrom, dateTo, status };
}

export function formatReportValue(
  row: FixedReportRow,
  column: ReportColumn,
) {
  const value = row[column.key];
  if (value === null || value === undefined || value === "") return "—";
  if (column.kind === "status") return translateStatus(value);
  if (column.kind === "boolean") return value ? "ใช่" : "ไม่";
  if (column.kind === "money") {
    const currency = String(row[column.currencyKey ?? "currency"] ?? "THB");
    return new Intl.NumberFormat("th-TH", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(Number(value));
  }
  if (column.kind === "date" || column.kind === "datetime") {
    return new Intl.DateTimeFormat("th-TH", {
      timeZone: "Asia/Bangkok",
      dateStyle: "medium",
      ...(column.kind === "datetime"
        ? ({ timeStyle: "short" } as const)
        : {}),
    }).format(new Date(String(value)));
  }
  return String(value);
}

function escapeCsv(value: string) {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

export function fixedReportToCsv(report: FixedReport) {
  const columns = reportColumns[report.report_type];
  const lines = [
    columns.map((column) => escapeCsv(column.label)).join(","),
    ...report.rows.map((row) =>
      columns
        .map((column) => escapeCsv(formatReportValue(row, column)))
        .join(","),
    ),
  ];
  return `\uFEFF${lines.join("\r\n")}`;
}

export function reportFileName(report: FixedReport) {
  return `gisp-${report.report_type}-report-${report.filters.date_from}-to-${report.filters.date_to}.csv`;
}
