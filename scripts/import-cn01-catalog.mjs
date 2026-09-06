import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { createAdminClient } from "@insforge/sdk";
import { FileBlob, SpreadsheetFile } from "file:///C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workDir = path.join(root, "tmp", "catalog-import-cn01");
const manifestPath = path.join(workDir, "cn01-import-manifest.json");
const uploadStatePath = path.join(workDir, "cn01-upload-state.json");
const importSqlPath = path.join(workDir, "cn01-import.sql");
const rollbackSqlPath = path.join(workDir, "cn01-rollback.sql");
const reportPath = path.join(root, "outputs", "catalog-import-cn01", "cn01-import-report.json");
const dryRunPath = path.join(root, "outputs", "catalog-import-cn01", "gisp-catalog-import-dry-run-cn01.xlsx");
const extractedPath = path.join(root, ".codex-tmp", "catalog-cn01-import-source-v1");
const creatorId = "4f406b57-8156-4df5-abcd-2dbdd1e06e83";
const sourceMime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const mode = process.argv[2] ?? "prepare";

await fs.mkdir(workDir, { recursive: true });
await fs.mkdir(path.dirname(reportPath), { recursive: true });

const text = (value) => String(value ?? "").trim();
const q = (value) => value === null || value === undefined ? "NULL" : `'${String(value).replaceAll("'", "''")}'`;
const n = (value) => value === null || value === undefined || value === "" ? "NULL" : String(Number(value));
const j = (value) => `${q(JSON.stringify(value))}::jsonb`;

function must(result, label) {
  if (result?.error) throw new Error(`${label}: ${result.error.message ?? JSON.stringify(result.error)}`);
  return result?.data ?? result;
}

async function loadProject() {
  const project = JSON.parse(await fs.readFile(path.join(root, ".insforge", "project.json"), "utf8"));
  if (project.project_name !== "slice-2-catalog" || project.branched_from?.project_name !== "gisp-mvp-development") {
    throw new Error(`BRANCH_GUARD: expected slice-2-catalog, got ${project.project_name}`);
  }
  return project;
}

function categoryResolution(excelRow, code, name) {
  const overrides = new Map([
    [149, ["EQUIPMENT", "อุปกรณ์/รถเข็น"]],
    [153, ["EQUIPMENT", "อุปกรณ์/รถเข็น"]],
    [383, ["CHAIR_STOOL", "เก้าอี้/สตูล"]],
    [591, ["CHAIR_STOOL", "เก้าอี้/สตูล"]],
    [592, ["CHAIR_STOOL", "เก้าอี้/สตูล"]],
    [649, ["CHAIR_STOOL", "เก้าอี้/สตูล"]],
    [650, ["TABLE", "โต๊ะ"]],
    [696, ["DECORATIVE", "ของตกแต่ง/ประติมากรรม"]],
  ]);
  return overrides.get(excelRow) ?? [code, name];
}

function resolvedName(excelRow, original) {
  const overrides = new Map([
    [161, `${original} — ซีรีส์ Dora (ขนาด 3250 มม.)`],
    [219, `${original} — ซีรีส์ 凝砂 / เกล็ดหิมะ (ชุดหลายขนาด)`],
    [237, `${original} — ผิวหินหลุมเหลือง UV`],
    [238, `${original} — ผิวขาวน้ำนมปลา UV`],
    [473, `${original} — ซีรีส์ GD097`],
    [529, `${original} — ซีรีส์ ZEUS`],
    [650, "โต๊ะข้างทรงแจกัน YCJ-T002"],
    [696, "ประติมากรรมม้าขนาดกลาง DY2020"],
  ]);
  return overrides.get(excelRow) ?? original;
}

function firstDimensions(spec) {
  const match = text(spec).match(/(\d{2,4})\s*[*×xX]\s*(\d{2,4})\s*[*×xX]\s*(\d{2,4})/);
  return match ? { width: Number(match[1]), depth: Number(match[2]), height: Number(match[3]) } : { width: null, depth: null, height: null };
}

function attr(fragment, name) {
  return fragment.match(new RegExp(`${name}="([^"]+)"`))?.[1] ?? null;
}

