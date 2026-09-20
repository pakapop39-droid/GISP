import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const packageJson = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
const packageLock = JSON.parse(readFileSync(new URL("../../package-lock.json", import.meta.url), "utf8"));
const manifest = readFileSync(new URL("../../release-candidates/full-flow-go-live-01/CANDIDATE-MANIFEST.md", import.meta.url), "utf8");

describe("FULL-FLOW-DEP-SEC-01 dependency contract", () => {
  it("pins only the approved direct dependency and override versions", () => {
    expect(packageJson.dependencies.next).toBe("16.3.5");
    expect(packageJson.devDependencies["eslint-config-next"]).toBe("16.3.5");
    expect(packageJson.dependencies.sharp).toBe("0.35.4");
    expect(packageJson.overrides.sharp).toBe("0.35.4");
    expect(packageJson.devDependencies.vitest).toBe("4.1.11");
  });

  it("resolves the exact approved lockfile versions", () => {
    const packages = packageLock.packages;
    expect(packages["node_modules/next"].version).toBe("16.3.5");
    expect(packages["node_modules/eslint-config-next"].version).toBe("16.3.5");
    expect(packages["node_modules/sharp"].version).toBe("0.35.4");
    expect(packages["node_modules/vitest"].version).toBe("4.1.11");
    expect(packages["node_modules/js-yaml"].version).toBe("4.3.2");
  });

  it("records the dependency gate without changing Production authority", () => {
    expect(manifest).toContain("FULL-FLOW-DEP-SEC-01 v0.1");
    expect(manifest).toContain("Production allowed:** `No`");
    expect(manifest).toContain("0 vulnerabilities");
  });
});
