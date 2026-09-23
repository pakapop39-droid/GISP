import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const TEMPLATE_SHA256 = "72CD3A7B96BA62B7E81293D172E0089CAD5E1B0FB5ED0F9DB6FB773D20898C2E";
const sha256 = (value) => createHash("sha256").update(value).digest("hex").toUpperCase();

export function assertSelectOnly(sql) {
  const executable = sql.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--.*$/gm, " ");
  const statements = executable.split(";").map((value) => value.trim()).filter(Boolean);
  if (!statements.length || statements.some((value) => !/^(SELECT|WITH)\b/i.test(value))) throw new Error("RECONCILE_NOT_SELECT_ONLY");
  if (/\b(INSERT|UPDATE|DELETE|TRUNCATE|CREATE|ALTER|DROP|GRANT|REVOKE|SET|CALL|DO|COPY|LOCK)\b/i.test(executable)) throw new Error("RECONCILE_CONTAINS_WRITE");
}

export function resolveNpxTransport({ platform=process.platform, execPath=process.execPath, npmExecPath=process.env.npm_execpath }={}) {
  if (platform !== "win32") return { executable: "npx", prefix: [] };
  const candidates = [npmExecPath ? join(dirname(npmExecPath), "npx-cli.js") : null, join(dirname(execPath), "node_modules", "npm", "bin", "npx-cli.js")].filter(Boolean);
  const cli = candidates.find((value) => existsSync(value));
  if (!cli) throw new Error("NPX_CLI_NOT_FOUND");
  return { executable: execPath, prefix: [cli] };
}

function argumentsMap(argv) {
  const values = new Map();
  for (let index=0; index<argv.length; index+=2) values.set(argv[index], argv[index+1]);
  if (values.get("--execute") !== "SELECT_ONLY_RECONCILIATION") throw new Error("EXECUTION_CONFIRMATION_MISMATCH");
  if (!values.get("--context") || !values.get("--expected-project-id")) throw new Error("MISSING_CONTEXT_OR_PROJECT");
  return values;
}

export function main(argv=process.argv.slice(2)) {
  const values = argumentsMap(argv);
  const context = resolve(values.get("--context"));
  const project = JSON.parse(readFileSync(resolve(context, ".insforge", "project.json"), "utf8"));
  if (project.project_id !== values.get("--expected-project-id")) throw new Error("PROJECT_ID_MISMATCH");
  const template = readFileSync(fileURLToPath(new URL("./reconcile.sql", import.meta.url)));
  if (sha256(template) !== TEMPLATE_SHA256) throw new Error("RECONCILE_HASH_MISMATCH");
  const sql = template.toString("utf8"); assertSelectOnly(sql);
  const transport = resolveNpxTransport();
  const result = spawnSync(transport.executable, [...transport.prefix, "-y", "@insforge/cli", "db", "query", sql, "--json"], { cwd: context, encoding: "utf8", shell: false, windowsHide: true, stdio: ["ignore","pipe","pipe"] });
  if (result.error || result.status !== 0) throw new Error("RECONCILE_CLI_FAILED");
  process.stdout.write(result.stdout);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { process.stderr.write(`${error instanceof Error ? error.message : "RECONCILE_FAILED"}\n`); process.exitCode=1; }
}
