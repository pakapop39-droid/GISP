import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

const root = new URL("../../release-candidates/full-flow-go-live-01/", import.meta.url);
const manifest = readFileSync(new URL("CANDIDATE-MANIFEST.md", root), "utf8");

const allowList = [
  ["20260920010000_pay-close-legacy-entry.sql", "638E76E102E05E9F03CCB93357B74DC496DB50E398DE030C0A057F3021D73993"],
  ["20260920010100_pay-evidence-binding.sql", "01D0786DE19094572467E2DCAEB347E3FD6D672D91146B596643A54D185DEA1B"],
  ["20260920010200_pay-private-executor.sql", "448A6A37BCB13372BEAA9CEE59EF01E5B9D4F4436DE2C6F7208030233E511CF7"],
  ["20260920010250_release-c-org-scope-hardening.sql", "A0757E88DC351F361E89AD0048158E8F89D064D5A9B1FC0BA953E2A587DB7D8E"],
  ["20260920010275_full-flow-financial-controls-pre-c.sql", "E3A63E271CC9DD3DBAB4430DA497F0938EED01FF6182556D3EFA558553B78939"],
  ["20260920010300_release-c-privileges.sql", "4120E34C2CD7B590DFD4FF671FD9AF57DBD5601B45441B8920751AC9220F0593"],
  ["20260920010400_d7-qc-reopen-prerequisite.sql", "7D250449DF315AA100F929AC5499333DA3719D5AEFADC616A88981B1EBD463C1"],
  ["20260920010500_release-d7-privileges.sql", "403D71930043C356BB0A61CD6ABF704EF247C5FD4CE1F70F7A8262C95D17D309"],
  ["20260920010600_d8-consolidation-prerequisite.sql", "E6E97E5949598C443278ABC878E7853802367A84ACA50AA7E339B86F0635D135"],
  ["20260920010700_d8-customs-prerequisite.sql", "7A5075F3455B146F3A74983AB37A4D14C3691D618AAC0A02D30D572629F42D69"],
  ["20260920010800_release-d8-privileges.sql", "832C2E55B87355BA498758C33E3C410200AADFFC103D892A11F2FF66D02841B7"],
  ["20260920010900_d8-freight-payment-enable.sql", "DC2A9008FB506AF84EF1591A1420F632045778FA6907A8EACDC899C3D2FBE00A"],
  ["20260920011000_release-d9-privileges.sql", "A032E91BA8734345C9AD02FD3D11E113B9B43625214C106015576F1CA090D0FF"],
  ["20260920011100_release-d10-privileges.sql", "2B687DEF1689F317D9090E0B139F219E2A54CF916DC28D6AD111149F5F941451"],
  ["20260920011200_full-flow-sourcing-scope-hardening.sql", "F5754D8BC1A9BDDD9A11E8C48F4203CCF99564B32E73908062EA14760B74CD7F"],
  ["20260920011300_full-flow-financial-controls.sql", "8B1C2AD186958A1E80249ADDA9AA6BF03F9C7815690E42977FF80CC131084D69"],
].map(([file, hash]) => ({ file, hash }));

describe("FULL-FLOW-GO-LIVE-01 local candidate package", () => {
  it("pins the exact migration allow-list hashes recorded in the manifest", () => {
    expect(allowList).toHaveLength(16);
    expect(readdirSync(new URL("migrations/", root)).sort()).toEqual(allowList.map((item) => item.file));
    for (const item of allowList) {
      const bytes = readFileSync(new URL(`migrations/${item.file}`, root));
      const hash = createHash("sha256").update(bytes).digest("hex").toUpperCase();
      expect(hash).toBe(item.hash);
      expect(manifest).toContain(item.file);
      expect(manifest).toContain(item.hash);
    }
  });

  it("installs the pre-C safeguard before restoring Release C privileges", () => {
    const names = allowList.map((item) => item.file);
    expect(names.indexOf("20260920010200_pay-private-executor.sql")).toBeLessThan(names.indexOf("20260920010250_release-c-org-scope-hardening.sql"));
    expect(names.indexOf("20260920010250_release-c-org-scope-hardening.sql")).toBeLessThan(names.indexOf("20260920010275_full-flow-financial-controls-pre-c.sql"));
    expect(names.indexOf("20260920010275_full-flow-financial-controls-pre-c.sql")).toBeLessThan(names.indexOf("20260920010300_release-c-privileges.sql"));
    expect(names.indexOf("20260920011100_release-d10-privileges.sql")).toBeLessThan(names.indexOf("20260920011300_full-flow-financial-controls.sql"));
    expect(manifest).toContain("Never use `up --all`");
  });

  it("records the local-only authority boundaries", () => {
    expect(manifest).toContain("Production allowed:** `No`");
    expect(manifest).toContain("No migration was applied");
    expect(manifest).toContain("No deployment or Production");
  });
});
