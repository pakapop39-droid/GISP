import "server-only";

import { requireAppAccess } from "@/lib/auth/session";
import { buildBusinessDocumentPdf } from "@/lib/documents/business-pdf";
import { createInsForgeAdminClient } from "@/lib/insforge/admin";
import { targetOrganizationPermissions } from "@/lib/orders/organization-access";

export class SupplierPoError extends Error { constructor(public status: number, public code: "NOT_FOUND" | "PO_NOT_ISSUED", message: string) { super(message); } }

export async function loadSupplierPoDocument(id: string) {
  await requireAppAccess({ active: true });
  const admin = createInsForgeAdminClient();
  const supplierOrder = await admin.database.from("supplier_orders").select("id,organization_id,customer_order_id,supplier_id,supplier_order_number,po_number,status,supplier_currency,total_factory_cost,po_issued_at").eq("id", id).maybeSingle();
  if (supplierOrder.error) throw supplierOrder.error;
  if (!supplierOrder.data) throw new SupplierPoError(404, "NOT_FOUND", "ไม่พบ Supplier PO");
  const permissions = await targetOrganizationPermissions(["supplier_payments.request", "supplier_payments.manage"], supplierOrder.data.organization_id);
  if (!permissions.length) throw new SupplierPoError(404, "NOT_FOUND", "ไม่พบ Supplier PO");
  if (!supplierOrder.data.po_number || !supplierOrder.data.po_issued_at || supplierOrder.data.status === "DRAFT") throw new SupplierPoError(409, "PO_NOT_ISSUED", "Supplier Order นี้ยังไม่ได้ออก PO");
  const linksResult = await admin.database.from("supplier_order_items").select("id,order_item_id,quantity,factory_unit_cost_snapshot,factory_line_total").eq("supplier_order_id", id).order("created_at").limit(200);
  if (linksResult.error) throw linksResult.error;
  const links = linksResult.data ?? [];
  const orderItemIds = links.map((item) => item.order_item_id);
  const [supplier, customerOrder, orderItems, company] = await Promise.all([
    admin.database.from("suppliers").select("id,code,name,legal_name,contact_name,contact_email,contact_phone,country_code").eq("id", supplierOrder.data.supplier_id).maybeSingle(),
    admin.database.from("customer_orders").select("id,order_number").eq("id", supplierOrder.data.customer_order_id).eq("organization_id", supplierOrder.data.organization_id).maybeSingle(),
    orderItemIds.length ? admin.database.from("order_items").select("id,item_name_snapshot,specification_snapshot,options_snapshot,unit").in("id", orderItemIds).limit(200) : Promise.resolve({ data: [], error: null }),
    admin.database.from("company_settings").select("company_name,company_legal_name,tax_id,address,company_email").eq("singleton", true).maybeSingle(),
  ]);
  for (const result of [supplier, customerOrder, orderItems, company]) if (result.error) throw result.error;
  const itemMap = new Map((orderItems.data ?? []).map((item) => [item.id, item]));
  return { supplierOrder: supplierOrder.data, supplier: supplier.data, customerOrder: customerOrder.data, company: company.data, items: links.map((link) => ({ ...link, orderItem: itemMap.get(link.order_item_id) ?? null })) };
}

const text = (value: unknown) => String(value ?? "—").trim() || "—";
const money = (value: unknown, currency: string) => `${new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value ?? 0))} ${currency}`;
export async function buildSupplierPoPdf(detail: Awaited<ReturnType<typeof loadSupplierPoDocument>>) {
  const { supplierOrder, supplier, customerOrder, company } = detail;
  return buildBusinessDocumentPdf({
    title: "ใบสั่งซื้อสินค้า / PURCHASE ORDER",
    reference: text(supplierOrder.po_number),
    companyLines: [text(company?.company_name), text(company?.company_legal_name), `เลขผู้เสียภาษี ${text(company?.tax_id)}`, `ที่อยู่ ${text(company?.address)}`, `อีเมล ${text(company?.company_email)}`],
    summaryLines: [`Supplier: ${text(supplier?.code)} · ${text(supplier?.name)} (${text(supplier?.legal_name)})`, `ผู้ติดต่อ Supplier: ${[supplier?.contact_name, supplier?.contact_phone, supplier?.contact_email].filter(Boolean).join(" · ") || "—"}`, `Supplier Order: ${text(supplierOrder.supplier_order_number)}  Customer Order: ${text(customerOrder?.order_number)}`, `วันที่ออก PO: ${new Date(supplierOrder.po_issued_at).toLocaleString("th-TH")}`, `สกุลเงิน: ${supplierOrder.supplier_currency}`],
    sections: [
      ...detail.items.map((item, index) => ({ marker: `PO-ROW-${String(index + 1).padStart(3, "0")}`, title: `${index + 1}. ${text(item.orderItem?.item_name_snapshot)}`, lines: [`สเปก: ${text(item.orderItem?.specification_snapshot)}`, `ตัวเลือก: ${(item.orderItem?.options_snapshot ?? []).map((option: { label?: string }) => option.label).filter(Boolean).join(" · ") || "—"}`, `จำนวน ${text(item.quantity)} ${text(item.orderItem?.unit)} × ${money(item.factory_unit_cost_snapshot, supplierOrder.supplier_currency)}`, `รวม ${money(item.factory_line_total, supplierOrder.supplier_currency)}`] })),
      { title: "สรุปและเงื่อนไข", lines: [`ยอดรวม ${money(supplierOrder.total_factory_cost, supplierOrder.supplier_currency)}`, "เงื่อนไขการชำระเงิน: มัดจำ 50% / ยอดคงเหลือ 50%", "หมายเหตุ: กรุณายืนยันรายละเอียดสินค้าและเลข PO ในทุกการติดต่อ"] },
    ],
    signatureLabels: ["ผู้จัดทำ", "ผู้อนุมัติ", "ผู้รับ PO"],
  });
}
