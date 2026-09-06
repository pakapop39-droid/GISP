import { z } from "zod";

export const projectTypeSchema = z.enum([
  "RESIDENTIAL", "CONDOMINIUM", "HOSPITALITY", "COMMERCIAL", "OTHER",
]);

export const createProjectSchema = z.object({
  name: z.string().trim().min(2).max(180),
  projectType: projectTypeSchema,
  endCustomerName: z.string().trim().min(2).max(180),
  endCustomerPhone: z.string().trim().max(50).default(""),
  endCustomerEmail: z.union([z.email(), z.literal("")]).default(""),
  siteAddress: z.string().trim().min(5).max(1000),
  expectedNeedDate: z.union([z.iso.date(), z.literal("")]).default(""),
  note: z.string().trim().max(1000).default(""),
});

export const updateProjectSchema = createProjectSchema;

export const createAreaSchema = z.object({
  name: z.string().trim().min(1).max(120),
  note: z.string().trim().max(500).default(""),
});

const selectedOptionSchema = z.object({
  optionId: z.uuid(), valueId: z.uuid(), label: z.string().trim().min(1).max(200),
});

export const addProjectItemSchema = z.object({
  areaId: z.union([z.uuid(), z.null()]).default(null),
  productId: z.uuid(),
  variantId: z.union([z.uuid(), z.null()]).default(null),
  selectedOptions: z.array(selectedOptionSchema).default([]),
  quantity: z.coerce.number().positive().max(999999),
});

export const updateProjectItemSchema = z.object({
  areaId: z.union([z.uuid(), z.null()]).default(null),
  variantId: z.union([z.uuid(), z.null()]).default(null),
  selectedOptions: z.array(selectedOptionSchema).default([]),
  quantity: z.coerce.number().positive().max(999999),
});

export const showroomVisitSchema = z.object({
  productId: z.uuid(),
  preferredAt: z.iso.datetime({ offset: true }),
  attendeeCount: z.coerce.number().int().min(1).max(50),
  note: z.string().trim().max(1000).default(""),
});

export const cancelShowroomVisitSchema = z.object({
  reason: z.string().trim().min(3).max(1000),
});

export const reviewShowroomVisitSchema = z.object({
  action: z.enum(["APPROVE", "REJECT", "COMPLETE"]),
  note: z.string().trim().max(1000).default(""),
});

export const revokeSupplierDisclosureSchema = z.object({
  reason: z.string().trim().min(5).max(1000),
});

export type ProjectScheduleItem = {
  areaName: string; sku: string; name: string; variant: string | null;
  options: string; quantity: number; unit: string; unitPrice: number; status: string;
};

export function scheduleTotals(items: ProjectScheduleItem[]) {
  return items.reduce(
    (total, item) => ({ quantity: total.quantity + item.quantity, subtotal: total.subtotal + item.quantity * item.unitPrice }),
    { quantity: 0, subtotal: 0 },
  );
}
