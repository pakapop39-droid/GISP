import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { createClient, createAdminClient } from "@insforge/sdk";
import { getUatPassword, UAT_MEMBER_EMAIL } from "../uat-password.mjs";
if (process.env.INSFORGE_URL !== "https://kit6y4pj.ap-southeast.insforge.app") throw Error("Development only");
const config = { baseUrl: process.env.INSFORGE_URL, anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY };
const anonymous = createClient(config);
const member = createClient(config);
const admin = createAdminClient({ baseUrl: config.baseUrl, apiKey: process.env.INSFORGE_API_KEY });
const login = await member.auth.signInWithPassword({ email: UAT_MEMBER_EMAIL, password: getUatPassword() });
assert(!login.error, "member login");
for (const client of [anonymous, member]) {
  for (const table of ["product_image_embeddings", "image_search_jobs", "image_search_budget", "image_search_daily_usage"]) {
    assert((await client.database.from(table).select("*").limit(1)).error, `denied ${table}`);
  }
  assert((await client.database.rpc("reserve_image_search_request", { user_input: null })).error, "quota RPC denied");
  assert((await client.database.rpc("claim_image_search_jobs", { limit_input: 1 })).error, "worker RPC denied");
}
const dataset = JSON.parse(await fs.readFile("output/image-search-spike/dataset.json", "utf8"));
const cache = JSON.parse(await fs.readFile("output/image-search-spike/voyage-multimodal-3.5/embeddings.json", "utf8"));
const source = dataset.gallery[0];
const input = { query_input: JSON.stringify(cache.vectors[source.image.normalizedSha256]), model_input: cache.identity, category_input: null };
assert((await anonymous.database.rpc("match_product_images", input)).error, "anonymous match denied");
const ranked = await member.database.rpc("match_product_images", input);
if (ranked.error) throw ranked.error;
assert((await member.database.rpc("match_product_images", { ...input, query_input: null })).error, "null vector denied");
assert(ranked.data.length === 12 && ranked.data.some(r => r.product_id === source.id), "member SQL search");
assert(ranked.data.every(r => Object.keys(r).every(k => ["product_id", "media_id", "similarity"].includes(k))), "bounded member projection");
const visible = await member.database.from("member_catalog").select("id").in("id", ranked.data.map(r => r.product_id));
assert(!visible.error && ranked.data.every(r => visible.data.some(v => v.id === r.product_id)), "all ranked IDs are currently visible to member");
const ready = await admin.database.from("image_search_jobs").select("product_id", { count: "exact", head: true }).eq("state", "READY");
assert(!ready.error && ready.count >= 634, "seed retained after rollback tests");
console.log(JSON.stringify({ result: "PASS", ready: ready.count, matchCount: ranked.data.length, access: "anon/member raw data and admin RPC denied; approved member ranking works" }));
