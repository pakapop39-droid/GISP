import { z } from "zod";

const nullableText = z.string().trim().max(4000).optional().nullable();

export const createQuotationSchema = z.object({
  custom_request_id: z.uuid(),
  subtotal: z.coerce.number().positive().max(999_999_999),
  lead_time_days: z.coerce.number().int().positive().max(730),
  valid_days: z.coerce.number().int().positive().max(365).default(30),
  supplier_id: z.uuid(),
  supplier_cost_total: z.coerce.number().positive().max(999_999_999),
  quote_note: nullableText,
  confirmed_specification: z.string().trim().min(10).max(10_000),
});

export const updateQuotationSchema = createQuotationSchema.omit({ custom_request_id: true });

export const quotationResponseSchema = z.object({
  response: z.enum(["ACCEPTED", "REJECTED"]),
  reason: nullableText,
}).superRefine((value, context) => {
  if (value.response === "REJECTED" && !value.reason) {
    context.addIssue({ code: "custom", path: ["reason"], message: "กรุณาระบุเหตุผลที่ปฏิเสธ" });
  }
});

export const quotationAdminActionSchema = z.object({
  action: z.enum(["CANCEL", "EXPIRE"]),
  reason: nullableText,
}).superRefine((value, context) => {
  if (value.action === "CANCEL" && !value.reason) {
    context.addIssue({ code: "custom", path: ["reason"], message: "กรุณาระบุเหตุผลที่ยกเลิก" });
  }
});

export function quotationRpcInput(input: z.infer<typeof createQuotationSchema>) {
  return {
    subtotal_input: input.subtotal,
    lead_time_days_input: input.lead_time_days,
    valid_days_input: input.valid_days,
    supplier_id_input: input.supplier_id,
    supplier_cost_total_input: input.supplier_cost_total,
    quote_note_input: input.quote_note ?? null,
    confirmed_specification_input: input.confirmed_specification,
  };
}
