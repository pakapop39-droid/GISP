export const sourcingStatuses = ["DRAFT","SUBMITTED","UNDER_REVIEW","NEED_INFO","OPTIONS_READY","MEMBER_SELECTED","CATALOG_PENDING","COMPLETED","UNAVAILABLE","CANCELLED"] as const;
export type SourcingStatus = (typeof sourcingStatuses)[number];
export const sourcingStatusLabels: Record<string,string> = { DRAFT:"ร่าง",SUBMITTED:"ส่งแล้ว",UNDER_REVIEW:"กำลังจัดหา",NEED_INFO:"รอข้อมูลเพิ่ม",OPTIONS_READY:"มีสินค้าเสนอ",MEMBER_SELECTED:"เลือกสินค้าแล้ว",CATALOG_PENDING:"กำลังนำเข้า Catalog",COMPLETED:"เสร็จสิ้น",UNAVAILABLE:"ไม่พบสินค้า",CANCELLED:"ยกเลิก" };

export const forbiddenMemberSourcingKeys = ["supplier_id","supplierId","supplierName","factory_sku","factorySku","factory_cost","factoryCost","factory_currency","factoryCurrency","internal_note","internalNote","marginPercent"] as const;
export function memberSourcingHasForbiddenKey(value:unknown):boolean {
  if(!value||typeof value!=="object")return false;
  if(Array.isArray(value))return value.some(memberSourcingHasForbiddenKey);
  return Object.entries(value).some(([key,child])=>forbiddenMemberSourcingKeys.includes(key as (typeof forbiddenMemberSourcingKeys)[number])||memberSourcingHasForbiddenKey(child));
}

