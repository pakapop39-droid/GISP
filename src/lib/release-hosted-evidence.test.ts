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
});
