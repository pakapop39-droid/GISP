import { z } from "zod";
import { customRequestTypes } from "./types";

const nullableUuid = z.union([z.uuid(), z.literal(""), z.null()]).optional().transform((value) => value || null);
const nullablePositive = z.union([z.number().positive(), z.null()]).optional().transform((value) => value ?? null);

export const customRequestInputSchema = z.object({
  projectId: z.uuid(),
  areaId: nullableUuid,
  baseProductId: nullableUuid,
  requestType: z.enum(customRequestTypes),
  itemName: z.string().trim().min(2, "กรุณาระบุชื่อรายการ").max(240),
  description: z.string().trim().min(10, "กรุณาระบุรายละเอียดอย่างน้อย 10 ตัวอักษร").max(12000),
  widthMm: nullablePositive,
  depthMm: nullablePositive,
  heightMm: nullablePositive,
  quantity: z.number().positive().max(999999),
  unit: z.string().trim().min(1).max(30),
  requestedMaterial: z.string().trim().max(2000).optional().default(""),
  requestedColor: z.string().trim().max(1000).optional().default(""),
  requestedFunction: z.string().trim().max(2000).optional().default(""),
  memberNote: z.string().trim().max(4000).optional().default(""),
});

export const submitCustomRequestSchema = z.object({});

export const cancelCustomRequestSchema = z.object({
  reason: z.string().trim().min(3, "กรุณาระบุเหตุผล").max(2000),
});

export const adminCustomRequestActionSchema = z.object({
  action: z.enum(["START_REVIEW", "REQUEST_INFO", "READY_FOR_QUOTE", "CANCEL", "SAVE_NOTE"]),
  message: z.string().trim().max(4000).optional().default(""),
  assignedTo: nullableUuid,
  dueAt: z.union([z.iso.datetime(), z.literal(""), z.null()]).optional().transform((value) => value || null),
});

export const supplierCandidatesSchema = z.object({
  supplierIds: z.array(z.uuid()).max(20),
});
