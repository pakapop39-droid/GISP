import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export const CONTRACT = Object.freeze({
  format: "GISP_RLC_HARDEN_01_REHEARSAL_V1",
  candidate: {
    commit: "cf62215b0cb359de87700b35f45c6d4ba1aaf1c2",
    tree: "8345c23b52b2ddc102dbc8bc92d237f957eeb1ef",
  },
  parent: {
    id: "865860c2-49fa-4e53-908f-9396b2f75233",
    name: "gisp-mvp-production",
    appkey: "m8ugbyak",
    host: "m8ugbyak.ap-southeast.insforge.app",
    migrationCount: 26,
    migrationHead: "20260908170000",
  },
  child: {
    id: "41df0506-ef0a-4753-9426-b1c8ed4f9ff6",
    name: "rlc-harden-01-rehearsal-20260920",
    appkey: "m8ugbyak-bd6",
    host: "m8ugbyak-bd6.ap-southeast.insforge.app",
    region: "ap-southeast",
    status: "active",
    state: "ready",
    mode: "schema-only",
  },
  schedule: {
    id: "aefecf8b-5b02-4649-a9b2-47aa448af0e8",
    name: "GISP-Notification-Retry",
  },
  fixturePrefix: "REH-RLC-HARDEN-01",
  executionToken: "RLC-HARDEN-01-APPLY-41df0506-ef0a-4753-9426-b1c8ed4f9ff6",
  migrations: [
    {
      version: "20260920010000",
      file: "release-candidates/pay-rpc-gate-001/migrations/20260920010000_pay-close-legacy-entry.sql",
      sha256: "081e4105445f2b51be6d7798c6175345237c2ae20bb8966baf0f363ec959e26b",
    },
    {
      version: "20260920010100",
      file: "release-candidates/pay-rpc-gate-001/migrations/20260920010100_pay-evidence-binding.sql",
      sha256: "c9f09a6dfe6c4a07472a2bbae40530b62707ad6be1d1b0d78a5747ee91cda11c",
    },
    {
      version: "20260920010200",
      file: "release-candidates/pay-rpc-gate-001/migrations/20260920010200_pay-private-executor.sql",
      sha256: "4cc15afc0583b1b0e9f9183d3b194cea7da510c85480c1107eaa2e6c8f82c929",
    },
    {
      version: "20260920010250",
      file: "release-candidates/rlc-harden-01/migrations/20260920010250_release-c-org-scope-hardening.sql",
      sha256: "0d2fac819d158a2a87962b181f2f637ada298b7973240341dfcef46f4be9bfa2",
    },
    {
      version: "20260920010300",
      file: "release-candidates/pay-rpc-gate-001/migrations/20260920010300_release-c-privileges.sql",
      sha256: "852a12532b9103809361e396647cdb8cb303da2cbefcedbd8a36813fbb09b98f",
    },
  ],
});

function value(object, ...keys) {
  for (const key of keys) {
    if (object?.[key] !== undefined && object?.[key] !== null) return object[key];
  }
  return undefined;
}

function normalizedString(input) {
  return String(input ?? "").trim().toLowerCase();
}

function containsProductionIdentity(input) {
  if (typeof input === "string") {
    const text = normalizedString(input);
    if (text === CONTRACT.parent.appkey) return true;
    if (text.includes(CONTRACT.parent.host)) return true;
    if (/(^|[^a-z0-9-])m8ugbyak([^a-z0-9-]|$)/i.test(text)) return true;
    return false;
  }
  if (Array.isArray(input)) return input.some(containsProductionIdentity);
  if (input && typeof input === "object") return Object.values(input).some(containsProductionIdentity);
  return false;
}

