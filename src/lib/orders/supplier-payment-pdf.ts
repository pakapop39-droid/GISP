import "server-only";

import { requireAppAccess } from "@/lib/auth/session";
import { buildBusinessDocumentPdf } from "@/lib/documents/business-pdf";
import { createInsForgeAdminClient } from "@/lib/insforge/admin";
import { targetOrganizationPermissions } from "@/lib/orders/organization-access";

export class SupplierPaymentDocumentError extends Error { constructor(public status: number, message: string) { super(message); } }
const text = (value: unknown) => String(value ?? "—").trim() || "—";
const money = (value: unknown, currency: string) => `${new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value ?? 0))} ${currency}`;

export async function buildSupplierPaymentPdf(id: string) {
  await requireAppAccess({ active: true });
  const admin = createInsForgeAdminClient();
  const payment = await admin.database.from("supplier_payments").select("id,supplier_order_id,payment_reference,payment_type,amount,currency,status,note,rejection_reason,created_at,reviewed_at,paid_at").eq("id", id).maybeSingle();
  if (payment.error) throw payment.error;
  if (!payment.data) throw new SupplierPaymentDocumentError(404, "ไม่พบ Supplier Payment");
  const supplierOrder = await admin.database.from("supplier_orders").select("id,organization_id,supplier_id,supplier_order_number,po_number").eq("id", payment.data.supplier_order_id).maybeSingle();
  if (supplierOrder.error) throw supplierOrder.error;
  if (!supplierOrder.data) throw new SupplierPaymentDocumentError(404, "ไม่พบ Supplier Payment");
  const permissions = await targetOrganizationPermissions(["supplier_payments.request", "supplier_payments.manage"], supplierOrder.data.organization_id);
  if (!permissions.length) throw new SupplierPaymentDocumentError(404, "ไม่พบ Supplier Payment");
  const [supplier, company] = await Promise.all([
    admin.database.from("suppliers").select("code,name,legal_name").eq("id", supplierOrder.data.supplier_id).maybeSingle(),
    admin.database.from("company_settings").select("company_name,company_legal_name,tax_id,address,company_email").eq("singleton", true).maybeSingle(),
  ]);
  if (supplier.error) throw supplier.error;
  if (company.error) throw company.error;
  const row = payment.data;
  const pdf = await buildBusinessDocumentPdf({
    title: "ใบรายการจ่าย Supplier / SUPPLIER PAYMENT",
    reference: row.payment_reference,
    companyLines: [text(company.data?.company_name), text(company.data?.company_legal_name), `เลขผู้เสียภาษี ${text(company.data?.tax_id)}`, `ที่อยู่ ${text(company.data?.address)}`],
    summaryLines: [`Supplier: ${text(supplier.data?.code)} · ${text(supplier.data?.name)} (${text(supplier.data?.legal_name)})`, `Supplier Order: ${supplierOrder.data.supplier_order_number}`, `PO: ${text(supplierOrder.data.po_number)}`],
    sections: [{ title: "รายละเอียดการจ่าย", lines: [`ประเภท ${row.payment_type}`, `จำนวน ${money(row.amount, row.currency)}`, `สถานะ ${row.status}`, `ขอจ่ายเมื่อ ${row.created_at ? new Date(row.created_at).toLocaleString("th-TH") : "—"}`, `ตรวจเมื่อ ${row.reviewed_at ? new Date(row.reviewed_at).toLocaleString("th-TH") : "—"}`, `จ่ายเมื่อ ${row.paid_at ? new Date(row.paid_at).toLocaleString("th-TH") : "—"}`, `หมายเหตุ ${text(row.note)}`, `เหตุผลไม่อนุมัติ ${text(row.rejection_reason)}`] }],
    signatureLabels: ["ผู้ขอจ่าย", "ผู้อนุมัติ", "ผู้บันทึกจ่าย"],
  });
  return { pdf, reference: row.payment_reference };
}
