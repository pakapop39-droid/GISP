export const BUSINESS_TYPE_OPTIONS = [
  { code: "INTERIOR_DESIGN", label: "บริษัทออกแบบตกแต่งภายใน" },
  { code: "INTERIOR_CONTRACTOR", label: "ผู้รับเหมาตกแต่งภายใน" },
  { code: "ARCHITECT_DESIGNER", label: "สถาปนิก / นักออกแบบ" },
  { code: "RETAIL_DISTRIBUTOR", label: "ร้านค้า / ตัวแทนจำหน่าย" },
  { code: "PROPERTY_DEVELOPER", label: "เจ้าของโครงการ / อสังหาริมทรัพย์" },
  { code: "HOSPITALITY", label: "โรงแรม / ร้านอาหาร / ธุรกิจบริการ" },
  { code: "OTHER", label: "อื่น ๆ" },
] as const;

export const BUSINESS_TYPE_CODES = BUSINESS_TYPE_OPTIONS.map((option) => option.code) as [
  "INTERIOR_DESIGN",
  "INTERIOR_CONTRACTOR",
  "ARCHITECT_DESIGNER",
  "RETAIL_DISTRIBUTOR",
  "PROPERTY_DEVELOPER",
  "HOSPITALITY",
  "OTHER",
];

export type BusinessTypeCode = (typeof BUSINESS_TYPE_OPTIONS)[number]["code"];
export type BusinessTypeSelection = BusinessTypeCode | "";

export function businessTypeDraftFromStored(value: string | null | undefined): {
  code: BusinessTypeSelection;
  other: string;
} {
  const stored = value?.trim() ?? "";
  if (!stored) return { code: "", other: "" };
  const matched = BUSINESS_TYPE_OPTIONS.find((option) => option.code !== "OTHER" && option.label === stored);
  return matched ? { code: matched.code, other: "" } : { code: "OTHER", other: stored };
}

export function businessTypeStoredValue(code: BusinessTypeCode, other: string): string {
  if (code === "OTHER") return other.trim();
  return BUSINESS_TYPE_OPTIONS.find((option) => option.code === code)?.label ?? "";
}
