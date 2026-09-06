import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createAdminClient } from "@insforge/sdk";
import pg from "pg";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(root, "outputs", "catalog-import-phase01-20260905", "gisp-import-manifest-722.json");
const uploadStatePath = path.join(root, "outputs", "catalog-import-phase01-20260905", "production-image-upload-state.ndjson");
const expectedProjectId = "db09b94e-fc37-4f90-9530-3289afef0b79";
const actorUserId = "0886e8c5-af8f-4ec1-b621-b7df2a2087f5";
const mode = process.argv[2] ?? "preflight";

function must(result, label) {
  if (result?.error) throw new Error(`${label}: ${result.error.message ?? JSON.stringify(result.error)}`);
  return result?.data ?? result;
}

function stableUuid(seed) {
  const bytes = createHash("sha256").update(seed).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function inBatches(items, size, fn) {
  const output = [];
  for (let index = 0; index < items.length; index += size) {
    output.push(...(await fn(items.slice(index, index + size))));
  }
  return output;
}

async function retry(label, fn, attempts = 4) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try { return await fn(); }
    catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, attempt * 750));
    }
  }
  throw new Error(`${label}: ${lastError?.message ?? lastError}`);
}

async function pool(items, concurrency, fn) {
  let cursor = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      await fn(items[index], index);
    }
  });
  await Promise.all(workers);
}

async function loadContext() {
  const project = JSON.parse(await fs.readFile(path.join(root, ".insforge", "project.json"), "utf8"));
  if (project.project_id !== expectedProjectId || project.project_name !== "gisp-mvp-development") {
    throw new Error(`PRODUCTION_GUARD_FAILED: ${project.project_id} ${project.project_name}`);
  }
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  if (manifest.products?.length !== 722 || manifest.counts?.images !== 3942) {
    throw new Error("MANIFEST_GUARD_FAILED");
  }
  const admin = createAdminClient({ baseUrl: project.oss_host, apiKey: project.api_key });
  const supplier = must(await admin.database.from("suppliers").select("id,code,status,default_currency").eq("code", "CN01").maybeSingle(), "read supplier");
  if (!supplier) throw new Error("SUPPLIER_CN01_NOT_FOUND");
  const products = must(await admin.database.from("products").select("id,sku,supplier_id,factory_cost,factory_currency").eq("supplier_id", supplier.id).order("sku").limit(1000), "read products");
  const expectedSkus = new Set(manifest.products.map((item) => item.sku));
  if (products.length !== 722 || products.some((item) => !expectedSkus.has(item.sku))) {
    throw new Error(`PRODUCT_GUARD_FAILED: found=${products.length}`);
  }
  return { project, manifest, admin, supplier, products, productBySku: new Map(products.map((item) => [item.sku, item])) };
}

function buildRelations(manifest, productBySku) {
  const variants = [];
  const options = [];
  const optionValues = [];
  const images = [];
  for (const item of manifest.products) {
    const product = productBySku.get(item.sku);
    if (!product) throw new Error(`PRODUCT_NOT_FOUND: ${item.sku}`);
    for (const variant of item.variants ?? []) {
      variants.push({
        id: stableUuid(`cn01:variant:${variant.variantSku}`), product_id: product.id,
        sku: variant.variantSku, name: variant.variantName,
        specification_summary: variant.rawSegment || null, factory_cost: variant.factoryCost,
        status: variant.status || "ACTIVE", factory_sku: variant.variantSku.replace(`${item.sku}-`, `${item.sourceCode}-`),
        width_mm: variant.widthMm, depth_mm: variant.depthMm, height_mm: variant.heightMm,
      });
    }
    const optionGroups = new Map();
    for (const option of item.options ?? []) {
      const list = optionGroups.get(option.optionName) ?? [];
      list.push(option);
      optionGroups.set(option.optionName, list);
    }
    let optionOrder = 0;
    for (const [optionName, values] of optionGroups) {
      optionOrder += 10;
      const optionId = stableUuid(`cn01:option:${item.sku}:${optionName}`);
      options.push({ id: optionId, product_id: product.id, name: optionName, is_required: values.some((value) => value.required === "YES"), sort_order: optionOrder, status: "ACTIVE" });
      values.forEach((value, index) => optionValues.push({
        id: stableUuid(`cn01:option-value:${item.sku}:${optionName}:${value.optionValue}`),
        option_id: optionId, label: value.optionValue,
        member_price_delta: value.memberPriceDelta ?? 0, factory_cost_delta: value.factoryCostDelta ?? 0,
        status: value.status || "ACTIVE", sort_order: (index + 1) * 10,
      }));
    }
    (item.images ?? []).forEach((image, index) => {
      const ext = path.extname(image.localRelativePath).toLowerCase().replace(".jpeg", ".jpg") || ".jpg";
      const fileId = stableUuid(`cn01:file:${item.sku}:${image.sha256}`);
      images.push({
        ...image, productId: product.id, productSku: item.sku, index,
        fileId, mediaId: stableUuid(`cn01:media:${item.sku}:${image.sha256}`),
        absolutePath: path.resolve(path.dirname(manifestPath), image.localRelativePath),
        key: `catalog/products/${product.id}/image/${String(index + 1).padStart(2, "0")}-${image.sha256.slice(0, 16)}${ext}`,
        mime: ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg",
      });
    });
  }
  return { variants, options, optionValues, images };
}

