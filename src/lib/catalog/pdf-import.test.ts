import { PDFDocument } from "pdf-lib";
import { afterEach, describe, expect, it } from "vitest";
import nextConfig from "../../../next.config";
import { PDF_CATALOG_MAX_BYTES, isPdfCatalogImportEnabled, pdfCandidateSchema, validatePdfCatalogFile } from "./pdf-import";

async function pdfFile(pages = 1, type = "application/pdf") {
  const document = await PDFDocument.create();
  for (let index = 0; index < pages; index += 1) document.addPage([100, 100]);
  const bytes = await document.save();
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return new File([buffer], "catalog.pdf", { type });
}

afterEach(() => { delete process.env.ENABLE_PDF_CATALOG_IMPORT; });

describe("PDF catalog validation", () => {
  it("accepts a valid PDF and returns its page count and hash", async () => {
    const result = await validatePdfCatalogFile(await pdfFile(2));
    expect(result.pageCount).toBe(2);
    expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects MIME spoofing and malformed signatures", async () => {
    await expect(validatePdfCatalogFile(await pdfFile(1, "text/plain"))).rejects.toMatchObject({ code: "PDF_TYPE_INVALID" });
    await expect(validatePdfCatalogFile(new File(["not pdf"], "catalog.pdf", { type: "application/pdf" }))).rejects.toMatchObject({ code: "PDF_SIGNATURE_INVALID" });
  });

  it("does not classify a portfolio from an untrusted raw-byte marker", async () => {
    const base = await pdfFile();
    const bytes = new Uint8Array(await base.arrayBuffer());
    const portfolio = new File([bytes, "\n/EmbeddedFiles"], "catalog.pdf", { type: "application/pdf" });
    await expect(validatePdfCatalogFile(portfolio)).resolves.toMatchObject({ pageCount: 1 });
  });

  it("keeps the feature disabled unless explicitly true", () => {
    expect(isPdfCatalogImportEnabled()).toBe(false);
    process.env.ENABLE_PDF_CATALOG_IMPORT = "true";
    expect(isPdfCatalogImportEnabled()).toBe(true);
  });

  it("requires evidence-backed structured candidates", () => {
    expect(pdfCandidateSchema.safeParse({ sku: "A-1", nameEn: "Chair", nameThDraft: "เก้าอี้", productType: "STANDARD", countryCode: "CN", confidence: { sku: 0.99 }, warningCodes: [] }).success).toBe(true);
    expect(pdfCandidateSchema.safeParse({ sku: "A-2", productType: "STANDARD", countryCode: "US", confidence: {}, warningCodes: [] }).success).toBe(true);
    expect(pdfCandidateSchema.safeParse({ sku: "A-1", productType: null, countryCode: null, confidence: {}, warningCodes: ["PRODUCT_TYPE_REQUIRED", "COUNTRY_REQUIRED"] }).success).toBe(true);
    expect(pdfCandidateSchema.safeParse({ sku: "A-1", productType: "STANDARD", widthMm: -1 }).success).toBe(false);
  });

  it("uses the approved 25 MB boundary", () => expect(PDF_CATALOG_MAX_BYTES).toBe(26_214_400));

  it("allows multipart overhead before enforcing the exact PDF limit in the route", () => {
    expect(nextConfig.experimental?.proxyClientMaxBodySize).toBe(26 * 1024 * 1024);
    expect(nextConfig.experimental?.proxyClientMaxBodySize).toBeGreaterThan(PDF_CATALOG_MAX_BYTES);
  });
});
