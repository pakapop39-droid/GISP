import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { PRODUCT_FIELDS, evaluatePdfCatalogUat } from "./evaluator-core.mjs";

const matrix = [
  ["cn-native", "CN", "NATIVE_TEXT"],
  ["cn-scanned", "CN", "SCANNED"],
  ["en-native", "EN", "NATIVE_TEXT"],
  ["en-scanned", "EN", "SCANNED"],
];

function expectedFields(index, sourcePage) {
  return {
    sku: `SKU-${String(index).padStart(3, "0")}`,
    factorySku: `FACTORY-${String(index).padStart(3, "0")}`,
    nameZh: index < 50 ? `产品 ${index}` : null,
    nameEn: index >= 50 ? `Product ${index}` : null,
    nameThDraft: `สินค้าทดสอบ ${index}`,
    productType: "STANDARD",
    categoryId: "11111111-1111-4111-8111-111111111111",
    countryCode: index < 50 ? "CN" : "US",
    leadTimeDays: 30,
    widthMm: 500,
    depthMm: 500,
    heightMm: 800,
    weightKg: 10,
    cbm: 0.2,
    materialSummary: "Steel",
    finishSummary: "Powder coat",
    moq: 1,
    descriptionTh: null,
    specificationSummary: "UAT fixture",
    sourcePage,
  };
}

function validInputs() {
  let index = 0;
  const catalogs = matrix.map(([catalogId, language, pdfKind], catalogIndex) => ({
    catalogId,
    language,
    pdfKind,
    pageCount: catalogId === "en-scanned" ? 100 : 25,
    sourcePdfSha256: String(catalogIndex + 1).repeat(64),
    products: Array.from({ length: 25 }, () => {
      const current = index++;
      const sourcePage = (current % 25) + 1;
      return {
        groundTruthId: `truth-${current}`,
        sourcePage,
        readableSku: true,
        imageAssessable: true,
        expectedImageRef: `image-${current}`,
        expected: expectedFields(current, sourcePage),
      };
    }),
    declaredProductCount: 25,
  }));
  const groundTruth = {
    artifactType: "PDF_CATALOG_UAT_GROUND_TRUTH",
    schemaVersion: "1.0",
    approval: { status: "OWNER_APPROVED", approvedBy: "Owner", approvedAt: "2026-09-12T12:00:00Z" },
    declaredProductCount: 100,
    catalogs,
  };
  const results = {
    artifactType: "PDF_CATALOG_UAT_RESULTS",
    schemaVersion: "1.0",
    status: "COMPLETED_EXPORT",
    catalogs: catalogs.map((catalog) => ({
      catalogId: catalog.catalogId,
      sourcePdfSha256: catalog.sourcePdfSha256,
      candidates: catalog.products.map((product) => ({
        candidateId: `candidate-${product.groundTruthId}`,
        matchedGroundTruthId: product.groundTruthId,
        selectedImageFileId: "22222222-2222-4222-8222-222222222222",
        selectedImageRef: product.expectedImageRef,
        fields: structuredClone(product.expected),
      })),
    })),
    performanceRuns: [{ catalogId: "en-scanned", pageCount: 100, startedAt: "2026-09-12T12:00:00Z", readyForReviewAt: "2026-09-12T12:29:59Z" }],
  };
  return { groundTruth, results };
}

test("a complete 100-product matrix passes every locked threshold", () => {
  const report = evaluatePdfCatalogUat(...Object.values(validInputs()));
  assert.equal(report.pass, true);
  assert.equal(report.dataset.groundTruthProducts, 100);
  assert.equal(report.metrics.productDetectionRecall.value, 1);
  assert.equal(report.metrics.readyForReview100Pages.worstElapsedSeconds, 1799);
  assert.deepEqual(Object.keys(report.metrics.fields), [...PRODUCT_FIELDS]);
});

test("missed products reduce recall and every affected field denominator remains 100", () => {
  const { groundTruth, results } = validInputs();
  results.catalogs[0].candidates.splice(0, 6);
  const report = evaluatePdfCatalogUat(groundTruth, results);
  assert.equal(report.metrics.productDetectionRecall.value, 0.94);
  assert.equal(report.metrics.fields.nameEn.denominator, 100);
  assert.equal(report.pass, false);
  assert(report.failures.includes("PRODUCT_DETECTION_RECALL"));
});

test("readable SKU comparison is exact and counts missed products as incorrect", () => {
  const { groundTruth, results } = validInputs();
  results.catalogs[0].candidates[0].fields.sku = "sku-000";
  results.catalogs[0].candidates[1].fields.sku = "SKU-001 ";
  results.catalogs[0].candidates.splice(2, 1);
  const report = evaluatePdfCatalogUat(groundTruth, results);
  assert.equal(report.metrics.exactReadableSkuAccuracy.numerator, 97);
  assert.equal(report.metrics.exactReadableSkuAccuracy.denominator, 100);
  assert.equal(report.metrics.exactReadableSkuAccuracy.pass, false);
});

test("a missing non-null result is incorrect while an expected null remains correct", () => {
  const { groundTruth, results } = validInputs();
  delete results.catalogs[0].candidates[0].fields.materialSummary;
  delete results.catalogs[0].candidates[0].fields.descriptionTh;
  const report = evaluatePdfCatalogUat(groundTruth, results);
  assert.equal(report.metrics.fields.materialSummary.numerator, 99);
  assert.equal(report.metrics.fields.descriptionTh.numerator, 100);
});