async function relationCounts(admin, products, relations) {
  const ids = products.map((item) => item.id);
  const variants = await inBatches(ids, 50, async (batch) => retry("read variants", async () => must(await admin.database.from("product_variants").select("id,product_id,sku").in("product_id", batch).limit(1000), "read variants")));
  const options = await inBatches(ids, 50, async (batch) => retry("read options", async () => must(await admin.database.from("product_options").select("id,product_id,name").in("product_id", batch).limit(1000), "read options")));
  const optionValues = options.length ? await inBatches(options.map((item) => item.id), 50, async (batch) => retry("read option values", async () => must(await admin.database.from("product_option_values").select("id,option_id,label").in("option_id", batch).limit(1000), "read option values"))) : [];
  const media = await inBatches(ids, 50, async (batch) => retry("read media", async () => must(await admin.database.from("product_media").select("id,product_id,file_id,is_primary").in("product_id", batch).limit(1000), "read media")));
  return { variants: variants.length, options: options.length, optionValues: optionValues.length, media: media.length, expected: { variants: relations.variants.length, options: relations.options.length, optionValues: relations.optionValues.length, media: relations.images.length } };
}

async function preflight() {
  const context = await loadContext();
  const relations = buildRelations(context.manifest, context.productBySku);
  const counts = await relationCounts(context.admin, context.products, relations);
  const files = await inBatches(relations.images, 250, async (batch) => Promise.all(batch.map(async (image) => {
    const stat = await fs.stat(image.absolutePath);
    if (stat.size !== Number(image.sizeBytes) || stat.size <= 0 || stat.size > 10 * 1024 * 1024) throw new Error(`IMAGE_FILE_INVALID: ${image.absolutePath}`);
    return stat.size;
  })));
  console.log(JSON.stringify({ phase: "PREFLIGHT_OK", supplier: context.supplier, products: context.products.length, relations: counts, images: { count: files.length, bytes: files.reduce((sum, value) => sum + value, 0) } }, null, 2));
}

async function insertRows(admin, table, rows, size = 100) {
  for (let index = 0; index < rows.length; index += size) {
    const label = `insert ${table} ${index + 1}-${Math.min(index + size, rows.length)}`;
    await retry(label, async () => must(await admin.database.from(table).insert(rows.slice(index, index + size)), label), 5);
  }
}

