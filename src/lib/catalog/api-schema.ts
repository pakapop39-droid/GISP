import { z } from "zod";

const optionalText = (max: number) =>
  z.union([z.string().trim().max(max), z.null()]).optional();

export const supplierDraftSchema = z.object({
  code: z.string().trim().min(2).max(40),
  name: z.string().trim().min(2).max(240),
  legalName: optionalText(240),
  countryCode: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/),
  defaultCurrency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
  contactName: optionalText(180),
  contactEmail: z.union([z.email(), z.literal(""), z.null()]).optional(),
  contactPhone: optionalText(60),
  websiteUrl: z.union([z.url(), z.literal(""), z.null()]).optional(),
  defaultLeadTimeDays: z.union([z.number().int().positive().max(3650), z.null()]).optional(),
});

export const productDraftSchema = z.object({
  supplierId: z.uuid(),
  categoryId: z.union([z.uuid(), z.null()]).default(null),
  sku: z.string().trim().min(2).max(80),
  factorySku: optionalText(100),
  nameTh: z.string().trim().min(2).max(240),
  nameEn: optionalText(240),
  productType: z.enum([
    "STANDARD",
    "CUSTOM_TEMPLATE",
    "READY_TO_ORDER",
    "BUILT_IN",
    "MATERIAL",
    "EQUIPMENT",
    "DECORATIVE",
  ]),
  countryCode: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/),
  defaultLeadTimeDays: z.union([z.number().int().positive().max(3650), z.null()]).optional(),
});

const optionalPositive = z.union([z.number().positive(), z.null()]).optional();

export const productDetailSchema = z.object({
  supplierId: z.uuid(),
  categoryId: z.union([z.uuid(), z.null()]),
  sku: z.string().trim().min(2).max(80),
  factorySku: optionalText(100),
  nameTh: z.string().trim().min(2).max(240),
  nameEn: optionalText(240),
  nameZh: optionalText(240),
  productType: productDraftSchema.shape.productType,
  countryCode: productDraftSchema.shape.countryCode,
  descriptionTh: optionalText(5000),
  specificationSummary: optionalText(5000),
  defaultLeadTimeDays: z.union([z.number().int().positive().max(3650), z.null()]),
  widthMm: optionalPositive,
  depthMm: optionalPositive,
  heightMm: optionalPositive,
  weightKg: optionalPositive,
  cbm: optionalPositive,
  materialSummary: optionalText(2000),
  finishSummary: optionalText(2000),
  moq: optionalPositive,
  sourceCatalogPage: optionalText(120),
  orderingNote: optionalText(3000),
});

export const productVariantSchema = z.object({
  variantId: z.union([z.uuid(), z.null()]).default(null),
  sku: z.string().trim().min(2).max(80),
  factorySku: optionalText(100),
  name: z.string().trim().min(2).max(240),
  specificationSummary: optionalText(3000),
  widthMm: optionalPositive,
  depthMm: optionalPositive,
  heightMm: optionalPositive,
  weightKg: optionalPositive,
  cbm: optionalPositive,
  materialSummary: optionalText(2000),
  finishSummary: optionalText(2000),
  moq: optionalPositive,
});

export const productSourceSchema = z.object({
  supplierProductCode: optionalText(120),
  sourceRowNumber: z.union([z.number().int().positive().max(1_000_000), z.null()]).optional(),
  sourceSpecificationRaw: optionalText(10_000),
});

export const productOptionSchema = z.object({
  optionId: z.union([z.uuid(), z.null()]).default(null),
  name: z.string().trim().min(1).max(120),
  isRequired: z.boolean().default(false),
});

export const productOptionValueSchema = z.object({
  optionValueId: z.union([z.uuid(), z.null()]).default(null),
  label: z.string().trim().min(1).max(240),
  memberPriceDelta: z.number().min(0).max(100_000_000).default(0),
  factoryCostDelta: z.number().min(0).max(100_000_000).default(0),
});

export const productReviewSchema = z.object({
  decision: z.enum(["PASSED", "NEEDS_FIX"]),
  note: z.string().trim().max(2000).default(""),
  confirmed: z.literal(true),
}).superRefine((value, context) => {
  if (value.decision === "NEEDS_FIX" && !value.note) {
    context.addIssue({ code: "custom", path: ["note"], message: "กรุณาระบุสิ่งที่ต้องแก้" });
  }
});

export const productFileSchema = z.object({
  kind: z.enum(["IMAGE", "DOCUMENT"]),
  documentType: z.enum(["CATALOG", "PRICE_LIST", "SPECIFICATION", "WARRANTY", "OTHER"]).default("OTHER"),
  sourcePage: z.string().trim().max(120).default(""),
  isPrimary: z.boolean().default(false),
  isMemberVisible: z.boolean().default(false),
});

export const catalogBatchActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("FILL_LEAD_TIME"),
    productIds: z.array(z.uuid()).min(1).max(1000),
    leadTimeDays: z.number().int().positive().max(3650),
    confirmed: z.literal(true),
  }),
  z.object({
    action: z.literal("FILL_MATERIAL"),
    productIds: z.array(z.uuid()).min(1).max(1000),
    materialSummary: z.string().trim().min(1).max(2000),
    confirmed: z.literal(true),
  }),
  z.object({
    action: z.literal("CREATE_DEFAULT_VARIANTS"),
    productIds: z.array(z.uuid()).min(1).max(1000),
    confirmed: z.literal(true),
  }),
  z.object({
    action: z.literal("PREPARE_COSTS"),
    productIds: z.array(z.uuid()).min(1).max(1000),
    exchangeRateToThb: z.number().positive().max(1_000_000),
    effectiveFrom: z.iso.datetime().optional(),
    confirmed: z.literal(true),
  }),
  z.object({
    action: z.literal("ACTIVATE_MEMBER_PRICES"),
    productIds: z.array(z.uuid()).min(1).max(1000),
    confirmed: z.literal(true),
  }),
]);

export function catalogBatchPayload(
  input: z.infer<typeof catalogBatchActionSchema>,
) {
  if (input.action === "FILL_LEAD_TIME") {
    return { leadTimeDays: input.leadTimeDays };
  }
  if (input.action === "FILL_MATERIAL") {
    return { materialSummary: input.materialSummary };
  }
  if (input.action === "PREPARE_COSTS") {
    return {
      exchangeRateToThb: input.exchangeRateToThb,
      effectiveFrom: input.effectiveFrom ?? new Date().toISOString(),
    };
  }
  return {};
}
