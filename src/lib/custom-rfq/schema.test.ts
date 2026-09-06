import { describe, expect, it } from "vitest";
import { customRequestInputSchema } from "./schema";
import { customRequestStatuses, customRequestTypes } from "./types";
import { canCancelCustomRequest, canTransitionCustomRequest, getAdminCustomRequestActionFeedback } from "./workflow";

const validInput = {
  projectId: "11111111-1111-4111-8111-111111111111",
  areaId: null,
  baseProductId: null,
  requestType: "PROJECT_SPECIFIC" as const,
  itemName: "ตู้รับรองพิเศษ",
  description: "ผลิตตามขนาดและวัสดุที่ระบุสำหรับโครงการ",
  widthMm: 1200,
  depthMm: 450,
  heightMm: 2400,
  quantity: 2,
  unit: "EA",
};

describe("custom RFQ input", () => {
  it("accepts project-specific and CAD/PDF request types", () => {
    expect(customRequestTypes).toContain("PROJECT_SPECIFIC");
    expect(customRequestTypes).toContain("CAD_PDF");
    expect(customRequestInputSchema.safeParse(validInput).success).toBe(true);
  });

  it("requires a meaningful description and positive quantity", () => {
    expect(customRequestInputSchema.safeParse({ ...validInput, description: "สั้น" }).success).toBe(false);
    expect(customRequestInputSchema.safeParse({ ...validInput, quantity: 0 }).success).toBe(false);
  });
});

describe("custom RFQ lifecycle", () => {
  it("contains only canonical request statuses", () => {
    expect(customRequestStatuses).toEqual([
      "DRAFT", "SUBMITTED", "UNDER_REVIEW", "NEED_INFO",
      "READY_FOR_QUOTE", "CONVERTED", "CANCELLED",
    ]);
  });

  it("supports the Slice 4 review loop and blocks reopening terminal states", () => {
    expect(canTransitionCustomRequest("DRAFT", "SUBMITTED")).toBe(true);
    expect(canTransitionCustomRequest("SUBMITTED", "UNDER_REVIEW")).toBe(true);
    expect(canTransitionCustomRequest("UNDER_REVIEW", "NEED_INFO")).toBe(true);
    expect(canTransitionCustomRequest("NEED_INFO", "SUBMITTED")).toBe(true);
    expect(canTransitionCustomRequest("UNDER_REVIEW", "READY_FOR_QUOTE")).toBe(true);
    expect(canTransitionCustomRequest("CONVERTED", "DRAFT")).toBe(false);
    expect(canCancelCustomRequest("READY_FOR_QUOTE")).toBe(true);
    expect(canCancelCustomRequest("CONVERTED")).toBe(false);
  });

  it("explains whether an admin action changed the visible status", () => {
    expect(getAdminCustomRequestActionFeedback("REQUEST_INFO")).toContain("สถานะใหม่: รอข้อมูลเพิ่ม");
    expect(getAdminCustomRequestActionFeedback("SAVE_NOTE")).toContain("สถานะไม่เปลี่ยน");
  });
});