async function imageMap() {
  const drawingFile = path.join(extractedPath, "xl", "drawings", "drawing1.xml");
  const relsFile = path.join(extractedPath, "xl", "drawings", "_rels", "drawing1.xml.rels");
  const drawing = await fs.readFile(drawingFile, "utf8");
  const rels = await fs.readFile(relsFile, "utf8");
  const targets = new Map();
  for (const match of rels.matchAll(/<Relationship\b([^>]+)\/?\s*>/g)) {
    const id = attr(match[1], "Id");
    const target = attr(match[1], "Target");
    if (id && target) targets.set(id, target);
  }
  const rows = new Map();
  const anchors = drawing.match(/<xdr:(?:twoCellAnchor|oneCellAnchor)[\s\S]*?<\/xdr:(?:twoCellAnchor|oneCellAnchor)>/g) ?? [];
  for (const anchor of anchors) {
    const row = Number(anchor.match(/<xdr:from>[\s\S]*?<xdr:row>(\d+)<\/xdr:row>/)?.[1]);
    const relId = anchor.match(/r:embed="([^"]+)"/)?.[1];
    const target = targets.get(relId);
    if (!Number.isInteger(row) || !target || rows.has(row)) continue;
    const filePath = path.resolve(path.dirname(drawingFile), target.replaceAll("/", path.sep));
    rows.set(row, filePath);
  }
  return { rows, anchors: anchors.length, uniqueTargets: new Set(rows.values()).size };
}

async function readSheetRows(workbook, sheetName, range, requiredColumns) {
  return workbook.worksheets.getItem(sheetName).getRange(range).values
    .filter((row) => row.slice(0, requiredColumns).some((value) => text(value)));
}

async function preflightDatabase(admin) {
  const suppliers = must(await admin.database.from("suppliers").select("id,code").eq("code", "CN01"), "read CN01 supplier");
  const categories = must(await admin.database.from("categories").select("id,code").in("code", ["SOFA","MATTRESS","CHAIR_STOOL","TABLE","CABINET","BED","EQUIPMENT","DECORATIVE"]), "read CN01 categories");
  const products = must(await admin.database.from("products").select("id,sku").like("sku", "CN01-%"), "read CN01 products");
  const jobs = must(await admin.database.from("file_metadata").select("id,object_key").like("object_key", "catalog-imports/cn01/%"), "read CN01 files");
  if (suppliers.length || categories.length || products.length || jobs.length) {
    throw new Error(`PREFLIGHT_COLLISION: suppliers=${suppliers.length}, categories=${categories.length}, products=${products.length}, files=${jobs.length}`);
  }
}

