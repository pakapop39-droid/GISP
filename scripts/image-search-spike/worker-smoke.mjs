import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { createAdminClient } from "@insforge/sdk";
if (process.env.INSFORGE_URL !== "https://kit6y4pj.ap-southeast.insforge.app" || !process.env.IMAGE_SEARCH_CRON_SECRET) throw Error("Development environment required");
const admin = createAdminClient({ baseUrl: process.env.INSFORGE_URL, apiKey: process.env.INSFORGE_API_KEY });
const dataset = JSON.parse(await fs.readFile("output/image-search-spike/dataset.json", "utf8"));
const productId = dataset.gallery[0].id;
const before = await admin.database.from("image_search_jobs").select("revision,state").eq("product_id", productId).single();
assert(!before.error && before.data.state === "READY");
const queued = await admin.database.rpc("queue_product_image_search", { product_input: productId, force_input: true });
if (queued.error) throw queued.error;
const response = await fetch("https://gisp-image-search-development.vercel.app/api/internal/image-search/process", {
  method: "POST", headers: { Authorization: `Bearer ${process.env.IMAGE_SEARCH_CRON_SECRET}` }, signal: AbortSignal.timeout(240000),
});
assert(response.ok, `worker HTTP ${response.status}`);
const body = await response.json();
const after = await admin.database.from("image_search_jobs").select("revision,state,error_code").eq("product_id", productId).single();
assert(!after.error && after.data.state === "READY" && after.data.revision > before.data.revision, `worker state ${after.data?.state} ${after.data?.error_code}`);
await fs.writeFile("output/image-search-spike/worker-smoke.json", JSON.stringify({ at: new Date().toISOString(), before: before.data, after: after.data, counts: body.data }, null, 2));
console.log(JSON.stringify({ result: "PASS", ...body.data, revision: after.data.revision }));
