export const forbiddenPublicCatalogKeys = [
  "customerPrice", "currency", "price", "memberPrice", "suggestedResalePrice",
  "freightEstimateLow", "freightEstimateHigh", "supplierId", "supplierName",
  "factorySku", "factoryCost", "factoryCurrency", "formulaVersionId",
  "formulaComponents", "grossMargin", "marginPercent", "internalNote",
  "endCustomer", "siteAddress", "quantity", "orderStatus",
] as const;

export function publicCatalogHasForbiddenKey(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(publicCatalogHasForbiddenKey);
  return Object.entries(value).some(([key, child]) =>
    forbiddenPublicCatalogKeys.includes(key as (typeof forbiddenPublicCatalogKeys)[number]) ||
    publicCatalogHasForbiddenKey(child));
}

export type PublicCatalogVersionItem = {
  id: string;
  product_id: string;
  image_file_id: string | null;
  sku: string;
  product_type: string;
  name_th: string;
  name_en: string | null;
  description_th: string | null;
  specification_summary: string | null;
  category_name: string | null;
  lead_time_days: number | null;
  width_mm: number | null;
  depth_mm: number | null;
  height_mm: number | null;
  material_summary: string | null;
  finish_summary: string | null;
  sort_order: number;
  project_area_name?: string | null;
  selected_options?: Array<{ label?: string }> | null;
};

export function serializePublicCatalogItem(
  row: PublicCatalogVersionItem,
  imageUrl: string | null,
  available: boolean,
) {
  return {
    id: row.id,
    sku: row.sku,
    productType: row.product_type,
    nameTh: row.name_th,
    nameEn: row.name_en,
    descriptionTh: row.description_th,
    specificationSummary: row.specification_summary,
    categoryName: row.category_name,
    leadTimeDays: row.lead_time_days,
    dimensions: { widthMm: row.width_mm, depthMm: row.depth_mm, heightMm: row.height_mm },
    materialSummary: row.material_summary,
    finishSummary: row.finish_summary,
    projectAreaName: row.project_area_name ?? null,
    selectedOptions: (row.selected_options ?? []).flatMap((option) =>
      typeof option?.label === "string" && option.label.trim() ? [option.label.trim()] : []),
    imageUrl,
    availability: available ? "AVAILABLE" : "INQUIRE",
  };
}

export type PublicCatalogItem = ReturnType<typeof serializePublicCatalogItem>;
