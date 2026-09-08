import assert from "node:assert/strict";
import { getUatPassword, UAT_ADMIN_EMAIL, UAT_MEMBER_EMAIL } from "./uat-password.mjs";

const site = (process.env.RELEASE_B_REHEARSAL_URL ?? "").replace(/\/$/, "");

if (!site.match(/^https:\/\/gisp-release-b-rehearsal(?:-[a-z0-9-]+)?\.vercel\.app$/)) {
  throw new Error("RELEASE_B_REHEARSAL_URL must point to the isolated Release B rehearsal site");
}

const password = getUatPassword();
const results = [];

function pass(condition, label) {
  assert.ok(condition, label);
  results.push(`PASS: ${label}`);
}

async function request(path, cookie) {
  return fetch(`${site}${path}`, {
    cache: "no-store",
    redirect: "manual",
    headers: cookie ? { Cookie: cookie } : undefined,
  });
}

async function login(email) {
  const response = await fetch(`${site}/api/auth/sign-in`, {
    method: "POST",
    redirect: "manual",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(response.status, 200, "UAT login must succeed");
  return response.headers.getSetCookie().map((item) => item.split(";", 1)[0]).join("; ");
}

const health = await request("/api/health");
const healthBody = await health.json();
pass(health.status === 200 && healthBody.insforge?.configured === true, "rehearsal health is configured");

const anonymousPage = await request("/admin/members");
const anonymousPageText = anonymousPage.status === 200 ? await anonymousPage.text() : "";
pass(
  ([307, 308].includes(anonymousPage.status) && anonymousPage.headers.get("location")?.includes("/login")) ||
    (anonymousPage.status === 200 && anonymousPageText.includes("เข้าสู่ระบบ")),
  "anonymous member review page resolves to login",
);
pass((await request("/api/admin/members")).status === 401, "anonymous member review API is blocked");
pass((await request("/register")).status === 200, "Release B registration page is open in rehearsal");

const adminCookie = await login(UAT_ADMIN_EMAIL);
const adminMembersPage = await request("/admin/members", adminCookie);
pass(adminMembersPage.status === 200 && (await adminMembersPage.text()).includes("อนุมัติและดูแลบัญชีสมาชิก"), "admin member review page renders");
const adminMembersApi = await request("/api/admin/members", adminCookie);
const adminMembersBody = await adminMembersApi.json();
pass(adminMembersApi.status === 200 && Array.isArray(adminMembersBody.data), "admin member review API returns a queue");
pass((await request("/admin/sourcing-requests", adminCookie)).status === 200, "admin sourcing page renders");
pass((await request("/api/admin/sourcing-requests", adminCookie)).status === 200, "admin sourcing API is enabled");

const memberCookie = await login(UAT_MEMBER_EMAIL);
pass((await request("/member/catalog", memberCookie)).status === 200, "member catalog renders");
pass((await request("/member/shared-catalogs", memberCookie)).status === 200, "member shared catalog page renders");
pass((await request("/api/member/shared-catalogs", memberCookie)).status === 200, "member shared catalog API is enabled");
pass((await request("/member/sourcing-requests", memberCookie)).status === 200, "member sourcing page renders");
pass((await request("/api/member/sourcing-requests", memberCookie)).status === 200, "member sourcing API is enabled");
pass((await request("/api/admin/members", memberCookie)).status === 403, "member cannot read the admin member queue");
pass((await request("/api/admin/sourcing-requests", memberCookie)).status === 403, "member cannot read the admin sourcing queue");
pass((await request("/api/public/catalogs/not-a-valid-token")).status === 404, "invalid public catalog token is rejected");

for (const result of results) console.log(result);
console.log(`Release B hosted smoke passed: ${results.length} assertions`);