async function prepare() {
  const project = await loadProject();
  const admin = createAdminClient({ baseUrl: project.oss_host, apiKey: project.api_key });
  await preflightDatabase(admin);

  const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(dryRunPath));
  const productRows = await readSheetRows(workbook, "Products Preview", "A2:Q724", 17);
  const variantRows = await readSheetRows(workbook, "Variants", "A2:K1000", 11);
  const optionRows = await readSheetRows(workbook, "Options", "A2:I1200", 9);
  const images = await imageMap();
  if (productRows.length !== 723 || variantRows.length !== 729 || optionRows.length !== 965) {
    throw new Error(`SOURCE_COUNT_MISMATCH: products=${productRows.length}, variants=${variantRows.length}, options=${optionRows.length}`);
  }
  if (images.rows.size !== 723 || images.anchors < 723) {
    throw new Error(`IMAGE_MAP_MISMATCH: mapped=${images.rows.size}, anchors=${images.anchors}`);
  }

  const jobId = randomUUID();
  const supplierId = randomUUID();
  const sourceFileId = randomUUID();
  const categoryDefs = [
    ["SOFA", "โซฟา", "Sofa"], ["MATTRESS", "ฟูก/ที่นอน", "Mattress"],
    ["CHAIR_STOOL", "เก้าอี้/สตูล", "Chair & Stool"], ["TABLE", "โต๊ะ", "Table"],
    ["CABINET", "ตู้", "Cabinet"], ["BED", "เตียง", "Bed"],
    ["EQUIPMENT", "อุปกรณ์/รถเข็น", "Equipment"],
    ["DECORATIVE", "ของตกแต่ง/ประติมากรรม", "Decorative & Sculpture"],
  ].map(([code, nameTh, nameEn], index) => ({ id: randomUUID(), code, nameTh, nameEn, sortOrder: (index + 1) * 10 }));
  const categoryIds = Object.fromEntries(categoryDefs.map((item) => [item.code, item.id]));

  const variantsByProduct = new Map();
  for (const row of variantRows) {
    const productSku = text(row[2]);
    const list = variantsByProduct.get(productSku) ?? [];
    list.push({
      id: randomUUID(), sku: text(row[3]), name: text(row[4]), width: Number(row[5]), depth: Number(row[6]),
      height: Number(row[7]), status: "ACTIVE", specification: text(row[10]),
    });
    variantsByProduct.set(productSku, list);
  }
  const optionsByProduct = new Map();
  for (const row of optionRows) {
    const productSku = text(row[2]);
    const list = optionsByProduct.get(productSku) ?? [];
    list.push(text(row[4]));
    optionsByProduct.set(productSku, list);
  }

  const products = [];
  for (const row of productRows) {
    const excelRow = Number(row[0]);
    const sourceId = text(row[1]);
    const sku = text(row[2]);
    const originalName = text(row[4]);
    const [categoryCode, categoryName] = categoryResolution(excelRow, text(row[5]), text(row[6]));
    const spec = text(row[16]);
    const imagePath = images.rows.get(excelRow - 1);
    const stat = await fs.stat(imagePath);
    const ext = path.extname(imagePath).toLowerCase();
    const mime = ext === ".png" ? "image/png" : "image/jpeg";
    const optionValues = [...(optionsByProduct.get(sku) ?? [])];
    if (excelRow === 684 && !optionValues.includes("สีขาว")) optionValues.push("สีขาว");
    if (excelRow === 173) optionValues.length = 0;
    const dims = firstDimensions(spec);
    products.push({
      id: randomUUID(), importRowId: randomUUID(), imageFileId: randomUUID(), mediaId: randomUUID(),
      excelRow, sourceId, sku, model: text(row[3]), originalName, name: resolvedName(excelRow, originalName),
      categoryCode, categoryName, categoryId: categoryIds[categoryCode], factoryCost: Number(row[7]),
      factoryCurrency: "CNY", status: "DRAFT", specification: spec,
      productType: excelRow === 149 || excelRow === 153 ? "EQUIPMENT" : excelRow === 696 ? "DECORATIVE" : "STANDARD",
      finishSummary: excelRow === 173 ? "ตามภาพ" : excelRow === 684 ? "สีขาว" : null,
      ...dims, variants: variantsByProduct.get(sku) ?? [],
      option: optionValues.length ? { id: randomUUID(), name: "สี/วัสดุ", values: optionValues.map((label) => ({ id: randomUUID(), label })) } : null,
      image: { path: imagePath, ext: ext === ".png" ? "png" : "jpg", mime, size: stat.size },
    });
  }

  const allSkus = [...products.map((item) => item.sku), ...products.flatMap((item) => item.variants.map((variant) => variant.sku))];
  const categoryProblems = products.filter((item) => !item.categoryId || item.categoryCode === "REVIEW");
  const invalidCosts = products.filter((item) => !Number.isFinite(item.factoryCost) || item.factoryCost < 0);
  const oversizedImages = products.filter((item) => item.image.size <= 0 || item.image.size > 10485760);
  const optionValueCount = products.reduce((sum, item) => sum + (item.option?.values.length ?? 0), 0);
  if (new Set(allSkus).size !== allSkus.length || categoryProblems.length || invalidCosts.length || oversizedImages.length || optionValueCount !== 966) {
    throw new Error(`MANIFEST_INVALID: uniqueSkus=${new Set(allSkus).size}/${allSkus.length}, categories=${categoryProblems.length}, costs=${invalidCosts.length}, images=${oversizedImages.length}, optionValues=${optionValueCount}`);
  }

  const manifest = {
    version: 1, preparedAt: new Date().toISOString(), branch: project.project_name, jobId, supplierId, sourceFileId,
    creatorId, source: { path: dryRunPath, mime: sourceMime, size: (await fs.stat(dryRunPath)).size },
    categories: categoryDefs, products,
    counts: { products: products.length, variants: variantRows.length, productOptions: products.filter((item) => item.option).length, optionValues: optionValueCount, images: products.length, resolvedRules: 16, sourceImageFiles: images.uniqueTargets },
  };
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  await fs.writeFile(reportPath, JSON.stringify({ phase: "PREPARED", ...manifest.counts, jobId, branch: manifest.branch, databaseWrites: 0, storageWrites: 0 }, null, 2));
  console.log(JSON.stringify({ phase: "PREPARED", jobId, ...manifest.counts }));
}

