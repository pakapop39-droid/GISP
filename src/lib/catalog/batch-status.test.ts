import { describe, expect, it } from "vitest";
import {
  catalogBatchSummary,
  catalogIssuesForProduct,
  type CatalogBatchProduct,
} from "./batch-status";

const completeProduct: CatalogBatchProduct = {
  id: "p1",
  supplier_id: "s1",
  category_id: "c1",
  sku: "CN01-001",
  name_th: "เก้าอี้",
  name_en: "Chair",
  product_type: "STANDARD",
  status: "DRAFT",
  qa_status: "NOT_REVIEWED",
  description_th: "รายละเอียด",
  specification_summary: "สเปก",
  default_lead_time_days: 45,
  width_mm: 500,
  depth_mm: 500,
  height_mm: 800,
  material_summary: "ไม้และผ้า",
  factory_cost: 100,
  factory_currency: "CNY",
};

describe("catalog batch validation", () => {
  it("reports no blockers when all catalog requirements are ready", () => {
    expect(
      catalogIssuesForProduct(completeProduct, {
        supplierActive: true,
        activeVariant: true,
        primaryImage: true,
        activeCost: true,
        activePrice: true,
      }),
    ).toEqual([]);
  });

  it("keeps missing business values blocked instead of inventing them", () => {
    const issues = catalogIssuesForProduct(
      {
        ...completeProduct,
        default_lead_time_days: null,
        material_summary: null,
        width_mm: null,
      },
      {
        supplierActive: true,
        activeVariant: false,
        primaryImage: true,
        activeCost: false,
        activePrice: false,
      },
    );
    expect(issues).toEqual([
      "LEAD_TIME_REQUIRED",
      "MATERIAL_REQUIRED",
      "DIMENSIONS_REQUIRED",
      "ACTIVE_VARIANT_REQUIRED",
      "ACTIVE_COST_REQUIRED",
      "ACTIVE_PRICE_REQUIRED",
    ]);
  });

  it("summarizes ready rows and each blocker", () => {
    const rows = [
      {
        ...completeProduct,
        issues: [],
        sourceCostReady: true,
        activeVariant: true,
        primaryImage: true,
        activeCost: true,
        activePrice: true,
      },
      {
        ...completeProduct,
        id: "p2",
        issues: ["ACTIVE_PRICE_REQUIRED" as const],
        sourceCostReady: true,
        activeVariant: true,
        primaryImage: true,
        activeCost: true,
        activePrice: false,
      },
    ];
    const summary = catalogBatchSummary(rows);
    expect(summary.total).toBe(2);
    expect(summary.readyForReview).toBe(1);
    expect(summary.issueCounts.ACTIVE_PRICE_REQUIRED).toBe(1);
  });
});
