import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { imageSearchIdentity, imageSearchModel, normalizeImageVector, type IndexedProductImage } from "./image-search-core";

export function imageSearchPreviewEnabled() {
  return imageSearchDatabaseEnabled() || (process.env.NODE_ENV === "development" && process.env.ENABLE_LOCAL_IMAGE_SEARCH === "true"
    && process.env.INSFORGE_URL === "https://kit6y4pj.ap-southeast.insforge.app");
}

export function imageSearchDatabaseEnabled() {
  return process.env.ENABLE_IMAGE_SEARCH === "true" && process.env.INSFORGE_URL === "https://kit6y4pj.ap-southeast.insforge.app";
}

export async function loadImageSearchGallery(): Promise<IndexedProductImage[]> {
  const root = path.join(process.cwd(), "output", "image-search-spike");
  const [dataset, cache] = await Promise.all([
    readFile(path.join(root, "dataset.json"), "utf8").then(JSON.parse),
    readFile(path.join(root, "voyage-multimodal-3.5", "embeddings.json"), "utf8").then(JSON.parse),
  ]);
  if (cache.identity !== imageSearchIdentity) throw new Error("Image index model mismatch");
  return dataset.gallery.map((item: { id: string; image: { mediaId: string; fileId: string; normalizedSha256: string } }) => ({
    productId: item.id, mediaId: item.image.mediaId, fileId: item.image.fileId,
    vector: normalizeImageVector(cache.vectors[item.image.normalizedSha256]),
  }));
}

export async function embedSearchImage(bytes: Buffer) {
  if (!process.env.OPENROUTER_API_KEY) throw new Error("Image search key missing");
  // Do not automatically retry a chargeable request. Query images stay in memory.
  const response = await fetch("https://openrouter.ai/api/v1/embeddings", {
    method: "POST", cache: "no-store", signal: AbortSignal.timeout(45000),
    headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: imageSearchModel, dimensions: 1024, encoding_format: "float",
      provider: { only: ["voyageai"], allow_fallbacks: false, data_collection: "deny" },
      input: [{ content: [{ type: "image_url", image_url: { url: `data:image/jpeg;base64,${bytes.toString("base64")}` } }] }],
    }),
  });
  if (!response.ok) throw new Error("Image search provider unavailable");
  const body = await response.json();
  if (body.error || body.data?.length !== 1 || body.data[0].index !== 0) throw new Error("Invalid image search response");
  return normalizeImageVector(body.data[0].embedding);
}

export async function verifyImageSearchModel() {
  const response = await fetch("https://openrouter.ai/api/v1/embeddings/models", { cache: "no-store", signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error("Cannot verify image model");
  const body = await response.json();
  const model = body.data?.find((m: { id: string }) => m.id === imageSearchModel);
  if (model?.canonical_slug !== imageSearchIdentity.split(":")[0] || !model.architecture?.input_modalities?.includes("image")) {
    throw new Error("Image model revision changed; rebuild index before searching");
  }
}
