import { createHash } from "node:crypto";
import { PDFDocument } from "pdf-lib";
import { z } from "zod";

export const PDF_CATALOG_MAX_BYTES = 25 * 1024 * 1024;
export const PDF_CATALOG_MAX_PAGES = 100;
export const PDF_SIGNED_URL_SECONDS = 300;

export type PdfValidation = {
  bytes: Uint8Array;
  pageCount: number;
  sha256: string;
};

export class PdfImportValidationError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
  }
}

export function isPdfCatalogImportEnabled() {
  return process.env.ENABLE_PDF_CATALOG_IMPORT === "true";
}

export async function validatePdfCatalogFile(file: File): Promise<PdfValidation> {
  if (!file.name.toLowerCase().endsWith(".pdf") || file.type !== "application/pdf") {
    throw new PdfImportValidationError("PDF_TYPE_INVALID", "ไฟล์ต้องเป็น PDF เท่านั้น");
  }
  if (file.size <= 0 || file.size > PDF_CATALOG_MAX_BYTES) {
    throw new PdfImportValidationError("PDF_SIZE_INVALID", "PDF ต้องมีขนาดไม่เกิน 25 MB");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (new TextDecoder("ascii").decode(bytes.subarray(0, 5)) !== "%PDF-") {
    throw new PdfImportValidationError("PDF_SIGNATURE_INVALID", "โครงสร้างไฟล์ไม่ใช่ PDF ที่ถูกต้อง");
  }
  let document: PDFDocument;
  try {
    document = await PDFDocument.load(bytes, { ignoreEncryption: false, updateMetadata: false });
  } catch {
    throw new PdfImportValidationError("PDF_MALFORMED", "PDF เสียหาย เข้ารหัส หรืออ่านโครงสร้างไม่ได้");
  }
  const pageCount = document.getPageCount();
  if (pageCount < 1 || pageCount > PDF_CATALOG_MAX_PAGES) {
    throw new PdfImportValidationError("PDF_PAGE_LIMIT", "PDF รองรับ 1–100 หน้า");
  }
  return { bytes, pageCount, sha256: createHash("sha256").update(bytes).digest("hex") };
}

const optionalText = z.string().trim().max(5_000).nullable().optional();
const optionalPositive = z.number().positive().nullable().optional();

export const pdfCandidateSchema = z.object({
  sku: z.string().trim().max(120).nullable(),
  factorySku: optionalText,
  nameZh: optionalText,
  nameEn: optionalText,
  nameThDraft: optionalText,
  productType: z.enum(["STANDARD", "CUSTOM_TEMPLATE", "READY_TO_ORDER", "BUILT_IN", "MATERIAL", "EQUIPMENT", "DECORATIVE"]).nullable(),
  categoryId: z.uuid().nullable().optional(),
  countryCode: z.string().regex(/^[A-Z]{2}$/).nullable(),
  leadTimeDays: z.number().int().positive().nullable().optional(),
  widthMm: optionalPositive,
  depthMm: optionalPositive,
  heightMm: optionalPositive,
  weightKg: optionalPositive,
  cbm: optionalPositive,
  materialSummary: optionalText,
  finishSummary: optionalText,
  moq: optionalPositive,
  descriptionTh: optionalText,
  specificationSummary: optionalText,
  sourceBbox: z.object({ x: z.number(), y: z.number(), width: z.number().nonnegative(), height: z.number().nonnegative() }).nullable().optional(),
  confidence: z.record(z.string(), z.number().min(0).max(1)).default({}),
  warningCodes: z.array(z.string().trim().min(1).max(100)).default([]),
});

export const pdfCandidatePatchSchema = pdfCandidateSchema.omit({ warningCodes: true, confidence: true, sourceBbox: true }).partial().extend({
  selectedImageFileId: z.uuid().nullable().optional(),
});

export function safePage(value: string | null) {
  const parsed = Number(value ?? "1");
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, 10_000) : 1;
}

export function safePageSize(value: string | null) {
  const parsed = Number(value ?? "50");
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, 100) : 50;
}
