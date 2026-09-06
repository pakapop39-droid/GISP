import { apiError } from "@/lib/api/response";
import { buildProductSchedulePdf } from "@/lib/projects/export";
import { loadProjectSchedule } from "@/lib/projects/server";

const value = (input: string | number | null | undefined) => input === null || input === undefined || input === "" ? "—" : String(input);
const money = (input: number | null) => input === null ? "—" : Number(input).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { project, customer, items } = await loadProjectSchedule(id);
    const headerLines = [
      "GISP PRODUCT SCHEDULE", `เลขที่โครงการ: ${project.project_number}`, `ชื่อโครงการ: ${project.name}`,
      `ลูกค้าปลายทาง: ${value(customer?.name)}`, `สถานที่โครงการ: ${project.site_address}`,
      `วันที่ต้องการสินค้า: ${value(project.expected_need_date)}`, `วันที่ออกรายการ: ${new Date().toLocaleDateString("th-TH")}`, "",
    ];
    const pdfItems = items.map((item, index) => ({ imageUrl: item.image_url, lines: [
      `${index + 1}. [${item.area_name}] ${item.sku} · ${item.product_name}`,
      `หมวด: ${value(item.category_name)} | สเปก: ${value(item.specification)} | Option: ${item.selected_options?.map(option => option.label).filter(Boolean).join(" · ") || "—"}`,
      `จำนวน ${item.quantity} ${item.unit} | ราคาสมาชิก ${money(item.member_price)} THB | ราคาแนะนำ ${money(item.suggested_resale)} THB`,
      `ค่าขนส่งประมาณการ ${money(item.freight_min)}–${money(item.freight_max)} THB | รวมราคาสินค้า ${money(Number(item.quantity) * Number(item.member_price))} THB | Lead time ${value(item.lead_time_days)} วัน`,
      `Supplier: ${item.supplier_name ? `${item.supplier_name} | ${value(item.supplier_address)} | ${value(item.supplier_contact)}` : "ยังไม่เปิดเผย — ต้องจบการเยี่ยมชมก่อน"}`,
    ] }));
    const footerLines = [
      "หมายเหตุ: ราคาสมาชิกและราคาแนะนำเป็นข้อมูล ณ วันที่ออกรายการ อาจเปลี่ยนแปลงได้",
      "ค่าขนส่งเป็นประมาณการ ไม่รวม VAT ค่านำเข้า ค่าติดตั้ง และค่าจัดส่งหน้างาน เว้นแต่ระบุไว้ต่างหาก",
      "เอกสารนี้เป็น Product Schedule สำหรับอ้างอิง ไม่ใช่ใบเสนอราคาหรือคำสั่งซื้อ",
    ];
    const bytes = await buildProductSchedulePdf(headerLines, pdfItems, footerLines);
    return new Response(Uint8Array.from(bytes).buffer, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${project.project_number}-product-schedule.pdf"` } });
  } catch (error) { return apiError(error); }
}