async function upload() {
  const project = await loadProject();
  const admin = createAdminClient({ baseUrl: project.oss_host, apiKey: project.api_key });
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  await preflightDatabase(admin);
  const prefix = `catalog-imports/cn01/${manifest.jobId}`;
  const uploaded = [];
  const sourceBytes = await fs.readFile(manifest.source.path);
  const sourceFile = new File([sourceBytes], path.basename(manifest.source.path), { type: manifest.source.mime });
  const sourceKey = `${prefix}/source/${sourceFile.name}`;
  const sourceStored = must(await admin.storage.from("gisp-confidential").upload(sourceKey, sourceFile), "upload import source");
  uploaded.push(sourceStored.key ?? sourceKey);
  const state = { jobId: manifest.jobId, prefix, source: { key: sourceStored.key ?? sourceKey, url: sourceStored.url ?? null }, products: [], uploadedKeys: uploaded };

  const concurrency = 6;
  let cursor = 0;
  async function worker() {
    while (true) {
      const index = cursor++;
      if (index >= manifest.products.length) return;
      const product = manifest.products[index];
      const bytes = await fs.readFile(product.image.path);
      const file = new File([bytes], `${product.sku}-primary.${product.image.ext}`, { type: product.image.mime });
      const key = `${prefix}/products/${product.sku}/primary.${product.image.ext}`;
      const stored = must(await admin.storage.from("gisp-confidential").upload(key, file), `upload ${product.sku}`);
      state.products[index] = { sku: product.sku, key: stored.key ?? key, url: stored.url ?? null };
      state.uploadedKeys.push(stored.key ?? key);
      if ((index + 1) % 50 === 0 || index + 1 === manifest.products.length) console.log(`UPLOAD_PROGRESS ${index + 1}/${manifest.products.length}`);
    }
  }
  try {
    await Promise.all(Array.from({ length: concurrency }, () => worker()));
    if (state.products.filter(Boolean).length !== manifest.products.length) throw new Error("UPLOAD_COUNT_MISMATCH");
    await fs.writeFile(uploadStatePath, JSON.stringify(state, null, 2));
    await fs.writeFile(reportPath, JSON.stringify({ phase: "UPLOADED", ...manifest.counts, jobId: manifest.jobId, branch: manifest.branch, databaseWrites: 0, storageWrites: state.uploadedKeys.length }, null, 2));
    console.log(JSON.stringify({ phase: "UPLOADED", files: state.uploadedKeys.length, bytes: manifest.products.reduce((sum, item) => sum + item.image.size, manifest.source.size) }));
  } catch (error) {
    console.error(`UPLOAD_FAILED: ${error.message}`);
    for (const key of state.uploadedKeys.reverse()) {
      try { await admin.storage.from("gisp-confidential").remove(key); } catch { /* best-effort cleanup */ }
    }
    throw error;
  }
}

function insertBatches(table, columns, rows, batchSize = 100) {
  const statements = [];
  for (let index = 0; index < rows.length; index += batchSize) {
    statements.push(`INSERT INTO public.${table}(${columns.join(",")}) VALUES\n${rows.slice(index, index + batchSize).map((row) => `(${row.join(",")})`).join(",\n")};`);
  }
  return statements.join("\n\n");
}

