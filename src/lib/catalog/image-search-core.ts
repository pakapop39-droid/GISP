import { hasValidImageSignature } from "../files/image-upload";

export const imageSearchModel = "voyageai/voyage-multimodal-3.5";
export const imageSearchIdentity = "voyageai/voyage-multimodal-3.5-20260727:float1024:normalized-768-jpeg88-v1:input-type-none";
export const imageSearchMaxBytes = 10 * 1024 * 1024;

export function normalizeImageVector(value: unknown): number[] {
  if (!Array.isArray(value) || value.length !== 1024 || !value.every(v => typeof v === "number" && Number.isFinite(v))) {
    throw new Error("Invalid image vector");
  }
  const norm = Math.hypot(...value);
  if (!Number.isFinite(norm) || norm <= 0) throw new Error("Invalid image vector norm");
  return value.map(v => v / norm);
}

export async function prepareSearchImage(bytes: Buffer, mimeType: string) {
  if (!bytes.length || bytes.length > imageSearchMaxBytes || !hasValidImageSignature(mimeType, bytes)) {
    throw new Error("Invalid image");
  }
  const { default: sharp } = await import("sharp");
  const pipeline = sharp(bytes, { limitInputPixels: 40_000_000, failOn: "warning" });
  const metadata = await pipeline.metadata();
  const expected = { "image/jpeg": "jpeg", "image/png": "png", "image/webp": "webp" }[mimeType];
  if (metadata.format !== expected || (metadata.pages ?? 1) !== 1) throw new Error("Invalid image format");
  return pipeline.rotate().resize(768, 768, { fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" }).jpeg({ quality: 88 }).toBuffer();
}

export type IndexedProductImage = { productId: string; mediaId: string; fileId: string; vector: number[] };

export function rankProductImages(query: number[], gallery: IndexedProductImage[]) {
  return gallery.map(item => ({ ...item, score: item.vector.reduce((sum, v, i) => sum + v * query[i], 0) }))
    .sort((a, b) => b.score - a.score || a.productId.localeCompare(b.productId));
}
