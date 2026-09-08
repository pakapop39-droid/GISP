import { describe, expect, it } from "vitest";
import { hasValidImageSignature } from "./image-upload";

describe("sourcing image signature validation", () => {
  it("accepts JPEG, PNG and WebP signatures", () => {
    expect(hasValidImageSignature("image/jpeg", new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe(true);
    expect(hasValidImageSignature("image/png", new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(true);
    expect(hasValidImageSignature("image/webp", new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]))).toBe(true);
  });

  it("rejects spoofed content and unsupported MIME types", () => {
    const text = new TextEncoder().encode("this is not an image");
    expect(hasValidImageSignature("image/jpeg", text)).toBe(false);
    expect(hasValidImageSignature("image/png", text)).toBe(false);
    expect(hasValidImageSignature("image/webp", text)).toBe(false);
    expect(hasValidImageSignature("image/gif", new Uint8Array([0x47, 0x49, 0x46]))).toBe(false);
  });
});
