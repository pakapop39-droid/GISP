import readXlsxFile from "read-excel-file/node";

export const finishImportHeaders = [
  "collection_code",
  "collection_name_th",
  "collection_name_zh",
  "finish_code",
  "finish_name_th",
  "finish_name_zh",
  "material",
  "color_hex",
  "source_document",
  "source_version",
  "source_page",
] as const;

export type FinishImportHeader = (typeof finishImportHeaders)[number];
export type FinishImportSource = Record<FinishImportHeader, string>;
export type FinishImportError = {
  fieldName: FinishImportHeader | null;
  code: string;
  message: string;
};

const requiredHeaders: FinishImportHeader[] = [
  "collection_code",
  "collection_name_th",
  "finish_code",
  "finish_name_th",
  "source_document",
  "source_page",
];

export const finishImportFieldLimits: Partial<Record<FinishImportHeader, number>> = {
  collection_code: 80,
  collection_name_th: 240,
  collection_name_zh: 240,
  finish_code: 80,
  finish_name_th: 240,
  finish_name_zh: 240,
  // Import maps this field to both collection.material_category (240) and finish.material (500).
  material: 240,
  color_hex: 7,
  source_document: 500,
  source_version: 120,
  source_page: 80,
};

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') {
        value += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(value);
      value = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(value);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      value = "";
    } else value += char;
  }
  row.push(value);
  if (row.some((cell) => cell.trim())) rows.push(row);
  return rows;
}

function cellText(value: unknown) {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
}

export async function readFinishImportFile(file: File) {
  const buffer = await file.arrayBuffer();
  const sheetRows = file.name.toLowerCase().endsWith(".csv")
    ? parseCsv(new TextDecoder("utf-8").decode(buffer).replace(/^\uFEFF/, ""))
    : await readXlsxFile(Buffer.from(buffer));
  if (sheetRows.length < 2) throw new Error("FINISH_IMPORT_EMPTY_FILE");
  const headerByColumn = new Map<number, FinishImportHeader>();
  sheetRows[0].forEach((value, index) => {
    const normalized = cellText(value).toLowerCase().replace(/\s+/g, "_");
    if (finishImportHeaders.includes(normalized as FinishImportHeader)) {
      headerByColumn.set(index, normalized as FinishImportHeader);
    }
  });
  const missing = requiredHeaders.filter(
    (header) => ![...headerByColumn.values()].includes(header),
  );
  if (missing.length) throw new Error(`FINISH_IMPORT_MISSING_HEADERS:${missing.join(",")}`);
  const rows = sheetRows.slice(1).flatMap((row, index) => {
    const source = Object.fromEntries(
      finishImportHeaders.map((header) => [header, ""]),
    ) as FinishImportSource;
    for (const [column, header] of headerByColumn) source[header] = cellText(row[column]);
    return Object.values(source).some(Boolean)
      ? [{ rowNumber: index + 2, source }]
      : [];
  });
  if (!rows.length) throw new Error("FINISH_IMPORT_EMPTY_FILE");
  if (rows.length > 1000) throw new Error("FINISH_IMPORT_ROW_LIMIT");
  return rows;
}

export function validateFinishImportRows(input: {
  rows: Array<{ rowNumber: number; source: FinishImportSource }>;
  existing: Array<{ collectionCode: string; finishCode: string }>;
}) {
  const used = new Set(
    input.existing.map((item) => `${item.collectionCode.toUpperCase()}::${item.finishCode.toUpperCase()}`),
  );
  return input.rows.map(({ rowNumber, source }) => {
    const normalized: FinishImportSource = {
      ...source,
      collection_code: source.collection_code.toUpperCase().trim(),
      collection_name_th: source.collection_name_th.trim(),
      collection_name_zh: source.collection_name_zh.trim(),
      finish_code: source.finish_code.toUpperCase().trim(),
      finish_name_th: source.finish_name_th.trim(),
      finish_name_zh: source.finish_name_zh.trim(),
      material: source.material.trim(),
      color_hex: source.color_hex.toUpperCase().trim(),
      source_document: source.source_document.trim(),
      source_version: source.source_version.trim(),
      source_page: source.source_page.trim(),
    };
    const errors: FinishImportError[] = [];
    for (const field of requiredHeaders) {
      if (!normalized[field]) {
        errors.push({ fieldName: field, code: "REQUIRED", message: `${field} จำเป็นต้องมีข้อมูล` });
      }
    }
    for (const field of finishImportHeaders) {
      const limit = finishImportFieldLimits[field];
      if (limit && normalized[field].length > limit) {
        errors.push({ fieldName: field, code: "MAX_LENGTH", message: `${field} ต้องไม่เกิน ${limit} ตัวอักษร` });
      }
    }
    if (normalized.color_hex && !/^#[0-9A-F]{6}$/.test(normalized.color_hex)) {
      errors.push({ fieldName: "color_hex", code: "INVALID_COLOR_HEX", message: "color_hex ต้องเป็นรูปแบบ #RRGGBB" });
    }
    const stableCode = `${normalized.collection_code}::${normalized.finish_code}`;
    if (normalized.collection_code && normalized.finish_code) {
      if (used.has(stableCode)) {
        errors.push({ fieldName: "finish_code", code: "DUPLICATE_FINISH_CODE", message: "รหัสสีซ้ำใน Collection หรือมีอยู่ในคลังแล้ว" });
      } else used.add(stableCode);
    }
    return { rowNumber, source: normalized, errors };
  });
}

export function finishImportTemplateCsv() {
  const example = [
    "COLLECTION-001",
    "ชื่อชุดสี",
    "",
    "FINISH-001",
    "ชื่อสีหรือผิวสำเร็จ",
    "",
    "วัสดุหรือประเภทผิว",
    "",
    "ชื่อเอกสารต้นทาง.pdf",
    "v1",
    "1",
  ];
  return `\uFEFF${finishImportHeaders.join(",")}\r\n${example
    .map((value) => `"${value.replaceAll('"', '""')}"`)
    .join(",")}\r\n`;
}
