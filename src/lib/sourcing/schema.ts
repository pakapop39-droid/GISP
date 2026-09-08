import { z } from "zod";
const nullableUuid=z.union([z.uuid(),z.literal(""),z.null()]).optional().transform(value=>value||null);
const nullablePositive=z.union([z.number().positive(),z.null()]).optional().transform(value=>value??null);
const nullableDimension=z.union([z.number().int().positive(),z.null()]).optional().transform(value=>value??null);
const optionalText=(max:number)=>z.string().trim().max(max).optional().default("");

export const sourcingRequestSchema=z.object({
  projectId:nullableUuid,areaId:nullableUuid,itemName:z.string().trim().min(2).max(240),
  description:z.string().trim().min(10).max(12000),matchPreference:z.enum(["EXACT_ONLY","SIMILAR_OK"]).default("SIMILAR_OK"),
  quantity:z.number().positive().max(999999),unit:z.string().trim().min(1).max(30),widthMm:nullableDimension,depthMm:nullableDimension,heightMm:nullableDimension,
  requestedMaterial:optionalText(2000),requestedColor:optionalText(1000),budgetMax:nullablePositive,
  neededAt:z.union([z.iso.date(),z.literal(""),z.null()]).optional().transform(value=>value||null),
  sourceUrl:z.union([z.url(),z.literal("")]).optional().default(""),memberNote:optionalText(4000),
});
export const sourcingCancelSchema=z.object({reason:z.string().trim().min(3).max(2000)});
export const sourcingSelectSchema=z.object({candidateId:z.uuid()});
export const sourcingRejectSchema=z.object({message:z.string().trim().min(3).max(2000)});
export const adminSourcingActionSchema=z.object({action:z.enum(["START_REVIEW","REQUEST_INFO","PUBLISH_OPTIONS","MARK_UNAVAILABLE","COMPLETE","CANCEL"]),message:optionalText(4000)});
export const sourcingCandidateSchema=z.object({
  candidateId:nullableUuid,supplierId:nullableUuid,categoryId:nullableUuid,proposedSku:optionalText(120),factorySku:optionalText(120),
  productType:z.enum(["STANDARD","READY_TO_ORDER","BUILT_IN","MATERIAL","EQUIPMENT","DECORATIVE"]).default("STANDARD"),countryCode:z.string().trim().length(2).default("CN"),
  nameTh:z.string().trim().min(2).max(240),nameEn:optionalText(240),description:optionalText(6000),specificationSummary:optionalText(6000),
  materialSummary:optionalText(2000),finishSummary:optionalText(2000),memberPrice:z.number().nonnegative(),leadTimeDays:z.union([z.number().int().positive(),z.null()]).optional().default(null),
  factoryCost:z.union([z.number().nonnegative(),z.null()]).optional().default(null),factoryCurrency:optionalText(3),internalNote:optionalText(4000),
});
export const sourcingLinkProductSchema=z.object({candidateId:z.uuid(),productId:z.uuid()});
