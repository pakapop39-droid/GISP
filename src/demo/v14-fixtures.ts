import { createPrototypeState } from "./prototype-fixtures";
import type { FormulaComponent, PriceFormula, V14State } from "./v14-types";
import { V14_SCHEMA_VERSION } from "./v14-types";

const globalComponents: FormulaComponent[] = [
  { code: "platform", name: "Platform Cost", basis: "FACTORY_COST_THB", calculationType: "PERCENTAGE", value: "5.00", includeInMemberPrice: true, inherited: false },
  { code: "marketing_visit", name: "Marketing / Training / Factory Visit", basis: "FACTORY_COST_THB", calculationType: "PERCENTAGE", value: "10.00", includeInMemberPrice: true, inherited: false },
  { code: "sourcing_catalog", name: "Product Sourcing / Catalog Operations", basis: "FACTORY_COST_THB", calculationType: "PERCENTAGE", value: "10.00", includeInMemberPrice: true, inherited: false },
  { code: "resale_markup", name: "Suggested Resale Markup", basis: "MEMBER_PRICE", calculationType: "PERCENTAGE", value: "25.00", includeInMemberPrice: false, inherited: false },
  { code: "freight_low", name: "Freight Estimate Low", basis: "FACTORY_COST_THB", calculationType: "PERCENTAGE", value: "15.00", includeInMemberPrice: false, inherited: false },
  { code: "freight_high", name: "Freight Estimate High", basis: "FACTORY_COST_THB", calculationType: "PERCENTAGE", value: "20.00", includeInMemberPrice: false, inherited: false },
];

const formulas: PriceFormula[] = [
  { id: "formula-global-v1", code: "GLOBAL-DEFAULT", scope: "GLOBAL", supplierId: null, productId: null, version: 1, status: "ACTIVE", components: globalComponents, effectiveFrom: "2026-08-01" },
  { id: "formula-supplier-draft", code: "FOSHAN-OVERRIDE", scope: "SUPPLIER", supplierId: "supplier-foshan-seating", productId: null, version: 1, status: "DRAFT", effectiveFrom: "2026-08-15", components: globalComponents.map((item) => ({ ...item, inherited: true })) },
  { id: "formula-product-draft", code: "LOUNGE-CHAIR-OVERRIDE", scope: "PRODUCT", supplierId: "supplier-foshan-seating", productId: "product-lounge-chair", version: 1, status: "DRAFT", effectiveFrom: "2026-08-20", components: globalComponents.map((item) => ({ ...item, inherited: true })) },
];

export function createV14State(): V14State {
  const workflow = createPrototypeState();
  workflow.memberApplication = { ...workflow.memberApplication, companyName: "Atelier Nara Design Co., Ltd.", taxId: "0105569000001" };
  workflow.organizationUsers = workflow.organizationUsers.slice(0, 1);

  return {
    schemaVersion: V14_SCHEMA_VERSION,
    workflow,
    activeAdminRole: "GISP_ADMIN",
    internalUsers: [
      { id: "staff-gisp-admin", fullName: "กิตติพงษ์ จัดซื้อ", email: "purchasing@gisp-demo.example", roles: ["MEMBER_ADMIN", "PRODUCT_ADMIN", "ORDER_ADMIN", "PURCHASING"], status: "ACTIVE" },
      { id: "staff-finance", fullName: "พิมพ์ชนก การเงิน", email: "finance@gisp-demo.example", roles: ["FINANCE"], status: "ACTIVE" },
      { id: "staff-super-admin", fullName: "GISP Super Admin", email: "super-admin@gisp-demo.example", roles: ["SUPER_ADMIN"], status: "ACTIVE" },
    ],
    formulas,
    activeFormulaId: "formula-global-v1",
    formulaPreview: { factoryCostThb: "100.00", memberPrice: "125.00", suggestedResalePrice: "156.25", freightEstimateLow: "15.00", freightEstimateHigh: "20.00", componentTotal: "25.00", formulaId: "formula-global-v1" },
    samples: [
      { id: "sample-walnut", code: "W301", type: "MATERIAL_SWATCH", materialName: "Walnut Veneer", productId: "product-reception-counter", supplierId: "supplier-guangzhou-bespoke", memberDisplayLabel: "Partner Showroom — Guangzhou / ชมรมประเทศไทย", country: "China", city: "Guangzhou", status: "AVAILABLE" },
      { id: "sample-sand-fabric", code: "F001", type: "MATERIAL_SWATCH", materialName: "Sand Fabric", productId: "product-lounge-chair", supplierId: "supplier-foshan-seating", memberDisplayLabel: "Partner Showroom — Foshan / ชมรมประเทศไทย", country: "China", city: "Foshan", status: "AVAILABLE" },
      { id: "sample-grey-stone", code: "S102", type: "MATERIAL_SWATCH", materialName: "Grey Stone", productId: "product-side-table", supplierId: "supplier-zhongshan-living", memberDisplayLabel: "Partner Showroom — Zhongshan", country: "China", city: "Zhongshan", status: "AVAILABLE" },
      { id: "sample-built-in", code: "BI-KITCHEN-01", type: "BUILT_IN_DISPLAY", materialName: "Built-in Kitchen Display", productId: "product-reception-counter", supplierId: "supplier-guangzhou-bespoke", memberDisplayLabel: "Partner Showroom — Guangzhou", country: "China", city: "Guangzhou", status: "AVAILABLE" },
    ],
    visits: [],
    disclosureGrants: [],
    warrantySnapshot: { versionId: "warranty-foshan-v1", title: "Partner Warranty", terms: "รับประกันข้อบกพร่องจากการผลิต 12 เดือน โดยตรวจหลักฐานตามเงื่อนไข Partner", version: 1, supplierId: "supplier-foshan-seating", snapshottedAt: "2026-08-01T09:00:00.000Z" },
    suggestedResponsibility: "LOGISTICS_INSURANCE",
    confirmedResponsibility: null,
    responsibilityConfirmedBy: null,
    audit: [{ id: "v14-audit-1", at: "2026-08-01T09:00:00.000Z", actor: "MEMBER", action: "DEMO_1_4_STARTED", detail: "เริ่ม Riverstone Demo 1.4 ด้วย State แยกจาก Version 1.3" }],
    uatResults: [
      ["uat-foundation", "Foundation / Permission"],
      ["uat-product", "Product / Supplier และ Price Formula"],
      ["uat-standard", "Standard Order และ Member-safe Pricing"],
      ["uat-custom", "Custom RFQ / Quotation และ Snapshot"],
      ["uat-payment", "Payment / PO"],
      ["uat-qc", "Production / QC และ Material Sample"],
      ["uat-shipment", "Shipment / Delivery และ Visit Disclosure"],
      ["uat-claim", "Claim / Dashboard และ Warranty Responsibility"],
    ].map(([id, title]) => ({ id, title, status: "NOT_TESTED" as const, note: "" })),
    buildReadiness: "PENDING_DEMO_1_4_UAT",
    lastError: null,
    revision: 0,
  };
}
