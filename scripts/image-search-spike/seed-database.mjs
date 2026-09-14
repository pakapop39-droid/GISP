// Reuse the approved experiment's cached vectors. No model calls or quota reset.
import fs from "node:fs/promises";
import { createAdminClient } from "@insforge/sdk";
const identity = "voyageai/voyage-multimodal-3.5-20260727:float1024:normalized-768-jpeg88-v1:input-type-none";
if (process.env.INSFORGE_URL !== "https://kit6y4pj.ap-southeast.insforge.app") throw Error("Development only");
const admin = createAdminClient({ baseUrl: process.env.INSFORGE_URL, apiKey: process.env.INSFORGE_API_KEY });
const dataset = JSON.parse(await fs.readFile("output/image-search-spike/dataset.json", "utf8"));
const cache = JSON.parse(await fs.readFile("output/image-search-spike/voyage-multimodal-3.5/embeddings.json", "utf8"));
if (cache.identity !== identity) throw Error("Model mismatch");
const gallery = new Map(dataset.gallery.map(p => [p.id, p]));
let saved = 0, cached = 0, unavailable = 0;
while (true) {
  const batch = await admin.database.rpc("claim_image_search_jobs", { limit_input: 8 });
  if (batch.error) throw batch.error;
  if (!batch.data?.length) break;
  for (const job of batch.data) {
    const item = gallery.get(job.product_id);
    const vector = item && item.image.mediaId === job.media_id && item.image.fileId === job.file_id ? cache.vectors[item.image.normalizedSha256] : null;
    if (!vector || vector.length !== 1024 || !vector.every(Number.isFinite)) {
      await admin.database.rpc("fail_image_search_job", { product_input: job.product_id, lease_input: job.lease_id, code_input: "NO_CACHED_VECTOR" });
      unavailable++; continue;
    }
    const result = await admin.database.rpc("finish_image_search_job", { product_input: job.product_id, lease_input: job.lease_id,
      revision_input: job.revision, model_input: identity, hash_input: item.image.normalizedSha256, embedding_input: JSON.stringify(vector) });
    if (result.error) throw result.error;
    if (result.data) saved++;
    cached++;
  }
  if (saved % 80 === 0) console.log(`Seeded ${saved}`);
}
console.log(JSON.stringify({ saved, cached, unavailable, modelCalls: 0 }));
