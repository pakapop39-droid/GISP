export const additionalReviewReasons = [
  { id: "MORE_MEDIA", label: "ขอรูปหรือวิดีโอเพิ่มเติม", description: "ขอมุมใกล้ มุมด้านใน หรือภาพระหว่างวัดจริง" },
  { id: "DIMENSION_SPEC", label: "ตรวจขนาดและสเปกซ้ำ", description: "ยืนยันขนาด ระยะ และรายละเอียดตามแบบ" },
  { id: "MATERIAL_COLOR", label: "ตรวจวัสดุและสีซ้ำ", description: "ยืนยันชนิดวัสดุ สี ลาย และความสม่ำเสมอ" },
  { id: "ASSEMBLY_FINISH", label: "ตรวจงานประกอบและผิวสำเร็จซ้ำ", description: "ตรวจรอยต่อ ความเรียบร้อย และตำหนิบนผิวงาน" },
  { id: "PACKING_READY", label: "ตรวจบรรจุภัณฑ์และความพร้อมจัดส่ง", description: "ตรวจการป้องกันสินค้า จำนวน และสภาพก่อนส่ง" },
  { id: "OTHER", label: "อื่น ๆ", description: "ระบุสิ่งที่ต้องการให้ตรวจในช่องรายละเอียด" },
] as const;

export type AdditionalReviewReasonId = typeof additionalReviewReasons[number]["id"];

export function buildAdditionalReviewNote(
  reasonIds: AdditionalReviewReasonId[],
  detail: string,
) {
  if (!reasonIds.length) return null;

  const normalizedDetail = detail.trim();
  if (reasonIds.includes("OTHER") && !normalizedDetail) return null;

  const labels = additionalReviewReasons
    .filter((reason) => reasonIds.includes(reason.id))
    .map((reason) => `• ${reason.label}`);

  return [
    "Member ขอให้ตรวจเพิ่มเติม:",
    ...labels,
    normalizedDetail ? `รายละเอียด: ${normalizedDetail}` : null,
  ].filter(Boolean).join("\n");
}
