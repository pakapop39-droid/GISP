import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildDryRunPlan,
  CONTRACT,
  validateChildIdentity,
  validateExecutionToken,
  validateMigrationInventory,
  validateNoBroadApply,
  validateProductionBaseline,
  validateScheduleSafety,
} from "./rehearsal-contract.mjs";

function option(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

if (process.argv.includes("--execute") || option("--mode") === "execute") {
  throw new Error("RLC_DRY_RUN_ONLY: this local preparation package never executes backend mutations");
}

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../..");
const migrations = validateMigrationInventory(repoRoot);
const steps = buildDryRunPlan();
validateNoBroadApply(steps);

const snapshotPath = option("--snapshot");
let snapshotStatus = "NOT_PROVIDED_REMOTE_PREFLIGHT_REQUIRED";
if (snapshotPath) {
  const snapshot = JSON.parse(readFileSync(resolve(snapshotPath), "utf8"));
  validateChildIdentity({ current: snapshot.currentProject, branch: snapshot.branch });
  validateScheduleSafety(snapshot.schedules, { complete: snapshot.schedulesComplete === true });
  validateProductionBaseline(snapshot.productionBaseline);
  snapshotStatus = "LOCAL_SNAPSHOT_VALID";
}

const token = option("--validate-execution-token");
if (token) validateExecutionToken(token);

const result = {
  format: CONTRACT.format,
  mode: "dry-run",
  mutationPerformed: false,
  snapshotStatus,
  candidate: CONTRACT.candidate,
  target: { childId: CONTRACT.child.id, parentId: CONTRACT.parent.id },
  scheduleSafetyRequired: {
    scheduleId: CONTRACT.schedule.id,
    rule: "abort if any active schedule targets Production",
  },
  futureExecutionLatchValidated: Boolean(token),
  migrations: migrations.map(({ file, sha256 }) => ({ file, sha256 })),
  futureMigrationSteps: steps,
  fixturePrefix: CONTRACT.fixturePrefix,
  nextGate: "Independent QA must confirm schedule safety before any mutation-capable executor is authorized",
};

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
