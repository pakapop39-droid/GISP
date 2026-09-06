import { describe, expect, it } from "vitest";
import { productDetailSchema, productDraftSchema, productOptionSchema, productOptionValueSchema, productReviewSchema, productSourceSchema, productVariantSchema, supplierDraftSchema } from "./api-schema";

describe("Slice 2 catalog action schemas", () => {
  it("accepts a valid Supplier Prospect", () => {
    const result = supplierDraftSchema.safeParse({
      code: "SUP-CN-001",
      name: "Guangdong Living",
      countryCode: "cn",
      defaultCurrency: "cny",
      defaultLeadTimeDays: 45,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.countryCode).toBe("CN");
      expect(result.data.defaultCurrency).toBe("CNY");
    }
  });

  it("rejects an invalid Supplier country code", () => {
    expect(supplierDraftSchema.safeParse({
      code: "SUP-1",
      name: "Supplier",
      countryCode: "CHN",
      defaultCurrency: "CNY",
    }).success).toBe(false);
  });

  it("creates a Product Draft payload without requiring a member price", () => {
    const result = productDraftSchema.safeParse({
      supplierId: "11111111-1111-4111-8111-111111111111",
      categoryId: null,
      sku: "CHR-001",
      nameTh: "เก้าอี้ทดสอบ",
      productType: "STANDARD",
      countryCode: "CN",
    });
    expect(result.success).toBe(true);
    if (result.success) expect("memberPrice" in result.data).toBe(false);
  });

  it("rejects an unsupported Product type", () => {
    expect(productDraftSchema.safeParse({
      supplierId: "11111111-1111-4111-8111-111111111111",
      sku: "CHR-001",
      nameTh: "เก้าอี้ทดสอบ",
      productType: "UNKNOWN",
      countryCode: "CN",
    }).success).toBe(false);
  });

  it("accepts complete Product Detail and Variant payloads", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    expect(productDetailSchema.safeParse({
      supplierId: id, categoryId: id, sku: "CHR-001", nameTh: "เก้าอี้",
      productType: "STANDARD", countryCode: "CN", descriptionTh: "รายละเอียด",
      specificationSummary: "สเปก", defaultLeadTimeDays: 45, widthMm: 600,
      depthMm: 650, heightMm: 800, materialSummary: "ไม้โอ๊ก",
    }).success).toBe(true);
    expect(productVariantSchema.safeParse({ sku: "CHR-001-OAK", name: "Oak", widthMm: 600 }).success).toBe(true);
  });

  it("accepts CN01 source identity and Product Option payloads", () => {
    expect(productSourceSchema.safeParse({
      supplierProductCode: "878", sourceRowNumber: 2,
      sourceSpecificationRaw: "ขนาด 1820×2120×1110; สี BK6699",
    }).success).toBe(true);
    expect(productOptionSchema.safeParse({ name: "สี/วัสดุ", isRequired: false }).success).toBe(true);
    expect(productOptionValueSchema.safeParse({
      label: "BK6699", memberPriceDelta: 0, factoryCostDelta: 0,
    }).success).toBe(true);
  });

  it("rejects negative Option price deltas and invalid source rows", () => {
    expect(productOptionValueSchema.safeParse({ label: "BK6699", memberPriceDelta: -1, factoryCostDelta: 0 }).success).toBe(false);
    expect(productSourceSchema.safeParse({ sourceRowNumber: 0 }).success).toBe(false);
  });

  it("requires a note when Review sends a Product back", () => {
    expect(productReviewSchema.safeParse({ decision: "NEEDS_FIX", note: "", confirmed: true }).success).toBe(false);
    expect(productReviewSchema.safeParse({ decision: "PASSED", note: "", confirmed: true }).success).toBe(true);
  });
});
