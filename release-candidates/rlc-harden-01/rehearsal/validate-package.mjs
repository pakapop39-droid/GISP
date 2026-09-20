import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { buildDryRunPlan, CONTRACT, validateMigrationInventory, validateNoBroadApply, validatePlanDocument } from "./rehearsal-contract.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../..");
const migrations = validateMigrationInventory(repoRoot);
const steps = buildDryRunPlan();
validateNoBroadApply(steps);
validatePlanDocument(JSON.parse(readFileSync(resolve(here, "rehearsal-plan.json"), "utf8")));

const result = {
  format: CONTRACT.format,
  status: "LOCAL_PACKAGE_VALID",
  mutationPerformed: false,
  candidate: CONTRACT.candidate,
  childId: CONTRACT.child.id,
  parentId: CONTRACT.parent.id,
  scheduleId: CONTRACT.schedule.id,
  fixturePrefix: CONTRACT.fixturePrefix,
  migrationCount: migrations.length,
  migrations: migrations.map(({ file, sha256 }) => ({ file, sha256 })),
  broadApplyPresent: false,
  futureWriteGuarded: steps.every((step) => step.requiresExecutionToken && step.requiresFreshIdentityRead && step.requiresFreshScheduleRead),
  planDocumentValid: true,
};

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
