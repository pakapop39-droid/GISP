import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  assessScheduleSafety,
  buildDryRunPlan,
  CONTRACT,
  validateChildIdentity,
  validateExecutionToken,
  validateMigrationInventory,
  validateNoBroadApply,
  validatePlanDocument,
  validateScheduleSafety,
} from "./rehearsal-contract.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../..");

function validIdentity() {
  return {
    current: {
      project_id: CONTRACT.child.id,
      project_name: CONTRACT.child.name,
      appkey: CONTRACT.child.appkey,
      region: CONTRACT.child.region,
    },
    branch: {
      id: CONTRACT.child.id,
      parent_project_id: CONTRACT.parent.id,
      name: CONTRACT.child.name,
      appkey: CONTRACT.child.appkey,
      status: CONTRACT.child.status,
      branch_state: CONTRACT.child.state,
      branch_metadata: { mode: CONTRACT.child.mode },
    },
  };
}

function validSchedule(overrides = {}) {
  return {
    id: CONTRACT.schedule.id,
    name: CONTRACT.schedule.name,
    isActive: false,
    functionUrl: `https://${CONTRACT.child.host}/functions/notification-retry`,
    headers: {},
    body: null,
    ...overrides,
  };
}

function assertUnsafe(input, { complete = true, pattern } = {}) {
  const assessment = assessScheduleSafety(input, { complete });
  assert.equal(assessment.safe, false);
  assert.ok(assessment.blockers.length > 0);
  assert.throws(() => validateScheduleSafety(input, { complete }), pattern ?? /RLC_SCHEDULE_GUARD/);
}

function validSnapshot() {
  const identity = validIdentity();
  return {
    currentProject: identity.current,
    branch: identity.branch,
    schedulesComplete: true,
    schedules: [],
    productionBaseline: {
      projectId: CONTRACT.parent.id,
      appkey: CONTRACT.parent.appkey,
      migrationCount: CONTRACT.parent.migrationCount,
      migrationHead: CONTRACT.parent.migrationHead,
    },
  };
}

test("accepts only the exact ready schema-only Child lineage", () => {
  const result = validateChildIdentity(validIdentity());
  assert.equal(result.childId, CONTRACT.child.id);
  assert.equal(result.parentId, CONTRACT.parent.id);
});

test("rejects Production current identity", () => {
  const input = validIdentity();
  input.current = { project_id: CONTRACT.parent.id, project_name: CONTRACT.parent.name, appkey: CONTRACT.parent.appkey, region: CONTRACT.child.region };
  assert.throws(() => validateChildIdentity(input), /Production identity is prohibited/);
});

test("rejects a wrong Child lineage or appkey", () => {
  const wrongParent = validIdentity();
  wrongParent.branch.parent_project_id = "00000000-0000-0000-0000-000000000000";
  assert.throws(() => validateChildIdentity(wrongParent), /lineage identity mismatch/);
  const wrongAppkey = validIdentity();
  wrongAppkey.current.appkey = CONTRACT.parent.appkey;
  assert.throws(() => validateChildIdentity(wrongAppkey), /Production identity is prohibited/);
});

test("accepts only a proven-complete absent or inactive target schedule", () => {
  assert.equal(validateScheduleSafety([], { complete: true }).targetState, "absent");
  const inactive = validSchedule({ isActive: false, functionUrl: `https://${CONTRACT.parent.host}/functions/notification-retry` });
  assert.equal(validateScheduleSafety([inactive], { complete: true }).targetState, "inactive");
});

test("rejects missing, null, object-shaped and other non-array schedule snapshots", () => {
  for (const input of [undefined, null, {}, { schedules: [] }, "[]", 0, 1, false, true]) assertUnsafe(input);
  assertUnsafe([], { complete: false, pattern: /completeness is not proven/ });
});

test("rejects malformed schedule entries and duplicate IDs", () => {
  const malformed = [
    null,
    {},
    validSchedule({ id: "not-a-uuid" }),
    validSchedule({ name: "" }),
    validSchedule({ name: 1 }),
  ];
  for (const entry of malformed) assertUnsafe([entry]);
  assertUnsafe([validSchedule(), validSchedule()], { pattern: /duplicated/ });
  assertUnsafe([validSchedule({ name: "Unexpected" })], { pattern: /unexpected name/ });
});

test("requires isActive to be a strict boolean", () => {
  for (const value of [undefined, null, "true", "false", 1, 0, {}, []]) {
    assertUnsafe([validSchedule({ isActive: value })], { pattern: /strict boolean/ });
  }
});

test("rejects missing, unparseable or non-HTTPS schedule URLs", () => {
  for (const functionUrl of [undefined, null, "", "not-a-url", "ftp://example.test/task", "https://user:password@example.test/task"]) {
    assertUnsafe([validSchedule({ isActive: true, functionUrl })], { pattern: /functionUrl/ });
  }
});

