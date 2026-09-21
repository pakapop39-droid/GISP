import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const APPROVED_TEMPLATE_SHA256 =
  "0938D60388A67D668E47197EBE2CE4746FA95BCF72AEB2420C68E9586099ED7D";
export const CUTOVER_PLACEHOLDER = "__GISP_CUTOVER_AT__";

const canonical = (value) => value.replace(/\r\n?/g, "\n").trimEnd();
const sha256 = (value) => createHash("sha256")
  .update(Buffer.from(canonical(value), "utf8"))
  .digest("hex")
  .toUpperCase();

export function validateCutover(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2})$/.exec(value ?? "");
  if (!match) throw new Error("CUTOVER_MUST_BE_ISO_8601_WITH_TIMEZONE");

  const [, year, month, day, hour, minute, second, , zone] = match;
  const maxDay = new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate();
  const zoneMatch = /^([+-])(\d{2}):(\d{2})$/.exec(zone);
  const validZone = zone === "Z" || (
    zoneMatch
    && Number(zoneMatch[2]) <= 14
    && Number(zoneMatch[3]) <= 59
    && (Number(zoneMatch[2]) < 14 || Number(zoneMatch[3]) === 0)
  );
  if (
    Number(month) < 1 || Number(month) > 12
    || Number(day) < 1 || Number(day) > maxDay
    || Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59
    || !validZone
  ) {
    throw new Error("CUTOVER_MUST_BE_VALID_ISO_8601");
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error("CUTOVER_MUST_BE_VALID_ISO_8601");
  return parsed.toISOString();
}

export function assertSelectOnly(sql) {
  const executable = canonical(sql)
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--.*$/gm, " ");
  const statements = executable.split(";").map((part) => part.trim()).filter(Boolean);
  if (statements.length === 0 || statements.some((statement) => !/^(SELECT|WITH)\b/i.test(statement))) {
    throw new Error("RECONCILE_TEMPLATE_NOT_SELECT_ONLY");
  }
  if (/\b(INSERT|UPDATE|DELETE|TRUNCATE|CREATE|ALTER|DROP|GRANT|REVOKE|SET|CALL|DO|COPY|LOCK)\b/i.test(executable)
    || /\bFOR\s+(UPDATE|SHARE)\b/i.test(executable)) {
    throw new Error("RECONCILE_TEMPLATE_CONTAINS_WRITE_OR_LOCK");
  }
}

export function renderReconciliationSql(template, cutover) {
  if (sha256(template) !== APPROVED_TEMPLATE_SHA256) {
    throw new Error("RECONCILE_TEMPLATE_HASH_MISMATCH");
  }
  const occurrences = template.split(CUTOVER_PLACEHOLDER).length - 1;
  if (occurrences !== 12) throw new Error("RECONCILE_TEMPLATE_PLACEHOLDER_COUNT_MISMATCH");

  const safeCutover = validateCutover(cutover);
  const rendered = canonical(template).replaceAll(CUTOVER_PLACEHOLDER, safeCutover);
  if (rendered.includes(CUTOVER_PLACEHOLDER)) throw new Error("RECONCILE_TEMPLATE_RENDER_FAILED");
  assertSelectOnly(rendered);
  return rendered;
}

export function readAndVerifyProject(contextDirectory, expectedProjectId) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(expectedProjectId ?? "")) {
    throw new Error("EXPECTED_PROJECT_ID_MUST_BE_UUID");
  }
  const context = resolve(contextDirectory ?? "");
  const configPath = resolve(context, ".insforge", "project.json");
  const project = JSON.parse(readFileSync(configPath, "utf8"));
  if (project.project_id !== expectedProjectId) throw new Error("INSFORGE_PROJECT_ID_MISMATCH");
  return context;
}

function parseArguments(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || value === undefined || value.startsWith("--")) {
      throw new Error("INVALID_ARGUMENTS");
    }
    values.set(key, value);
  }
  for (const required of ["--cutover", "--context", "--expected-project-id", "--execute"]) {
    if (!values.has(required)) throw new Error(`MISSING_${required.slice(2).toUpperCase().replaceAll("-", "_")}`);
  }
  if (values.get("--execute") !== "SELECT_ONLY_RECONCILIATION") {
    throw new Error("EXECUTION_CONFIRMATION_MISMATCH");
  }
  return values;
}

export function resolveNpxTransport({
  platform = process.platform,
  execPath = process.execPath,
  npmExecPath = process.env.npm_execpath,
} = {}) {
  if (platform !== "win32") return { executable: "npx", prefixArguments: [] };

  const candidates = [
    npmExecPath ? join(dirname(npmExecPath), "npx-cli.js") : undefined,
    join(dirname(execPath), "node_modules", "npm", "bin", "npx-cli.js"),
  ].filter(Boolean);
  const npxCli = candidates.find((candidate) => existsSync(candidate));
  if (!npxCli) throw new Error("NPX_CLI_NOT_FOUND");
  return { executable: execPath, prefixArguments: [npxCli] };
}

export function runCli(context, renderedSql, transport = resolveNpxTransport()) {
  assertSelectOnly(renderedSql);
  if (renderedSql.includes(CUTOVER_PLACEHOLDER)) throw new Error("RECONCILE_TEMPLATE_RENDER_FAILED");
  const result = spawnSync(
    transport.executable,
    [
      ...transport.prefixArguments,
      "-y",
      "@insforge/cli",
      "db",
      "query",
      renderedSql,
      "--json",
    ],
    {
      cwd: context,
      encoding: "utf8",
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    },
  );

  if (result.error || result.status !== 0) throw new Error("RECONCILE_CLI_FAILED");
  return result.stdout;
}

export function main(argv = process.argv.slice(2)) {
  const values = parseArguments(argv);
  const context = readAndVerifyProject(values.get("--context"), values.get("--expected-project-id"));
  const templatePath = fileURLToPath(new URL("./reconcile.sql", import.meta.url));
  const renderedSql = renderReconciliationSql(readFileSync(templatePath, "utf8"), values.get("--cutover"));
  process.stdout.write(runCli(context, renderedSql));
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : "RECONCILE_RUNNER_FAILED"}\n`);
    process.exitCode = 1;
  }
}
