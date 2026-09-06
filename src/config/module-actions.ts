import type { ActionDefinition } from "@/components/quick-action-form";
import type { ModuleSlug } from "@/config/modules";

export const moduleActions: Partial<Record<ModuleSlug, ActionDefinition>> = {
  access: {
    title: "อนุมัติสมาชิก",
    description: "การอนุมัติต้องผ่าน Backend Permission Guard และบันทึก Audit",
    endpoint: "/api/admin/member-applications/approve",
    submitLabel: "อนุมัติสมาชิก",
    fields: [
      {
        name: "application_id",
        label: "Application ID",
        placeholder: "UUID ของคำขอ",
        required: true,
      },
    ],
  },
  catalog: {
    title: "เพิ่ม Product Draft",
    description: "Factory Cost จะไม่ถูกส่งผ่าน Member API",
    endpoint: "/api/admin/products",
    submitLabel: "สร้าง Product Draft",
    fields: [
      { name: "sku", label: "SKU", placeholder: "CHR-001", required: true },
      {
        name: "name_th",
        label: "ชื่อสินค้า",
        placeholder: "เก้าอี้รับประทานอาหาร",
        required: true,
      },
      {
        name: "supplier_id",
        label: "Supplier ID",
        placeholder: "UUID ของโรงงาน",
        required: true,
      },
      {
        name: "member_price",
        label: "ราคาสมาชิกก่อน VAT",
        placeholder: "12500.00",
        type: "number",
        required: true,
      },
    ],
  },
  projects: {
    title: "สร้างโครงการ",
    description: "โครงการจะถูกผูกกับ Organization ของสมาชิกโดยอัตโนมัติ",
    endpoint: "/api/member/projects",
    submitLabel: "สร้างโครงการ",
    fields: [
      {
        name: "name",
        label: "ชื่อโครงการ",
        placeholder: "Riverside House",
        required: true,
      },
      {
        name: "end_customer_name",
        label: "ลูกค้าปลายทาง",
        placeholder: "คุณสมชาย",
        required: true,
      },
      {
        name: "site_address",
        label: "ที่อยู่หน้างาน",
        placeholder: "กรุงเทพมหานคร",
        type: "textarea",
        required: true,
      },
    ],
  },
  rfq: {
    title: "ส่ง Custom RFQ",
    description: "ใช้เฉพาะสินค้า Custom และต้องมี Project ต้นทาง",
    endpoint: "/api/member/custom-requests",
    submitLabel: "ส่งคำขอราคา",
    fields: [
      {
        name: "project_id",
        label: "Project ID",
        placeholder: "UUID ของโครงการ",
        required: true,
      },
      {
        name: "item_name",
        label: "ชื่อรายการ Custom",
        placeholder: "Built-in TV Cabinet",
        required: true,
      },
      {
        name: "specification",
        label: "สเปกและขนาด",
        placeholder: "กว้าง 3200 มม. วัสดุ...",
        type: "textarea",
        required: true,
      },
    ],
  },
  quotations: {
    title: "สร้าง Quotation Version",
    description: "ราคาเป็นก่อน VAT และ Quotation ออกในชื่อ GISP",
    endpoint: "/api/admin/custom-quotations",
    submitLabel: "สร้าง Draft",
    fields: [
      {
        name: "custom_request_id",
        label: "Custom Request ID",
        placeholder: "UUID ของ RFQ",
        required: true,
      },
      {
        name: "subtotal",
        label: "ราคาก่อน VAT",
        placeholder: "95000.00",
        type: "number",
        required: true,
      },
      {
        name: "lead_time_days",
        label: "Lead Time (วัน)",
        placeholder: "45",
        type: "number",
        required: true,
      },
      {
        name: "supplier_id",
        label: "Supplier ID (ข้อมูลภายใน)",
        placeholder: "UUID ของโรงงานที่เลือก",
        required: true,
      },
      {
        name: "supplier_cost_total",
        label: "ต้นทุนโรงงานรวม (ข้อมูลภายใน)",
        placeholder: "12800.00",
        type: "number",
        required: true,
      },
    ],
  },
  orders: {
    title: "สร้าง Order จาก Project",
    description: "ระบบ Snapshot ราคา/สเปก/VAT และแยก Supplier Order",
    endpoint: "/api/member/orders",
    submitLabel: "สร้าง Order Draft",
    fields: [
      {
        name: "project_id",
        label: "Project ID",
        placeholder: "UUID ของโครงการ",
        required: true,
      },
      {
        name: "project_item_ids",
        label: "Project Item IDs",
        placeholder: "UUID:จำนวน คั่นด้วยจุลภาค เช่น ...a001:2",
        type: "textarea",
        required: true,
      },
    ],
  },
  production: {
    title: "อัปเดตการผลิต",
    description: "Status เปลี่ยนผ่าน Action Function และบันทึก Timeline",
    endpoint: "/api/admin/production-updates",
    submitLabel: "บันทึก Update",
    fields: [
      {
        name: "supplier_order_id",
        label: "Supplier Order ID",
        placeholder: "UUID ของ PO",
        required: true,
      },
      {
        name: "status",
        label: "สถานะ",
        placeholder: "IN_PRODUCTION",
        required: true,
      },
      {
        name: "note",
        label: "รายละเอียด",
        placeholder: "เริ่มประกอบโครง...",
        type: "textarea",
      },
    ],
  },
  shipments: {
    title: "สร้าง Shipment",
    description: "ระบบจะตรวจ Dispatch Gate และ Quantity ก่อนสร้าง",
    endpoint: "/api/admin/shipments",
    submitLabel: "ตรวจ Gate และสร้าง Shipment",
    fields: [
      {
        name: "shipment_name",
        label: "ชื่อ Shipment",
        placeholder: "CN-BKK / Aug 01",
        required: true,
      },
      {
        name: "order_item_ids",
        label: "Order Item IDs",
        placeholder: "UUID:จำนวน คั่นด้วยจุลภาค เช่น ...a001:1",
        type: "textarea",
        required: true,
      },
    ],
  },
  claims: {
    title: "เปิด Claim",
    description: "Claim ต้องสร้างจาก Delivered Item และมีหลักฐาน",
    endpoint: "/api/member/claims",
    submitLabel: "เปิดเคลม",
    fields: [
      {
        name: "delivery_item_id",
        label: "Delivery Item ID",
        placeholder: "UUID ของรายการที่ส่งมอบ",
        required: true,
      },
      {
        name: "issue_type",
        label: "ประเภทปัญหา",
        placeholder: "DAMAGED",
        required: true,
      },
      {
        name: "description",
        label: "รายละเอียด",
        placeholder: "มุมตู้มีรอยกระแทก...",
        type: "textarea",
        required: true,
      },
      {
        name: "evidence_file_id",
        label: "Evidence File ID",
        placeholder: "UUID ของรูปหรือไฟล์หลักฐาน",
        required: true,
      },
    ],
  },
};
