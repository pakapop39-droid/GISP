import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const script = join(process.cwd(), "release-candidates", "pay-rpc-gate-001", "hosted-rehearsal", "capture-evidence.mjs");
const tempDirs: string[] = [];

afterEach(() => {
  for (const path of tempDirs.splice(0)) rmSync(path, { recursive: true, force: true });
});

describe("hosted rehearsal evidence capture", () => {
  it("sanitizes credentials, writes canonical evidence, and records reproducible SHA-256", () => {
    const root = mkdtempSync(join(tmpdir(), "gisp-hr-evidence-"));
    tempDirs.push(root);
    const input = join(root, "advisor.json");
    const output = join(root, "frozen");
    const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.signature_value";
    const rawInput = JSON.stringify({
      scan: { status: "completed", scanId: "scan-1" },
      authorization: "Bearer unsafe-token",
      nested: { apiKey: "unsafe-api-key", url: "https://example.test/?access_token=unsafe-query", jwt },
      envLeak: "test-secret-value",
    });
    writeFileSync(input, rawInput);
    execFileSync(process.execPath, [script, "--out-dir", output, `advisor=${input}`], {
      env: { ...process.env, HR_CAPTURE_TEST_SECRET: "test-secret-value" },
    });
    const evidence = readFileSync(join(output, "advisor.sanitized.json"), "utf8");
    const manifest = JSON.parse(readFileSync(join(output, "manifest.json"), "utf8"));
    expect(evidence.endsWith("\n")).toBe(true);
    for (const secret of ["unsafe-token", "unsafe-api-key", "unsafe-query", jwt, "test-secret-value"]) {
      expect(evidence).not.toContain(secret);
    }
    expect(manifest.files).toEqual([{
      kind: "advisor",
      file: "advisor.sanitized.json",
      bytes: Buffer.byteLength(evidence),
      sourceRawSha256: createHash("sha256").update(Buffer.from(rawInput, "utf8")).digest("hex"),
      sanitizedSha256: createHash("sha256").update(Buffer.from(evidence, "utf8")).digest("hex"),
    }]);
  });

  it("refuses to replace immutable evidence with different sanitized bytes", () => {
    const root = mkdtempSync(join(tmpdir(), "gisp-hr-evidence-"));
    tempDirs.push(root);
    const input = join(root, "runtime.json");
    const output = join(root, "frozen");
    writeFileSync(input, JSON.stringify({ result: "first" }));
    execFileSync(process.execPath, [script, "--out-dir", output, `runtime=${input}`]);
    writeFileSync(input, JSON.stringify({ result: "changed" }));
    expect(() => execFileSync(process.execPath, [script, "--out-dir", output, `runtime=${input}`], { stdio: "pipe" }))
      .toThrow(/Command failed/);
  });

  it("redacts case-insensitive and nested credential keys without erasing safe evidence keys", () => {
    const root = mkdtempSync(join(tmpdir(), "gisp-hr-evidence-"));
    tempDirs.push(root);
    const input = join(root, "deployment.json");
    const output = join(root, "frozen");
    const secrets = {
      bareKey: "secret-bare-key-value",
      access: "secret-access-key-value",
      service: "secret-service-role-value",
      database: "postgresql://user:password@private-db.example/gisp",
      connection: "redis://default:password@private-cache.example:6379",
      nestedApi: "secret-nested-api-value",
      mixedToken: "secret-mixed-token-value",
      accessVariant: "secret-access-variant-value",
      databaseVariant: "secret-database-variant-value",
      connectionVariant: "secret-connection-variant-value",
    };
    writeFileSync(input, JSON.stringify({
      KEY: secrets.bareKey,
      AccessKey: secrets.access,
      SERVICE_ROLE_KEY: secrets.service,
      databaseUrl: secrets.database,
      Connection_String: secrets.connection,
      nested: { settings: {
        customApiKey: secrets.nestedApi,
        UserAccessToken: secrets.mixedToken,
        awsAccessKeyIdentifier: secrets.accessVariant,
        primaryDatabaseUrlResolved: secrets.databaseVariant,
        replicaConnectionStringValue: secrets.connectionVariant,
      } },
      safeEvidence: {
        monkey: "preserve-monkey",
        keyCount: 54,
        ruleKey: "advisor-rule-1",
        publicKey: "documented-public-identifier",
        scanId: "scan-2",
      },
      diagnostic: `database unavailable at ${secrets.database}`,
    }));
    execFileSync(process.execPath, [script, "--out-dir", output, `deployment=${input}`]);
    const evidence = readFileSync(join(output, "deployment.sanitized.json"), "utf8");
    const manifest = readFileSync(join(output, "manifest.json"), "utf8");
    for (const value of Object.values(secrets)) {
      expect(evidence).not.toContain(value);
      expect(manifest).not.toContain(value);
    }
    expect(evidence).toContain("preserve-monkey");
    expect(evidence).toContain('"keyCount": 54');
    expect(evidence).toContain("advisor-rule-1");
    expect(evidence).toContain("documented-public-identifier");
    expect(evidence).toContain("scan-2");
    expect(evidence).toContain("[REDACTED_CONNECTION_URL]");
  });
});
