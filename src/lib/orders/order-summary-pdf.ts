import "server-only";

import { AppAccessError } from "@/lib/auth/session";
import { buildBusinessDocumentPdf } from "@/lib/documents/business-pdf";
import { loadAdminOrderDetail } from "@/lib/orders/server";

const text = (value: unknown) => String(value ?? "—").trim() || "—";
const money = (value: unknown, currency: string) => `${new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value ?? 0))} ${currency}`;

export async function buildOrderSummaryPdf(id: string) {
  const detail = await loadAdminOrderDetail(id);
  if (!detail.capabilities?.viewSalesAmounts) throw new AppAccessError("PERMISSION_DENIED", 404, "ไม่พบ Order");
  const { order } = detail;
  const pdf = await buildBusinessDocumentPdf({
    title: "สรุปคำสั่งซื้อ / ORDER SUMMARY",
    reference: order.order_number,
    companyLines: [text(order.member?.company_name), `ผู้ติดต่อ ${text(order.member?.contact_name)}`, `โครงการ ${text(order.project?.project_number)} · ${text(order.project?.name)}`],
    summaryLines: [`สถานะ ${text(order.status)}`, `สกุลเงิน ${order.currency}`, `ก่อน VAT ${money(order.subtotal, order.currency)}`, `VAT ${money(order.vat_amount, order.currency)}`, `ยอดรวม ${money(order.grand_total, order.currency)}`],
    sections: detail.items.map((item, index) => ({ marker: `ORDER-ROW-${String(index + 1).padStart(3, "0")}`, title: `${index + 1}. ${text(item.item_name_snapshot)}`, lines: [`สเปก: ${text(item.specification_snapshot)}`, `จำนวน ${item.quantity} ${item.unit}`, `ราคาต่อหน่วย ${money(item.unit_price_snapshot, order.currency)}`, `รวม ${money(item.line_total, order.currency)}`] })),
    signatureLabels: ["ผู้ตรวจสอบ", "ผู้อนุมัติ"],
  });
  return { pdf, reference: order.order_number };
}
