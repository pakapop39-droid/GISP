import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

const allowedKinds = new Set(["advisor", "suppressions", "deployment", "acl", "runtime", "attestation"]);
const exactSensitiveKeys = new Set([
  "key", "accesskey", "accesskeyid", "secretaccesskey", "servicerolekey",
  "databaseurl", "dburl", "connectionstring", "databaseconnectionstring",
  "authorization", "cookie", "setcookie", "credential", "credentials",
  "password", "passwd", "privatekey", "apikey", "anonkey", "token",
  "accesstoken", "refreshtoken", "sessiontoken", "clientsecret", "jwt",
]);

function isSensitiveKey(key) {
  const normalized = String(key).replace(/[^a-z0-9]/gi, "").toLowerCase();
  return exactSensitiveKeys.has(normalized)
    || normalized.includes("authorization")
    || normalized.includes("credential")
    || normalized.includes("password")
    || normalized.includes("secret")
    || normalized.includes("token")
    || normalized.includes("accesskey")
    || normalized.includes("servicerolekey")
    || normalized.includes("privatekey")
    || normalized.includes("apikey")
    || normalized.includes("anonkey")
    || normalized.includes("databaseurl")
    || normalized.includes("connectionstring");
}

const sensitiveEnvValues = Object.entries(process.env)
  .filter(([key, value]) => value && isSensitiveKey(key) && String(value).length >= 8)
  .map(([, value]) => String(value));

function sanitizeString(value) {
  let result = value
    .replace(/(bearer\s+)[^\s"']+/gi, "$1[REDACTED]")
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[REDACTED_JWT]")
    .replace(/\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/[^\s"'<>]+/gi, "[REDACTED_CONNECTION_URL]")
    .replace(/([?&](?:access_token|refresh_token|token|api_key|key|secret|password)=)[^&#\s]+/gi, "$1[REDACTED]");
  for (const secret of sensitiveEnvValues) result = result.split(secret).join("[REDACTED_ENV]");
  return result;
}

function sanitize(value, key = "") {
  if (isSensitiveKey(key)) return "[REDACTED]";
  if (typeof value === "string") return sanitizeString(value);
  if (Array.isArray(value)) return value.map((item) => sanitize(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((childKey) => [childKey, sanitize(value[childKey], childKey)]));
  }
  return value;
}

function canonicalJson(value) {
  return `${JSON.stringify(sanitize(value), null, 2)}\n`;
}

function sha256(content) {
  return createHash("sha256").update(Buffer.from(content, "utf8")).digest("hex");
}

function writeImmutable(path, content) {
  if (existsSync(path)) {
    const existing = readFileSync(path, "utf8").replace(/\r\n?/g, "\n");
    if (existing !== content) throw new Error(`Refusing to replace immutable evidence: ${basename(path)}`);
    return;
  }
  writeFileSync(path, content, { encoding: "utf8", flag: "wx" });
}

function parseArguments(argv) {
  const outIndex = argv.indexOf("--out-dir");
  if (outIndex < 0 || !argv[outIndex + 1]) throw new Error("Usage: capture-evidence.mjs --out-dir <dir> kind=file.json [...]");
  const outDir = resolve(argv[outIndex + 1]);
  const sources = argv.filter((_, index) => index !== outIndex && index !== outIndex + 1).map((entry) => {
    const splitAt = entry.indexOf("=");
    const kind = entry.slice(0, splitAt);
    const path = entry.slice(splitAt + 1);
    if (splitAt < 1 || !allowedKinds.has(kind) || !path) throw new Error(`Unsupported evidence source: ${entry}`);
    return { kind, path: resolve(path) };
  });
  if (sources.length === 0) throw new Error("At least one evidence source is required");
  if (new Set(sources.map(({ kind }) => kind)).size !== sources.length) throw new Error("Evidence kinds must be unique per capture");
  return { outDir, sources };
}

function main() {
  const { outDir, sources } = parseArguments(process.argv.slice(2));
  mkdirSync(outDir, { recursive: true });
  const files = [];
  for (const { kind, path } of sources) {
    const rawBytes = readFileSync(path);
    const raw = JSON.parse(rawBytes.toString("utf8"));
    const content = canonicalJson(raw);
    const file = `${kind}.sanitized.json`;
    writeImmutable(join(outDir, file), content);
    files.push({
      kind,
      file,
      bytes: Buffer.byteLength(content),
      sourceRawSha256: createHash("sha256").update(rawBytes).digest("hex"),
      sanitizedSha256: sha256(content),
    });
  }
  const manifest = canonicalJson({ format: "GISP_HOSTED_REHEARSAL_EVIDENCE_V1", files });
  writeImmutable(join(outDir, "manifest.json"), manifest);
  process.stdout.write(manifest);
}

main();
