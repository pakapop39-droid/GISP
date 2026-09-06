export const catalogIssueCodes = [
  "SUPPLIER_NOT_ACTIVE",
  "CATEGORY_REQUIRED",
  "DESCRIPTION_REQUIRED",
  "SPECIFICATION_REQUIRED",
  "LEAD_TIME_REQUIRED",
  "MATERIAL_REQUIRED",
  "DIMENSIONS_REQUIRED",
  "ACTIVE_VARIANT_REQUIRED",
  "PRIMARY_IMAGE_REQUIRED",
  "ACTIVE_COST_REQUIRED",
  "ACTIVE_PRICE_REQUIRED",
] as const;

export type CatalogIssueCode = (typeof catalogIssueCodes)[number];

export type CatalogBatchProduct = {
  id: string;
  supplier_id: string;
  category_id: string | null;
  sku: string;
  name_th: string;
  name_en: string | null;
  product_type: string;
  status: string;
  qa_status: string;
  description_th: string | null;
  specification_summary: string | null;
  default_lead_time_days: number | null;
  width_mm: number | null;
  depth_mm: number | null;
  height_mm: number | null;
  material_summary: string | null;
  factory_cost: number | null;
  factory_currency: string | null;
};

export type CatalogBatchRow = CatalogBatchProduct & {
  issues: CatalogIssueCode[];
  sourceCostReady: boolean;
  activeVariant: boolean;
  primaryImage: boolean;
  activeCost: boolean;
  activePrice: boolean;
};

export type CatalogBatchRelations = {
  supplierActive: boolean;
  activeVariant: boolean;
  primaryImage: boolean;
  activeCost: boolean;
  activePrice: boolean;
};

const requiredDimensionTypes = new Set([
  "STANDARD",
  "READY_TO_ORDER",
  "EQUIPMENT",
  "DECORATIVE",
]);

export function catalogIssuesForProduct(
  product: CatalogBatchProduct,
  relations: CatalogBatchRelations,
): CatalogIssueCode[] {
  const issues: CatalogIssueCode[] = [];
  if (!relations.supplierActive) issues.push("SUPPLIER_NOT_ACTIVE");
  if (!product.category_id) issues.push("CATEGORY_REQUIRED");
  if (!product.description_th?.trim()) issues.push("DESCRIPTION_REQUIRED");
  if (!product.specification_summary?.trim()) {
    issues.push("SPECIFICATION_REQUIRED");
  }
  if (!product.default_lead_time_days) issues.push("LEAD_TIME_REQUIRED");
  if (!product.material_summary?.trim()) issues.push("MATERIAL_REQUIRED");
  if (
    requiredDimensionTypes.has(product.product_type) &&
    (!product.width_mm || !product.depth_mm || !product.height_mm)
  ) {
    issues.push("DIMENSIONS_REQUIRED");
  }
  if (!relations.activeVariant) issues.push("ACTIVE_VARIANT_REQUIRED");
  if (!relations.primaryImage) issues.push("PRIMARY_IMAGE_REQUIRED");
  if (!relations.activeCost) issues.push("ACTIVE_COST_REQUIRED");
  if (!relations.activePrice) issues.push("ACTIVE_PRICE_REQUIRED");
  return issues;
}

export function catalogBatchSummary(rows: CatalogBatchRow[]) {
  const issueCounts = Object.fromEntries(
    catalogIssueCodes.map((code) => [
      code,
      rows.filter((row) => row.issues.includes(code)).length,
    ]),
  ) as Record<CatalogIssueCode, number>;
  return {
    total: rows.length,
    readyForReview: rows.filter((row) => row.issues.length === 0).length,
    issueCounts,
  };
}