async function enrich() {
  const context = await loadContext();
  const relations = buildRelations(context.manifest, context.productBySku);
  const before = await relationCounts(context.admin, context.products, relations);
  for (const key of ["variants", "options", "optionValues"]) {
    if (before[key] !== 0 && before[key] !== before.expected[key]) throw new Error(`PARTIAL_RELATION_STATE: ${key}=${before[key]}/${before.expected[key]}`);
  }
  await pool(context.manifest.products, 4, async (item, index) => {
    const product = context.productBySku.get(item.sku);
    await retry(`update product ${item.sku}`, async () => must(await context.admin.database.from("products").update({
        factory_cost: item.factoryCost, factory_currency: item.factoryCurrency,
        supplier_product_code: item.sourceCode, source_row_number: item.excelRow,
        source_specification_raw: item.catalog.specification_summary || null,
        internal_note: "นำเข้าจาก Supplier CN01 เป็น Draft; ต้นทุนและข้อมูล Supplier เป็นข้อมูลภายใน",
      }).eq("id", product.id), `update product ${item.sku}`), 6);
    if ((index + 1) % 100 === 0 || index + 1 === context.manifest.products.length) console.log(`PRODUCT_PROGRESS ${index + 1}/722`);
  });
  if (before.variants === 0) await insertRows(context.admin, "product_variants", relations.variants);
  if (before.options === 0) await insertRows(context.admin, "product_options", relations.options);
  if (before.optionValues === 0) await insertRows(context.admin, "product_option_values", relations.optionValues);
  await insertRows(context.admin, "audit_events", [{
    actor_user_id: actorUserId, entity_type: "catalog_import_job", entity_id: "bb91aa4c-1784-48c6-b666-0f31ebfff351",
    action: "CATALOG_ENRICHMENT_COMPLETED", after_data: { supplierCode: "CN01", products: 722, factoryCosts: 722, variants: relations.variants.length, productOptions: relations.options.length, optionValues: relations.optionValues.length },
  }]);
  const after = await relationCounts(context.admin, context.products, relations);
  console.log(JSON.stringify({ phase: "ENRICHMENT_OK", before, after }, null, 2));
}

async function activateSupplier() {
  const context = await loadContext();
  if (context.supplier.status === "ACTIVE") {
    console.log(JSON.stringify({ phase: "SUPPLIER_ACTIVE", changed: false }));
    return;
  }
  if (!new Set(["PROSPECT", "INACTIVE", "SUSPENDED"]).has(context.supplier.status)) {
    throw new Error(`SUPPLIER_STATUS_INVALID: ${context.supplier.status}`);
  }
  await retry("activate supplier CN01", async () => must(await context.admin.database.from("suppliers").update({ status: "ACTIVE", suspended_reason: null }).eq("id", context.supplier.id), "activate supplier CN01"));
  await insertRows(context.admin, "audit_events", [{
    actor_user_id: actorUserId, entity_type: "supplier", entity_id: context.supplier.id,
    action: "ACTIVATED", before_data: context.supplier, after_data: { status: "ACTIVE" },
  }]);
  console.log(JSON.stringify({ phase: "SUPPLIER_ACTIVE", changed: true }));
}

async function runBatchAsActor(action, productIds, payload = {}) {
  const connectionOutput = execFileSync(
    "cmd.exe",
    ["/d", "/s", "/c", "npx -y @insforge/cli db connection-string"],
    { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  const connectionString = connectionOutput.match(/postgres(?:ql)?:\/\/\S+/)?.[0]?.trim();
  if (!connectionString) throw new Error("DATABASE_CONNECTION_STRING_NOT_FOUND");
  const client = new pg.Client({ connectionString });
  await client.connect();
  let result;
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ sub: actorUserId, role: "authenticated" }),
    ]);
    const response = await client.query(
      "SELECT public.run_catalog_batch($1, $2::uuid[], $3::jsonb) AS result",
      [action, productIds, JSON.stringify(payload)],
    );
    result = response.rows[0]?.result;
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
  return result;
}

async function createDefaultVariants() {
  if (!process.argv.includes("--approved-production-update")) {
    throw new Error("PRODUCTION_UPDATE_APPROVAL_FLAG_REQUIRED");
  }
  const context = await loadContext();
  const productIds = context.products.map((item) => item.id);
  const activeVariants = await inBatches(productIds, 50, async (batch) =>
    retry("read active variants", async () => must(
      await context.admin.database.from("product_variants")
        .select("product_id")
        .in("product_id", batch)
        .eq("status", "ACTIVE")
        .limit(1000),
      "read active variants",
    )),
  );
  const activeProductIds = new Set(activeVariants.map((item) => item.product_id));
  const selectedProductIds = productIds.filter((id) => !activeProductIds.has(id));
  if (selectedProductIds.length !== 438) {
    throw new Error(`DEFAULT_VARIANT_SELECTION_GUARD_FAILED: ${selectedProductIds.length}`);
  }
  const result = await runBatchAsActor("CREATE_DEFAULT_VARIANTS", selectedProductIds);
  console.log(JSON.stringify({ phase: "DEFAULT_VARIANTS_DONE", result }, null, 2));
}

