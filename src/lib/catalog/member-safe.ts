export type MemberCatalogViewRow = {
  id: string;
  sku: string;
  product_type: string;
  name_th: string;
  name_en: string | null;
  description_th: string | null;
  specification_summary: string | null;
  default_lead_time_days: number | null;
  country_code: string;
  width_mm: number | null;
  depth_mm: number | null;
  height_mm: number | null;
  weight_kg: number | null;
  cbm: number | null;
  material_summary: string | null;
  finish_summary: string | null;
  moq: number | null;
  category_id: string | null;
  category_name: string | null;
  price_id: string;
  member_price_before_vat: number;
  suggested_resale_amount: number | null;
  freight_estimate_min: number | null;
  freight_estimate_max: number | null;
  currency: string;
  published_at: string;
  available_sample_count: number;
  warranty_summary: string;
};

export type MemberCatalogItem = ReturnType<typeof serializeMemberCatalogItem>;

export function serializeMemberCatalogItem(
  row: MemberCatalogViewRow,
  imageUrl: string | null = null,
) {
  return {
    id: row.id,
    sku: row.sku,
    productType: row.product_type,
    nameTh: row.name_th,
    nameEn: row.name_en,
    descriptionTh: row.description_th,
    specificationSummary: row.specification_summary,
    leadTimeDays: row.default_lead_time_days,
    countryCode: row.country_code,
    dimensions: {
      widthMm: row.width_mm,
      depthMm: row.depth_mm,
      heightMm: row.height_mm,
    },
    weightKg: row.weight_kg,
    cbm: row.cbm,
    materialSummary: row.material_summary,
    finishSummary: row.finish_summary,
    moq: row.moq,
    category: row.category_id
      ? { id: row.category_id, name: row.category_name }
      : null,
    price: {
      id: row.price_id,
      memberPrice: Number(row.member_price_before_vat),
      suggestedResalePrice:
        row.suggested_resale_amount === null
          ? null
          : Number(row.suggested_resale_amount),
      freightEstimateLow:
        row.freight_estimate_min === null
          ? null
          : Number(row.freight_estimate_min),
      freightEstimateHigh:
        row.freight_estimate_max === null
          ? null
          : Number(row.freight_estimate_max),
      currency: row.currency,
    },
    availableSampleCount: Number(row.available_sample_count ?? 0),
    warrantySummary: row.warranty_summary,
    imageUrl,
    partnerSourceLabel: `Partner Source · ${row.country_code}`,
    publishedAt: row.published_at,
  };
}

export const forbiddenMemberCatalogKeys = [
  "supplierId",
  "supplierName",
  "factorySku",
  "factoryCost",
  "factoryCurrency",
  "exchangeRate",
  "formulaVersionId",
  "formulaComponents",
  "grossMargin",
  "marginPercent",
  "internalNote",
] as const;

export function memberPayloadHasForbiddenKey(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(memberPayloadHasForbiddenKey);
  return Object.entries(value).some(
    ([key, child]) =>
      forbiddenMemberCatalogKeys.includes(
        key as (typeof forbiddenMemberCatalogKeys)[number],
      ) || memberPayloadHasForbiddenKey(child),
  );
}
