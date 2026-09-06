import { z } from "zod";
import {
  pricingCalculationBases,
  pricingCalculationTypes,
  pricingScopeTypes,
} from "@/lib/pricing/engine";

const decimalInput = z.union([
  z.number().finite(),
  z.string().trim().regex(/^\d+(?:\.\d+)?$/),
]);

const nullableUuid = z.union([z.uuid(), z.null()]).default(null);

export const pricingComponentSchema = z.object({
  componentCode: z.string().trim().min(1).max(80),
  componentName: z.string().trim().min(1).max(180),
  calculationType: z.enum(pricingCalculationTypes),
  calculationBasis: z.enum(pricingCalculationBases),
  componentValue: decimalInput,
  includedInMemberPrice: z.boolean().default(true),
  enabled: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(10000).default(0),
});

export const priceFormulaDraftSchema = z
  .object({
    scopeType: z.enum(pricingScopeTypes),
    supplierId: nullableUuid,
    productId: nullableUuid,
    name: z.string().trim().min(2).max(180),
    effectiveFrom: z.iso.datetime().optional(),
    effectiveUntil: z.union([z.iso.datetime(), z.null()]).default(null),
    suggestedResaleMarkupPercent: decimalInput,
    freightEstimateMinPercent: decimalInput,
    freightEstimateMaxPercent: decimalInput,
    components: z.array(pricingComponentSchema).max(100),
  })
  .superRefine((value, context) => {
    const scopeIsValid =
      (value.scopeType === "GLOBAL" &&
        value.supplierId === null &&
        value.productId === null) ||
      (value.scopeType === "SUPPLIER" &&
        value.supplierId !== null &&
        value.productId === null) ||
      (value.scopeType === "PRODUCT" &&
        value.supplierId === null &&
        value.productId !== null);
    if (!scopeIsValid) {
      context.addIssue({
        code: "custom",
        path: ["scopeType"],
        message: "Scope และ Supplier/Product ไม่สอดคล้องกัน",
      });
    }
    if (value.scopeType === "GLOBAL" && !value.components.some((item) => item.enabled)) {
      context.addIssue({
        code: "custom",
        path: ["components"],
        message: "สูตร Global ต้องมี Component ที่เปิดใช้งานอย่างน้อยหนึ่งรายการ",
      });
    }
    const codes = value.components.map((item) => item.componentCode.toUpperCase());
    if (new Set(codes).size !== codes.length) {
      context.addIssue({
        code: "custom",
        path: ["components"],
        message: "Component Code ห้ามซ้ำกันในสูตรเดียวกัน",
      });
    }
  });

export const pricePreviewSchema = z.object({
  productId: z.uuid(),
  variantId: nullableUuid,
});

export const confirmedActionSchema = z.object({ confirmed: z.literal(true) });

export const productCostSchema = z.object({
  variantId: nullableUuid,
  factoryCost: decimalInput,
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
  exchangeRateToThb: decimalInput,
  effectiveFrom: z.iso.datetime().optional(),
});

export function formulaComponentsForRpc(
  components: z.infer<typeof pricingComponentSchema>[],
) {
  return components.map((component) => ({
    component_code: component.componentCode,
    component_name: component.componentName,
    calculation_type: component.calculationType,
    calculation_basis: component.calculationBasis,
    component_value: component.componentValue,
    included_in_member_price: component.includedInMemberPrice,
    is_enabled: component.enabled,
    sort_order: component.sortOrder,
  }));
}