export function validateChildIdentity({ current, branch }) {
  const currentId = value(current, "project_id", "projectId", "id");
  const currentName = value(current, "project_name", "projectName", "name");
  const currentAppkey = value(current, "appkey", "appKey");
  const currentRegion = value(current, "region");
  if (currentId === CONTRACT.parent.id || currentName === CONTRACT.parent.name || currentAppkey === CONTRACT.parent.appkey) {
    throw new Error("RLC_TARGET_GUARD: Production identity is prohibited");
  }
  if (currentId !== CONTRACT.child.id) throw new Error("RLC_TARGET_GUARD: current project ID is not the approved Child");
  if (currentName !== CONTRACT.child.name) throw new Error("RLC_TARGET_GUARD: current project name is not the approved Child");
  if (currentAppkey !== CONTRACT.child.appkey) throw new Error("RLC_TARGET_GUARD: current appkey is not the approved Child appkey");
  if (currentRegion !== CONTRACT.child.region) throw new Error("RLC_TARGET_GUARD: current region is not approved");

  const branchId = value(branch, "id", "project_id", "projectId");
  const branchParent = value(branch, "parent_project_id", "parentProjectId");
  const branchName = value(branch, "name", "project_name", "projectName");
  const branchStatus = value(branch, "status");
  const branchState = value(branch, "branch_state", "branchState", "state");
  const branchMode = value(branch?.branch_metadata, "mode") ?? value(branch, "mode");
  const branchAppkey = value(branch, "appkey", "appKey");
  if (branchId !== CONTRACT.child.id || branchParent !== CONTRACT.parent.id || branchName !== CONTRACT.child.name) {
    throw new Error("RLC_TARGET_GUARD: Child lineage identity mismatch");
  }
  if (branchStatus !== CONTRACT.child.status || branchState !== CONTRACT.child.state || branchMode !== CONTRACT.child.mode) {
    throw new Error("RLC_TARGET_GUARD: Child is not active/ready/schema-only");
  }
  if (branchAppkey !== CONTRACT.child.appkey) throw new Error("RLC_TARGET_GUARD: branch appkey mismatch");
  return { childId: currentId, parentId: branchParent, appkey: currentAppkey };
}

export function validateScheduleSafety(schedulesInput) {
  const schedules = Array.isArray(schedulesInput) ? schedulesInput : schedulesInput ? [schedulesInput] : [];
  const target = schedules.find((item) => value(item, "id") === CONTRACT.schedule.id);
  if (target && value(target, "name") !== CONTRACT.schedule.name) {
    throw new Error("RLC_SCHEDULE_GUARD: approved Schedule ID has an unexpected name");
  }
  const unsafe = schedules.filter((item) => {
    const active = value(item, "isActive", "is_active", "active") === true;
    if (!active) return false;
    return containsProductionIdentity({
      url: value(item, "functionUrl", "function_url", "url"),
      headers: value(item, "headers"),
      body: value(item, "body"),
    });
  });
  if (unsafe.length > 0) {
    throw new Error(`RLC_SCHEDULE_GUARD: ${unsafe.length} active Schedule(s) target Production`);
  }
  return {
    targetState: target ? (value(target, "isActive", "is_active", "active") === true ? "active-safe-target" : "inactive") : "absent",
    activeProductionTargets: 0,
  };
}

export function validateExecutionToken(token) {
  if (token !== CONTRACT.executionToken) {
    throw new Error("RLC_EXECUTION_GUARD: deliberate execution token mismatch");
  }
  return true;
}

export function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

export function validateMigrationInventory(repoRoot) {
  const actual = CONTRACT.migrations.map((entry) => ({
    ...entry,
    actualSha256: sha256File(resolve(repoRoot, entry.file)),
  }));
  for (const entry of actual) {
    if (entry.actualSha256 !== entry.sha256) {
      throw new Error(`RLC_MIGRATION_GUARD: hash mismatch for ${entry.file}`);
    }
  }
  const versions = actual.map(({ version }) => version);
  const sorted = [...versions].sort();
  if (JSON.stringify(versions) !== JSON.stringify(sorted) || new Set(versions).size !== versions.length) {
    throw new Error("RLC_MIGRATION_GUARD: allow-list order is invalid");
  }
  return actual;
}

export function buildDryRunPlan() {
  return CONTRACT.migrations.map((entry, index) => ({
    step: index + 1,
    mutation: "migration-apply",
    source: entry.file,
    sha256: entry.sha256,
    requiresExecutionToken: true,
    requiresFreshIdentityRead: true,
    requiresFreshScheduleRead: true,
    command: ["npx", "-y", "@insforge/cli", "db", "migrations", "up", entry.file.split("/").at(-1), "--json"],
  }));
}

