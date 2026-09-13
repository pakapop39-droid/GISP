import "server-only";

import { createHash,randomUUID } from "node:crypto";
import { createInsForgeAdminClient } from "@/lib/insforge/admin";
import { buildCatalogEnrichmentWorkbook, parseCatalogEnrichmentWorkbook, type EnrichmentExportRow } from "@/lib/catalog/enrichment-xlsx";
import {
  CATALOG_EXCEL_MIME, CATALOG_EXCEL_SCHEMA_VERSION, CatalogExcelError, enrichmentDetailSchema,
  parseFactoryCost, parseOptionalNumber, productColumns, stableHash, summarizeEnrichmentStatuses,
} from "@/lib/catalog/excel-roundtrip";

type AccessContext = { userId: string; organizationId: string | null; permissions: string[] };
type Db = ReturnType<typeof createInsForgeAdminClient>["database"];
type SheetRow = Record<string, unknown>;
const exportableStatuses = ["READY_FOR_REVIEW", "COMPLETED", "COMPLETED_WITH_ISSUES"];
const requiredFields = new Set(["sku", "name_th", "product_type", "country_code"]);
const numericFields = new Set(["lead_time_days", "width_mm", "depth_mm", "height_mm", "weight_kg", "cbm", "moq"]);
function byteHash(bytes:Uint8Array){return createHash("sha256").update(bytes).digest("hex");}

function check<T>(result: { data: T; error?: unknown | null }): T {
  if (result.error) throw result.error;
  return result.data;
}

function scalar(value:unknown): string|number|null { return typeof value==="string"||typeof value==="number"?value:null; }
function numericScalar(value:unknown):number|null{if(value===null||value===undefined||value==="")return null;const number=Number(value);return Number.isFinite(number)?number:null;}
function normalizedDetail(source: Record<string, unknown>):Record<string,string|number|null> {
  return {
    sku: scalar(source.sku) ?? "", factory_sku: scalar(source.factory_sku), name_th: scalar(source.name_th) ?? scalar(source.name_th_draft) ?? "",
    name_en: scalar(source.name_en), name_zh: scalar(source.name_zh), product_type: scalar(source.product_type) ?? "",
    category_id: scalar(source.category_id), category_code: scalar(source.category_code), country_code: scalar(source.country_code) ?? "",
    lead_time_days: numericScalar(source.default_lead_time_days) ?? numericScalar(source.lead_time_days),
    width_mm: numericScalar(source.width_mm), depth_mm: numericScalar(source.depth_mm), height_mm: numericScalar(source.height_mm),
    weight_kg: numericScalar(source.weight_kg), cbm: numericScalar(source.cbm), material_summary: scalar(source.material_summary),
    finish_summary: scalar(source.finish_summary), moq: numericScalar(source.moq), description_th: scalar(source.description_th),
    specification_summary: scalar(source.specification_summary),
  };
}

async function audit(db: Db, actor: string, entityType: string, entityId: string, action: string, after: unknown) {
  const result = await db.from("audit_events").insert([{ actor_user_id: actor, entity_type: entityType, entity_id: entityId, action, after_data: after }]);
  if (result.error) throw result.error;
}

