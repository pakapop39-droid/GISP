import assert from "node:assert/strict";
import { COMPANIES, FIXTURE_VERSION, FORBIDDEN_MEMBER_FIELDS } from "./fixtures.mjs";
import { loadDevelopmentTarget } from "./target-guard.mjs";
import { VERIFY_REPORT_PATH, readManifest, writeJson } from "./io.mjs";

// This guard deliberately runs before the SDK module is loaded or any client exists.
const target = loadDevelopmentTarget();
const { createAdminClient, createClient } = await import("@insforge/sdk");
const { getUatPassword, UAT_ADMIN_EMAIL } = await import("../uat-password.mjs");
const manifest = readManifest();
assert.equal(manifest.fixtureVersion, FIXTURE_VERSION);
assert.equal(manifest.environment.projectId, target.projectId);
assert.equal(manifest.companies.length, 5);

const password = getUatPassword();
const admin = createAdminClient({ baseUrl: target.host, apiKey: process.env.INSFORGE_API_KEY });
const assertions = [];
const pass = (id, detail) => assertions.push({ id, result: "PASS", detail });
const must = (result, label) => {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
};

const clients = [];
for (const fixture of manifest.companies) {
  const client = createClient({ baseUrl: target.host, anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY });
  must(await client.auth.signInWithPassword({ email: fixture.email, password }), `login ${fixture.key}`);
  clients.push({ fixture, client });
  const profile = must(await client.database.from("member_profiles").select("id,organization_id,company_name").eq("id", fixture.memberProfileId).single(), `own profile ${fixture.key}`);
  assert.equal(profile.organization_id, fixture.organizationId);
  const project = must(await client.database.from("projects").select("id,organization_id").eq("id", fixture.projectId).single(), `own project ${fixture.key}`);
  assert.equal(project.organization_id, fixture.organizationId);
  const catalog = must(await client.database.from("shared_catalogs").select("id,organization_id").eq("id", fixture.sharedCatalogId).single(), `own shared catalog ${fixture.key}`);
  assert.equal(catalog.organization_id, fixture.organizationId);
  const canAccessSourcing = must(await client.database.rpc("can_access_sourcing_request", { request_id_input: fixture.sourcingRequestId }), `own sourcing access ${fixture.key}`);
  assert.equal(canAccessSourcing, true);
  const file = must(await client.database.from("file_metadata").select("id,organization_id,visibility").eq("id", fixture.privateFileMetadataId).single(), `own private metadata ${fixture.key}`);
  assert.equal(file.visibility, "MEMBER_PRIVATE");
  pass(`OWN-${fixture.key}`, "member sees its own profile, project, shared catalog, sourcing request and private metadata");
}

for (let index = 0; index < clients.length; index += 1) {
  const { fixture, client } = clients[index];
  const other = clients[(index + 1) % clients.length].fixture;
  for (const [resource, table, id] of [
    ["profile", "member_profiles", other.memberProfileId],
    ["project", "projects", other.projectId],
    ["private-file", "file_metadata", other.privateFileMetadataId],
    ["shared-catalog", "shared_catalogs", other.sharedCatalogId],
  ]) {
    const rows = must(await client.database.from(table).select("id").eq("id", id).limit(1), `${fixture.key} cross-tenant ${resource}`);
    assert.equal(rows.length, 0, `${fixture.key} must not see ${other.key} ${resource}`);
    pass(`RLS-${fixture.key}-${resource}`, `${fixture.key} cannot read ${other.key} ${resource}`);
  }
  const canAccessOtherSourcing = must(await client.database.rpc("can_access_sourcing_request", { request_id_input: other.sourcingRequestId }), `${fixture.key} cross-tenant sourcing`);
  assert.equal(canAccessOtherSourcing, false, `${fixture.key} must not access ${other.key} sourcing`);
  pass(`RLS-${fixture.key}-sourcing`, `${fixture.key} cannot access ${other.key} sourcing through the member-safe authorization RPC`);
}

const catalogRows = must(await clients[0].client.database.from("member_catalog").select("*").limit(3), "read member-safe catalog");
assert.ok(catalogRows.length > 0, "Development must have at least one published catalog product for member-safe verification");
for (const row of catalogRows) {
  const keys = Object.keys(row).map((key) => key.toLowerCase());
  for (const forbidden of FORBIDDEN_MEMBER_FIELDS) {
    assert.ok(!keys.some((key) => key.includes(forbidden)), `member catalog leaked ${forbidden}`);
  }
}
pass("MEMBER-SAFE-CATALOG", `checked ${catalogRows.length} catalog payload(s) for forbidden cost/formula/margin/supplier/internal fields`);

