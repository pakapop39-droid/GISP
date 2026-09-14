import "server-only";
import { createHash } from "node:crypto";
import { createInsForgeAdminClient } from "@/lib/insforge/admin";
import { imageSearchIdentity, imageSearchMaxBytes, normalizeImageVector, prepareSearchImage } from "./image-search-core";
import { embedSearchImage, verifyImageSearchModel } from "./image-search-server";

type Job = { product_id: string; media_id: string; file_id: string; revision: number; lease_id: string };

export async function runImageSearchWorker() {
  await verifyImageSearchModel();
  const admin = createInsForgeAdminClient();
  const claimed = await admin.database.rpc("claim_image_search_jobs", { limit_input: 4 });
  if (claimed.error) throw claimed.error;
  const jobs = (claimed.data ?? []) as Job[];
  const counts = { claimed: jobs.length, indexed: 0, reused: 0, stale: 0, failed: 0 };
  async function processJob(job: Job) {
    try {
      const file = await admin.database.from("file_metadata").select("bucket,object_key,mime_type,size_bytes").eq("id", job.file_id).single();
      if (file.error || !file.data || file.data.size_bytes > imageSearchMaxBytes) throw new Error("INVALID_FILE");
      const downloaded = await admin.storage.from(file.data.bucket).download(file.data.object_key);
      if (downloaded.error || !downloaded.data) throw new Error("DOWNLOAD_FAILED");
      if (downloaded.data.size > imageSearchMaxBytes) throw new Error("INVALID_FILE");
      const bytes = await prepareSearchImage(Buffer.from(await downloaded.data.arrayBuffer()), file.data.mime_type);
      const hash = createHash("sha256").update(bytes).digest("hex");
      const previous = await admin.database.from("product_image_embeddings").select("embedding").eq("content_hash", hash).eq("model_identity", imageSearchIdentity).limit(1);
      if (previous.error) throw previous.error;
      let vector: number[];
      if (previous.data?.length) {
        const value = previous.data[0].embedding;
        vector = normalizeImageVector(typeof value === "string" ? JSON.parse(value) : value);
        counts.reused++;
      } else {
        const reserved = await admin.database.rpc("reserve_image_search_request", { user_input: null });
        if (reserved.error) throw new Error(reserved.error.message.includes("IMAGE_SEARCH_QUOTA") ? "IMAGE_SEARCH_QUOTA" : "QUOTA_UNAVAILABLE");
        vector = await embedSearchImage(bytes);
      }
      const result = await admin.database.rpc("finish_image_search_job", { product_input: job.product_id, lease_input: job.lease_id,
        revision_input: job.revision, model_input: imageSearchIdentity, hash_input: hash, embedding_input: JSON.stringify(vector) });
      if (result.error) throw result.error;
      if (result.data) counts.indexed++; else counts.stale++;
    } catch (error) {
      const code = error instanceof Error && ["INVALID_FILE", "DOWNLOAD_FAILED", "IMAGE_SEARCH_QUOTA", "QUOTA_UNAVAILABLE"].includes(error.message) ? error.message : "INDEX_FAILED";
      const failed = await admin.database.rpc("fail_image_search_job", { product_input: job.product_id, lease_input: job.lease_id, code_input: code });
      if (failed.error) throw new Error("Cannot release image job lease");
      counts.failed++;
    }
  }
  for (let start = 0; start < jobs.length; start += 2) await Promise.all(jobs.slice(start, start + 2).map(processJob));
  return counts;
}
