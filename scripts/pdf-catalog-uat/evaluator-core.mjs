export const UAT_THRESHOLDS = Object.freeze({
  productDetectionRecall: 0.95,
  exactReadableSkuAccuracy: 0.98,
  fieldAccuracy: 0.9,
  macroFieldAccuracy: 0.9,
  imageAssociationAccuracy: 0.9,
  maxReadySecondsFor100Pages: 30 * 60,
});

export const PRODUCT_FIELDS = Object.freeze([
  "sku", "factorySku", "nameZh", "nameEn", "nameThDraft", "productType", "categoryId",
  "countryCode", "leadTimeDays", "widthMm", "depthMm", "heightMm", "weightKg", "cbm",
  "materialSummary", "finishSummary", "moq", "descriptionTh", "specificationSummary", "sourcePage",
]);

const REQUIRED_MATRIX = Object.freeze([
  ["CN", "NATIVE_TEXT"],
  ["CN", "SCANNED"],
  ["EN", "NATIVE_TEXT"],
  ["EN", "SCANNED"],
]);

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function canonical(value) {
  if (typeof value === "string") return value.normalize("NFC").trim().replace(/\s+/gu, " ");
  if (Array.isArray(value)) return value.map(canonical);
  if (isObject(value)) return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}

function equalField(actual, expected) {
  return JSON.stringify(canonical(actual ?? null)) === JSON.stringify(canonical(expected));
}

function ratio(numerator, denominator) {
  return denominator === 0 ? null : numerator / denominator;
}

function metric(numerator, denominator, threshold) {
  const value = ratio(numerator, denominator);
  return { numerator, denominator, value, threshold, pass: value !== null && value >= threshold };
}

function collectGroundTruth(groundTruth) {
  invariant(isObject(groundTruth), "Ground truth must be a JSON object");
  invariant(groundTruth.artifactType === "PDF_CATALOG_UAT_GROUND_TRUTH", "Ground truth artifactType is invalid");
  invariant(groundTruth.schemaVersion === "1.0", "Ground truth schemaVersion must be 1.0");
  invariant(groundTruth.approval?.status === "OWNER_APPROVED", "Ground truth must be OWNER_APPROVED; TEMPLATE files are not UAT evidence");
  invariant(typeof groundTruth.approval?.approvedBy === "string" && groundTruth.approval.approvedBy.trim(), "Ground truth approvedBy is required");
  invariant(Number.isFinite(Date.parse(groundTruth.approval?.approvedAt)), "Ground truth approvedAt must be an ISO timestamp");
  invariant(Array.isArray(groundTruth.catalogs) && groundTruth.catalogs.length > 0, "Ground truth catalogs are required");

  const catalogs = new Map();
  const products = new Map();
  const matrix = new Set();
  const sourceHashes = new Set();
  for (const catalog of groundTruth.catalogs) {
    invariant(isObject(catalog) && typeof catalog.catalogId === "string" && catalog.catalogId.trim(), "Each catalog requires catalogId");
    invariant(!catalogs.has(catalog.catalogId), `Duplicate catalogId: ${catalog.catalogId}`);
    invariant(["CN", "EN"].includes(catalog.language), `Invalid language for ${catalog.catalogId}`);
    invariant(["NATIVE_TEXT", "SCANNED"].includes(catalog.pdfKind), `Invalid pdfKind for ${catalog.catalogId}`);
    invariant(Number.isInteger(catalog.pageCount) && catalog.pageCount > 0 && catalog.pageCount <= 100, `Invalid pageCount for ${catalog.catalogId}`);
    invariant(typeof catalog.sourcePdfSha256 === "string" && /^[a-f0-9]{64}$/u.test(catalog.sourcePdfSha256), `Invalid sourcePdfSha256 for ${catalog.catalogId}`);
    invariant(!sourceHashes.has(catalog.sourcePdfSha256), `Each UAT catalog must use a distinct real PDF; duplicate sourcePdfSha256: ${catalog.sourcePdfSha256}`);
    invariant(Array.isArray(catalog.products), `Products are required for ${catalog.catalogId}`);
    invariant(catalog.declaredProductCount === catalog.products.length, `declaredProductCount does not match products for ${catalog.catalogId}`);
    catalogs.set(catalog.catalogId, catalog);
    sourceHashes.add(catalog.sourcePdfSha256);
    matrix.add(`${catalog.language}:${catalog.pdfKind}`);
    for (const product of catalog.products) {
      invariant(isObject(product) && typeof product.groundTruthId === "string" && product.groundTruthId.trim(), `A product in ${catalog.catalogId} lacks groundTruthId`);
      invariant(!products.has(product.groundTruthId), `Duplicate groundTruthId: ${product.groundTruthId}`);
      invariant(Number.isInteger(product.sourcePage) && product.sourcePage >= 1 && product.sourcePage <= catalog.pageCount, `Invalid sourcePage for ${product.groundTruthId}`);
      invariant(typeof product.readableSku === "boolean", `readableSku must be boolean for ${product.groundTruthId}`);
      invariant(typeof product.imageAssessable === "boolean", `imageAssessable must be boolean for ${product.groundTruthId}`);
      invariant(isObject(product.expected), `expected fields are required for ${product.groundTruthId}`);
      for (const field of PRODUCT_FIELDS) invariant(Object.hasOwn(product.expected, field), `Ground truth ${product.groundTruthId} must explicitly include ${field}, using null when absent in the PDF`);
      invariant(product.expected.sourcePage === product.sourcePage, `expected.sourcePage must match sourcePage for ${product.groundTruthId}`);
      if (product.readableSku) invariant(typeof product.expected.sku === "string" && product.expected.sku.length > 0, `Readable SKU is missing for ${product.groundTruthId}`);
      if (product.imageAssessable) invariant(typeof product.expectedImageRef === "string" && product.expectedImageRef.trim(), `expectedImageRef is required for ${product.groundTruthId}`);
      products.set(product.groundTruthId, { ...product, catalogId: catalog.catalogId });
    }
  }
  for (const [language, pdfKind] of REQUIRED_MATRIX) invariant(matrix.has(`${language}:${pdfKind}`), `Missing required UAT coverage: ${language} x ${pdfKind}`);
  invariant(groundTruth.declaredProductCount === products.size, "Top-level declaredProductCount does not match the product manifest");
  invariant(products.size >= 100, `At least 100 ground-truth products are required; found ${products.size}`);
  return { catalogs, products };
}

