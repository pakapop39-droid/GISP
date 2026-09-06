import { apiError } from "@/lib/api/response";
import { buildExcelXml } from "@/lib/projects/export";
import { loadProjectSchedule } from "@/lib/projects/server";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { project, customer, items } = await loadProjectSchedule(id);
    const rows: Array<Array<string | number>> = [
      ["Project No.", project.project_number], ["Project", project.name], ["Customer", customer?.name ?? "—"], ["Site", project.site_address], ["Expected date", project.expected_need_date ?? "—"], ["Issued date", new Date().toISOString().slice(0, 10)], [],
      ["Area", "SKU", "Product", "Category", "Specification", "Options", "Quantity", "Unit", "Member Price", "Suggested Resale", "Freight Min", "Freight Max", "Product Total", "Lead Time (days)", "Status", "Supplier", "Supplier Address", "Supplier Contact"],
      ...items.map(item => [item.area_name, item.sku, item.product_name, item.category_name ?? "", item.specification ?? "", item.selected_options?.map(option => option.label).filter(Boolean).join(" · ") ?? "", Number(item.quantity), item.unit, Number(item.member_price), item.suggested_resale === null ? "" : Number(item.suggested_resale), item.freight_min === null ? "" : Number(item.freight_min), item.freight_max === null ? "" : Number(item.freight_max), Number(item.quantity) * Number(item.member_price), item.lead_time_days ?? "", item.item_status, item.supplier_name ?? "ยังไม่เปิดเผย", item.supplier_address ?? "", item.supplier_contact ?? ""]),
      [], ["Disclaimer", "ราคาสมาชิกและราคาแนะนำอาจเปลี่ยนแปลง ค่าขนส่งเป็นประมาณการ ไม่รวม VAT ค่านำเข้า ค่าติดตั้ง และค่าจัดส่งหน้างาน เอกสารนี้ไม่ใช่ใบเสนอราคาหรือคำสั่งซื้อ"],
    ];
    const xml = buildExcelXml(`${project.project_number} ${project.name}`, rows);
    return new Response("\uFEFF" + xml, { headers: { "Content-Type": "application/vnd.ms-excel; charset=utf-8", "Content-Disposition": `attachment; filename="${project.project_number}-product-schedule.xls"` } });
  } catch (error) { return apiError(error); }
}