async function generateSql() {
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  const uploads = JSON.parse(await fs.readFile(uploadStatePath, "utf8"));
  if (manifest.jobId !== uploads.jobId || uploads.products.length !== manifest.products.length) throw new Error("UPLOAD_STATE_MISMATCH");
  const uploadBySku = new Map(uploads.products.map((item) => [item.sku, item]));
  const sourceName = path.basename(manifest.source.path);
  const products = manifest.products;
  const sql = [];
  sql.push("BEGIN;");
  sql.push(insertBatches("suppliers", ["id","code","name","country_code","default_currency","internal_note","status"], [[q(manifest.supplierId),q("CN01"),q("China Supplier 01"),q("CN"),q("CNY"),q("ข้อมูล Supplier ภายในสำหรับ Catalog Import CN01"),q("ACTIVE")]]));
  sql.push(insertBatches("categories", ["id","code","name_th","name_en","status","sort_order"], manifest.categories.map((item) => [q(item.id),q(item.code),q(item.nameTh),q(item.nameEn),q("ACTIVE"),n(item.sortOrder)])));
  sql.push(insertBatches("file_metadata", ["id","bucket","object_key","url","original_name","mime_type","size_bytes","visibility","entity_type","entity_id","uploaded_by"], [[q(manifest.sourceFileId),q("gisp-confidential"),q(uploads.source.key),q(uploads.source.url),q(sourceName),q(manifest.source.mime),n(manifest.source.size),q("CONFIDENTIAL"),q("CATALOG_IMPORT"),q(manifest.jobId),q(manifest.creatorId)]]));
  sql.push(insertBatches("catalog_import_jobs", ["id","source_file_id","source_type","status","total_rows","valid_rows","invalid_rows","created_by","started_at","completed_at"], [[q(manifest.jobId),q(manifest.sourceFileId),q("XLSX"),q("IMPORTING"),n(products.length),n(products.length),"0",q(manifest.creatorId),"NOW()","NULL"]]));
  sql.push(insertBatches("products", ["id","supplier_id","category_id","sku","product_type","name_th","description_th","specification_summary","factory_cost","factory_currency","internal_note","status","created_by","factory_sku","country_code","width_mm","depth_mm","height_mm","finish_summary","source_catalog_page","qa_status","supplier_product_code","source_row_number","source_specification_raw"], products.map((item) => [q(item.id),q(manifest.supplierId),q(item.categoryId),q(item.sku),q(item.productType),q(item.name),q(item.name),q(item.specification),n(item.factoryCost),q(item.factoryCurrency),q("นำเข้าจาก Supplier CN01 เป็น Draft; ต้นทุนและข้อมูล Supplier เป็นข้อมูลภายใน"),q("DRAFT"),q(manifest.creatorId),q(item.model || item.sourceId),q("CN"),n(item.width),n(item.depth),n(item.height),q(item.finishSummary),q(`Excel row ${item.excelRow}`),q("NOT_REVIEWED"),q(item.sourceId),n(item.excelRow),q(item.specification)])));
  const variants = products.flatMap((product) => product.variants.map((variant) => [q(variant.id),q(product.id),q(variant.sku),q(variant.name),q(variant.specification),"NULL",q(variant.status),q(variant.sku.replace(`${product.sku}-`, `${product.sourceId}-`)),n(variant.width),n(variant.depth),n(variant.height)]));
  sql.push(insertBatches("product_variants", ["id","product_id","sku","name","specification_summary","factory_cost","status","factory_sku","width_mm","depth_mm","height_mm"], variants));
  const productOptions = products.filter((item) => item.option).map((item) => [q(item.option.id),q(item.id),q(item.option.name),"FALSE","10"]);
  const optionValues = products.flatMap((item) => item.option ? item.option.values.map((value, index) => [q(value.id),q(item.option.id),q(value.label),"0","0",q("ACTIVE"),n((index + 1) * 10)]) : []);
  sql.push(insertBatches("product_options", ["id","product_id","name","is_required","sort_order"], productOptions));
  sql.push(insertBatches("product_option_values", ["id","option_id","label","member_price_delta","factory_cost_delta","status","sort_order"], optionValues));
  sql.push(insertBatches("file_metadata", ["id","bucket","object_key","url","original_name","mime_type","size_bytes","visibility","entity_type","entity_id","uploaded_by"], products.map((item) => { const stored=uploadBySku.get(item.sku); return [q(item.imageFileId),q("gisp-confidential"),q(stored.key),q(stored.url),q(`${item.sku}-primary.${item.image.ext}`),q(item.image.mime),n(item.image.size),q("CONFIDENTIAL"),q("PRODUCT_MEDIA"),q(item.id),q(manifest.creatorId)]; })));
  sql.push(insertBatches("product_media", ["id","product_id","file_id","media_type","is_primary","sort_order"], products.map((item) => [q(item.mediaId),q(item.id),q(item.imageFileId),q("IMAGE"),"TRUE","10"])));
  sql.push(insertBatches("catalog_import_rows", ["id","import_job_id","row_number","source_data","validation_status","product_id"], products.map((item) => [q(item.importRowId),q(manifest.jobId),n(item.excelRow),j({ sourceRow: item.excelRow, sourceId: item.sourceId, sku: item.sku, originalName: item.originalName, normalizedName: item.name, rawSpecification: item.specification, factoryCost: item.factoryCost, factoryCurrency: item.factoryCurrency, category: item.categoryCode, approvedRuleSet: "CN01-2026-08-19" }),q("IMPORTED"),q(item.id)])));
  sql.push(`UPDATE public.catalog_import_jobs SET status='COMPLETED', completed_at=NOW() WHERE id=${q(manifest.jobId)};`);
  sql.push(insertBatches("audit_events", ["actor_user_id","entity_type","entity_id","action","after_data"], [[q(manifest.creatorId),q("catalog_import_job"),q(manifest.jobId),q("CATALOG_IMPORT_COMPLETED"),j({ supplierCode: "CN01", status: "COMPLETED", ...manifest.counts })]]));
  sql.push("COMMIT;");
  await fs.writeFile(importSqlPath, `${sql.join("\n\n")}\n`);

  const rollback = `BEGIN;\nINSERT INTO public.audit_events(actor_user_id,entity_type,entity_id,action,after_data) VALUES (${q(manifest.creatorId)},'catalog_import_job',${q(manifest.jobId)},'CATALOG_IMPORT_ROLLBACK',${j({ supplierCode: "CN01" })});\nDELETE FROM public.catalog_import_jobs WHERE id=${q(manifest.jobId)};\nDELETE FROM public.products WHERE supplier_id=${q(manifest.supplierId)};\nDELETE FROM public.file_metadata WHERE object_key LIKE ${q(`${uploads.prefix}/%`)};\nDELETE FROM public.categories WHERE id IN (${manifest.categories.map((item) => q(item.id)).join(",")});\nDELETE FROM public.suppliers WHERE id=${q(manifest.supplierId)};\nCOMMIT;\n`;
  await fs.writeFile(rollbackSqlPath, rollback);
  console.log(JSON.stringify({ phase: "SQL_GENERATED", sqlBytes: (await fs.stat(importSqlPath)).size, rollbackBytes: (await fs.stat(rollbackSqlPath)).size, rows: { products: products.length, variants: variants.length, options: productOptions.length, optionValues: optionValues.length, files: products.length + 1 } }));
}