export async function createEnrichmentExport(jobId: string, context: AccessContext) {
  const admin = createInsForgeAdminClient(); const db = admin.database;
  const job = check(await db.from("catalog_import_jobs").select("id,source_type,status,file_name").eq("id", jobId).maybeSingle()) as Record<string, unknown> | null;
  if (!job) throw new CatalogExcelError("NOT_FOUND", "ไม่พบ Import Job");
  if (job.source_type !== "PDF" || !exportableStatuses.includes(String(job.status))) throw new CatalogExcelError("INVALID_TRANSITION", "สถานะงานนี้ยัง Export ไม่ได้");
  const sourceRows = check(await db.from("catalog_import_rows").select("*").eq("import_job_id", jobId).order("row_number").limit(1001)) as Record<string, unknown>[];
  if (!sourceRows.length) throw new CatalogExcelError("NOT_FOUND", "ไม่มีรายการสำหรับ Export");
  if(sourceRows.length>1000)throw new CatalogExcelError("XLSX_ROW_LIMIT","รองรับสูงสุด 1,000 รายการ");
  const productIds = sourceRows.map(row => row.product_id).filter(Boolean) as string[];
  const products = productIds.length ? check(await db.from("products").select("*").in("id", productIds)) as Record<string, unknown>[] : [];
  const productById = new Map(products.map(product => [String(product.id), product]));
  const categories = check(await db.from("categories").select("id,code").eq("status", "ACTIVE").order("sort_order").limit(500)) as { id: string; code: string }[];
  const categoryById = new Map(categories.map(category => [category.id, category.code]));
  const countries = check(await db.from("countries").select("code").eq("status", "ACTIVE").order("sort_order").limit(300)) as { code: string }[];
  const includeCosts = context.permissions.includes("catalog.cost.read");
  const costs = includeCosts && productIds.length ? check(await db.from("product_cost_versions").select("product_id,factory_cost,currency,exchange_rate_to_thb,effective_from,status").in("product_id", productIds).is("variant_id", null).eq("status", "ACTIVE")) as Record<string, unknown>[] : [];
  const costByProduct = new Map(costs.map(cost => [String(cost.product_id), cost]));
  const batchId = randomUUID(); const exportedAt = new Date().toISOString();
  const exportRows: EnrichmentExportRow[] = sourceRows.map(row => {
    const product = row.product_id ? productById.get(String(row.product_id)) : null;
    const detail = normalizedDetail(product ?? row);
    detail.category_code = detail.category_id ? categoryById.get(String(detail.category_id)) ?? null : null;
    const rawCost = product ? costByProduct.get(String(product.id)) ?? null : null;
    const cost=rawCost?{factory_cost:Number(rawCost.factory_cost),currency:String(rawCost.currency).trim(),exchange_rate_to_thb:Number(rawCost.exchange_rate_to_thb),effective_from:String(rawCost.effective_from),status:String(rawCost.status)}:null;
    const baselineDetail={...detail};delete baselineDetail.category_code;
    return { rowKey: randomUUID(), importRowId: String(row.id), productId: product ? String(product.id) : null, sourcePage: Number(row.source_page_number ?? row.row_number), detail, cost, baselineDetailHash: stableHash(baselineDetail), baselineCostHash: cost ? stableHash(cost) : null };
  });
  const workbook = buildCatalogEnrichmentWorkbook({ workbookId: batchId, jobId, exportedAt, rows: exportRows, categories: categories.map(item => item.code), countries: countries.map(item => item.code), includeCosts });
  const key = `catalog-enrichment/${jobId}/${batchId}/export.xlsx`;
  const uploaded = await admin.storage.from("gisp-confidential").upload(key, new File([workbook], `catalog-enrichment-${jobId}.xlsx`, { type: CATALOG_EXCEL_MIME }));
  if (uploaded.error || !uploaded.data) throw uploaded.error ?? new Error("UPLOAD_FAILED");
  const storage = uploaded.data as unknown as { key?: string; url?: string };
  const metadata = check(await db.from("file_metadata").insert([{ organization_id: context.organizationId, bucket: "gisp-confidential", object_key: storage.key ?? key, url: storage.url ?? null, original_name: `catalog-enrichment-${jobId}.xlsx`, mime_type: CATALOG_EXCEL_MIME, size_bytes: workbook.length, visibility: "CONFIDENTIAL", entity_type: "CATALOG_ENRICHMENT_EXPORT", entity_id: batchId, uploaded_by: context.userId }]).select("id").single()) as { id: string };
  const batchInsert=await db.from("catalog_import_enrichment_batches").insert([{ id: batchId, import_job_id: jobId, workbook_id: batchId, schema_version: CATALOG_EXCEL_SCHEMA_VERSION, status: "EXPORTED", export_file_id: metadata.id, export_sha256: byteHash(workbook), exported_with_costs: includeCosts, total_rows: exportRows.length, created_by: context.userId,exported_at:exportedAt }]);if(batchInsert.error)throw batchInsert.error;
  const staged = exportRows.map((row,index) => {const baseline={...row.detail};delete baseline.category_code;return ({ batch_id: batchId, row_key: row.rowKey, import_row_id: row.importRowId, product_id: row.productId, row_number:index+1, baseline_detail_hash: row.baselineDetailHash, baseline_cost_hash: row.baselineCostHash, baseline_detail: baseline, baseline_cost: row.cost, proposed_detail:{}, proposed_cost:null, detail_status: "UNCHANGED", cost_status: "UNCHANGED" });});
  const inserted = await db.from("catalog_import_enrichment_rows").insert(staged); if (inserted.error) throw inserted.error;
  await audit(db, context.userId, "catalog_import_enrichment_batch", batchId, "CATALOG_ENRICHMENT_EXPORTED", { jobId, rowCount: exportRows.length, includeCosts });
  return { bytes: workbook, batchId, filename: `catalog-enrichment-${String(job.file_name).replace(/\.pdf$/i, "")}.xlsx` };
}

