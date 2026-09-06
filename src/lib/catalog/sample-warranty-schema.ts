import { z } from "zod";

const nullableText = (max: number) =>
  z.union([z.string().trim().max(max), z.null()]).optional();

export const sampleWarrantyActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("CREATE_LOCATION"),
    supplierId: z.uuid(),
    countryCode: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/),
    city: z.string().trim().min(1).max(160),
    locationType: z.enum(["FACTORY", "SHOWROOM", "WAREHOUSE"]),
    publicLabel: z.string().trim().min(2).max(240),
    addressLine: nullableText(500),
    contactName: nullableText(180),
    contactEmail: z.union([z.email(), z.literal(""), z.null()]).optional(),
    contactPhone: nullableText(60),
  }),
  z.object({
    action: z.literal("CREATE_SAMPLE"),
    productId: z.uuid(),
    supplierLocationId: z.uuid(),
    sampleCode: z.string().trim().min(2).max(80),
    sampleType: z.enum(["MATERIAL_SWATCH", "BUILT_IN_DISPLAY"]),
    displayName: z.string().trim().min(2).max(240),
    memberNote: nullableText(1000),
    shelfLocation: nullableText(160),
    internalNote: nullableText(2000),
  }),
  z.object({
    action: z.literal("SET_SAMPLE_STATUS"),
    sampleId: z.uuid(),
    status: z.enum(["AVAILABLE", "BORROWED", "UNAVAILABLE"]),
  }),
  z.object({
    action: z.literal("CREATE_WARRANTY"),
    supplierId: z.uuid(),
    productId: z.union([z.uuid(), z.null()]).default(null),
    title: z.string().trim().min(2).max(240),
    memberSummary: z.string().trim().min(2).max(1000),
    termsText: z.string().trim().min(2).max(10000),
    durationMonths: z.union([z.number().int().positive().max(600), z.null()]).default(null),
    effectiveFrom: z.iso.datetime(),
  }),
  z.object({ action: z.literal("ACTIVATE_WARRANTY"), warrantyId: z.uuid() }),
  z.object({ action: z.literal("RETIRE_WARRANTY"), warrantyId: z.uuid() }),
]);