async function cleanupStorage() {
  const project = await loadProject();
  const admin = createAdminClient({ baseUrl: project.oss_host, apiKey: project.api_key });
  const state = JSON.parse(await fs.readFile(uploadStatePath, "utf8"));
  for (const key of [...state.uploadedKeys].reverse()) must(await admin.storage.from("gisp-confidential").remove(key), `remove ${key}`);
  console.log(JSON.stringify({ phase: "STORAGE_CLEANED", files: state.uploadedKeys.length }));
}

async function insertRows(admin, table, rows, batchSize = 100) {
  for (let index = 0; index < rows.length; index += batchSize) {
    must(await admin.database.from(table).insert(rows.slice(index, index + batchSize)), `insert ${table} ${index + 1}-${Math.min(index + batchSize, rows.length)}`);
  }
}

async function rollbackDatabase(admin, manifest, uploads) {
  const steps = [
    ["catalog_import_jobs", () => admin.database.from("catalog_import_jobs").delete().eq("id", manifest.jobId)],
    ["products", () => admin.database.from("products").delete().eq("supplier_id", manifest.supplierId)],
    ["file_metadata", () => admin.database.from("file_metadata").delete().like("object_key", `${uploads.prefix}/%`)],
    ["categories", () => admin.database.from("categories").delete().in("id", manifest.categories.map((item) => item.id))],
    ["suppliers", () => admin.database.from("suppliers").delete().eq("id", manifest.supplierId)],
  ];
  const failures = [];
  for (const [label, action] of steps) {
    const result = await action();
    if (result?.error) failures.push(`${label}: ${result.error.message ?? JSON.stringify(result.error)}`);
  }
  if (failures.length) throw new Error(`ROLLBACK_FAILED: ${failures.join(" | ")}`);
}