function textChange(value: unknown, field: string) {
  if (value === null || value === undefined || String(value).trim() === "") return undefined;
  const text = String(value).trim();
  if (text === "#CLEAR") {
    if (requiredFields.has(field)) throw new CatalogExcelError("CLEAR_NOT_ALLOWED", `ห้ามล้าง ${field}`);
    return null;
  }
  return text;
}

function uniqueByRowKey(rows: SheetRow[], label: string) {
  const keys = rows.map(row => String(row.row_key ?? "").trim());
  if (keys.some(key => !key) || new Set(keys).size !== keys.length) throw new CatalogExcelError("DUPLICATE_OR_EMPTY_ROW_KEY", `${label} มี row_key ว่างหรือซ้ำ`);
  return new Map(rows.map(row => [String(row.row_key).trim(), row]));
}

export async function stageEnrichmentUpload(jobId: string, file: File, context: AccessContext) {
  const parsed = await parseCatalogEnrichmentWorkbook(file); const admin = createInsForgeAdminClient(); const db = admin.database;
  const products = uniqueByRowKey(parsed.productRows, "Products"); const costs = uniqueByRowKey(parsed.costRows, "Costs"); const meta = uniqueByRowKey(parsed.metaRows, "__Meta");
  const firstMeta = parsed.metaRows[0];
  if (!firstMeta || parsed.metaRows.some(row=>row.schema_version!==CATALOG_EXCEL_SCHEMA_VERSION||String(row.job_id)!==jobId||String(row.workbook_id)!==String(firstMeta.workbook_id))) throw new CatalogExcelError("WORKBOOK_TAMPERED", "Metadata ไม่ตรงกับงาน");
  const batchId = String(firstMeta.workbook_id); const batch = check(await db.from("catalog_import_enrichment_batches").select("*").eq("id", batchId).eq("import_job_id", jobId).maybeSingle()) as Record<string, unknown> | null;
  if (!batch) throw new CatalogExcelError("NOT_FOUND", "ไม่พบ Export batch");
  const job=check(await db.from("catalog_import_jobs").select("source_type,status").eq("id",jobId).maybeSingle()) as {source_type:string;status:string}|null;if(!job||job.source_type!=="PDF"||!exportableStatuses.includes(job.status))throw new CatalogExcelError("INVALID_TRANSITION","สถานะ PDF Import เปลี่ยนไปแล้ว");
  const stagedRows = check(await db.from("catalog_import_enrichment_rows").select("*").eq("batch_id", batchId).limit(1000)) as Record<string, unknown>[];
  const stagedByKey = new Map(stagedRows.map(row => [String(row.row_key), row]));
  for (const key of [...products.keys(), ...costs.keys(), ...meta.keys()]) if (!stagedByKey.has(key)) throw new CatalogExcelError("UNKNOWN_ROW_KEY", "พบแถวที่ไม่ได้มาจาก Workbook ต้นฉบับ");
  if(meta.size!==stagedByKey.size||[...stagedByKey.keys()].some(key=>!meta.has(key))||[...products.keys(),...costs.keys()].some(key=>!meta.has(key)))throw new CatalogExcelError("WORKBOOK_TAMPERED","__Meta ไม่ครบหรือไม่ตรงกับแถวข้อมูล");
  if(parsed.costRows.length&&!context.permissions.includes("catalog.cost.read"))throw new CatalogExcelError("PERMISSION_DENIED","ไม่มีสิทธิ์อ่านหรืออัปโหลดข้อมูลต้นทุน");
  if(parsed.hasCosts!==Boolean(batch.exported_with_costs))throw new CatalogExcelError("WORKBOOK_TAMPERED","โครงสร้าง Cost sheet ไม่ตรง Workbook ต้นฉบับ");
  for (const [key, metaRow] of meta) {
    const source = stagedByKey.get(key)!;
    if (String(metaRow.catalog_import_row_id) !== String(source.import_row_id) || String(metaRow.product_id ?? "") !== String(source.product_id ?? "") || String(metaRow.baseline_detail_hash) !== String(source.baseline_detail_hash) || String(metaRow.baseline_cost_hash ?? "") !== String(source.baseline_cost_hash ?? "")) throw new CatalogExcelError("WORKBOOK_TAMPERED", "Mapping หรือ baseline ถูกแก้ไข");
  }
  const categoryRows = check(await db.from("categories").select("id,code").eq("status", "ACTIVE").limit(500)) as { id: string; code: string }[];
  const categoryByCode = new Map(categoryRows.map(row => [row.code.toUpperCase(), row.id]));
  const countryRows = check(await db.from("countries").select("code").eq("status", "ACTIVE").limit(300)) as { code: string }[];
  const validCountries = new Set(countryRows.map(row => row.code.toUpperCase()));
  const currentImportRows=check(await db.from("catalog_import_rows").select("*").in("id",stagedRows.map(row=>row.import_row_id))) as Record<string,unknown>[];
  const currentImportById=new Map(currentImportRows.map(row=>[String(row.id),row]));
  const linkedIds=stagedRows.map(row=>row.product_id).filter(Boolean) as string[];
  const currentProducts=linkedIds.length?check(await db.from("products").select("*").in("id",linkedIds)) as Record<string,unknown>[]:[];
  const currentProductById=new Map(currentProducts.map(row=>[String(row.id),row]));
  const activeCosts=linkedIds.length?check(await db.from("product_cost_versions").select("product_id,factory_cost,currency,exchange_rate_to_thb,effective_from,status").in("product_id",linkedIds).is("variant_id",null).eq("status","ACTIVE")) as Record<string,unknown>[]:[];
  const activeCostByProduct=new Map(activeCosts.map(raw=>[String(raw.product_id),{factory_cost:Number(raw.factory_cost),currency:String(raw.currency).trim(),exchange_rate_to_thb:Number(raw.exchange_rate_to_thb),effective_from:String(raw.effective_from),status:String(raw.status)}]));
  const uploadHash = byteHash(parsed.bytes);
  if(batch.upload_sha256===uploadHash&&["READY_FOR_REVIEW","PARTIALLY_APPLIED","COMPLETED"].includes(String(batch.status)))return{batchId,summary:{readyDetails:Number(batch.ready_detail_rows??0),readyCosts:Number(batch.ready_cost_rows??0),invalid:Number(batch.invalid_rows??0),unchanged:0,waiting:0},idempotent:true};
  if(batch.status!=="EXPORTED")throw new CatalogExcelError("INVALID_TRANSITION","Workbook นี้เคยอัปโหลดแล้วและเนื้อหาไม่ตรงกัน");
  const key = `catalog-enrichment/${jobId}/${batchId}/upload-${uploadHash}.xlsx`;
  const uploaded = await admin.storage.from("gisp-confidential").upload(key, file); if (uploaded.error || !uploaded.data) throw uploaded.error ?? new Error("UPLOAD_FAILED");
  const storage = uploaded.data as unknown as { key?: string; url?: string };
  const metadata = check(await db.from("file_metadata").insert([{ organization_id: context.organizationId, bucket: "gisp-confidential", object_key: storage.key ?? key, url: storage.url ?? null, original_name: file.name, mime_type: CATALOG_EXCEL_MIME, size_bytes: file.size, visibility: "CONFIDENTIAL", entity_type: "CATALOG_ENRICHMENT_UPLOAD", entity_id: batchId, uploaded_by: context.userId }]).select("id").single()) as { id: string };
  let readyDetails=0, readyCosts=0, invalid=0, conflicts=0, unchanged=0, waiting=0;
  const skuCounts=new Map<string,number>();for(const row of stagedRows){const sheet=products.get(String(row.row_key));const sku=sheet?textChange(sheet.sku,"sku")??(row.baseline_detail as Record<string,unknown>).sku:(row.baseline_detail as Record<string,unknown>).sku;const key=String(sku??"").trim().toUpperCase();if(key)skuCounts.set(key,(skuCounts.get(key)??0)+1);}
  for (const [rowKey, sheet] of products) {
    const row = stagedByKey.get(rowKey)!; const before = row.baseline_detail as Record<string, unknown>; const proposed: Record<string, unknown> = {}; const errors: string[]=[];
    try {
      for (const field of productColumns.slice(2)) {
        const value = numericFields.has(field) ? parseOptionalNumber(sheet[field], field === "lead_time_days") : textChange(sheet[field], field);
        if (value !== undefined) proposed[field] = value;
      }
      if ("category_code" in proposed) { const code=String(proposed.category_code ?? "").toUpperCase(); proposed.category_id=code ? categoryByCode.get(code) ?? null : null; if (code&&!proposed.category_id) errors.push("CATEGORY_NOT_FOUND"); delete proposed.category_code; }
      if ("country_code" in proposed) { proposed.country_code=String(proposed.country_code).toUpperCase(); if(!validCountries.has(String(proposed.country_code))) errors.push("COUNTRY_NOT_FOUND"); }
      const after={...before,...proposed}; const result=enrichmentDetailSchema.safeParse(after); if(!result.success) errors.push(...result.error.issues.map(issue=>`${issue.path.join(".")}:${issue.message}`));
      const currentTarget=row.product_id?currentProductById.get(String(row.product_id)):currentImportById.get(String(row.import_row_id));const currentBaseline=currentTarget?normalizedDetail(currentTarget):null;if(currentBaseline)delete currentBaseline.category_code;
      const conflicted=!currentBaseline||stableHash(currentBaseline)!==stableHash(before);
      const sku=String(after.sku??"").toUpperCase();if((skuCounts.get(sku)??0)>1)errors.push("DUPLICATE_SKU_IN_WORKBOOK");
      let existingProductId:string|null=null;if (sku) { const collision=check(await db.from("products").select("id").ilike("sku",String(after.sku)).neq("id",row.product_id??"00000000-0000-0000-0000-000000000000").limit(1).maybeSingle()) as {id:string}|null; if(collision){existingProductId=collision.id;errors.push("DUPLICATE_SKU_IN_DATABASE");} }
      const diff=Object.fromEntries(Object.entries(proposed).filter(([field,value])=>stableHash(value)!==stableHash(before[field]))); const status=conflicted?"CONFLICT":errors.length?"INVALID":Object.keys(diff).length?"READY":"UNCHANGED";
      if(status==="READY")readyDetails++; else if(status==="INVALID")invalid++; else if(status==="CONFLICT")conflicts++; else unchanged++;
      const update=await db.from("catalog_import_enrichment_rows").update({ proposed_detail: proposed, detail_diff: diff, detail_status: status, error_codes: errors,existing_product_id:existingProductId }).eq("id",row.id); if(update.error)throw update.error;
    } catch(error) { invalid++; const update=await db.from("catalog_import_enrichment_rows").update({detail_status:"INVALID",error_codes:[error instanceof Error?error.message:"INVALID_DETAIL"]}).eq("id",row.id); if(update.error)throw update.error; }
  }
  for (const [rowKey, sheet] of costs) {
    const row=stagedByKey.get(rowKey)!; const values=[sheet.new_factory_cost,sheet.currency,sheet.exchange_rate_to_thb,sheet.effective_from]; if(values.every(value=>value===null||value===undefined||String(value).trim()==="")) continue;
    const errors:string[]=[]; let proposed:Record<string,unknown>={};
    try { const amount=parseFactoryCost(sheet.new_factory_cost); const rate=parseOptionalNumber(sheet.exchange_rate_to_thb); const currency=String(sheet.currency??"").trim().toUpperCase(); if(amount===undefined||rate===undefined||!/^[A-Z]{3}$/.test(currency))errors.push("COST_FIELDS_REQUIRED"); if(values.some(value=>String(value).trim()==="#CLEAR"))errors.push("CLEAR_NOT_ALLOWED");const effectiveRaw=sheet.effective_from instanceof Date?sheet.effective_from.toISOString():String(sheet.effective_from??"").trim();if(effectiveRaw&&!Number.isFinite(Date.parse(effectiveRaw)))errors.push("EFFECTIVE_FROM_INVALID"); proposed={factory_cost:amount,currency,exchange_rate_to_thb:rate,effective_from:effectiveRaw||null}; }
    catch(error){errors.push(error instanceof Error?error.message:"INVALID_COST");}
    const currentCost=row.product_id?activeCostByProduct.get(String(row.product_id))??null:null;const costConflict=stableHash(currentCost)!==stableHash(row.baseline_cost??null);
    const status=costConflict?"CONFLICT":errors.length?"INVALID":row.product_id?"READY":"WAITING_FOR_DRAFT"; if(status==="READY")readyCosts++; else if(status==="WAITING_FOR_DRAFT")waiting++; else if(status==="CONFLICT")conflicts++; else invalid++;
    const update=await db.from("catalog_import_enrichment_rows").update({proposed_cost:proposed,cost_diff:proposed,cost_status:status,error_codes:[...(Array.isArray(row.error_codes)?row.error_codes:[]),...errors]}).eq("id",row.id); if(update.error)throw update.error;
  }
  const finalStatuses=check(await db.from("catalog_import_enrichment_rows").select("detail_status,cost_status").eq("batch_id",batchId).limit(1000)) as Array<{detail_status:string;cost_status:string|null}>;
  ({readyDetails,readyCosts,invalid,conflicts,unchanged,waiting}=summarizeEnrichmentStatuses(finalStatuses));
  const updated=await db.from("catalog_import_enrichment_batches").update({status:"READY_FOR_REVIEW",upload_file_id:metadata.id,upload_sha256:uploadHash,uploaded_by:context.userId,uploaded_at:new Date().toISOString(),ready_detail_rows:readyDetails,ready_cost_rows:readyCosts,invalid_rows:invalid,conflict_rows:conflicts,unchanged_rows:unchanged,waiting_for_draft_rows:waiting}).eq("id",batchId); if(updated.error)throw updated.error;
  await audit(db,context.userId,"catalog_import_enrichment_batch",batchId,"CATALOG_ENRICHMENT_UPLOADED",{readyDetails,readyCosts,invalid,conflicts,unchanged,waiting});
  return {batchId,summary:{readyDetails,readyCosts,invalid,conflicts,unchanged,waiting}};
}