test("rejects malformed headers and non-JSON body values", () => {
  for (const headers of [[], "X-Test: value", { "X-Test": 1 }, { "": "value" }]) {
    assertUnsafe([validSchedule({ headers })], { pattern: /headers/ });
  }
  const cyclic = {};
  cyclic.self = cyclic;
  for (const body of [new Date(), () => true, { missing: undefined }, Number.NaN, cyclic]) {
    assertUnsafe([validSchedule({ body })], { pattern: /body/ });
  }
  assertUnsafe([validSchedule({ isActive: true, body: cyclic })], { pattern: /body/ });
});

test("rejects any active schedule targeting Production in URL, headers or body", () => {
  const productionUrl = validSchedule({ isActive: true, functionUrl: `https://${CONTRACT.parent.host}/functions/notification-retry` });
  assertUnsafe([productionUrl], { pattern: /active and targets Production/ });
  const productionAppkeyAlias = validSchedule({ isActive: true, functionUrl: `https://${CONTRACT.parent.appkey}.example.test/task` });
  assertUnsafe([productionAppkeyAlias], { pattern: /active and targets Production/ });
  const otherId = "11111111-1111-4111-8111-111111111111";
  const productionHeader = validSchedule({ id: otherId, name: "Other", isActive: true, headers: { "X-Target": `project ${CONTRACT.parent.appkey}` } });
  assertUnsafe([productionHeader], { pattern: /active and targets Production/ });
  const productionBody = validSchedule({ id: otherId, name: "Other", isActive: true, body: { callback: `https://${CONTRACT.parent.host}/task` } });
  assertUnsafe([productionBody], { pattern: /active and targets Production/ });
});

test("allows an active schedule only when its complete shape does not target Production", () => {
  const safeTarget = validSchedule({ isActive: true });
  const result = validateScheduleSafety([safeTarget], { complete: true });
  assert.equal(result.safe, true);
  assert.equal(result.targetState, "active-safe-target");
  assert.deepEqual(result.blockers, []);
});

test("requires the deliberate future execution token", () => {
  assert.throws(() => validateExecutionToken("wrong"), /token mismatch/);
  assert.equal(validateExecutionToken(CONTRACT.executionToken), true);
});

test("validates all five migration hashes in exact ascending order", () => {
  const inventory = validateMigrationInventory(repoRoot);
  assert.equal(inventory.length, 5);
  assert.deepEqual(inventory.map(({ version }) => version), [...inventory.map(({ version }) => version)].sort());
});

test("future migration steps prohibit broad apply and require fresh guards", () => {
  const steps = buildDryRunPlan();
  assert.equal(validateNoBroadApply(steps), true);
  for (const step of steps) {
    assert.equal(step.requiresExecutionToken, true);
    assert.equal(step.requiresFreshIdentityRead, true);
    assert.equal(step.requiresFreshScheduleRead, true);
    assert.doesNotMatch(step.command.join(" "), /\s--(?:all|to)(?:\s|$)/);
  }
});

test("validates the frozen rehearsal plan and rejects target drift", async () => {
  const plan = (await import("./rehearsal-plan.json", { with: { type: "json" } })).default;
  assert.equal(validatePlanDocument(plan), true);
  const drifted = structuredClone(plan);
  drifted.target.childId = CONTRACT.parent.id;
  assert.throws(() => validatePlanDocument(drifted), /target identity mismatch/);
});

test("preparation CLI is dry-run by default and refuses execute mode", () => {
  const script = resolve(here, "prepare-rehearsal.mjs");
  const dryRun = spawnSync(process.execPath, [script], { encoding: "utf8" });
  assert.equal(dryRun.status, 0, dryRun.stderr);
  const output = JSON.parse(dryRun.stdout);
  assert.equal(output.mode, "dry-run");
  assert.equal(output.mutationPerformed, false);
  const execute = spawnSync(process.execPath, [script, "--mode", "execute"], { encoding: "utf8" });
  assert.notEqual(execute.status, 0);
  assert.match(execute.stderr, /RLC_DRY_RUN_ONLY/);
});

test("preparation CLI requires explicit proof that a snapshot schedule list is complete", () => {
  const directory = mkdtempSync(resolve(tmpdir(), "rlc-rehearsal-"));
  try {
    const script = resolve(here, "prepare-rehearsal.mjs");
    const validPath = resolve(directory, "valid.json");
    writeFileSync(validPath, JSON.stringify(validSnapshot()));
    const valid = spawnSync(process.execPath, [script, "--snapshot", validPath], { encoding: "utf8" });
    assert.equal(valid.status, 0, valid.stderr);
    assert.equal(JSON.parse(valid.stdout).snapshotStatus, "LOCAL_SNAPSHOT_VALID");

    const incomplete = validSnapshot();
    delete incomplete.schedulesComplete;
    const incompletePath = resolve(directory, "incomplete.json");
    writeFileSync(incompletePath, JSON.stringify(incomplete));
    const rejected = spawnSync(process.execPath, [script, "--snapshot", incompletePath], { encoding: "utf8" });
    assert.notEqual(rejected.status, 0);
    assert.match(rejected.stderr, /completeness is not proven/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
