import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe,expect,it } from "vitest";
const read=(path:string)=>readFileSync(join(process.cwd(),path),"utf8");
const routes={export:read("src/app/api/admin/catalog/imports/[id]/enrichment/export/route.ts"),upload:read("src/app/api/admin/catalog/imports/[id]/enrichment/uploads/route.ts"),preview:read("src/app/api/admin/catalog/imports/[id]/enrichment/[batchId]/route.ts"),details:read("src/app/api/admin/catalog/imports/[id]/enrichment/[batchId]/apply-details/route.ts"),costs:read("src/app/api/admin/catalog/imports/[id]/enrichment/[batchId]/apply-costs/route.ts"),cancel:read("src/app/api/admin/catalog/imports/[id]/enrichment/[batchId]/cancel/route.ts")};
describe("Catalog enrichment API contract",()=>{
  it("gates every endpoint with the default-off feature flag",()=>{for(const source of Object.values(routes))expect(source).toContain("isCatalogExcelRoundtripEnabled")});
  it("uses the approved permission split",()=>{expect(routes.export).toContain('permissions:["catalog.import"]');expect(routes.upload).toContain('permissions:["catalog.import"]');expect(routes.preview).toContain('permissions:["catalog.import"]');expect(routes.details).toContain('permissions:["catalog.import","catalog.manage"]');expect(routes.costs).toContain('permissions:["catalog.import","catalog.cost.manage"]');expect(routes.cancel).toContain('permissions:["catalog.import"]');});
  it("validates URL IDs, input schemas and cross-job batch linkage",()=>{for(const source of Object.values(routes))expect(source).toContain("z.uuid()");expect(routes.details).toContain("enrichmentApplySchema.safeParse");expect(routes.costs).toContain("enrichmentApplySchema.safeParse");expect(routes.cancel).toContain("enrichmentCancelSchema.safeParse");for(const source of [routes.details,routes.costs,routes.cancel])expect(source).toContain("ensureEnrichmentBatchJob(id,batchId)");});
  it("redacts cost data unless catalog.cost.read",()=>{expect(routes.preview).toContain('context.permissions.includes("catalog.cost.read")');});
});
