import { describe, expect, it } from "vitest";
import { sharedCatalogInputSchema, sharedCatalogItemSchema } from "./schema";

describe("Slice 12 shared catalog schemas", () => {
  it("defaults to a curated no-price catalog", () => {
    expect(sharedCatalogInputSchema.parse({ title: "บ้านสุขุมวิท", brandName: "Studio A" }).scopeType).toBe("CURATED");
  });

  it("requires a source for product and project links", () => {
    expect(sharedCatalogInputSchema.safeParse({ title: "สินค้า", brandName: "Studio A", scopeType: "PRODUCT" }).success).toBe(false);
    expect(sharedCatalogInputSchema.safeParse({ title: "สินค้า", brandName: "Studio A", scopeType: "PRODUCT", sourceId: crypto.randomUUID() }).success).toBe(true);
  });

  it("accepts a product selection without customer price", () => {
    expect(sharedCatalogItemSchema.safeParse({ productId: crypto.randomUUID(), sortOrder: 0 }).success).toBe(true);
  });
});
