import "server-only";

import { buildSimplePdf } from "@/lib/projects/export";
import { formatQuotationMoney, type QuotationDetail } from "@/lib/custom-quotation/types";

const value = (input: string | null | undefined) => input?.trim() || "—";

export function buildQuotationPdf(detail: QuotationDetail) {
  const { quotation, request, project, member, items } = detail;
  return buildSimplePdf([
    "GISP CUSTOM QUOTATION",
    `เลขที่ใบเสนอราคา: ${quotation.quotation_number}  Revision: ${quotation.version}`,
    `วันที่ออก: ${new Date(quotation.created_at).toLocaleDateString("th-TH")}`,
    `ใช้ได้ถึง: ${new Date(`${quotation.valid_until}T00:00:00`).toLocaleDateString("th-TH")}`,
    "",
    `สมาชิก: ${value(member?.company_name)}`,
    `ผู้ติดต่อ: ${value(member?.contact_name)}`,
    `โครงการ: ${value(project?.project_number)} · ${value(project?.name)}`,
    `สถานที่โครงการ: ${value(project?.site_address)}`,
    `อ้างอิงคำขอ: ${value(request?.request_number)}`,
    "",
    "รายการ",
    ...items.flatMap((item) => [
      `${item.line_number}. ${item.item_name}`,
      `สเปกยืนยัน: ${item.specification_snapshot}`,
      `จำนวน ${item.quantity} ${item.unit} × ${formatQuotationMoney(item.unit_price, quotation.currency)}`,
      `รวม ${formatQuotationMoney(item.line_subtotal, quotation.currency)}`,
      "",
    ]),
    `ยอดก่อน VAT: ${formatQuotationMoney(quotation.subtotal, quotation.currency)}`,
    `VAT ${quotation.vat_rate}%: ${formatQuotationMoney(quotation.vat_amount, quotation.currency)}`,
    `ยอดรวมสุทธิ: ${formatQuotationMoney(quotation.grand_total, quotation.currency)}`,
    `ระยะเวลาผลิตโดยประมาณ: ${quotation.lead_time_days} วัน`,
    `หมายเหตุ: ${value(quotation.quote_note)}`,
    "",
    "เงื่อนไข: ราคาและสเปกในเอกสารนี้เป็น Snapshot ของ Revision ที่ระบุ",
    "เมื่อสมาชิกยอมรับ ระบบจะล็อกราคา VAT สเปก และ Lead Time แล้วสร้างรายการในโครงการ",
    "เอกสารออกในนาม GISP และใช้สำหรับขั้นตอนสั่งซื้อหลังการตอบรับเท่านั้น",
  ]);
}
