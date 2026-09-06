import { createAdminClient } from "@insforge/sdk";
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import assert from "node:assert/strict";
import { getUatPassword, UAT_ADMIN_EMAIL } from "./uat-password.mjs";

const site = process.env.PENDING_SMOKE_URL ?? "http://localhost:3117";
if (process.env.INSFORGE_URL !== "https://kit6y4pj.ap-southeast.insforge.app" || !["http://localhost:3117", "https://kit6y4pj.insforge.site", "https://gisp-mvp-development.insforge.site"].includes(site)) throw new Error("Development-only smoke test");
const admin = createAdminClient({ baseUrl: process.env.INSFORGE_URL, apiKey: process.env.INSFORGE_API_KEY });
const must = (result) => { if (result.error) throw new Error(result.error.message); return result.data; };
const check = (value, label) => { assert.ok(value, label); console.log(`PASS: ${label}`); };
mkdirSync("tmp/pending-dashboard", { recursive: true });
const fixturePath = "tmp/pending-dashboard/fixture.json";
async function login(user) {
  const res = await fetch(`${site}/api/auth/sign-in`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: user.email, password: user.password }) });
  assert.equal(res.status, 200, `login ${user.email}`);
  const cookies = res.headers.getSetCookie().map(item => item.split(";", 1)[0]);
  return cookies.join("; ");
}
async function request(path, cookie, body, method) {
  return fetch(`${site}${path}`, { redirect: "manual", method: method ?? (body ? "POST" : "GET"), headers: { Cookie: cookie, ...(body && !(body instanceof FormData) ? { "Content-Type": "application/json" } : {}) }, body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined });
}
function saveState(cookie) {
  const cookies = cookie.split("; ").map(pair => { const index = pair.indexOf("="); return { name: pair.slice(0, index), value: pair.slice(index + 1), domain: new URL(site).hostname, path: "/", expires: -1, httpOnly: true, secure: site.startsWith("https"), sameSite: "Lax" }; });
  writeFileSync("tmp/pending-dashboard/browser-state.json", JSON.stringify({ cookies, origins: [] }));
}
async function createMember(label) {
  const email = `pending-dashboard-${label}-${Date.now()}@example.com`;
  const password = `Test!${randomBytes(18).toString("hex")}`;
  const creator = createAdminClient({ baseUrl: process.env.INSFORGE_URL, apiKey: process.env.INSFORGE_API_KEY });
  const result = must(await creator.auth.signUp({ email, password, name: `Dashboard test ${label}`, autoConfirm: true }));
  const id = result.user?.id ?? must(await admin.database.rpc("operator_find_auth_user_id", { email_input: email }));
  const user = { id, email, password };
  const cookie = await login(user);
  const response = await request("/api/member/onboarding", cookie, { contact_name: "ผู้สมัครทดสอบ", contact_phone: "0800000000", company_name: `บริษัททดสอบ Dashboard ${label}`, business_type: "INTERIOR_DESIGN", consents: { terms: true, privacy: true } });
  assert.equal(response.status, 201, "submit onboarding");
  Object.assign(user, (await response.json()).data);
  return user;
}

