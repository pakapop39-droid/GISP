import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { normalizeImageVector, prepareSearchImage, rankProductImages } from "./image-search-core";

describe("image search inputs and ranking", () => {
  it("rejects forged headers, mismatched types, corrupt images and excessive pixel counts", async () => {
    await expect(prepareSearchImage(Buffer.from([255, 216, 255, 0]), "image/jpeg")).rejects.toThrow();
    const png = await sharp({ create: { width: 4, height: 4, channels: 3, background: "red" } }).png().toBuffer();
    await expect(prepareSearchImage(png, "image/jpeg")).rejects.toThrow();
    const bomb = await sharp({ create: { width: 6500, height: 6500, channels: 3, background: "white" } }).png().toBuffer();
    await expect(prepareSearchImage(bomb, "image/png")).rejects.toThrow();
  });
  it("normalizes orientation and bounds output dimensions without metadata", async () => {
    const input = await sharp({ create: { width: 1200, height: 800, channels: 3, background: "red" } }).withMetadata({ orientation: 6 }).jpeg().toBuffer();
    const result = await sharp(await prepareSearchImage(input, "image/jpeg")).metadata();
    expect(result.width).toBe(512); expect(result.height).toBe(768);
    expect(result.exif).toBeUndefined(); expect(result.orientation).toBeUndefined();
  });
  it("rejects nonfinite, zero and wrong-dimensional vectors", () => {
    for (const value of [[], Array(1024).fill(0), Array(1024).fill(NaN), Array(1024).fill(Infinity), Array(1024).fill("1")]) {
      expect(() => normalizeImageVector(value)).toThrow();
    }
  });
  it("orders nearest vectors first and breaks ties deterministically", () => {
    const query = normalizeImageVector([1, ...Array(1023).fill(0)]);
    const gallery = ["b", "a", "c"].map(productId => ({ productId, mediaId: productId, fileId: productId, vector: productId === "c" ? query.map(v => -v) : query }));
    expect(rankProductImages(query, gallery).map(p => p.productId)).toEqual(["a", "b", "c"]);
  });
});