async function applyApprovedLeadTimeAndPricing() {
  if (!process.argv.includes("--approved-production-update")) {
    throw new Error("PRODUCTION_UPDATE_APPROVAL_FLAG_REQUIRED");
  }
  const context = await loadContext();
  const productIds = context.products.map((item) => item.id);
  const missingLeadTime = must(
    await context.admin.database.from("products")
      .select("id")
      .eq("supplier_id", context.supplier.id)
      .is("default_lead_time_days", null)
      .limit(1000),
    "read missing lead time",
  ).map((item) => item.id);
  if (missingLeadTime.length !== 722) {
    throw new Error(`LEAD_TIME_SELECTION_GUARD_FAILED: ${missingLeadTime.length}`);
  }
  const leadTime = await runBatchAsActor("FILL_LEAD_TIME", missingLeadTime, {
    leadTimeDays: 60,
  });
  const costs = await runBatchAsActor("PREPARE_COSTS", productIds, {
    exchangeRateToThb: 5,
    effectiveFrom: new Date().toISOString(),
  });
  if (costs.failed !== 0 || costs.succeeded + costs.skipped !== 722) {
    throw new Error(`COST_PREPARATION_INCOMPLETE: ${JSON.stringify(costs)}`);
  }
  const prices = await runBatchAsActor("ACTIVATE_MEMBER_PRICES", productIds);
  console.log(JSON.stringify({
    phase: "APPROVED_INPUTS_APPLIED",
    approved: { leadTimeDays: 60, exchangeRateToThb: 5 },
    leadTime,
    costs,
    prices,
  }, null, 2));
}