const phase = process.argv[2] ?? "verify";
if (phase === "setup") {
  const a = await createMember("A"); const b = await createMember("B");
  writeFileSync(fixturePath, JSON.stringify({ a, b }));
  saveState(await login(a));
  console.log("PASS: two new Development applicants submitted; browser state saved locally");
} else {
  const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));
  if (phase === "suspend") {
    const ownerCookie = await login({ email: UAT_ADMIN_EMAIL, password: getUatPassword() });
    const priorCookie = await login(fixture.a);
    check((await request(`/api/admin/members/${fixture.a.id}/action`, ownerCookie, { action: "suspend", reason: "Dashboard smoke test suspension" })).status === 200, "admin suspends test member");
    check((await request("/api/auth/session", priorCookie)).status === 401, "suspension revokes existing session");
    const suspendedCookie = await login(fixture.a);
    check((await (await request("/api/auth/session", suspendedCookie)).json()).next === "/account-suspended", "suspended account goes to existing status page");
    check((await request(`/api/admin/members/${fixture.a.id}/action`, ownerCookie, { action: "reactivate" })).status === 200, "admin reactivates test member");
    process.exit(0);
  }
  if (phase === "lifecycle") {
    const ownerCookie = await login({ email: UAT_ADMIN_EMAIL, password: getUatPassword() });
    check((await request("/admin/dashboard", ownerCookie)).status === 200, "existing admin dashboard works");
    check((await request(`/api/admin/members/${fixture.b.applicationId}/action`, ownerCookie, { action: "reject", reason: "Dashboard smoke test rejection" })).status === 200, "admin rejects test applicant");
    const rejectedCookie = await login(fixture.b);
    check((await (await request("/api/auth/session", rejectedCookie)).json()).next === "/application-rejected", "rejected applicant goes to existing rejection page");
    check((await request(`/api/admin/members/${fixture.a.applicationId}/action`, ownerCookie, { action: "approve", note: "Dashboard smoke test approval" })).status === 200, "admin approves test applicant");
    const approvedCookie = await login(fixture.a);
    check((await (await request("/api/auth/session", approvedCookie)).json()).next === "/member/dashboard", "approved applicant goes to full dashboard");
    check((await request("/member/dashboard", approvedCookie)).status === 200, "approved dashboard works");
    saveState(approvedCookie);
    process.exit(0);
  }
  const cookie = await login(phase === "state-b" ? fixture.b : fixture.a);
  saveState(cookie);
  if (phase === "state" || phase === "state-b") { console.log("PASS: browser session refreshed"); process.exit(0); }
  const session = await (await request("/api/auth/session", cookie)).json();
  check(session.next === "/pending-approval", "pending destination after login");
  const page = await request("/pending-approval", cookie);
  check(page.status === 200 && (await page.text()).includes("ส่งคำขอสำเร็จแล้ว"), "pending dashboard server render");
  const profile = await (await request("/api/member/profile", cookie)).json();
  check(profile.data.id === fixture.a.memberProfileId, "profile belongs to current applicant");
  for (const path of ["/api/member/catalog", "/api/member/projects", "/api/member/orders", "/api/member/reports"]) {
    const res = await request(path, cookie); check(res.status === 403, `pending API blocked: ${path}`);
  }
  check((await request(`/api/files?memberProfileId=${fixture.b.memberProfileId}`, cookie)).status === 403, "other member file listing blocked");
  check((await request("/api/member/profile", cookie, { contact_name: "Changed", company_name: "Changed", business_type: "INTERIOR_DESIGN" }, "PATCH")).status === 403, "pending profile edits remain blocked");
  async function upload(type, size = 32, extra = {}) {
    const form = new FormData(); form.set("file", new Blob([new Uint8Array(size)], { type }), "test.pdf");
    for (const [key, value] of Object.entries(extra)) form.set(key, value);
    return request("/api/files", cookie, form);
  }
  check((await upload("text/plain")).status === 400, "invalid file type blocked");
  const oversized = await upload("application/pdf", 10 * 1024 * 1024 + 1);
  check(oversized.status >= 400, `oversize direct request rejected (HTTP ${oversized.status}; proxy limit applies)`);
  check((await upload("application/pdf", 32, { memberProfileId: fixture.b.memberProfileId })).status === 403, "other member upload blocked");
  const files = (await (await request("/api/files", cookie)).json()).data;
  for (let i = files.length; i < 5; i++) check((await upload("application/pdf")).status === 201, `file upload ${i + 1}`);
  check((await upload("application/pdf")).status === 409, "sixth file blocked");
  const listed = (await (await request("/api/files", cookie)).json()).data;
  check(listed.length === 5, "uploaded files remain listed");
  check((await request(`/api/files/${listed[0].id}/download`, cookie)).status === 200, "own signed download allowed");
  const cookieB = await login(fixture.b);
  check([403, 404].includes((await request(`/api/files/${listed[0].id}/download`, cookieB)).status), "other member download blocked");
  check((await request("/api/auth/sign-out", cookieB, {})).status === 200, "logout succeeds");
  check((await request("/api/auth/session", cookieB)).status === 401, "logged out session revoked");
  console.log("Pending dashboard smoke complete");
}
