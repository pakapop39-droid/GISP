import { z } from "zod";
import { sharedCatalogScopes } from "./types";

const optionalText = (max: number) => z.string().trim().max(max).optional().default("");
const expiry = z.union([z.iso.datetime(), z.literal(""), z.null()]).optional().transform((value) => value || null);

export const sharedCatalogInputSchema = z.object({
  title: z.string().trim().min(2, "กรุณาระบุชื่อ Catalog").max(160),
  introduction: optionalText(2000),
  brandName: z.string().trim().min(2, "กรุณาระบุชื่อบริษัท").max(160),
  contactName: optionalText(160),
  contactPhone: optionalText(80),
  contactEmail: z.union([z.email(), z.literal("")]).optional().default(""),
  lineUrl: z.union([z.url(), z.literal("")]).optional().default(""),
  scopeType: z.enum(sharedCatalogScopes).default("CURATED"),
  sourceId: z.union([z.uuid(), z.literal(""), z.null()]).optional().transform((value) => value || null),
  expiresAt: expiry,
}).superRefine((value, context) => {
  if (["PRODUCT", "PROJECT"].includes(value.scopeType) && !value.sourceId) {
    context.addIssue({ code: "custom", path: ["sourceId"], message: "กรุณาเลือกสินค้าหรือโครงการ" });
  }
  if (["CURATED", "FULL_CATALOG"].includes(value.scopeType) && value.sourceId) {
    context.addIssue({ code: "custom", path: ["sourceId"], message: "ลิงก์ชนิดนี้ไม่ต้องระบุแหล่งข้อมูล" });
  }
});

export const sharedCatalogItemSchema = z.object({
  productId: z.uuid(),
  sortOrder: z.number().int().min(0).max(10000).optional().default(0),
});

export const sharedCatalogRemoveItemSchema = z.object({ productId: z.uuid() });