async function publishMemberCatalog() {
  if (!process.argv.includes("--approved-production-publish")) {
    throw new Error("PRODUCTION_PUBLISH_APPROVAL_FLAG_REQUIRED");
  }
  const context = await loadContext();
  const rows = must(
    await context.admin.database.from("products")
      .select("id,sku,status,material_summary,specification_summary,width_mm,depth_mm,height_mm")
      .eq("supplier_id", context.supplier.id)
      .order("sku")
      .limit(1000),
    "read publish candidates",
  );
  const candidates = rows.filter((item) => {
    const supplierDetail = String(item.specification_summary ?? "").split(/\r?\n/)[1]?.trim();
    return item.status === "DRAFT"
      && item.width_mm != null && item.depth_mm != null && item.height_mm != null
      && Boolean(supplierDetail);
  });
  if (candidates.length !== 634) {
    throw new Error(`MEMBER_CATALOG_PUBLISH_GUARD_FAILED: ${candidates.length}`);
  }
  const productIds = candidates.map((item) => item.id);
  const connectionOutput = execFileSync(
    "cmd.exe",
    ["/d", "/s", "/c", "npx -y @insforge/cli db connection-string"],
    { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  const connectionString = connectionOutput.match(/postgres(?:ql)?:\/\/\S+/)?.[0]?.trim();
  if (!connectionString) throw new Error("DATABASE_CONNECTION_STRING_NOT_FOUND");
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ sub: actorUserId, role: "authenticated" }),
    ]);
    const materialUpdate = await client.query(
      `UPDATE public.products
       SET material_summary = BTRIM(SPLIT_PART(specification_summary, CHR(10), 2)),
           status = 'DRAFT', qa_status = 'NOT_REVIEWED', reviewed_by = NULL,
           reviewed_at = NULL, review_note = NULL, updated_at = NOW()
       WHERE id = ANY($1::uuid[])
         AND NULLIF(BTRIM(COALESCE(material_summary, '')), '') IS NULL`,
      [productIds],
    );
    if (materialUpdate.rowCount !== 634) {
      throw new Error(`MATERIAL_MAPPING_GUARD_FAILED: ${materialUpdate.rowCount}`);
    }
    await client.query(
      `SELECT public.write_audit_event(
         NULL, 'product', p.id, 'MATERIAL_MAPPED_FROM_SUPPLIER_SPEC', NULL,
         jsonb_build_object('source', 'specification_summary', 'materialSummary', p.material_summary)
       )
       FROM public.products p WHERE p.id = ANY($1::uuid[])`,
      [productIds],
    );
    const submitted = await client.query(
      "SELECT public.submit_product_for_review(p.id) FROM public.products p WHERE p.id = ANY($1::uuid[]) ORDER BY p.sku",
      [productIds],
    );
    const reviewed = await client.query(
      "SELECT public.review_catalog_product(p.id, 'PASSED', $2) FROM public.products p WHERE p.id = ANY($1::uuid[]) ORDER BY p.sku",
      [productIds, "ตรวจข้อมูลนำเข้า รูป ต้นทุน ราคา มิติ และสเปก Supplier สำหรับ Member Catalog แล้ว"],
    );
    const published = await client.query(
      "SELECT public.publish_product(p.id) FROM public.products p WHERE p.id = ANY($1::uuid[]) ORDER BY p.sku",
      [productIds],
    );
    if (submitted.rowCount !== 634 || reviewed.rowCount !== 634 || published.rowCount !== 634) {
      throw new Error(`PUBLISH_COUNT_GUARD_FAILED: ${submitted.rowCount}/${reviewed.rowCount}/${published.rowCount}`);
    }
    await client.query("COMMIT");
    console.log(JSON.stringify({
      phase: "MEMBER_CATALOG_PUBLISHED",
      materialMapped: materialUpdate.rowCount,
      submitted: submitted.rowCount,
      reviewed: reviewed.rowCount,
      published: published.rowCount,
      heldDraft: rows.length - candidates.length,
    }, null, 2));
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

async function verifyMemberCatalog() {
  const context = await loadContext();
  const approvedMembers = must(
    await context.admin.database.from("member_applications")
      .select("user_id")
      .eq("status", "APPROVED")
      .limit(1),
    "read approved member",
  );
  const memberUserId = approvedMembers[0]?.user_id;
  if (!memberUserId) throw new Error("APPROVED_MEMBER_NOT_FOUND");
  const connectionOutput = execFileSync(
    "cmd.exe",
    ["/d", "/s", "/c", "npx -y @insforge/cli db connection-string"],
    { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  const connectionString = connectionOutput.match(/postgres(?:ql)?:\/\/\S+/)?.[0]?.trim();
  if (!connectionString) throw new Error("DATABASE_CONNECTION_STRING_NOT_FOUND");
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ sub: memberUserId, role: "authenticated" }),
    ]);
    const result = await client.query(
      `SELECT COUNT(*)::integer AS visible_products,
              MIN(member_price_before_vat) AS min_price,
              MAX(member_price_before_vat) AS max_price
       FROM public.member_catalog WHERE sku LIKE 'CN01-%'`,
    );
    await client.query("ROLLBACK");
    console.log(JSON.stringify({ phase: "MEMBER_CATALOG_VERIFIED", ...result.rows[0] }, null, 2));
  } finally {
    await client.end();
  }
}

async function readUploadState() {
  try {
    const text = await fs.readFile(uploadStatePath, "utf8");
    return new Map(text.split(/\r?\n/).filter(Boolean).map((line) => { const value = JSON.parse(line); return [value.fileId, value]; }));
  } catch (error) {
    if (error?.code === "ENOENT") return new Map();
    throw error;
  }
}