test("zero assessable SKU and image denominators fail instead of producing a false pass", () => {
  const { groundTruth, results } = validInputs();
  for (const catalog of groundTruth.catalogs) for (const product of catalog.products) {
    product.readableSku = false;
    product.imageAssessable = false;
    delete product.expectedImageRef;
  }
  const report = evaluatePdfCatalogUat(groundTruth, results);
  assert.equal(report.metrics.exactReadableSkuAccuracy.value, null);
  assert.equal(report.metrics.imageAssociationAccuracy.value, null);
  assert.equal(report.pass, false);
});

test("a single field below 90 percent fails even when macro accuracy remains above 90 percent", () => {
  const { groundTruth, results } = validInputs();
  for (let index = 0; index < 11; index++) results.catalogs[0].candidates[index].fields.finishSummary = "Wrong";
  const report = evaluatePdfCatalogUat(groundTruth, results);
  assert.equal(report.metrics.fields.finishSummary.value, 0.89);
  assert.equal(report.metrics.macroFieldAccuracy.pass, true);
  assert.equal(report.pass, false);
  assert(report.failures.includes("FIELD_ACCURACY:finishSummary"));
});

test("performance requires a real 100-page run and enforces 30 minutes", () => {
  const late = validInputs();
  late.results.performanceRuns[0].readyForReviewAt = "2026-09-12T12:30:01Z";
  assert.equal(evaluatePdfCatalogUat(late.groundTruth, late.results).metrics.readyForReview100Pages.pass, false);
  const missing = validInputs();
  missing.results.performanceRuns[0].pageCount = 99;
  assert.equal(evaluatePdfCatalogUat(missing.groundTruth, missing.results).metrics.readyForReview100Pages.pass, false);
});

test("templates, incomplete language matrix and fewer than 100 products are rejected", () => {
  const template = validInputs();
  template.groundTruth.approval.status = "TEMPLATE_NOT_APPROVED";
  assert.throws(() => evaluatePdfCatalogUat(template.groundTruth, template.results), /TEMPLATE files are not UAT evidence/);
  const incomplete = validInputs();
  incomplete.groundTruth.catalogs.pop();
  incomplete.results.catalogs.pop();
  assert.throws(() => evaluatePdfCatalogUat(incomplete.groundTruth, incomplete.results), /Missing required UAT coverage|At least 100/);
  const short = validInputs();
  short.groundTruth.catalogs[0].products.pop();
  short.groundTruth.catalogs[0].declaredProductCount = 24;
  short.groundTruth.declaredProductCount = 99;
  short.results.catalogs[0].candidates.pop();
  assert.throws(() => evaluatePdfCatalogUat(short.groundTruth, short.results), /At least 100 ground-truth products/);
});

test("duplicate or cross-catalog truth mappings are rejected", () => {
  const duplicate = validInputs();
  duplicate.results.catalogs[0].candidates[1].matchedGroundTruthId = duplicate.results.catalogs[0].candidates[0].matchedGroundTruthId;
  assert.throws(() => evaluatePdfCatalogUat(duplicate.groundTruth, duplicate.results), /Multiple candidates matched/);
  const crossed = validInputs();
  crossed.results.catalogs[0].candidates[0].matchedGroundTruthId = crossed.groundTruth.catalogs[1].products[0].groundTruthId;
  assert.throws(() => evaluatePdfCatalogUat(crossed.groundTruth, crossed.results), /matched across catalogs/);
});

test("a result from a different PDF hash is rejected", () => {
  const { groundTruth, results } = validInputs();
  results.catalogs[0].sourcePdfSha256 = "b".repeat(64);
  assert.throws(() => evaluatePdfCatalogUat(groundTruth, results), /PDF hash mismatch/);
});

test("four matrix labels cannot reuse one physical PDF hash", () => {
  const { groundTruth, results } = validInputs();
  groundTruth.catalogs[1].sourcePdfSha256 = groundTruth.catalogs[0].sourcePdfSha256;
  results.catalogs[1].sourcePdfSha256 = results.catalogs[0].sourcePdfSha256;
  assert.throws(() => evaluatePdfCatalogUat(groundTruth, results), /distinct real PDF; duplicate sourcePdfSha256/);
});

test("CLI exits nonzero on a threshold failure", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "gisp-pdf-uat-"));
  try {
    const { groundTruth, results } = validInputs();
    results.performanceRuns[0].readyForReviewAt = "2026-09-12T12:31:00Z";
    const truthPath = path.join(root, "truth.json");
    const resultsPath = path.join(root, "results.json");
    fs.writeFileSync(truthPath, JSON.stringify(groundTruth));
    fs.writeFileSync(resultsPath, JSON.stringify(results));
    const run = spawnSync(process.execPath, [path.resolve("scripts/pdf-catalog-uat/evaluate.mjs"), "--ground-truth", truthPath, "--results", resultsPath], { encoding: "utf8" });
    assert.equal(run.status, 1);
    assert.equal(JSON.parse(run.stdout).pass, false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
