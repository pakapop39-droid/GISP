export const FIXTURE_VERSION = "SMTR-v1.0";
export const DEFAULT_RUN_ID = "smtr-v1.0-development";
export const CODE_PREFIX = "SMTR10-";

export const COMPANIES = [
  { key: "C01", email: "smtr-v1-company-01@example.com", companyName: "[SMTR-v1.0] บริษัทออกแบบจำลอง", businessType: "INTERIOR_DESIGN", scenario: "DESIGN_PROJECT" },
  { key: "C02", email: "smtr-v1-company-02@example.com", companyName: "[SMTR-v1.0] บริษัทรับเหมาจำลอง", businessType: "CONTRACTOR", scenario: "CONTRACTOR_ORDER_BOUNDARY" },
  { key: "C03", email: "smtr-v1-company-03@example.com", companyName: "[SMTR-v1.0] บริษัทตัวแทนจำลอง", businessType: "DEALER", scenario: "SHARED_CATALOG" },
  { key: "C04", email: "smtr-v1-company-04@example.com", companyName: "[SMTR-v1.0] บริษัททดสอบการแยกข้อมูล", businessType: "OTHER", scenario: "CROSS_TENANT_ISOLATION" },
  { key: "C05", email: "smtr-v1-company-05@example.com", companyName: "[SMTR-v1.0] บริษัททดสอบวงจรสถานะ", businessType: "OTHER", scenario: "LIFECYCLE" },
].map((item) => ({
  ...item,
  organizationCode: `${CODE_PREFIX}${item.key}`,
  contactName: `[SMTR] ผู้ทดสอบ ${item.key}`,
  projectName: `[SMTR-v1.0] โครงการ ${item.key}`,
  catalogTitle: `[SMTR-v1.0] แคตตาล็อก ${item.key}`,
  sourcingItemName: `[SMTR-v1.0] สินค้าจากภาพ ${item.key}`,
}));

export const FORBIDDEN_MEMBER_FIELDS = [
  "factory_cost",
  "factory_currency",
  "factory_sku",
  "gross_margin",
  "internal_note",
  "supplier_id",
  "supplier_payment",
  "formula",
];