function collectResults(results, groundTruthCatalogs, groundTruthProducts) {
  invariant(isObject(results), "Results must be a JSON object");
  invariant(results.artifactType === "PDF_CATALOG_UAT_RESULTS", "Results artifactType is invalid");
  invariant(results.schemaVersion === "1.0", "Results schemaVersion must be 1.0");
  invariant(results.status === "COMPLETED_EXPORT", "Results must be COMPLETED_EXPORT; TEMPLATE files are not UAT evidence");
  invariant(Array.isArray(results.catalogs), "Result catalogs are required");
  invariant(Array.isArray(results.performanceRuns), "performanceRuns are required");

  const candidatesByTruth = new Map();
  const candidateIds = new Set();
  const seenCatalogs = new Set();
  for (const catalog of results.catalogs) {
    invariant(isObject(catalog) && groundTruthCatalogs.has(catalog.catalogId), `Unknown result catalogId: ${catalog?.catalogId ?? "(missing)"}`);
    invariant(!seenCatalogs.has(catalog.catalogId), `Duplicate result catalogId: ${catalog.catalogId}`);
    invariant(Array.isArray(catalog.candidates), `Candidates are required for ${catalog.catalogId}`);
    invariant(catalog.sourcePdfSha256 === groundTruthCatalogs.get(catalog.catalogId).sourcePdfSha256, `PDF hash mismatch for ${catalog.catalogId}`);
    seenCatalogs.add(catalog.catalogId);
    for (const candidate of catalog.candidates) {
      invariant(isObject(candidate) && typeof candidate.candidateId === "string" && candidate.candidateId.trim(), `A candidate in ${catalog.catalogId} lacks candidateId`);
      invariant(!candidateIds.has(candidate.candidateId), `Duplicate candidateId: ${candidate.candidateId}`);
      invariant(isObject(candidate.fields), `Candidate fields are required for ${candidate.candidateId}`);
      invariant(candidate.selectedImageFileId === null || (typeof candidate.selectedImageFileId === "string" && candidate.selectedImageFileId.trim()), `selectedImageFileId is invalid for ${candidate.candidateId}`);
      candidateIds.add(candidate.candidateId);
      if (candidate.matchedGroundTruthId === null) continue;
      invariant(typeof candidate.matchedGroundTruthId === "string" && groundTruthProducts.has(candidate.matchedGroundTruthId), `Unknown matchedGroundTruthId for ${candidate.candidateId}`);
      const truth = groundTruthProducts.get(candidate.matchedGroundTruthId);
      invariant(truth.catalogId === catalog.catalogId, `Candidate ${candidate.candidateId} is matched across catalogs`);
      invariant(!candidatesByTruth.has(candidate.matchedGroundTruthId), `Multiple candidates matched to ${candidate.matchedGroundTruthId}`);
      candidatesByTruth.set(candidate.matchedGroundTruthId, candidate);
    }
  }
  for (const catalogId of groundTruthCatalogs.keys()) invariant(seenCatalogs.has(catalogId), `Missing result catalog: ${catalogId}`);
  return candidatesByTruth;
}

