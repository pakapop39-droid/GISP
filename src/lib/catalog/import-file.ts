import readXlsxFile from "read-excel-file/node";

export const catalogImportHeaders = ["sku","factory_sku","name_th","name_en","product_type","category_code","country_code","lead_time_days","width_mm","depth_mm","height_mm","weight_kg","cbm","material_summary","finish_summary","moq","description_th","specification_summary"] as const;
export type CatalogImportHeader = (typeof catalogImportHeaders)[number];
export type CatalogImportSource = Record<CatalogImportHeader, string>;
export type CatalogImportError = { fieldName: CatalogImportHeader | null; code: string; message: string };

const requiredHeaders: CatalogImportHeader[] = ["sku", "name_th", "product_type"];
const productTypes = new Set(["STANDARD","CUSTOM_TEMPLATE","READY_TO_ORDER","BUILT_IN","MATERIAL","EQUIPMENT","DECORATIVE"]);

function parseCsv(text: string) {
  const rows: string[][] = []; let row: string[] = []; let value = ""; let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') { value += '"'; index += 1; }
      else quoted = !quoted;
    } else if (char === "," && !quoted) { row.push(value); value = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(value); if (row.some((cell) => cell.trim())) rows.push(row); row = []; value = "";
    } else value += char;
  }
  row.push(value); if (row.some((cell) => cell.trim())) rows.push(row);
  return rows;
}

function cellText(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
}

export async function readCatalogImportFile(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  const sheetRows = file.name.toLowerCase().endsWith(".csv")
    ? parseCsv(new TextDecoder("utf-8").decode(arrayBuffer).replace(/^\uFEFF/, ""))
    : await readXlsxFile(Buffer.from(arrayBuffer));
  if (sheetRows.length < 2) throw new Error("IMPORT_EMPTY_FILE");
  const headerByColumn = new Map<number, CatalogImportHeader>();
  sheetRows[0].forEach((value, index) => {
    const normalized = cellText(value).toLowerCase().replace(/\s+/g, "_");
    if (catalogImportHeaders.includes(normalized as CatalogImportHeader)) headerByColumn.set(index, normalized as CatalogImportHeader);
  });
  const missing = requiredHeaders.filter((header) => ![...headerByColumn.values()].includes(header));
  if (missing.length) throw new Error(`IMPORT_MISSING_HEADERS:${missing.join(",")}`);
  const rows = sheetRows.slice(1).flatMap((row, index) => {
    const source = Object.fromEntries(catalogImportHeaders.map((header) => [header, ""])) as CatalogImportSource;
    for (const [column, header] of headerByColumn) source[header] = cellText(row[column]);
    return Object.values(source).some(Boolean) ? [{ rowNumber: index + 2, source }] : [];
  });
  if (!rows.length) throw new Error("IMPORT_EMPTY_FILE");
  if (rows.length > 1000) throw new Error("IMPORT_ROW_LIMIT");
  return { headers: [...headerByColumn.values()], rows };
}

function positiveNumber(value: string, fieldName: CatalogImportHeader, errors: CatalogImportError[]) {
  if (!value) return;
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) errors.push({ fieldName, code: "INVALID_POSITIVE_NUMBER", message: `${fieldName} ต้องเป็นตัวเลขมากกว่า 0` });
}

export function validateCatalogImportRows(input: { rows: Array<{ rowNumber: number; source: CatalogImportSource }>; supplierId: string; categories: Array<{ id: string; code: string }>; existingSkus: string[] }) {
  const categoryByCode = new Map(input.categories.map((item) => [item.code.toUpperCase(), item.id]));
  const usedSkus = new Set(input.existingSkus.map((sku) => sku.toUpperCase()));
  return input.rows.map(({ rowNumber, source }) => {
    const normalized: CatalogImportSource = { ...source, sku: source.sku.toUpperCase(), factory_sku: source.factory_sku.trim(), name_th: source.name_th.trim(), name_en: source.name_en.trim(), product_type: source.product_type.toUpperCase(), category_code: source.category_code.toUpperCase(), country_code: (source.country_code || "CN").toUpperCase() };
    const errors: CatalogImportError[] = [];
    if (!normalized.sku) errors.push({ fieldName: "sku", code: "REQUIRED", message: "ต้องมี SKU" });
    else if (usedSkus.has(normalized.sku)) errors.push({ fieldName: "sku", code: "DUPLICATE_SKU", message: "SKU ซ้ำในไฟล์หรือมีอยู่ใน Catalog แล้ว" });
    else usedSkus.add(normalized.sku);
    if (!normalized.name_th) errors.push({ fieldName: "name_th", code: "REQUIRED", message: "ต้องมีชื่อสินค้าไทย" });
    if (!productTypes.has(normalized.product_type)) errors.push({ fieldName: "product_type", code: "INVALID_PRODUCT_TYPE", message: "ประเภทสินค้าไม่อยู่ในรายการที่ระบบรองรับ" });
    if (!/^[A-Z]{2}$/.test(normalized.country_code)) errors.push({ fieldName: "country_code", code: "INVALID_COUNTRY", message: "รหัสประเทศต้องมี 2 ตัวอักษร เช่น CN" });
    const categoryId = normalized.category_code ? categoryByCode.get(normalized.category_code) ?? null : null;
    if (normalized.category_code && !categoryId) errors.push({ fieldName: "category_code", code: "CATEGORY_NOT_FOUND", message: "ไม่พบรหัสหมวดสินค้าในระบบ" });
    (["lead_time_days","width_mm","depth_mm","height_mm","weight_kg","cbm","moq"] as CatalogImportHeader[]).forEach((field) => positiveNumber(normalized[field], field, errors));
    return { rowNumber, source: { ...normalized, supplierId: input.supplierId, categoryId }, errors };
  });
}

export function catalogImportTemplateCsv() {
  const example = ["TEST-001","FACTORY-001","เก้าอี้ตัวอย่าง","Sample chair","STANDARD","CHAIR_STOOL","CN","45","600","650","820","8.5","0.32","โครงไม้จริง หุ้มผ้า","สีตามภาพ","1","สินค้า Import ตัวอย่าง","W600 × D650 × H820 mm"];
  return `\uFEFF${catalogImportHeaders.join(",")}\r\n${example.map((value) => `"${value.replaceAll('"', '""')}"`).join(",")}\r\n`;
}
