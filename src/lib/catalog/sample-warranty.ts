export type MemberSampleRow = {
  id: string;
  sample_code: string;
  sample_type: "MATERIAL_SWATCH" | "BUILT_IN_DISPLAY";
  display_name: string;
  member_note: string | null;
  availability_status: "AVAILABLE" | "BORROWED" | "UNAVAILABLE";
  country_code: string;
  city: string;
  public_location_label: string;
};

export type MemberWarrantyRow = {
  version_number: number;
  title: string;
  member_summary: string;
  terms_text: string;
  duration_months: number | null;
  effective_from: string;
};

export type MemberCatalogExtras = {
  samples: Array<{
    id: string;
    code: string;
    type: MemberSampleRow["sample_type"];
    displayName: string;
    memberNote: string | null;
    availabilityStatus: MemberSampleRow["availability_status"];
    countryCode: string;
    city: string;
    publicLocationLabel: string;
  }>;
  warranty: {
    versionNumber: number;
    title: string;
    memberSummary: string;
    termsText: string;
    durationMonths: number | null;
    effectiveFrom: string;
  } | null;
};

export const sampleTypeLabels = {
  MATERIAL_SWATCH: "ตัวอย่างวัสดุ",
  BUILT_IN_DISPLAY: "ชุดตัวอย่าง Built-in",
} as const;

export const sampleStatusLabels = {
  AVAILABLE: "พร้อมให้บริการ",
  BORROWED: "ถูกยืม",
  UNAVAILABLE: "ไม่พร้อมให้บริการ",
} as const;

export const warrantyStatusLabels = {
  DRAFT: "ฉบับร่าง",
  ACTIVE: "ใช้งานอยู่",
  RETIRED: "ยกเลิกใช้แล้ว",
} as const;

export const memberForbiddenSampleKeys = [
  "supplier_id",
  "supplier_name",
  "address_line",
  "contact_name",
  "contact_email",
  "contact_phone",
  "shelf_location",
  "internal_note",
] as const;

export function serializeMemberCatalogExtras(input: unknown): MemberCatalogExtras {
  const value = (input && typeof input === "object" ? input : {}) as {
    samples?: MemberSampleRow[];
    warranty?: MemberWarrantyRow | null;
  };
  return {
    samples: (value.samples ?? []).map((sample) => ({
      id: sample.id,
      code: sample.sample_code,
      type: sample.sample_type,
      displayName: sample.display_name,
      memberNote: sample.member_note,
      availabilityStatus: sample.availability_status,
      countryCode: sample.country_code,
      city: sample.city,
      publicLocationLabel: sample.public_location_label,
    })),
    warranty: value.warranty
      ? {
          versionNumber: value.warranty.version_number,
          title: value.warranty.title,
          memberSummary: value.warranty.member_summary,
          termsText: value.warranty.terms_text,
          durationMonths: value.warranty.duration_months,
          effectiveFrom: value.warranty.effective_from,
        }
      : null,
  };
}
