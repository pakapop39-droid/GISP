import "server-only";
import { requireAppAccess } from "@/lib/auth/session";
import { buildBusinessDocumentPdf } from "../documents/business-pdf";
import { createInsForgeAdminClient } from "@/lib/insforge/admin";
import { hasTargetOrganizationPermission } from "./organization-access";

export class WarehouseReceiptError extends Error { constructor(public status: 404, message: string) { super(message); } }
export async function loadWarehouseReceiptDocument(id: string) {
  await requireAppAccess({ active: true });
  const admin = createInsForgeAdminClient();
  const receipt = await admin.database.from("warehouse_receipts").select("id,organization_id,warehouse_id,supplier_order_id,customer_order_id,receipt_number,status,received_at,package_count,actual_weight_kg,actual_cbm,note").eq("id", id).maybeSingle();
  if (receipt.error) throw receipt.error;
  if (!receipt.data) throw new WarehouseReceiptError(404, "ไม่พบใบรับเข้าคลัง");
  if (!await hasTargetOrganizationPermission("shipments.manage", receipt.data.organization_id)) {
    throw new WarehouseReceiptError(404, "ไม่พบใบรับเข้าคลัง");
  }
  const itemsResult = await admin.database.from("warehouse_receipt_items").select("id,order_item_id,expected_quantity,received_quantity,released_quantity,blocked_quantity,condition,discrepancy_note").eq("warehouse_receipt_id", id).order("created_at").limit(500);
  if (itemsResult.error) throw itemsResult.error;
  const items = itemsResult.data ?? [];
  const orderItemIds = items.map((item) => item.order_item_id);
  const [warehouse, supplierOrder, customerOrder, orderItems, company] = await Promise.all([
    admin.database.from("warehouses").select("id,warehouse_code,warehouse_name,country_code,address").eq("id", receipt.data.warehouse_id).maybeSingle(),
    admin.database.from("supplier_orders").select("id,supplier_order_number,po_number").eq("id", receipt.data.supplier_order_id).eq("organization_id", receipt.data.organization_id).maybeSingle(),
    admin.database.from("customer_orders").select("id,order_number").eq("id", receipt.data.customer_order_id).eq("organization_id", receipt.data.organization_id).maybeSingle(),
    orderItemIds.length ? admin.database.from("order_items").select("id,item_name_snapshot,specification_snapshot,options_snapshot,unit").in("id", orderItemIds).limit(500) : Promise.resolve({ data: [], error: null }),
    admin.database.from("company_settings").select("company_name,company_legal_name,tax_id,address,company_email").eq("singleton", true).maybeSingle(),
  ]);
  for (const result of [warehouse, supplierOrder, customerOrder, orderItems, company]) if (result.error) throw result.error;
  const itemMap = new Map((orderItems.data ?? []).map((item) => [item.id, item]));
  return { receipt: receipt.data, warehouse: warehouse.data, supplierOrder: supplierOrder.data, customerOrder: customerOrder.data, company: company.data, items: items.map((item) => ({ ...item, orderItem: itemMap.get(item.order_item_id) ?? null })) };
}

const text = (value: unknown) => String(value ?? "—").trim() || "—";
const conditionLabels: Record<string, string> = { GOOD: "สภาพดี", DAMAGED: "ชำรุด", MISSING: "สูญหาย", WRONG_ITEM: "สินค้าผิดรายการ", OTHER: "อื่น ๆ" };
export async function buildWarehouseReceiptPdf(detail: Awaited<ReturnType<typeof loadWarehouseReceiptDocument>>) {
  const { receipt, warehouse, supplierOrder, customerOrder, company } = detail;
  return buildBusinessDocumentPdf({
    title: "ใบรับสินค้าเข้าคลัง / WAREHOUSE RECEIPT", reference: text(receipt.receipt_number),
    companyLines: [text(company?.company_name), text(company?.company_legal_name), `เลขผู้เสียภาษี ${text(company?.tax_id)}`, `ที่อยู่ ${text(company?.address)}`, `อีเมล ${text(company?.company_email)}`],
    summaryLines: [`วันที่รับ: ${new Date(receipt.received_at).toLocaleString("th-TH")}  สถานะ: ${text(receipt.status)}`, `คลัง: ${text(warehouse?.warehouse_code)} · ${text(warehouse?.warehouse_name)} (${text(warehouse?.country_code)})`, `ที่อยู่คลัง: ${warehouse?.address ? JSON.stringify(warehouse.address) : "—"}`, `Customer Order: ${text(customerOrder?.order_number)}  Supplier Order: ${text(supplierOrder?.supplier_order_number)}  PO: ${text(supplierOrder?.po_number)}`, `จำนวนหีบห่อ ${text(receipt.package_count)} · น้ำหนัก ${text(receipt.actual_weight_kg)} กก. · CBM ${text(receipt.actual_cbm)}`, `หมายเหตุ: ${text(receipt.note)}`],
    sections: detail.items.map((item, index) => ({ marker: `WRC-ROW-${String(index + 1).padStart(3, "0")}`, title: `${index + 1}. ${text(item.orderItem?.item_name_snapshot)}`, lines: [`สเปก: ${text(item.orderItem?.specification_snapshot)}`, `ตัวเลือก: ${(item.orderItem?.options_snapshot ?? []).map((option: { label?: string }) => option.label).filter(Boolean).join(" · ") || "—"}`, `จำนวนคาดหมาย ${text(item.expected_quantity)} ${text(item.orderItem?.unit)} · รับจริง ${text(item.received_quantity)} · ปล่อยแล้ว ${text(item.released_quantity)} · พักไว้ ${text(item.blocked_quantity)}`, `สภาพ: ${conditionLabels[item.condition] ?? item.condition} · รายละเอียดส่วนต่าง: ${text(item.discrepancy_note)}`] })),
    signatureLabels: ["ผู้ส่งมอบ", "ผู้รับเข้าคลัง", "ผู้ตรวจสอบ"],
  });
}
