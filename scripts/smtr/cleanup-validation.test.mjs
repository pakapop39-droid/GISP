import test from "node:test";
import assert from "node:assert/strict";
import { COMPANIES, FIXTURE_VERSION } from "./fixtures.mjs";
import { validateCleanupPreflight } from "./cleanup-validation.mjs";

function fixture() {
  const companies = COMPANIES.map((definition, index) => ({
    key: definition.key,
    email: definition.email,
    userId: `user-${index}`,
    organizationId: `org-${index}`,
    organizationCode: definition.organizationCode,
    memberProfileId: `profile-${index}`,
    sharedCatalogId: `catalog-${index}`,
  }));
  const snapshots = companies.map((item) => ({
    key: item.key,
    authUserId: item.userId,
    profile: { id: item.memberProfileId, user_id: item.userId, organization_id: item.organizationId },
    organization: { id: item.organizationId, code: item.organizationCode, name: COMPANIES.find((row) => row.key === item.key).companyName },
    catalog: { id: item.sharedCatalogId, organization_id: item.organizationId, member_profile_id: item.memberProfileId },
  }));
  return { manifest: { fixtureVersion: FIXTURE_VERSION, companies }, snapshots };
}

test("accepts a complete matching manifest and backend snapshot", () => {
  const input = fixture();
  assert.equal(validateCleanupPreflight(input.manifest, input.snapshots), true);
});

for (const [label, tamper] of [
  ["auth user id", (input) => { input.snapshots[0].authUserId = "attacker"; }],
  ["profile organization", (input) => { input.snapshots[0].profile.organization_id = "other-org"; }],
  ["organization name", (input) => { input.snapshots[0].organization.name = "Real company"; }],
  ["catalog ownership", (input) => { input.snapshots[0].catalog.member_profile_id = "other-profile"; }],
  ["manifest catalog id", (input) => { input.manifest.companies[0].sharedCatalogId = "tampered"; }],
]) {
  test(`rejects tampered ${label}`, () => {
    const input = fixture();
    tamper(input);
    assert.throws(() => validateCleanupPreflight(input.manifest, input.snapshots));
  });
}
