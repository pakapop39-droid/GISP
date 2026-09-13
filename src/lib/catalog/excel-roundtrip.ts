import { createHash } from "node:crypto";
import { z } from "zod";

export const CATALOG_EXCEL_SCHEMA_VERSION = "PXR-1.0";
export const CATALOG_EXCEL_MAX_BYTES = 10 * 1024 * 1024;
export const CATALOG_EXCEL_MAX_ROWS = 1000;
export const CATALOG_EXCEL_MAX_UNCOMPRESSED_BYTES = 50 * 1024 * 1024;
export const CATALOG_EXCEL_MAX_PART_BYTES = 20 * 1024 * 1024;
export const CATALOG_EXCEL_MAX_RATIO = 100;
export const CATALOG_EXCEL_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export type CatalogSourceFileMetadata = {
  id?: string;
  original_name?: string | null;
  bucket?: string | null;
  visibility?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
};

export function isTrustedCatalogImportSourceFile(jobId: string, sourceFile: CatalogSourceFileMetadata | null) {
  return sourceFile?.bucket === "gisp-confidential"
    && sourceFile.visibility === "CONFIDENTIAL"
    && sourceFile.entity_type === "CATALOG_IMPORT"
    && (sourceFile.entity_id === null || sourceFile.entity_id === jobId);
}

export function resolveCatalogImportSourceName(jobId: string, sourceFile: CatalogSourceFileMetadata | null) {
  if (!isTrustedCatalogImportSourceFile(jobId, sourceFile)) return null;
  return String(sourceFile?.original_name ?? "").split(/[\\/]/).at(-1)?.trim() || null;
}

export function resolveCatalogEnrichmentFilename(jobId: string, sourceFile: CatalogSourceFileMetadata | null) {
  const basename = resolveCatalogImportSourceName(jobId, sourceFile)?.replace(/\.pdf$/i, "") ?? "";
  const normalizedStem = String(basename ?? "").normalize("NFKC").replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/g, "-").replace(/\s+/g, " ").trim();
  const safeStem = Array.from(normalizedStem, (character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint >= 0xd800 && codePoint <= 0xdfff ? "-" : character;
  }).slice(0, 100).join("");
  return `catalog-enrichment-${safeStem || `pdf-catalog-${jobId.slice(0, 8)}`}.xlsx`;
}

type CatalogImportProductLink = {
  product_id?: unknown;
  imported_at?: unknown;
  imported_product_snapshot?: unknown;
};

export function resolveTrustedCatalogProductId(row: CatalogImportProductLink) {
  const productId = typeof row.product_id === "string" ? row.product_id : "";
  const snapshot = row.imported_product_snapshot;
  if (!productId || !row.imported_at || !snapshot || typeof snapshot !== "object") return null;
  return (snapshot as Record<string, unknown>).id === productId ? productId : null;
}

export const productTypes = ["STANDARD", "CUSTOM_TEMPLATE", "READY_TO_ORDER", "BUILT_IN", "MATERIAL", "EQUIPMENT", "DECORATIVE"] as const;
export const enrichmentPreviewStatuses = ["READY", "UNCHANGED", "INVALID", "CONFLICT", "WAITING_FOR_DRAFT", "APPLIED", "CANCELLED"] as const;

export function summarizeEnrichmentStatuses(rows: Array<{ detail_status: string; cost_status: string | null }>) {
  return {
    readyDetails: rows.filter((row) => row.detail_status === "READY").length,
    readyCosts: rows.filter((row) => row.cost_status === "READY").length,
    invalid: rows.filter((row) => row.detail_status === "INVALID" || row.cost_status === "INVALID").length,
    conflicts: rows.filter((row) => row.detail_status === "CONFLICT" || row.cost_status === "CONFLICT").length,
    unchanged: rows.filter((row) => row.detail_status === "UNCHANGED" && row.cost_status === "UNCHANGED").length,
    waiting: rows.filter((row) => row.detail_status === "WAITING_FOR_DRAFT" || row.cost_status === "WAITING_FOR_DRAFT").length,
  };
}