async function uploadImages() {
  if (!process.argv.includes("--approved-production-upload")) throw new Error("PRODUCTION_UPLOAD_APPROVAL_FLAG_REQUIRED");
  const context = await loadContext();
  const relations = buildRelations(context.manifest, context.productBySku);
  const state = await readUploadState();
  let stateWrite = Promise.resolve();
  let uploadedNow = 0;
  await pool(relations.images.filter((image) => !state.has(image.fileId)), 6, async (image) => {
    const bytes = await fs.readFile(image.absolutePath);
    const file = new File([bytes], path.basename(image.absolutePath), { type: image.mime });
    const stored = must(await context.admin.storage.from("gisp-confidential").upload(image.key, file), `upload ${image.productSku} image ${image.index + 1}`);
    const record = { fileId: image.fileId, mediaId: image.mediaId, productId: image.productId, productSku: image.productSku, key: stored.key ?? image.key, url: stored.url ?? null };
    state.set(image.fileId, record);
    stateWrite = stateWrite.then(() => fs.appendFile(uploadStatePath, `${JSON.stringify(record)}\n`, "utf8"));
    await stateWrite;
    uploadedNow += 1;
    if (state.size % 100 === 0 || state.size === relations.images.length) console.log(`UPLOAD_PROGRESS ${state.size}/${relations.images.length}`);
  });
  if (state.size !== relations.images.length) throw new Error(`UPLOAD_STATE_MISMATCH: ${state.size}/${relations.images.length}`);
  const user = must(await context.admin.database.from("users").select("id,primary_organization_id").eq("id", actorUserId).maybeSingle(), "read actor");
  const existingMetadata = await inBatches(context.products.map((item) => item.id), 50, async (batch) => retry("read image metadata", async () => must(await context.admin.database.from("file_metadata").select("id,entity_id,object_key").eq("entity_type", "PRODUCT_MEDIA").in("entity_id", batch).limit(1000), "read image metadata")));
  const existingFileIds = new Set(existingMetadata.map((item) => item.id));
  const metadata = relations.images.filter((image) => !existingFileIds.has(image.fileId)).map((image) => {
    const stored = state.get(image.fileId);
    return { id: image.fileId, organization_id: user?.primary_organization_id ?? null, bucket: "gisp-confidential", object_key: stored.key, url: stored.url, original_name: path.basename(image.absolutePath), mime_type: image.mime, size_bytes: image.sizeBytes, visibility: "CONFIDENTIAL", entity_type: "PRODUCT_MEDIA", entity_id: image.productId, uploaded_by: actorUserId };
  });
  if (metadata.length) await insertRows(context.admin, "file_metadata", metadata, 75);
  const existingMedia = await inBatches(context.products.map((item) => item.id), 50, async (batch) => retry("read media", async () => must(await context.admin.database.from("product_media").select("id,product_id,file_id").in("product_id", batch).limit(1000), "read media")));
  const existingMediaIds = new Set(existingMedia.map((item) => item.id));
  const media = relations.images.filter((image) => !existingMediaIds.has(image.mediaId)).map((image) => ({ id: image.mediaId, product_id: image.productId, file_id: image.fileId, media_type: "IMAGE", is_primary: image.isPrimary === "YES", sort_order: (image.index + 1) * 10 }));
  if (media.length) await insertRows(context.admin, "product_media", media, 100);
  await insertRows(context.admin, "audit_events", [{ actor_user_id: actorUserId, entity_type: "catalog_import_job", entity_id: "bb91aa4c-1784-48c6-b666-0f31ebfff351", action: "CATALOG_IMAGES_ATTACHED", after_data: { supplierCode: "CN01", images: relations.images.length, uploadedNow } }]);
  console.log(JSON.stringify({ phase: "IMAGES_OK", total: relations.images.length, uploadedNow, metadataInserted: metadata.length, mediaInserted: media.length }, null, 2));
}

if (mode === "preflight") await preflight();
else if (mode === "enrich") await enrich();
else if (mode === "activate-supplier") await activateSupplier();
else if (mode === "create-default-variants") await createDefaultVariants();
else if (mode === "apply-approved-inputs") await applyApprovedLeadTimeAndPricing();
else if (mode === "publish-member-catalog") await publishMemberCatalog();
else if (mode === "verify-member-catalog") await verifyMemberCatalog();
else if (mode === "upload-images") await uploadImages();
else throw new Error(`UNKNOWN_MODE: ${mode}`);
