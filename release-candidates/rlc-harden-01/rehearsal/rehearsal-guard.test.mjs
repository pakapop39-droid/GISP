import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
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

test("accepts an absent or inactive target schedule", () => {
  assert.equal(validateScheduleSafety([]).targetState, "absent");
  const inactive = { id: CONTRACT.schedule.id, name: CONTRACT.schedule.name, isActive: false, functionUrl: `https://${CONTRACT.parent.host}/functions/notification-retry` };
  assert.equal(validateScheduleSafety([inactive]).targetState, "inactive");
});

test("rejects any active schedule targeting Production", () => {
  const unsafe = { id: CONTRACT.schedule.id, name: CONTRACT.schedule.name, isActive: true, functionUrl: `https://${CONTRACT.parent.host}/functions/notification-retry` };
  assert.throws(() => validateScheduleSafety([unsafe]), /active Schedule\(s\) target Production/);
  const unsafeHeader = { id: "other", name: "Other", isActive: true, functionUrl: `https://${CONTRACT.child.host}/functions/test`, headers: { "X-Target": `project ${CONTRACT.parent.appkey}` } };
  assert.throws(() => validateScheduleSafety([unsafeHeader]), /active Schedule\(s\) target Production/);
});

test("allows an active schedule only when it does not target Production", () => {
  const safeTarget = { id: CONTRACT.schedule.id, name: CONTRACT.schedule.name, isActive: true, functionUrl: `https://${CONTRACT.child.host}/functions/notification-retry` };
  assert.equal(validateScheduleSafety([safeTarget]).targetState, "active-safe-target");
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
