import { describe, expect, it } from "vitest";
import { validatedSwatchExtension } from "./swatch-file";

describe("swatch magic bytes", () => {
  it.each([
    ["image/jpeg", [0xff, 0xd8, 0xff, 0x00], "jpg"],
    ["image/png", [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], "png"],
    ["image/webp", [...Buffer.from("RIFF0000WEBP")], "webp"],
  ])("accepts a real %s signature", async (mime, bytes, extension) => {
    await expect(validatedSwatchExtension(new File([new Uint8Array(bytes)], "swatch", { type: mime }))).resolves.toBe(extension);
  });

  it("rejects executable bytes disguised as an image", async () => {
    await expect(validatedSwatchExtension(new File(["MZ fake"], "swatch.jpg", { type: "image/jpeg" }))).resolves.toBeNull();
  });
});
