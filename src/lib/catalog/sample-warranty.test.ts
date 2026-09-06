import { describe, expect, it } from "vitest";
import { memberForbiddenSampleKeys, serializeMemberCatalogExtras } from "./sample-warranty";
import { sampleWarrantyActionSchema } from "./sample-warranty-schema";

describe("Slice 11 member-safe catalog extras", () => {
  it("serializes only the public sample location and warranty fields", () => {
    const result = serializeMemberCatalogExtras({
      samples: [{
        id: "sample-1", sample_code: "SMP-001", sample_type: "MATERIAL_SWATCH",
        display_name: "ผ้าโทนทราย", member_note: "นัดหมายล่วงหน้า",
        availability_status: "AVAILABLE", country_code: "TH", city: "Bangkok",
        public_location_label: "โชว์รูมกรุงเทพฯ", supplier_id: "secret",
        address_line: "secret", shelf_location: "A-01", internal_note: "secret",
      }],
      warranty: { version_number: 2, title: "รับประกันโครงสร้าง", member_summary: "24 เดือน", terms_text: "ตามเงื่อนไข", duration_months: 24, effective_from: "2026-09-01T00:00:00.000Z" },
    });
    expect(result.samples[0]).toEqual({ id:"sample-1", code:"SMP-001", type:"MATERIAL_SWATCH", displayName:"ผ้าโทนทราย", memberNote:"นัดหมายล่วงหน้า", availabilityStatus:"AVAILABLE", countryCode:"TH", city:"Bangkok", publicLocationLabel:"โชว์รูมกรุงเทพฯ" });
    const serialized = JSON.stringify(result);
    for (const key of memberForbiddenSampleKeys) expect(serialized).not.toContain(key);
    expect(result.warranty?.versionNumber).toBe(2);
  });

  it("validates built-in sample actions and warranty drafts", () => {
    expect(sampleWarrantyActionSchema.safeParse({ action:"CREATE_SAMPLE", productId:"00000000-0000-4000-8000-000000000001", supplierLocationId:"00000000-0000-4000-8000-000000000002", sampleCode:"SMP-1", sampleType:"BUILT_IN_DISPLAY", displayName:"ครัวตัวอย่าง" }).success).toBe(true);
    expect(sampleWarrantyActionSchema.safeParse({ action:"CREATE_WARRANTY", supplierId:"00000000-0000-4000-8000-000000000001", productId:null, title:"เงื่อนไข", memberSummary:"รับประกัน 24 เดือน", termsText:"ใช้ตามเงื่อนไข", durationMonths:24, effectiveFrom:"2026-09-01T00:00:00.000Z" }).success).toBe(true);
  });
});
