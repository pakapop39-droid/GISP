import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "../../..");
const manifestPath = resolve(scriptDirectory, "manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

function canonicalBytes(relativePath) {
  const text = readFileSync(resolve(repositoryRoot, relativePath), "utf8");
  return Buffer.from(text.replace(/\r\n?/g, "\n"), "utf8");
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function git(...args) {
  return execFileSync("git", args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

const failures = [];
const head = git("rev-parse", "HEAD");
const tree = git("rev-parse", "HEAD^{tree}");
if (head !== manifest.sourceCommit) failures.push(`HEAD mismatch: ${head}`);
if (tree !== manifest.sourceTree) failures.push(`tree mismatch: ${tree}`);

const results = [];
for (const item of manifest.migrations) {
  const sourceBytes = canonicalBytes(item.source);
  const targetBytes = canonicalBytes(item.target);
  const sourceHash = sha256(sourceBytes);
  const targetHash = sha256(targetBytes);
  const exactCopy = sourceBytes.equals(targetBytes);

  if (sourceHash !== item.canonicalSha256) {
    failures.push(`${item.source}: source hash ${sourceHash}`);
  }
  if (targetHash !== item.canonicalSha256) {
    failures.push(`${item.target}: target hash ${targetHash}`);
  }
  if (!exactCopy) failures.push(`${item.target}: canonical content differs from source`);

  results.push({
    sequence: item.sequence,
    phase: item.phase,
    target: item.target,
    canonicalSha256: targetHash,
    exactCopy,
  });
}

const reconcileHash = sha256(canonicalBytes(manifest.reconcile.source));
if (reconcileHash !== manifest.reconcile.canonicalSha256) {
  failures.push(`${manifest.reconcile.source}: reconcile hash ${reconcileHash}`);
}

const report = {
  ok: failures.length === 0,
  sourceCommit: head,
  sourceTree: tree,
  reconcile: {
    source: manifest.reconcile.source,
    canonicalSha256: reconcileHash,
  },
  migrations: results,
  failures,
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (failures.length > 0) process.exitCode = 1;