export async function getEnrichmentPreview(jobId:string,batchId:string,page:number,pageSize:number,canReadCosts:boolean){
  const db=createInsForgeAdminClient().database;
  const batch=check(await db.from("catalog_import_enrichment_batches").select("*").eq("id",batchId).eq("import_job_id",jobId).maybeSingle()) as Record<string,unknown>|null;
  if(!batch)throw new CatalogExcelError("NOT_FOUND","ไม่พบ Preview");
  const countResult=await db.from("catalog_import_enrichment_rows").select("id",{count:"exact",head:true}).eq("batch_id",batchId);if(countResult.error)throw countResult.error;
  const from=(page-1)*pageSize; const rows=check(await db.from("catalog_import_enrichment_rows").select("*").eq("batch_id",batchId).order("row_number",{ascending:true}).order("id",{ascending:true}).range(from,from+pageSize-1)) as Record<string,unknown>[];
  const redacted=canReadCosts?rows:rows.map(source=>{const row={...source};delete row.baseline_cost;delete row.proposed_cost;delete row.cost_diff;delete row.price_preview;return{...row,cost_status:null,error_codes:Array.isArray(row.error_codes)?row.error_codes.filter(code=>!/(COST|PRICE|CURRENCY|EXCHANGE|EFFECTIVE)/i.test(String(code))):[],warning_codes:Array.isArray(row.warning_codes)?row.warning_codes.filter(code=>!/(COST|PRICE|CURRENCY|EXCHANGE|EFFECTIVE)/i.test(String(code))):[]};});
  const total=countResult.count??Number(batch.row_count??rows.length);
  const visibleBatch=canReadCosts?batch:Object.fromEntries(Object.entries(batch).filter(([key])=>!["ready_cost_rows","waiting_for_draft_rows","exported_with_costs"].includes(key)));
  return {batch:visibleBatch,rows:redacted,pagination:{page,pageSize,total,totalPages:Math.max(1,Math.ceil(total/pageSize))}};
}

export async function ensureEnrichmentBatchJob(jobId:string,batchId:string){const db=createInsForgeAdminClient().database;const found=check(await db.from("catalog_import_enrichment_batches").select("id").eq("id",batchId).eq("import_job_id",jobId).maybeSingle());if(!found)throw new CatalogExcelError("NOT_FOUND","ไม่พบ Batch ใน Import Job นี้");}
