import { describe, expect, it } from "vitest";
import { memberProfileSchema, onboardingRpcInput, onboardingSchema } from "./onboarding";

const profile = {
  contact_name: "Member Test",
  contact_phone: "",
  company_name: "GISP Test Studio",
  company_legal_name: "",
  tax_id: "",
  business_type: "INTERIOR_DESIGN" as const,
  business_type_other: "",
  address_line: "",
  district: "",
  province: "",
  postal_code: "",
  service_areas: ["กรุงเทพฯ"],
  product_interests: [],
  training_interest: false,
  training_note: "",
};

describe("member profile validation", () => {
  it("allows an approved member to update a profile without accepting consent again", () => {
    expect(memberProfileSchema.safeParse(profile).success).toBe(true);
  });

  it("still requires terms and privacy consent during initial onboarding", () => {
    expect(onboardingSchema.safeParse(profile).success).toBe(false);
  });

  it("maps validated profile fields to the onboarding RPC", () => {
    expect(onboardingRpcInput(memberProfileSchema.parse(profile))).toMatchObject({
      contact_name_input: "Member Test",
      company_name_input: "GISP Test Studio",
      business_type_input: "บริษัทออกแบบตกแต่งภายใน",
      service_areas_input: ["กรุงเทพฯ"],
    });
  });

  it("rejects a business type outside the approved dropdown", () => {
    expect(memberProfileSchema.safeParse({ ...profile, business_type: "บริษัทของฉัน" }).success).toBe(false);
  });

  it("requires a description when business type is other", () => {
    expect(memberProfileSchema.safeParse({ ...profile, business_type: "OTHER", business_type_other: "" }).success).toBe(false);
    expect(memberProfileSchema.safeParse({ ...profile, business_type: "OTHER", business_type_other: "ผู้ผลิตเฟอร์นิเจอร์" }).success).toBe(true);
  });
});
