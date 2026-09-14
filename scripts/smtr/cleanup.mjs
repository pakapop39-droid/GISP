import assert from "node:assert/strict";
import { FIXTURE_VERSION } from "./fixtures.mjs";
import { validateCleanupPreflight } from "./cleanup-validation.mjs";
import { loadDevelopmentTarget } from "./target-guard.mjs";
import { CLEANUP_REPORT_PATH, readManifest, writeJson } from "./io.mjs";

// This guard deliberately runs before the SDK module is loaded or any client exists.
const target = loadDevelopmentTarget();
const manifest = readManifest();
assert.equal(manifest.fixtureVersion, FIXTURE_VERSION);
assert.equal(manifest.environment.projectId, target.projectId);
assert.equal(manifest.companies.length, 5);
const execute = process.argv.includes("--execute");

const actions = manifest.companies.map((item) => ({
  key: item.key,
  userId: item.userId,
  organizationId: item.organizationId,
  action: "logical-deactivate",
}));

if (execute && process.env.SMTR_ALLOW_CLEANUP !== "true") {
  throw new Error("SMTR cleanup execution requires SMTR_ALLOW_CLEANUP=true");
}

// Preflight is complete for every fixture before the first possible mutation.
const { createAdminClient } = await import("@insforge/sdk");
const admin = createAdminClient({ baseUrl: target.host, apiKey: process.env.INSFORGE_API_KEY });
const must = (result, label) => {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
};
const snapshots = [];
for (const item of manifest.companies) {
  const authUserId = must(await admin.database.rpc("operator_find_auth_user_id", { email_input: item.email }), `resolve auth identity ${item.key}`);
  const profile = must(await admin.database.from("member_profiles").select("id,user_id,organization_id").eq("id", item.memberProfileId).single(), `preflight profile ${item.key}`);
  const organization = must(await admin.database.from("organizations").select("id,code,name").eq("id", item.organizationId).single(), `preflight organization ${item.key}`);
  const catalog = must(await admin.database.from("shared_catalogs").select("id,organization_id,member_profile_id").eq("id", item.sharedCatalogId).single(), `preflight catalog ${item.key}`);
  snapshots.push({ key: item.key, authUserId, profile, organization, catalog });
}
validateCleanupPreflight(manifest, snapshots);

if (execute) {
  for (const item of manifest.companies) {
    must(await admin.database.from("shared_catalogs").update({ status: "REVOKED" }).eq("id", item.sharedCatalogId), `revoke catalog ${item.key}`);
    must(await admin.database.from("users").update({ status: "INACTIVE", status_reason: `${FIXTURE_VERSION} logical cleanup` }).eq("id", item.userId), `deactivate user ${item.key}`);
    must(await admin.database.from("organizations").update({ status: "INACTIVE" }).eq("id", item.organizationId), `deactivate organization ${item.key}`);
  }
}

const report = {
  fixtureVersion: FIXTURE_VERSION,
  runId: manifest.runId,
  environment: target,
  mode: execute ? "EXECUTED" : "DRY_RUN",
  generatedAt: new Date().toISOString(),
  actions,
  physicalDeleteCount: 0,
  auditRetention: "All database rows, auth users, audit events and security events are retained.",
  expectedResidue: ["auth users", "organizations", "member profiles", "applications", "projects", "shared catalogs", "sourcing requests", "file metadata", "audit/security history"],
  secretMaterialRecorded: false,
  result: "PASS",
};
writeJson(CLEANUP_REPORT_PATH, report);
console.log(JSON.stringify({ result: report.result, mode: report.mode, companyCount: actions.length, physicalDeleteCount: 0, report: "output/smtr/SMTR-v1.0-cleanup-report.json" }, null, 2));