async function importWithAdminSdk() {
  const project = await loadProject();
  const admin = createAdminClient({ baseUrl: project.oss_host, apiKey: project.api_key });
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  const uploads = JSON.parse(await fs.readFile(uploadStatePath, "utf8"));
  await preflightDatabase(admin);
  const uploadBySku = new Map(uploads.products.map((item) => [item.sku, item]));
  const products = manifest.products;
  const startedAt = new Date().toISOString();
  try {
    await insertRows(admin, "suppliers", [{ id: manifest.supplierId, code: "CN01", name: "China Supplier 01", country_code: "CN", default_currency: "CNY", internal_note: "ข้อมูล Supplier ภายในสำหรับ Catalog Import CN01", status: "ACTIVE" }]);
    await insertRows(admin, "categories", manifest.categories.map((item) => ({ id: item.id, code: item.code, name_th: item.nameTh, name_en: item.nameEn, status: "ACTIVE", sort_order: item.sortOrder })));
    await insertRows(admin, "file_metadata", [{ id: manifest.sourceFileId, bucket: "gisp-confidential", object_key: uploads.source.key, url: uploads.source.url, original_name: path.basename(manifest.source.path), mime_type: manifest.source.mime, size_bytes: manifest.source.size, visibility: "CONFIDENTIAL", entity_type: "CATALOG_IMPORT", entity_id: manifest.jobId, uploaded_by: manifest.creatorId }]);
    await insertRows(admin, "catalog_import_jobs", [{ id: manifest.jobId, source_file_id: manifest.sourceFileId, source_type: "XLSX", status: "IMPORTING", total_rows: products.length, valid_rows: products.length, invalid_rows: 0, created_by: manifest.creatorId, started_at: startedAt }]);
    console.log("DB_PROGRESS foundation 1/8");

    await insertRows(admin, "products", products.map((item) => ({
      id: item.id, supplier_id: manifest.supplierId, category_id: item.categoryId, sku: item.sku, product_type: item.productType,
      name_th: item.name, description_th: item.name, specification_summary: item.specification, factory_cost: item.factoryCost,
      factory_currency: item.factoryCurrency, internal_note: "นำเข้าจาก Supplier CN01 เป็น Draft; ต้นทุนและข้อมูล Supplier เป็นข้อมูลภายใน",
      status: "DRAFT", created_by: manifest.creatorId, factory_sku: item.model || item.sourceId, country_code: "CN",
      width_mm: item.width, depth_mm: item.depth, height_mm: item.height, finish_summary: item.finishSummary,
      source_catalog_page: `Excel row ${item.excelRow}`, qa_status: "NOT_REVIEWED", supplier_product_code: item.sourceId,
      source_row_number: item.excelRow, source_specification_raw: item.specification,
    })), 50);
    console.log("DB_PROGRESS products 2/8");

    await insertRows(admin, "product_variants", products.flatMap((product) => product.variants.map((variant) => ({
      id: variant.id, product_id: product.id, sku: variant.sku, name: variant.name, specification_summary: variant.specification,
      factory_cost: null, status: variant.status, factory_sku: variant.sku.replace(`${product.sku}-`, `${product.sourceId}-`),
      width_mm: variant.width, depth_mm: variant.depth, height_mm: variant.height,
    }))));
    await insertRows(admin, "product_options", products.filter((item) => item.option).map((item) => ({ id: item.option.id, product_id: item.id, name: item.option.name, is_required: false, sort_order: 10 })));
    await insertRows(admin, "product_option_values", products.flatMap((item) => item.option ? item.option.values.map((value, index) => ({ id: value.id, option_id: item.option.id, label: value.label, member_price_delta: 0, factory_cost_delta: 0, status: "ACTIVE", sort_order: (index + 1) * 10 })) : []));
    console.log("DB_PROGRESS variants-options 3/8");

    await insertRows(admin, "file_metadata", products.map((item) => {
      const stored = uploadBySku.get(item.sku);
      return { id: item.imageFileId, bucket: "gisp-confidential", object_key: stored.key, url: stored.url, original_name: `${item.sku}-primary.${item.image.ext}`, mime_type: item.image.mime, size_bytes: item.image.size, visibility: "CONFIDENTIAL", entity_type: "PRODUCT_MEDIA", entity_id: item.id, uploaded_by: manifest.creatorId };
    }), 50);
    console.log("DB_PROGRESS image-metadata 4/8");
    await insertRows(admin, "product_media", products.map((item) => ({ id: item.mediaId, product_id: item.id, file_id: item.imageFileId, media_type: "IMAGE", is_primary: true, sort_order: 10 })));
    console.log("DB_PROGRESS product-media 5/8");

    await insertRows(admin, "catalog_import_rows", products.map((item) => ({
      id: item.importRowId, import_job_id: manifest.jobId, row_number: item.excelRow,
      source_data: { sourceRow: item.excelRow, sourceId: item.sourceId, sku: item.sku, originalName: item.originalName, normalizedName: item.name, rawSpecification: item.specification, factoryCost: item.factoryCost, factoryCurrency: item.factoryCurrency, category: item.categoryCode, approvedRuleSet: "CN01-2026-08-19" },
      validation_status: "IMPORTED", product_id: item.id,
    })), 50);
    console.log("DB_PROGRESS import-rows 6/8");

    must(await admin.database.from("catalog_import_jobs").update({ status: "COMPLETED", completed_at: new Date().toISOString() }).eq("id", manifest.jobId), "complete import job");
    await insertRows(admin, "audit_events", [{ actor_user_id: manifest.creatorId, entity_type: "catalog_import_job", entity_id: manifest.jobId, action: "CATALOG_IMPORT_COMPLETED", after_data: { supplierCode: "CN01", status: "COMPLETED", ...manifest.counts } }]);
    console.log("DB_PROGRESS completed 8/8");
    await fs.writeFile(reportPath, JSON.stringify({ phase: "IMPORTED", ...manifest.counts, jobId: manifest.jobId, branch: manifest.branch, databaseWrites: { supplier: 1, categories: manifest.categories.length, products: products.length, variants: manifest.counts.variants, productOptions: manifest.counts.productOptions, optionValues: manifest.counts.optionValues, fileMetadata: products.length + 1, productMedia: products.length, importRows: products.length, importErrors: 0 }, storageWrites: uploads.uploadedKeys.length }, null, 2));
    console.log(JSON.stringify({ phase: "IMPORTED", jobId: manifest.jobId, ...manifest.counts }));
  } catch (error) {
    console.error(`DATABASE_IMPORT_FAILED: ${error.message}`);
    await rollbackDatabase(admin, manifest, uploads);
    console.error("DATABASE_ROLLBACK_COMPLETED");
    throw error;
  }
}

