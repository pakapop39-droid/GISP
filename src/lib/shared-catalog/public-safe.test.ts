import { describe, expect, it } from "vitest";
import { publicCatalogHasForbiddenKey, serializePublicCatalogItem } from "./public-safe";

describe("Slice 12.1 public catalog serializer", () => {
  it("contains no price or internal project fields", () => {
    const item = serializePublicCatalogItem({
      id: "i", product_id: "p", image_file_id: null, sku: "SKU", product_type: "STANDARD",
      name_th: "เก้าอี้", name_en: null, description_th: null, specification_summary: null,
      category_name: null, lead_time_days: 30, width_mm: null, depth_mm: null, height_mm: null,
      material_summary: null, finish_summary: null, sort_order: 0, project_area_name: "ห้องรับแขก",
      selected_options: [{ label: "สีเขียว" }],
    }, null, true);
    expect(item).not.toHaveProperty("customerPrice");
    expect(item).not.toHaveProperty("currency");
    expect(item.projectAreaName).toBe("ห้องรับแขก");
    expect(item.selectedOptions).toEqual(["สีเขียว"]);
    expect(publicCatalogHasForbiddenKey(item)).toBe(false);
    expect(publicCatalogHasForbiddenKey({ factoryCost: 1 })).toBe(true);
    expect(publicCatalogHasForbiddenKey({ siteAddress: "private" })).toBe(true);
  });
});
