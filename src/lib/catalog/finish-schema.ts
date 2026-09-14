import { z } from "zod";

const optionalText = (max: number) =>
  z.union([z.string().trim().max(max), z.null()]).optional();

const collectionFields = {
  supplierId: z.uuid(),
  code: z.string().trim().min(1).max(80),
  nameTh: z.string().trim().min(1).max(240),
  nameZh: optionalText(240),
  materialCategory: optionalText(240),
  sourceDocument: z.string().trim().min(1).max(500),
  sourceVersion: optionalText(120),
};

const finishFields = {
  collectionId: z.uuid(),
  code: z.string().trim().min(1).max(80),
  nameTh: z.string().trim().min(1).max(240),
  nameZh: optionalText(240),
  material: optionalText(500),
  colorHex: z.union([
    z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/),
    z.literal(""),
    z.null(),
  ]).optional(),
  sourceDocument: z.string().trim().min(1).max(500),
  sourcePage: z.string().trim().min(1).max(80),
  metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).default({}),
};

export const finishLibraryActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("CREATE_COLLECTION"),
    ...collectionFields,
  }),
  z.object({
    action: z.literal("UPDATE_COLLECTION"),
    collectionId: z.uuid(),
    ...collectionFields,
  }),
  z.object({
    action: z.literal("SET_COLLECTION_STATUS"),
    collectionId: z.uuid(),
    status: z.enum(["ACTIVE", "INACTIVE"]),
  }),
  z.object({
    action: z.literal("CREATE_FINISH"),
    ...finishFields,
  }),
  z.object({
    action: z.literal("UPDATE_FINISH"),
    finishId: z.uuid(),
    ...finishFields,
  }),
  z.object({
    action: z.literal("SET_FINISH_STATUS"),
    finishId: z.uuid(),
    status: z.enum(["ACTIVE", "INACTIVE"]),
  }),
  z.object({
    action: z.literal("MAP_FINISH"),
    optionValueId: z.uuid(),
    finishId: z.union([z.uuid(), z.null()]),
  }),
]);