async function rollbackDatabaseMode() {
  const project = await loadProject();
  const admin = createAdminClient({ baseUrl: project.oss_host, apiKey: project.api_key });
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  const uploads = JSON.parse(await fs.readFile(uploadStatePath, "utf8"));
  await rollbackDatabase(admin, manifest, uploads);
  console.log(JSON.stringify({ phase: "DATABASE_ROLLED_BACK", jobId: manifest.jobId }));
}

async function verifyStorage() {
  const project = await loadProject();
  const admin = createAdminClient({ baseUrl: project.oss_host, apiKey: project.api_key });
  const state = JSON.parse(await fs.readFile(uploadStatePath, "utf8"));
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  const checks = [state.source, state.products[0], state.products[Math.floor(state.products.length / 2)], state.products.at(-1)];
  const listed = must(await admin.storage.from("gisp-confidential").list({ prefix: state.prefix, limit: 1000, offset: 0 }), "list import objects");
  const objects = Array.isArray(listed) ? listed : listed.objects ?? listed.files ?? listed.data ?? [];
  const objectKeys = new Set(objects.map((item) => item.key ?? item.name ?? item.path).filter(Boolean));
  const missing = state.uploadedKeys.filter((key) => !objectKeys.has(key));
  if (objects.length !== state.uploadedKeys.length || missing.length) throw new Error(`STORAGE_LIST_MISMATCH: listed=${objects.length}, expected=${state.uploadedKeys.length}, missing=${missing.length}`);
  const signed = must(await admin.storage.from("gisp-confidential").createSignedUrls(checks.map((item) => item.key), 300), "sign sample objects");
  const signedOk = signed.filter((item) => item.signedUrl && !item.error).length;
  if (signedOk !== checks.length) throw new Error(`SIGNED_URL_MISMATCH: ${signedOk}/${checks.length}`);
  console.log(JSON.stringify({ phase: "STORAGE_VERIFIED", listedFiles: objects.length, signedSamples: signedOk, sourceBytes: manifest.source.size }));
}

if (mode === "prepare") await prepare();
else if (mode === "upload") await upload();
else if (mode === "generate-sql") await generateSql();
else if (mode === "import-sdk") await importWithAdminSdk();
else if (mode === "rollback-db-sdk") await rollbackDatabaseMode();
else if (mode === "verify-storage") await verifyStorage();
else if (mode === "cleanup-storage") await cleanupStorage();
else throw new Error(`Unknown mode: ${mode}`);
