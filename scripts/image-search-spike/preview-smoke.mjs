// Local development only. --paid authorizes one embedding request; no retries.
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { getUatPassword, UAT_MEMBER_EMAIL, UAT_ADMIN_EMAIL } from "../uat-password.mjs";

const base = process.env.IMAGE_SEARCH_TEST_URL ?? "http://127.0.0.1:3108";
if (!["http://127.0.0.1:3108", "https://gisp-image-search-development.vercel.app"].includes(base)) throw Error("Unexpected test host");
const endpoint = `${base}/api/member/catalog/image-search`;
const root = path.resolve("output/image-search-spike");
const checks = [];
function check(condition, label) { assert(condition, label); checks.push(label); console.log(`PASS ${label}`); }
const anonymous = await fetch(endpoint, { method: "POST" });
check(anonymous.status === 401, "anonymous denied before processing");
const password = getUatPassword();
async function login(email) {
  const response = await fetch(`${base}/api/auth/sign-in`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
  check(response.ok, email === UAT_MEMBER_EMAIL ? "member login" : "staff login");
  const cookies = response.headers.getSetCookie().filter(c => !c.includes("Max-Age=0")).map(c => {
    const pair = c.split(";", 1)[0]; const separator = pair.indexOf("=");
    return { name: pair.slice(0, separator), value: pair.slice(separator + 1), domain: new URL(base).hostname, path: "/", expires: -1, httpOnly: true, secure: base.startsWith("https:"), sameSite: "Lax" };
  });
  return { cookies, header: cookies.map(c => `${c.name}=${c.value}`).join("; ") };
}
const staff = await login(UAT_ADMIN_EMAIL);
check((await fetch(endpoint, { method: "POST", headers: { Cookie: staff.header } })).status === 403, "non-member staff denied");
const member = await login(UAT_MEMBER_EMAIL);
await fs.writeFile(path.join(root, "preview-auth.json"), JSON.stringify({ cookies: member.cookies, origins: [] }));
check((await fetch(`${base}/api/internal/image-search/process`, { method: "POST" })).status === 401, "worker rejects missing secret");
check((await fetch(`${base}/member/catalog/image-search`, { headers: { Cookie: member.header } })).ok, "member image search page");
check((await fetch(endpoint, { method: "POST", headers: { Cookie: member.header, Origin: "https://unrelated.example" } })).status === 403, "cross-origin submission denied");
const invalid = new FormData(); invalid.set("image", new Blob([Buffer.from([255, 216, 255, 0])], { type: "image/jpeg" }), "fake.jpg");
check((await fetch(endpoint, { method: "POST", headers: { Cookie: member.header }, body: invalid })).status === 400, "corrupt image rejected");
check((await fetch(endpoint, { method: "POST", headers: { Cookie: member.header, "Content-Type": "application/octet-stream" }, body: Buffer.alloc(10 * 1024 * 1024 + 65537) })).status === 413, "oversized body rejected");
if (process.argv.includes("--paid")) {
  const dataset = JSON.parse(await fs.readFile(path.join(root, "dataset.json"), "utf8"));
  const source = dataset.gallery[0];
  const form = new FormData(); form.set("image", new Blob([await fs.readFile(path.join(root, source.image.relative))], { type: "image/jpeg" }), "catalog-test.jpg");
  const started = performance.now();
  const response = await fetch(endpoint, { method: "POST", headers: { Cookie: member.header, Origin: base }, body: form });
  const body = await response.json();
  check(response.ok, `real embedding search HTTP ${response.status}${response.ok ? "" : `: ${body.message}`}`);
  const items = body.data.items;
  check(items.length > 0 && items.length <= 12, "bounded real product results");
  check(new Set(items.map(i => i.id)).size === items.length, "unique products");
  check(items.some(i => i.id === source.id), "source product retrieved");
  const encoded = JSON.stringify(body);
  check(!/factoryCost|supplierId|factory_cost|supplier_id|object_key|embedding|"vector"|OPENROUTER_API_KEY/.test(encoded), "member response excludes internal data");
  check(response.headers.get("cache-control") === "no-store", "private response not cached");
  const detail = await fetch(`${base}/api/member/catalog/${items[0].id}`, { headers: { Cookie: member.header } });
  check(detail.ok, "result opens eligible product detail");
  check(items.some(i => i.imageUrl), "result image URLs signed");
  await fs.writeFile(path.join(root, base.startsWith("https:") ? "hosted-smoke.json" : "preview-smoke.json"), JSON.stringify({ at: new Date().toISOString(), base, checks, resultCount: items.length, expectedProductFound: true, elapsedMs: performance.now() - started, scope: "Development only; one catalog-image query, not quantitative real-photo UAT" }, null, 2));
}
