import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe,expect,it } from "vitest";
const ui=readFileSync(join(process.cwd(),"src/components/catalog-enrichment-panel.tsx"),"utf8");
const page=readFileSync(join(process.cwd(),"src/app/admin/catalog/imports/page.tsx"),"utf8");
describe("Catalog enrichment UI contract",()=>{it("shows export/upload, separate confirms, before/after diffs, pagination and price warning",()=>{for(const text of ["Export Excel","Upload Excel กลับ","ยืนยันรายละเอียดสินค้า","ยืนยันต้นทุน","Member Price","pagination.totalPages","baseline_detail","cost_diff","ก่อน","หลัง"])expect(ui).toContain(text);});it("passes independent cost permissions and feature flag",()=>{expect(page).toContain('catalog.cost.read');expect(page).toContain('catalog.cost.manage');expect(page).toContain('isCatalogExcelRoundtripEnabled()');});});
