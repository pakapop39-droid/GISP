import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

const root = new URL("../../release-candidates/full-flow-go-live-01/emergency/", import.meta.url);
const read = (name: string) => readFileSync(new URL(name, root), "utf8");
const normalize = (value: string) => value.replace(/\r\n?/g, "\n");
const compact = (value: string) => value.replace(/--.*$/gm, "").replace(/\s+/g, " ").trim();
const functionDefinition = (source: string, name: string) => {
  const match = normalize(source).match(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${name}\\([\\s\\S]*?\\n\\$\\$;`));
  expect(match?.[0], name).toBeTruthy();
  return match?.[0] ?? "";
};
const expected = [
  ["function-snapshot.sql", "4BDFD8773DEDC668A019AA462D4AECAA65E4259B0D8C00E73ABC253B65E0ADC9"],
  ["reconcile.sql", "0938D60388A67D668E47197EBE2CE4746FA95BCF72AEB2420C68E9586099ED7D"],
  ["resume-c.sql", "E783FC27044CCA9E0A39B6BCA0D54FA296C05CC918552EBD90918EF834D0AC25"],
  ["resume-d10.sql", "363C60C76687829D36E61FE42C264EFA812AD2205DC5D1AB9F342D16C37F048C"],
  ["resume-d7.sql", "98CC941A83DB6EAE077DACEAD8B4EBB01CB36FE6B9E7A38C600594D7DD8DA3E7"],
  ["resume-d8.sql", "DDED3302186D562FC2A0E6D29C23412724F5E55FC5000D900D82E8F14C32D61A"],
  ["resume-d9.sql", "CDEA0786BDC272645741782E5DF1D1FF6C2277735BC930F6150F9031BB4A185F"],
  ["stop-c.sql", "079F8AF1F7AC57E262896BCC754781DB23D1E64894AA177501A77F506269BF8D"],
  ["stop-d10.sql", "02133352788813B22BBDE127AF2A24D7DB0899BE16D9933D4CF06000DB6B9654"],
  ["stop-d7.sql", "293AC4984FA4A6AB4285526CD9A3DE0F167665735DE7A015185DA71E315D795B"],
  ["stop-d8.sql", "0515AA486F7A9F3B10DF38BE50B48F9CA59C68706C65E96ED1D687D739E002D8"],
  ["stop-d9.sql", "DF117BDA42A5A8DE36399862C20EBB0AF8C8630F4622E443643C65B69432F981"],
] as const;
const runnerExpected = [
  "run-reconcile.mjs",
  "7D0F755274CC09828EDBD6BFFEEB0AD3A38304878CAE5A56982C75D5900C6B84",
] as const;

describe("FULL-FLOW exact-candidate emergency package", () => {
  it("pins all SQL hashes in the candidate emergency manifest", () => {
    expect(readdirSync(root).filter((name) => name.endsWith(".sql")).sort())
      .toEqual(expected.map(([name]) => name));
    const manifest = read("README.md");
    for (const [name, expectedHash] of expected) {
      const bytes = normalize(read(name)).trimEnd();
      const actual = createHash("sha256").update(Buffer.from(bytes, "utf8")).digest("hex").toUpperCase();
      expect(actual, name).toBe(expectedHash);
      expect(manifest).toContain(`\`${name}\``);
      expect(manifest).toContain(`\`${expectedHash}\``);
    }
    const runnerBytes = normalize(read(runnerExpected[0])).trimEnd();
    const runnerHash = createHash("sha256").update(Buffer.from(runnerBytes, "utf8")).digest("hex").toUpperCase();
    expect(runnerHash).toBe(runnerExpected[1]);
    expect(manifest).toContain(`\`${runnerExpected[0]}\``);
    expect(manifest).toContain(`\`${runnerExpected[1]}\``);
  });

  it("stops every new project-admin financial executor fail closed", () => {
    const stop = read("stop-c.sql");
    for (const signature of [
      "verify_payment_transfer_private(UUID,BOOLEAN,TEXT,TEXT,UUID,TEXT,BIGINT)",
      "create_payment_adjustment_private(UUID,TEXT,NUMERIC,TEXT,TEXT)",
      "review_payment_adjustment_private(UUID,BOOLEAN,TEXT,TEXT)",
      "recalculate_customer_payment_schedule(UUID,UUID,UUID)",
      "confirm_payment_workflow_hold_private(UUID,TEXT,TEXT,TEXT)",
      "payment_adjustment_actor(TEXT,UUID)",
      "payment_hold_actor(TEXT,UUID,TEXT)",
    ]) {
      expect(compact(stop)).toContain(`REVOKE ALL ON FUNCTION public.${signature} FROM PUBLIC,anon,authenticated,project_admin`);
    }
    expect(stop.match(/EMERGENCY_WRITE_DISABLED/g)).toHaveLength(6);
    expect(compact(stop)).not.toMatch(/\bGRANT\b/i);
  });

  it("restores exact pre-C bodies and exact post-D Freight-aware bodies", () => {
    const pre = readFileSync(new URL("../../migrations/20260920092500_full-flow-financial-controls-pre-c.sql", import.meta.url), "utf8");
    const post = readFileSync(new URL("../../migrations/20260920093000_full-flow-financial-controls.sql", import.meta.url), "utf8");
    const resumeC = read("resume-c.sql");
    const resumeD8 = read("resume-d8.sql");
    for (const name of [
      "verify_payment_transfer_private",
      "recalculate_customer_payment_schedule",
      "create_payment_adjustment_private",
      "review_payment_adjustment_private",
      "confirm_payment_workflow_hold_private",
    ]) {
      expect(functionDefinition(resumeC, name), `${name} pre-C body`)
        .toBe(functionDefinition(pre, name));
    }
    for (const name of ["recalculate_customer_payment_schedule", "confirm_payment_workflow_hold_private"]) {
      expect(functionDefinition(resumeD8, name), `${name} post-D body`)
        .toBe(functionDefinition(post, name));
    }
    expect(resumeC).toContain("GRANT EXECUTE ON FUNCTION public.payment_adjustment_actor(TEXT,UUID) TO project_admin");
    expect(resumeC).toContain("GRANT EXECUTE ON FUNCTION public.payment_hold_actor(TEXT,UUID,TEXT) TO project_admin");
  });

  it("snapshots exactly the 60 routines touched by stop files", () => {
    const snapshot = read("function-snapshot.sql");
    const targetBlock = snapshot.match(/WITH target\(signature\) AS \([\s\S]*?\n\), resolved AS \(/)?.[0] ?? "";
    const targets = [...targetBlock.matchAll(/\('([^']+)'\)/g)].map((match) => match[1].toLowerCase());
    const stopped = ["stop-c.sql", "stop-d7.sql", "stop-d8.sql", "stop-d9.sql", "stop-d10.sql"]
      .flatMap((name) => [...read(name).matchAll(/REVOKE ALL ON FUNCTION (public\.[^(]+\([^;]*\))/g)]
        .map((match) => match[1].toLowerCase().replaceAll("timestamptz", "timestamp with time zone")));
    expect(targets).toHaveLength(60);
    expect(new Set(targets).size).toBe(60);
    expect(new Set(stopped).size).toBe(60);
    expect(targets.slice().sort()).toEqual([...new Set(stopped)].sort());
    expect(snapshot).toMatch(/expected_count = 60 AND actual_count = expected_count/);
  });

  it("keeps reconciliation SELECT-only and covers adjustment/hold no-write deltas", () => {
    const reconcile = compact(read("reconcile.sql"));
    expect(reconcile).toContain("payment_adjustments");
    expect(reconcile).toContain("payment_workflow_holds");
    expect(reconcile.match(/__GISP_CUTOVER_AT__/g)).toHaveLength(12);
    expect(reconcile).not.toMatch(/set_config\s*\(|current_setting\s*\(/i);
    expect(reconcile).not.toMatch(/\b(INSERT|UPDATE|DELETE|TRUNCATE|CREATE|ALTER|DROP|GRANT|REVOKE|SET)\b/i);
    expect(reconcile).not.toMatch(/\bLOCK\b|\bFOR\s+(UPDATE|SHARE)\b/i);
  });

  it("removes the custom maintenance GUC from every exact-candidate emergency artifact", () => {
    for (const name of [...expected.map(([file]) => file), runnerExpected[0]]) {
      expect(read(name), name).not.toMatch(/set_config\s*\(|current_setting\s*\(/i);
    }
  });
});
