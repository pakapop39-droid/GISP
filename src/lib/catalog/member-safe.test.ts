import { describe, expect, it } from "vitest";
import {
  memberPayloadHasForbiddenKey,
  serializeMemberCatalogItem,
  serializeMemberFinish,
  type MemberCatalogViewRow,
} from "./member-safe";

const row: MemberCatalogViewRow = {
  id: "product-1",
  sku: "GISP-001",
  product_type: "STANDARD",
  name_th: "เก้าอี้",
  name_en: "Chair",
  description_th: "รายละเอียด",
  specification_summary: "สเปก",
  default_lead_time_days: 45,
  country_code: "CN",
  width_mm: 500,
  depth_mm: 500,
  height_mm: 800,
  weight_kg: 12,
  cbm: 0.2,
  material_summary: "ไม้และผ้า",
  finish_summary: "Walnut",
  moq: 1,
  category_id: "category-1",
  category_name: "เก้าอี้",
  price_id: "price-1",
  member_price_before_vat: 125,
  suggested_resale_amount: 156.25,
  freight_estimate_min: 15,
  freight_estimate_max: 20,
  currency: "THB",
  published_at: "2026-08-19T00:00:00.000Z",
  available_sample_count: 0,
  warranty_summary: "Partner Warranty",
};

describe("member catalog serializer", () => {
  it("returns member pricing without confidential pricing inputs", () => {
    const result = serializeMemberCatalogItem(row, "https://signed.example/image");
    expect(result.price).toEqual({
      id: "price-1",
      memberPrice: 125,
      suggestedResalePrice: 156.25,
      freightEstimateLow: 15,
      freightEstimateHigh: 20,
      currency: "THB",
    });
    expect(memberPayloadHasForbiddenKey(result)).toBe(false);
  });

  it("detects forbidden keys recursively", () => {
    expect(memberPayloadHasForbiddenKey({ safe: { factoryCost: 100 } })).toBe(true);
  });

  it("projects a finish to code, label and signed swatch only", () => {
    const finish = serializeMemberFinish({
      code: "A9-6001",
      name_th: "สี A9-6001",
      name_zh: "颜色",
      signed_url: "https://signed.example/swatch",
    });
    expect(finish).toEqual({
      code: "A9-6001",
      label: "สี A9-6001",
      labelZh: "颜色",
      swatchUrl: "https://signed.example/swatch",
    });
    expect(memberPayloadHasForbiddenKey(finish)).toBe(false);
    expect(memberPayloadHasForbiddenKey({ sourceDocument: "confidential.pdf" })).toBe(true);
  });
});