const lifecycle = manifest.companies.find((item) => item.key === "C05");
assert.deepEqual(lifecycle.status, { user: "ACTIVE", organization: "ACTIVE", application: "APPROVED", sourcing: "SUBMITTED" });
const lifecycleExecuted = process.env.SMTR_ALLOW_LIFECYCLE === "true";
if (lifecycleExecuted) {
  const operator = createClient({ baseUrl: target.host, anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY });
  must(await operator.auth.signInWithPassword({ email: UAT_ADMIN_EMAIL, password }), "login UAT operator for lifecycle verification");
  const beforeUser = must(await admin.database.from("users").select("status").eq("id", lifecycle.userId).single(), "preflight C05 user");
  const beforeOrg = must(await admin.database.from("organizations").select("status").eq("id", lifecycle.organizationId).single(), "preflight C05 organization");
  assert.equal(beforeUser.status, "ACTIVE");
  assert.equal(beforeOrg.status, "ACTIVE");
  let suspended = false;
  try {
    must(await operator.database.rpc("suspend_user", { target_user_id_input: lifecycle.userId, reason_input: `${FIXTURE_VERSION} lifecycle verification` }), "suspend C05");
    suspended = true;
    const suspendedUser = must(await admin.database.from("users").select("status").eq("id", lifecycle.userId).single(), "read suspended C05 user");
    const suspendedOrg = must(await admin.database.from("organizations").select("status").eq("id", lifecycle.organizationId).single(), "read suspended C05 organization");
    assert.equal(suspendedUser.status, "SUSPENDED");
    assert.equal(suspendedOrg.status, "SUSPENDED");
    pass("LIFECYCLE-C05-SUSPEND", "operator suspension is visible in persisted lifecycle state");
  } finally {
    const currentUser = must(await admin.database.from("users").select("status").eq("id", lifecycle.userId).single(), "read C05 status before recovery");
    if (suspended || currentUser.status === "SUSPENDED") {
      must(await operator.database.rpc("reactivate_user", { target_user_id_input: lifecycle.userId }), "reactivate C05");
    }
  }
  const activeUser = must(await admin.database.from("users").select("status").eq("id", lifecycle.userId).single(), "read reactivated C05 user");
  const activeOrg = must(await admin.database.from("organizations").select("status").eq("id", lifecycle.organizationId).single(), "read reactivated C05 organization");
  assert.equal(activeUser.status, "ACTIVE");
  assert.equal(activeOrg.status, "ACTIVE");
  pass("LIFECYCLE-C05-REACTIVATE", "C05 returns to ACTIVE so all five fixtures remain available for owner testing");
} else {
  const activeUser = must(await admin.database.from("users").select("status").eq("id", lifecycle.userId).single(), "read C05 user status");
  const activeOrg = must(await admin.database.from("organizations").select("status").eq("id", lifecycle.organizationId).single(), "read C05 organization status");
  assert.equal(activeUser.status, "ACTIVE");
  assert.equal(activeOrg.status, "ACTIVE");
  pass("LIFECYCLE-C05-READONLY", "default verification is read-only; C05 is ACTIVE (set SMTR_ALLOW_LIFECYCLE=true to exercise suspend/reactivate)");
}

const beforeOrders = must(await admin.database.from("customer_orders").select("id").in("organization_id", manifest.companies.map((item) => item.organizationId)).limit(1000), "count SMTR orders before boundary test").length;
const cBoundary = await clients[0].client.database.rpc("create_customer_order", {
  project_id_input: clients[1].fixture.projectId,
  selections_input: [{ project_item_id: clients[1].fixture.projectItemId, quantity: 1 }],
});
assert.ok(cBoundary.error, "cross-tenant Release C order creation must fail");
assert.ok(["PROJECT_NOT_FOUND", "project not found"].includes(String(cBoundary.error.message).trim()), `expected canonical tenant denial, got: ${cBoundary.error.message}`);
const afterOrders = must(await admin.database.from("customer_orders").select("id").in("organization_id", manifest.companies.map((item) => item.organizationId)).limit(1000), "count SMTR orders after boundary test").length;
assert.equal(afterOrders, beforeOrders, "tenant denial must not create an order");
pass("RELEASE-C-BOUNDARY", "Development RPC is present and rejects a project owned by another synthetic company before creating an order");

const report = {
  fixtureVersion: FIXTURE_VERSION,
  runId: manifest.runId,
  environment: target,
  verifiedAt: new Date().toISOString(),
  companyCount: clients.length,
  assertionCount: assertions.length,
  passCount: assertions.length,
  failCount: 0,
  assertions,
  lifecycleMode: lifecycleExecuted ? "EXECUTED_AND_RESTORED_ACTIVE" : "SKIPPED_READ_ONLY",
  limitations: [
    "Private-file verification covers database metadata RLS; no real Storage object or signed URL was created.",
    "Release C coverage is a safe cross-tenant order boundary assertion. Full quotation/order/payment transactions were not generated.",
    "Release D production/QC/shipping/claim workflows were not generated because safe cleanup would require retaining transaction and audit history beyond this rehearsal fixture.",
  ],
  secretMaterialRecorded: false,
  result: "PASS",
};
writeJson(VERIFY_REPORT_PATH, report);
console.log(JSON.stringify({ result: report.result, fixtureVersion: FIXTURE_VERSION, companyCount: report.companyCount, assertions: report.assertionCount, report: "output/smtr/SMTR-v1.0-verify-report.json", limitations: report.limitations }, null, 2));
