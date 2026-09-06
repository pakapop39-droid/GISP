import { z } from "zod";
import { BUSINESS_TYPE_CODES, businessTypeStoredValue } from "./business-types";

const memberProfileBaseSchema = z.object({
  contact_name: z.string().trim().min(2).max(120),
  contact_phone: z.string().trim().max(40).default(""),
  company_name: z.string().trim().min(2).max(180),
  company_legal_name: z.string().trim().max(220).default(""),
  tax_id: z.string().trim().max(30).default(""),
  business_type: z.enum(BUSINESS_TYPE_CODES),
  business_type_other: z.string().trim().max(80).default(""),
  address_line: z.string().trim().max(500).default(""),
  district: z.string().trim().max(100).default(""),
  province: z.string().trim().max(100).default(""),
  postal_code: z.string().trim().max(20).default(""),
  service_areas: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  product_interests: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  training_interest: z.boolean().default(false),
  training_note: z.string().trim().max(500).default(""),
});

function validateBusinessType(
  input: { business_type: string; business_type_other: string },
  context: z.RefinementCtx,
) {
  if (input.business_type === "OTHER" && input.business_type_other.length < 2) {
    context.addIssue({
      code: "custom",
      path: ["business_type_other"],
      message: "กรุณาระบุประเภทธุรกิจอื่น ๆ",
    });
  }
}

export const memberProfileSchema = memberProfileBaseSchema.superRefine(validateBusinessType);

export const onboardingSchema = memberProfileBaseSchema.extend({
  consents: z.object({ terms: z.literal(true), privacy: z.literal(true) }),
}).superRefine(validateBusinessType);

export function onboardingRpcInput(input: z.infer<typeof memberProfileSchema>) {
  return {
    contact_name_input: input.contact_name,
    contact_phone_input: input.contact_phone,
    company_name_input: input.company_name,
    company_legal_name_input: input.company_legal_name,
    tax_id_input: input.tax_id,
    business_type_input: businessTypeStoredValue(input.business_type, input.business_type_other),
    address_line_input: input.address_line,
    district_input: input.district,
    province_input: input.province,
    postal_code_input: input.postal_code,
    service_areas_input: input.service_areas,
    product_interests_input: input.product_interests,
    training_interest_input: input.training_interest,
    training_note_input: input.training_note,
  };
}
