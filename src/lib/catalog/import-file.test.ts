import { describe, expect, it } from "vitest";
import { catalogImportHeaders, validateCatalogImportRows, type CatalogImportSource } from "./import-file";

function source(values: Partial<CatalogImportSource>): CatalogImportSource {
  return Object.fromEntries(catalogImportHeaders.map((header) => [header, values[header] ?? ""])) as CatalogImportSource;
}

describe("catalog import validation", () => {
  it("accepts a valid row and resolves its category", () => {
    const [row] = validateCatalogImportRows({ supplierId: "supplier-1", categories: [{ id: "category-1", code: "CHAIR_STOOL" }], existingSkus: [], rows: [{ rowNumber: 2, source: source({ sku: "new-001", name_th: "เก้าอี้", product_type: "standard", category_code: "chair_stool", width_mm: "600" }) }] });
    expect(row.errors).toEqual([]);
    expect(row.source.sku).toBe("NEW-001");
    expect(row.source.categoryId).toBe("category-1");
    expect(row.source.country_code).toBe("CN");
  });

  it("reports duplicate SKU, unknown category and invalid dimensions", () => {
    const [row] = validateCatalogImportRows({ supplierId: "supplier-1", categories: [], existingSkus: ["DUP-001"], rows: [{ rowNumber: 2, source: source({ sku: "dup-001", name_th: "สินค้า", product_type: "STANDARD", category_code: "UNKNOWN", width_mm: "-5" }) }] });
    expect(row.errors.map((error) => error.code)).toEqual(["DUPLICATE_SKU", "CATEGORY_NOT_FOUND", "INVALID_POSITIVE_NUMBER"]);
  });

  it("blocks a duplicate SKU inside the same file", () => {
    const rows = validateCatalogImportRows({ supplierId: "supplier-1", categories: [], existingSkus: [], rows: [{ rowNumber: 2, source: source({ sku: "SAME-001", name_th: "หนึ่ง", product_type: "STANDARD" }) }, { rowNumber: 3, source: source({ sku: "SAME-001", name_th: "สอง", product_type: "STANDARD" }) }] });
    expect(rows[0].errors).toHaveLength(0);
    expect(rows[1].errors[0].code).toBe("DUPLICATE_SKU");
  });
});