export function validateNoBroadApply(steps) {
  for (const step of steps) {
    const command = step.command.join(" ");
    if (command.includes(" --all") || command.includes(" --to")) {
      throw new Error("RLC_MIGRATION_GUARD: broad migration apply is prohibited");
    }
    if (!step.requiresExecutionToken || !step.requiresFreshIdentityRead || !step.requiresFreshScheduleRead) {
      throw new Error("RLC_EXECUTION_GUARD: every future write requires fresh guards and a deliberate token");
    }
  }
  return true;
}

export function validateProductionBaseline(baseline) {
  if (value(baseline, "projectId", "project_id", "id") !== CONTRACT.parent.id) throw new Error("RLC_BASELINE_GUARD: Production ID mismatch");
  if (value(baseline, "appkey", "appKey") !== CONTRACT.parent.appkey) throw new Error("RLC_BASELINE_GUARD: Production appkey mismatch");
  if (Number(value(baseline, "migrationCount", "migration_count")) !== CONTRACT.parent.migrationCount) throw new Error("RLC_BASELINE_GUARD: Production migration count changed");
  if (String(value(baseline, "migrationHead", "migration_head")) !== CONTRACT.parent.migrationHead) throw new Error("RLC_BASELINE_GUARD: Production migration head changed");
  return true;
}

export function validatePlanDocument(plan) {
  if (plan?.format !== "GISP_RLC_HARDEN_01_REHEARSAL_PLAN_V1" || plan?.status !== "PREPARED_NOT_EXECUTED") {
    throw new Error("RLC_PLAN_GUARD: plan format/status mismatch");
  }
  if (plan?.candidate?.commit !== CONTRACT.candidate.commit || plan?.candidate?.tree !== CONTRACT.candidate.tree) {
    throw new Error("RLC_PLAN_GUARD: candidate identity mismatch");
  }
  if (plan?.target?.childId !== CONTRACT.child.id || plan?.target?.parentId !== CONTRACT.parent.id) {
    throw new Error("RLC_PLAN_GUARD: target identity mismatch");
  }
  if (plan?.target?.prohibitedProductionAppkey !== CONTRACT.parent.appkey || plan?.target?.prohibitedProductionHost !== CONTRACT.parent.host) {
    throw new Error("RLC_PLAN_GUARD: Production rejection markers mismatch");
  }
  if (plan?.scheduleGate?.id !== CONTRACT.schedule.id || plan?.scheduleGate?.requiredBeforeEveryWrite !== true) {
    throw new Error("RLC_PLAN_GUARD: schedule gate mismatch");
  }
  if (plan?.execution?.defaultMode !== "dry-run" || plan?.execution?.mutationExecutorIncluded !== false) {
    throw new Error("RLC_PLAN_GUARD: package must remain dry-run only");
  }
  if (plan?.execution?.requiresDeliberateToken !== true || plan?.execution?.requiresFreshChildIdentityBeforeEveryWrite !== true || plan?.execution?.requiresFreshScheduleSafetyBeforeEveryWrite !== true) {
    throw new Error("RLC_PLAN_GUARD: future write guards are incomplete");
  }
  if (JSON.stringify(plan?.execution?.forbiddenMigrationArguments) !== JSON.stringify(["--all", "--to"])) {
    throw new Error("RLC_PLAN_GUARD: broad-apply rejection mismatch");
  }
  if (plan?.fixture?.prefix !== CONTRACT.fixturePrefix || plan?.fixture?.syntheticOnly !== true) {
    throw new Error("RLC_PLAN_GUARD: fixture boundary mismatch");
  }
  if (!Array.isArray(plan?.runtimeTests) || plan.runtimeTests.length < 9) {
    throw new Error("RLC_PLAN_GUARD: runtime test matrix is incomplete");
  }
  if (plan?.cleanup?.executeNow !== false) throw new Error("RLC_PLAN_GUARD: cleanup must remain non-executable");
  return true;
}
