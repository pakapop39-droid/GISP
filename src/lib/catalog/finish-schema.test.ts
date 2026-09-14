import { describe, expect, it } from "vitest";
import { finishLibraryActionSchema } from "./finish-schema";

const id = "11111111-1111-4111-8111-111111111111";

describe("finish library action schema", () => {
  it("accepts a traceable finish without pricing fields", () => {
    const result = finishLibraryActionSchema.safeParse({
      action: "CREATE_FINISH",
      collectionId: id,
      code: "a9-6001",
      nameTh: "สี A9-6001",
      colorHex: "#AABBCC",
      sourceDocument: "A9 large color card",
      sourcePage: "1",
      metadata: { surface: "matte" },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect("price" in result.data).toBe(false);
      expect("factoryCost" in result.data).toBe(false);
    }
  });

  it("rejects a missing source page and malformed color", () => {
    expect(finishLibraryActionSchema.safeParse({
      action: "CREATE_FINISH",
      collectionId: id,
      code: "A9-6001",
      nameTh: "สี",
      colorHex: "AABBCC",
      sourceDocument: "A9",
      sourcePage: "",
    }).success).toBe(false);
  });
});

