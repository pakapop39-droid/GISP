import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Release C application organization-scope contract", () => {
  it.each([
    "src/app/api/admin/custom-requests/route.ts",
    "src/app/api/admin/custom-quotations/route.ts",
    "src/app/api/admin/custom-quotations/options/route.ts",
    "src/lib/orders/server.ts",
  ])("filters privileged list/detail loaders in %s", (path) => {
    const source = read(path);
    expect(source).toContain("organizationScope");
    expect(source).toContain("organization_id");
  });

  it.each([
    "src/app/api/admin/custom-requests/[id]/files/[fileId]/route.ts",
    "src/app/api/files/[id]/download/route.ts",
    "src/app/api/files/route.ts",
    "src/lib/custom-quotation/server.ts",
    "src/app/api/admin/supplier-payments/[id]/mark-paid/route.ts",
  ])("checks the target organization before privileged file/cost/payment access in %s", (path) => {
    const source = read(path);
    const target = source.indexOf("organization_id");
    const permission = source.indexOf("assertOrganizationPermission");
    expect(target).toBeGreaterThan(-1);
    expect(permission).toBeGreaterThan(-1);
    expect(source.lastIndexOf("assertOrganizationPermission")).toBeGreaterThan(target);
  });
});
