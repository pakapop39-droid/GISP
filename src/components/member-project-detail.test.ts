import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const component = readFileSync(join(process.cwd(), "src/components/member-project-detail.tsx"), "utf8");
const route = readFileSync(join(process.cwd(), "src/app/api/member/projects/[id]/route.ts"), "utf8");

describe("member project current catalog image", () => {
  it("adds a signed current image only after the member-scoped project and items load", () => {
    expect(route.indexOf("projectResult.data")).toBeLessThan(route.indexOf("signedMemberProductMedia(productIds)"));
    expect(route).toContain("image_url:item.product_id?");
    expect(route).toContain("media.get(item.product_id)?.[0]?.url??null");
  });

  it("renders the image and a safe placeholder", () => {
    expect(component).toContain("item.image_url?<img");
    expect(component).toContain("ไม่มีรูปสินค้า");
  });
});