export const productColumns = [
  "row_key", "source_page", "sku", "factory_sku", "name_th", "name_en", "name_zh", "product_type",
  "category_code", "country_code", "lead_time_days", "width_mm", "depth_mm", "height_mm", "weight_kg", "cbm",
  "material_summary", "finish_summary", "moq", "description_th", "specification_summary",
] as const;
export const costColumns = [
  "row_key", "current_factory_cost", "current_currency", "current_exchange_rate_to_thb", "current_cost_status",
  "new_factory_cost", "currency", "exchange_rate_to_thb", "effective_from",
] as const;
export const metaColumns = [
  "schema_version", "workbook_id", "job_id", "exported_at", "row_key", "catalog_import_row_id", "product_id",
  "baseline_detail_hash", "baseline_cost_hash",
] as const;

const optionalPositiveNumber = z.number().positive().nullable();
export const enrichmentDetailSchema = z.object({
  sku: z.string().trim().min(1).max(120), factory_sku: z.string().trim().max(5000).nullable(),
  name_th: z.string().trim().min(1).max(5000), name_en: z.string().trim().max(5000).nullable(), name_zh: z.string().trim().max(5000).nullable(),
  product_type: z.enum(productTypes), category_id: z.uuid().nullable(), country_code: z.string().regex(/^[A-Z]{2}$/),
  lead_time_days: z.number().int().positive().nullable(), width_mm: optionalPositiveNumber, depth_mm: optionalPositiveNumber,
  height_mm: optionalPositiveNumber, weight_kg: optionalPositiveNumber, cbm: optionalPositiveNumber,
  material_summary: z.string().trim().max(5000).nullable(), finish_summary: z.string().trim().max(5000).nullable(),
  moq: optionalPositiveNumber, description_th: z.string().trim().max(5000).nullable(), specification_summary: z.string().trim().max(5000).nullable(),
});

export const enrichmentApplySchema = z.object({
  rowIds: z.array(z.uuid()).max(500).nullable(),
  idempotencyKey: z.string().trim().min(8).max(200),
  confirmed: z.literal(true),
}).superRefine((value, context) => {
  if (value.rowIds && new Set(value.rowIds).size !== value.rowIds.length) context.addIssue({ code: "custom", path: ["rowIds"], message: "rowIds ห้ามซ้ำ" });
});
export const enrichmentCancelSchema = z.object({ confirmed: z.literal(true) });

export function isCatalogExcelRoundtripEnabled() {
  return process.env.ENABLE_CATALOG_EXCEL_ROUNDTRIP === "true";
}

export function stableHash(value: unknown) {
  const normalize = (item: unknown): unknown => Array.isArray(item)
    ? item.map(normalize)
    : item && typeof item === "object"
      ? Object.fromEntries(Object.entries(item as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, nested]) => [key, normalize(nested)]))
      : item;
  return createHash("sha256").update(JSON.stringify(normalize(value)) ?? "undefined").digest("hex");
}

export class CatalogExcelError extends Error {
  constructor(public readonly code: string, message: string) { super(message); }
}

export function safeSpreadsheetText(value: unknown) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

export function parseOptionalNumber(value: unknown, integer = false) {
  if (value === null || value === undefined || String(value).trim() === "") return undefined;
  if (value === "#CLEAR") return null;
  const number = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(number) || number <= 0 || (integer && !Number.isInteger(number))) throw new CatalogExcelError("INVALID_NUMBER", "ตัวเลขต้องมากกว่า 0");
  return number;
}

export function parseFactoryCost(value: unknown) {
  if (value === null || value === undefined || String(value).trim() === "") return undefined;
  if (value === "#CLEAR") throw new CatalogExcelError("CLEAR_NOT_ALLOWED", "ห้ามใช้ #CLEAR กับข้อมูลต้นทุน");
  const number = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(number) || number < 0) throw new CatalogExcelError("INVALID_COST", "Factory cost ต้องไม่น้อยกว่า 0");
  return number;
}
