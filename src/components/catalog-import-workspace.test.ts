import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const unifiedWorkspace = read("src/components/catalog-import-workspace.tsx");
const finishPanel = read("src/components/finish-import-panel.tsx");
const finishWorkspace = read("src/components/finish-library-workspace.tsx");
const navigation = read("src/components/production-shell.tsx");

describe("Unified Catalog Import v1.1 UI contract", () => {
  it("uses one primary entry with explicit product and finish choices", () => {
    expect(unifiedWorkspace).toContain("นำเข้า Catalog");
    expect(unifiedWorkspace).toContain("ข้อมูลสินค้า");
    expect(unifiedWorkspace).toContain("คลังสีและผิวสำเร็จ");
    expect(unifiedWorkspace).toContain("<FinishImportPanel");
    expect(navigation).toContain('label:"นำเข้า Catalog"');
  });

  it("keeps product history product-specific and links imported rows only when product_id exists", () => {
    expect(unifiedWorkspace).toContain("ประวัติ Import สินค้าล่าสุด");
    expect(unifiedWorkspace).toContain("row.validation_status === \"IMPORTED\" && row.product_id");
    expect(unifiedWorkspace).toContain("เปิด Product Draft");
  });

  it("keeps finish import stateless in the UI and out of the advanced library workspace", () => {
    expect(finishPanel).toContain("/api/admin/catalog/finishes/import");
    expect(finishPanel).not.toMatch(/Import history|ประวัติ Import/);
    expect(finishWorkspace).not.toContain("/api/admin/catalog/finishes/import");
    expect(finishWorkspace).toContain("กลับไปนำเข้า Catalog");
  });

  it("clears stale selections when import kind, supplier, or file changes", () => {
    expect(unifiedWorkspace).toContain("setFile(null)");
    expect(unifiedWorkspace).toContain("setDetail(null)");
    expect(finishPanel).toContain("setPreview(undefined)");
    expect(finishPanel).toContain("setFileInputKey");
  });

  it("captures the swatch form before awaiting upload and safely resets that reference", () => {
    const handler = finishWorkspace.slice(
      finishWorkspace.indexOf("async function uploadSwatch"),
      finishWorkspace.indexOf("const collectionById"),
    );
    expect(handler).toContain("const formElement = event.currentTarget");
    expect(handler).toContain("new FormData(formElement)");
    expect(handler).toContain("formElement.reset()");
    expect(handler).not.toContain("event.currentTarget.reset()");
    expect(handler.indexOf("const formElement")).toBeLessThan(handler.indexOf("await requestJson"));
  });
});
