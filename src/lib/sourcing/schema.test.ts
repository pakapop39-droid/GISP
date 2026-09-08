import { describe, expect, it } from "vitest";
import { sourcingRequestSchema } from "./schema";

const validRequest = {
  itemName: "เก้าอี้อ้างอิง",
  description: "ต้องการรุ่นใกล้เคียงกับภาพ",
  matchPreference: "SIMILAR_OK",
  quantity: 1,
  unit: "EA",
};

describe("Slice 13 sourcing input", () => {
  it("allows requests without a project", () => {
    const result = sourcingRequestSchema.safeParse(validRequest);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.projectId).toBeNull();
  });

  it("accepts whole millimetres for dimensions", () => {
    const result = sourcingRequestSchema.safeParse({
      ...validRequest,
      widthMm: 500,
      depthMm: 500,
      heightMm: 700,
    });
    expect(result.success).toBe(true);
  });

  it("rejects decimal millimetres", () => {
    const result = sourcingRequestSchema.safeParse({ ...validRequest, widthMm: 500.5 });
    expect(result.success).toBe(false);
  });
});