function scorePerformance(performanceRuns, groundTruthCatalogs) {
  const runs = performanceRuns.filter((run) => run?.pageCount === 100);
  const measured = [];
  for (const run of runs) {
    invariant(typeof run.catalogId === "string" && run.catalogId.trim(), "A 100-page performance run requires catalogId");
    invariant(groundTruthCatalogs.get(run.catalogId)?.pageCount === 100, `Performance run ${run.catalogId} does not reference a 100-page ground-truth catalog`);
    const started = Date.parse(run.startedAt);
    const ready = Date.parse(run.readyForReviewAt);
    invariant(Number.isFinite(started) && Number.isFinite(ready) && ready >= started, `Invalid performance timestamps for ${run.catalogId}`);
    measured.push({ catalogId: run.catalogId, elapsedSeconds: (ready - started) / 1000 });
  }
  const worstElapsedSeconds = measured.length ? Math.max(...measured.map((run) => run.elapsedSeconds)) : null;
  return {
    measuredRuns: measured,
    denominator: measured.length,
    worstElapsedSeconds,
    thresholdSeconds: UAT_THRESHOLDS.maxReadySecondsFor100Pages,
    pass: measured.length > 0 && worstElapsedSeconds <= UAT_THRESHOLDS.maxReadySecondsFor100Pages,
  };
}

export function evaluatePdfCatalogUat(groundTruth, results) {
  const truth = collectGroundTruth(groundTruth);
  const candidatesByTruth = collectResults(results, truth.catalogs, truth.products);
  const detected = [...truth.products.keys()].filter((id) => candidatesByTruth.has(id)).length;
  const detection = metric(detected, truth.products.size, UAT_THRESHOLDS.productDetectionRecall);

  let readableSkuTotal = 0;
  let readableSkuExact = 0;
  let imageTotal = 0;
  let imageExact = 0;
  const fieldCounts = Object.fromEntries(PRODUCT_FIELDS.map((field) => [field, { correct: 0, total: 0 }]));
  for (const [truthId, expectedProduct] of truth.products) {
    const candidate = candidatesByTruth.get(truthId);
    if (expectedProduct.readableSku) {
      readableSkuTotal += 1;
      if (candidate && candidate.fields.sku === expectedProduct.expected.sku) readableSkuExact += 1;
    }
    if (expectedProduct.imageAssessable) {
      imageTotal += 1;
      if (candidate && candidate.selectedImageRef === expectedProduct.expectedImageRef) imageExact += 1;
    }
    for (const field of PRODUCT_FIELDS) {
      fieldCounts[field].total += 1;
      if (candidate && equalField(candidate.fields[field], expectedProduct.expected[field])) fieldCounts[field].correct += 1;
    }
  }

  const fields = Object.fromEntries(PRODUCT_FIELDS.map((field) => {
    const counts = fieldCounts[field];
    return [field, metric(counts.correct, counts.total, UAT_THRESHOLDS.fieldAccuracy)];
  }));
  const fieldValues = Object.values(fields).map((entry) => entry.value).filter((value) => value !== null);
  const macroValue = fieldValues.length ? fieldValues.reduce((sum, value) => sum + value, 0) / fieldValues.length : null;
  const macroFields = { denominator: fieldValues.length, value: macroValue, threshold: UAT_THRESHOLDS.macroFieldAccuracy, pass: macroValue !== null && macroValue >= UAT_THRESHOLDS.macroFieldAccuracy };
  const readableSku = metric(readableSkuExact, readableSkuTotal, UAT_THRESHOLDS.exactReadableSkuAccuracy);
  const images = metric(imageExact, imageTotal, UAT_THRESHOLDS.imageAssociationAccuracy);
  const performance = scorePerformance(results.performanceRuns, truth.catalogs);
  const failedFields = Object.entries(fields).filter(([, entry]) => !entry.pass).map(([field]) => field);
  const pass = detection.pass && readableSku.pass && images.pass && macroFields.pass && performance.pass && failedFields.length === 0;

  return {
    artifactType: "PDF_CATALOG_UAT_EVALUATION",
    schemaVersion: "1.0",
    evaluatedAt: new Date().toISOString(),
    pass,
    thresholds: UAT_THRESHOLDS,
    dataset: { catalogs: truth.catalogs.size, groundTruthProducts: truth.products.size, matchedProducts: detected },
    metrics: { productDetectionRecall: detection, exactReadableSkuAccuracy: readableSku, fields, macroFieldAccuracy: macroFields, imageAssociationAccuracy: images, readyForReview100Pages: performance },
    failures: [
      ...(!detection.pass ? ["PRODUCT_DETECTION_RECALL"] : []),
      ...(!readableSku.pass ? ["EXACT_READABLE_SKU_ACCURACY"] : []),
      ...(failedFields.length ? failedFields.map((field) => `FIELD_ACCURACY:${field}`) : []),
      ...(!macroFields.pass ? ["MACRO_FIELD_ACCURACY"] : []),
      ...(!images.pass ? ["IMAGE_ASSOCIATION_ACCURACY"] : []),
      ...(!performance.pass ? ["READY_FOR_REVIEW_100_PAGE_TIME"] : []),
    ],
  };
}
