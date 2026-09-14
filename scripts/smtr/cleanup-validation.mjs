import assert from "node:assert/strict";
import { COMPANIES, FIXTURE_VERSION } from "./fixtures.mjs";

export function validateCleanupPreflight(manifest, snapshots) {
  assert.equal(manifest?.fixtureVersion, FIXTURE_VERSION, "fixture version mismatch");
  assert.equal(manifest?.companies?.length, 5, "cleanup requires exactly five manifest companies");
  assert.equal(snapshots?.length, 5, "cleanup requires five complete backend snapshots");
  const expectedByKey = new Map(COMPANIES.map((item) => [item.key, item]));
  const snapshotByKey = new Map(snapshots.map((item) => [item.key, item]));
  assert.equal(snapshotByKey.size, 5, "backend snapshot keys must be unique");
  for (const item of manifest.companies) {
    const expected = expectedByKey.get(item.key);
    const actual = snapshotByKey.get(item.key);
    assert.ok(expected, `unknown fixture key ${item.key}`);
    assert.ok(actual, `missing backend snapshot ${item.key}`);
    assert.equal(item.email, expected.email, `${item.key} manifest email mismatch`);
    assert.equal(item.organizationCode, expected.organizationCode, `${item.key} manifest organization code mismatch`);
    assert.equal(actual.authUserId, item.userId, `${item.key} auth email/user relationship mismatch`);
    assert.equal(actual.profile.id, item.memberProfileId, `${item.key} member profile id mismatch`);
    assert.equal(actual.profile.user_id, item.userId, `${item.key} member profile user mismatch`);
    assert.equal(actual.profile.organization_id, item.organizationId, `${item.key} member profile organization mismatch`);
    assert.equal(actual.organization.id, item.organizationId, `${item.key} organization id mismatch`);
    assert.equal(actual.organization.code, expected.organizationCode, `${item.key} organization code mismatch`);
    assert.equal(actual.organization.name, expected.companyName, `${item.key} organization name mismatch`);
    assert.equal(actual.catalog.id, item.sharedCatalogId, `${item.key} shared catalog id mismatch`);
    assert.equal(actual.catalog.organization_id, item.organizationId, `${item.key} shared catalog organization mismatch`);
    assert.equal(actual.catalog.member_profile_id, item.memberProfileId, `${item.key} shared catalog profile mismatch`);
  }
  assert.equal(new Set(manifest.companies.map((item) => item.userId)).size, 5, "manifest user ids must be unique");
  assert.equal(new Set(manifest.companies.map((item) => item.organizationId)).size, 5, "manifest organization ids must be unique");
  assert.equal(new Set(manifest.companies.map((item) => item.memberProfileId)).size, 5, "manifest profile ids must be unique");
  return true;
}
