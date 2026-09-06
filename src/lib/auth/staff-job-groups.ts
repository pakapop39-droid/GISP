import type { ProductionRole } from "@/lib/auth/types";

export const staffJobGroups = ["OPERATIONS", "FINANCE", "LOGISTICS"] as const;

export type StaffJobGroup = (typeof staffJobGroups)[number];

export type StaffJobGroupDefinition = {
  label: string;
  shortLabel: string;
  description: string;
  roles: readonly ProductionRole[];
};

export const staffJobGroupDefinitions: Record<StaffJobGroup, StaffJobGroupDefinition> = {
  OPERATIONS: {
    label: "ผู้ดูแลระบบงานและออเดอร์",
    shortLabel: "ระบบงานและออเดอร์",
    description: "บัญชี Member, Catalog, RFQ, Order, จัดซื้อ, การผลิต, QC และ Claim",
    roles: ["MEMBER_ADMIN", "PRODUCT_ADMIN", "ORDER_ADMIN", "PURCHASING", "QC"],
  },
  FINANCE: {
    label: "การเงิน",
    shortLabel: "การเงิน",
    description: "ตรวจรับเงินลูกค้า อนุมัติการจ่ายโรงงาน และจัดการค่าขนส่ง",
    roles: ["FINANCE"],
  },
  LOGISTICS: {
    label: "โลจิสติกส์",
    shortLabel: "โลจิสติกส์",
    description: "รับสินค้าเข้าคลัง รวม Shipment ติดตามการขนส่ง และส่งมอบ",
    roles: ["LOGISTICS"],
  },
};

export function rolesForStaffJobGroup(group: StaffJobGroup): ProductionRole[] {
  return [...staffJobGroupDefinitions[group].roles];
}

export function staffJobGroupLabelsForRoles(roles: readonly ProductionRole[]): string[] {
  if (roles.includes("SUPER_ADMIN")) return ["เจ้าของระบบ"];

  const roleSet = new Set(roles);
  const labels = staffJobGroups
    .filter((group) => staffJobGroupDefinitions[group].roles.every((role) => roleSet.has(role)))
    .map((group) => staffJobGroupDefinitions[group].shortLabel);

  return labels.length ? labels : ["สิทธิ์เฉพาะ"];
}
