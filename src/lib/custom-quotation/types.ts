export const quotationStatuses = [
  "DRAFT",
  "SENT",
  "ACCEPTED",
  "REJECTED",
  "EXPIRED",
  "CANCELLED",
  "SUPERSEDED",
] as const;

export type QuotationStatus = (typeof quotationStatuses)[number];

export const quotationStatusLabels: Record<QuotationStatus, string> = {
  DRAFT: "ร่าง",
  SENT: "รอสมาชิกตอบรับ",
  ACCEPTED: "ยอมรับแล้ว",
  REJECTED: "ปฏิเสธ",
  EXPIRED: "หมดอายุ",
  CANCELLED: "ยกเลิก",
  SUPERSEDED: "มี Revision ใหม่",
};

export type QuotationRow = {
  id: string;
  organization_id: string;
  member_profile_id: string;
  custom_request_id: string;
  quotation_number: string;
  version: number;
  status: QuotationStatus;
  revision_of_id: string | null;
  currency: string;
  subtotal: number;
  vat_rate: number;
  vat_amount: number;
  grand_total: number;
  lead_time_days: number;
  confirmed_specification: string;
  confirmed_spec_json: Record<string, unknown>;
  quote_note: string | null;
  valid_until: string;
  decision_reason: string | null;
  sent_at: string | null;
  responded_at: string | null;
  accepted_at: string | null;
  rejected_at: string | null;
  expired_at: string | null;
  cancelled_at: string | null;
  superseded_at: string | null;
  created_at: string;
  updated_at: string;
};

export type QuotationItem = {
  id: string;
  quotation_id: string;
  line_number: number;
  item_name: string;
  specification_snapshot: string;
  quantity: number;
  unit: string;
  unit_price: number;
  line_subtotal: number;
};

export type QuotationHistory = {
  id: string;
  action: string;
  from_status: string | null;
  to_status: string | null;
  message: string | null;
  visibility: "MEMBER" | "INTERNAL";
  created_at: string;
};

export type QuotationListRow = QuotationRow & {
  request: { request_number: string; item_name: string } | null;
  project: { id: string; project_number: string; name: string } | null;
  member: { id: string; company_name: string } | null;
};

export type QuotationDetail = {
  quotation: QuotationRow;
  items: QuotationItem[];
  request: {
    id: string;
    request_number: string;
    item_name: string;
    project_id: string;
    status: string;
  } | null;
  project: { id: string; project_number: string; name: string; site_address: string } | null;
  member: { id: string; company_name: string; contact_name: string | null } | null;
  history: QuotationHistory[];
  cost?: {
    supplier_id: string;
    supplier_cost_total: number;
    supplier_currency: string;
    supplier?: { id: string; code: string; name: string } | null;
  } | null;
  candidates?: Array<{ id: string; code: string; name: string }>;
};

export function quotationStatusTone(status: QuotationStatus) {
  if (status === "ACCEPTED") return "good";
  if (status === "SENT" || status === "DRAFT") return "warn";
  if (status === "REJECTED" || status === "CANCELLED") return "bad";
  return "neutral";
}

export function formatQuotationMoney(value: number, currency = "THB") {
  return `${Number(value).toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency.trim()}`;
}
