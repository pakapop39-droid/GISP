// Five simultaneous requests from one existing test account; at most five calls.
import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { createAdminClient } from "@insforge/sdk";
if (process.env.INSFORGE_URL !== "https://kit6y4pj.ap-southeast.insforge.app") throw Error("Development only");
const base = "https://gisp-image-search-development.vercel.app";
const auth = JSON.parse(await fs.readFile("output/image-search-spike/preview-auth.json", "utf8"));
const cookie = auth.cookies.filter(c => c.domain === new URL(base).hostname).map(c => `${c.name}=${c.value}`).join("; ");
assert(cookie, "hosted member state required");
const admin = createAdminClient({ baseUrl: process.env.INSFORGE_URL, apiKey: process.env.INSFORGE_API_KEY });
const before = await admin.database.from("image_search_budget").select("used_requests").single();
assert(!before.error);
const image = await fs.readFile("output/image-search-spike/images/3c5ebb79-43b3-53b6-98e9-054bcc03c3c9.jpg");
const requests = await Promise.all(Array.from({ length: 5 }, async () => {
  const body = new FormData(); body.set("image", new Blob([image], { type: "image/jpeg" }), "test.jpg");
  const started = performance.now();
  const response = await fetch(`${base}/api/member/catalog/image-search`, { method: "POST", headers: { Cookie: cookie, Origin: base }, body });
  await response.arrayBuffer();
  return { status: response.status, elapsedMs: performance.now() - started };
}));
const after = await admin.database.from("image_search_budget").select("used_requests").single();
assert(!after.error);
assert(requests.every(r => [200, 429].includes(r.status)), "no server errors in burst");
assert(requests.some(r => r.status === 429) && requests.some(r => r.status === 200), "burst throttled while legitimate search succeeds");
const successes = requests.filter(r => r.status === 200).length;
assert(after.data.used_requests - before.data.used_requests === successes, "atomic quota matches accepted calls; denied requests do not consume quota");
const result = { at: new Date().toISOString(), scope: "single-account concurrent burst, not five-user load benchmark", requests, reservations: successes };
await fs.writeFile("output/image-search-spike/hosted-quota-smoke.json", JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
