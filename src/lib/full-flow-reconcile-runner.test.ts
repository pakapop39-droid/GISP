import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
// @ts-expect-error The audited recovery runner intentionally remains directly executable JavaScript.
import { APPROVED_TEMPLATE_SHA256, assertSelectOnly, renderReconciliationSql, resolveNpxTransport, runCli, validateCutover } from "../../release-candidates/full-flow-go-live-01/emergency/run-reconcile.mjs";

const root = new URL("../../release-candidates/full-flow-go-live-01/emergency/", import.meta.url);
const template = readFileSync(new URL("reconcile.sql", root), "utf8");
const runner = readFileSync(new URL("run-reconcile.mjs", root), "utf8");

describe("FULL-FLOW SELECT-only reconciliation runner", () => {
  it("pins the approved template and renders only a canonical cutover literal", () => {
    expect(APPROVED_TEMPLATE_SHA256).toBe(
      "0938D60388A67D668E47197EBE2CE4746FA95BCF72AEB2420C68E9586099ED7D",
    );
    const rendered = renderReconciliationSql(template, "2026-09-21T07:30:00+07:00");
    expect(rendered).not.toContain("__GISP_CUTOVER_AT__");
    expect(rendered.match(/2026-09-21T00:30:00\.000Z/g)).toHaveLength(12);
    expect(rendered).not.toMatch(/set_config\s*\(|current_setting\s*\(/i);
    expect(() => assertSelectOnly(rendered)).not.toThrow();
  });

  it("rejects altered templates, invalid calendar values and literal injection", () => {
    expect(() => renderReconciliationSql(`${template}\nSELECT 1;`, "2026-09-21T00:00:00Z"))
      .toThrow("RECONCILE_TEMPLATE_HASH_MISMATCH");
    expect(() => validateCutover("2026-02-30T00:00:00Z"))
      .toThrow("CUTOVER_MUST_BE_VALID_ISO_8601");
    expect(() => validateCutover("2026-09-21T00:00:00Z'; DROP TABLE x; --"))
      .toThrow("CUTOVER_MUST_BE_ISO_8601_WITH_TIMEZONE");
  });

  it("uses a guarded standard CLI read path without unrestricted or write SQL", () => {
    for (const argument of ['"@insforge/cli"', '"db"', '"query"', '"--json"']) {
      expect(runner).toContain(argument);
    }
    expect(runner).toContain('"--expected-project-id"');
    expect(runner).toContain("INSFORGE_PROJECT_ID_MISMATCH");
    expect(runner).toContain("SELECT_ONLY_RECONCILIATION");
    expect(runner).toContain("shell: false");
    expect(runner).not.toMatch(/cmd\.exe|ComSpec|npx\.cmd/i);
    expect(runner).not.toContain("--unrestricted");
    expect(runner).not.toMatch(/\bdb\s+(migration|exec|apply)\b/i);
  });

  it("preserves the complete long multiline SQL argument through a shell-free process", () => {
    const rendered = renderReconciliationSql(template, "2026-09-21T00:00:00Z");
    expect(rendered.length).toBeGreaterThan(8_000);
    expect(rendered.split("\n").length).toBeGreaterThan(200);
    const stub = "const {createHash}=require('node:crypto');const sql=process.argv[5];process.stdout.write(JSON.stringify({prefix:process.argv.slice(1,5),suffix:process.argv.slice(6),length:sql.length,lines:sql.split('\\n').length,hash:createHash('sha256').update(sql).digest('hex')}))";
    const output = runCli(process.cwd(), rendered, {
      executable: process.execPath,
      prefixArguments: ["-e", stub, "--"],
    });
    const captured = JSON.parse(output);
    expect(captured.prefix).toEqual(["-y", "@insforge/cli", "db", "query"]);
    expect(captured.suffix).toEqual(["--json"]);
    expect(captured.length).toBe(rendered.length);
    expect(captured.lines).toBe(rendered.split("\n").length);
    expect(captured.hash).toBe(createHash("sha256").update(rendered).digest("hex"));
  });

  it("resolves npx without a Windows command shim", () => {
    expect(resolveNpxTransport({ platform: "linux" })).toEqual({
      executable: "npx",
      prefixArguments: [],
    });
    if (process.platform === "win32") {
      const transport = resolveNpxTransport();
      expect(transport.executable).toBe(process.execPath);
      expect(transport.prefixArguments).toHaveLength(1);
      expect(transport.prefixArguments[0]).toMatch(/npx-cli\.js$/i);
    }
  });
});
