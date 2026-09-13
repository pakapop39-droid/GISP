import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveCatalogNavigation, resolveCatalogProductSelection } from "../../../lib/catalog/catalog-navigation";

const targetProductId = "11111111-1111-4111-8111-111111111111";

describe("Catalog pricing deep link", () => {
  it("maps query navigation to the pricing tab and requested Product", async () => {
    const navigation = resolveCatalogNavigation({ productId: targetProductId, tab: "pricing" });
    expect(navigation).toEqual({ initialTab: "pricing", initialProductId: targetProductId });
    expect(resolveCatalogProductSelection(targetProductId, [{ id: "22222222-2222-4222-8222-222222222222" }, { id: targetProductId }])).toBe(targetProductId);
    const page = readFileSync(join(process.cwd(), "src/app/admin/catalog/page.tsx"), "utf8");
    const workspace = readFileSync(join(process.cwd(), "src/components/catalog-workspace.tsx"), "utf8");
    expect(page).toContain("resolveCatalogNavigation(query)");
    expect(workspace).toContain("useState<Tab>(initialTab)");
    expect(workspace).toContain("useState(initialProductId)");
  });

  it("preserves the existing Supplier/default-Product behavior without a valid deep link", async () => {
    expect(resolveCatalogNavigation({ productId: "not-a-uuid" })).toEqual({ initialTab: "suppliers", initialProductId: "" });
    expect(resolveCatalogProductSelection("", [{ id: "first" }, { id: "second" }])).toBe("first");
  });
});
