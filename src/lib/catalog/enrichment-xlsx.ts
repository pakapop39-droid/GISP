import "server-only";

import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import readXlsxFile from "read-excel-file/node";
import {
  CATALOG_EXCEL_MAX_BYTES, CATALOG_EXCEL_MAX_PART_BYTES, CATALOG_EXCEL_MAX_RATIO,
  CATALOG_EXCEL_MAX_ROWS, CATALOG_EXCEL_MAX_UNCOMPRESSED_BYTES, CATALOG_EXCEL_MIME,
  CATALOG_EXCEL_SCHEMA_VERSION, CatalogExcelError, costColumns, metaColumns, productColumns,
} from "./excel-roundtrip";

type Cell = string | number | boolean | Date | null;
export type ExportDetail = Record<string, string | number | null>;
export type ExportCost = { factory_cost: number | string | null; currency: string | null; exchange_rate_to_thb: number | string | null; effective_from: string | null; status: string | null } | null;
export type EnrichmentExportRow = { rowKey: string; importRowId: string; productId: string | null; sourcePage: number | null; detail: ExportDetail; cost: ExportCost; baselineDetailHash: string; baselineCostHash: string | null };

function escapeXml(value: unknown) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}
function columnName(index: number) { let output = ""; for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) output = String.fromCharCode(65 + ((n - 1) % 26)) + output; return output; }
function cellXml(value: Cell, row: number, column: number, unlocked = false) {
  const ref = `${columnName(column)}${row}`; const style = unlocked ? ' s="1"' : "";
  if (value === null || value === undefined || value === "") return `<c r="${ref}"${style}/>`;
  if (typeof value === "number" && Number.isFinite(value)) return `<c r="${ref}"${style}><v>${value}</v></c>`;
  if (typeof value === "boolean") return `<c r="${ref}" t="b"${style}><v>${value ? 1 : 0}</v></c>`;
  const text = value instanceof Date ? value.toISOString() : String(value);
  return `<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${escapeXml(text)}</t></is></c>`;
}
function columnsXml(widths: readonly number[] | undefined, hiddenFirst = false) {
  if (!widths?.length) return hiddenFirst ? '<cols><col min="1" max="1" hidden="1"/></cols>' : "";
  return `<cols>${widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"${hiddenFirst && index === 0 ? ' hidden="1"' : ""}/>`).join("")}</cols>`;
}
function sheetXml(rows: Cell[][], options: { unlockedFrom?: number; unlockedTo?: number; hiddenFirst?: boolean; validations?: string; columnWidths?: readonly number[]; protect?: boolean } = {}) {
  const body = rows.map((values, rowIndex) => `<row r="${rowIndex + 1}">${values.map((value, columnIndex) => cellXml(value, rowIndex + 1, columnIndex, rowIndex > 0 && options.unlockedFrom !== undefined && columnIndex >= options.unlockedFrom && columnIndex <= (options.unlockedTo ?? options.unlockedFrom))).join("")}</row>`).join("");
  const protection = options.protect === false ? "" : '<sheetProtection sheet="1" objects="1" scenarios="1" formatColumns="1"/>';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${columnsXml(options.columnWidths, options.hiddenFirst)}<sheetData>${body}</sheetData>${protection}${options.validations ?? ""}</worksheet>`;
}

export function buildCatalogEnrichmentWorkbook(input: { workbookId: string; jobId: string; exportedAt: string; rows: EnrichmentExportRow[]; categories: string[]; countries: string[]; includeCosts: boolean }) {
  if (input.rows.length < 1 || input.rows.length > CATALOG_EXCEL_MAX_ROWS) throw new CatalogExcelError("ROW_LIMIT", "รองรับ 1–1,000 รายการ");
  const instructions: Cell[][] = [["PDF Catalog Excel Round-trip v1.0"], ["กรอกเฉพาะช่องที่ต้องการเปลี่ยน ช่องว่างหมายถึงคงค่าเดิม"], ["ใช้ #CLEAR เพื่อล้างได้เฉพาะข้อมูลสินค้าแบบไม่บังคับ ห้ามใช้กับ SKU ชื่อไทย ประเภท ประเทศ และต้นทุน"], ["ห้ามเพิ่มแถว เปลี่ยน row_key ใส่สูตร Macro หรือลิงก์ภายนอก"], ["ต้นทุนใหม่เป็น Factory Cost เท่านั้น Member Price เป็น Preview และต้อง Activate ในหน้าราคาปกติ"]];
  const products: Cell[][] = [Array.from(productColumns)];
  const costs: Cell[][] = [Array.from(costColumns)];
  const meta: Cell[][] = [Array.from(metaColumns)];
  for (const row of input.rows) {
    products.push([row.rowKey,row.sourcePage,row.detail.sku,row.detail.factory_sku,row.detail.name_th,row.detail.name_en,row.detail.name_zh,row.detail.product_type,row.detail.category_code,row.detail.country_code,row.detail.lead_time_days,row.detail.width_mm,row.detail.depth_mm,row.detail.height_mm,row.detail.weight_kg,row.detail.cbm,row.detail.material_summary,row.detail.finish_summary,row.detail.moq,row.detail.description_th,row.detail.specification_summary] as Cell[]);
    if (input.includeCosts) costs.push([row.rowKey,row.cost?.factory_cost ?? null,row.cost?.currency ?? null,row.cost?.exchange_rate_to_thb ?? null,row.cost?.status ?? null,null,null,null,null]);
    meta.push([CATALOG_EXCEL_SCHEMA_VERSION,input.workbookId,input.jobId,input.exportedAt,row.rowKey,row.importRowId,row.productId,row.baselineDetailHash,row.baselineCostHash]);
  }
  const maxRows = input.rows.length + 1;
  const validations = `<dataValidations count="3"><dataValidation type="list" allowBlank="0" sqref="H2:H${maxRows}"><formula1>Lists!$C$2:$C$${input.includeCosts ? 8 : 8}</formula1></dataValidation><dataValidation type="list" allowBlank="1" sqref="I2:I${maxRows}"><formula1>Lists!$A$2:$A$${Math.max(2,input.categories.length+1)}</formula1></dataValidation><dataValidation type="list" allowBlank="0" sqref="J2:J${maxRows}"><formula1>Lists!$B$2:$B$${Math.max(2,input.countries.length+1)}</formula1></dataValidation></dataValidations>`;
  const listRows: Cell[][] = [["category_code","country_code","product_type"]];
  const types = ["STANDARD","CUSTOM_TEMPLATE","READY_TO_ORDER","BUILT_IN","MATERIAL","EQUIPMENT","DECORATIVE"];
  for (let index=0; index<Math.max(input.categories.length,input.countries.length,types.length); index++) listRows.push([input.categories[index]??null,input.countries[index]??null,types[index]??null]);
  const sheets = input.includeCosts ? ["Instructions","Products","Costs","Lists","__Meta"] : ["Instructions","Products","Lists","__Meta"];
  const workbookSheets = sheets.map((name,index)=>`<sheet name="${escapeXml(name)}" sheetId="${index+1}" r:id="rId${index+1}"${name==="__Meta"||name==="Lists"?' state="hidden"':""}/>`).join("");
  const rels = sheets.map((_name,index)=>`<Relationship Id="rId${index+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index+1}.xml"/>`).join("");
  const overrides = sheets.map((_name,index)=>`<Override PartName="/xl/worksheets/sheet${index+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("");
  const files: Record<string,Uint8Array> = {
    "[Content_Types].xml":strToU8(`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${overrides}</Types>`),
    "_rels/.rels":strToU8(`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
    "xl/workbook.xml":strToU8(`<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><workbookPr/><bookViews><workbookView/></bookViews><sheets>${workbookSheets}</sheets></workbook>`),
    "xl/_rels/workbook.xml.rels":strToU8(`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}<Relationship Id="rId${sheets.length+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`),
    "xl/styles.xml":strToU8(`<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="Aptos"/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyProtection="1"><protection locked="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyProtection="1"><protection locked="0"/></xf></cellXfs></styleSheet>`),
  };
  const productWidths = [2,12,18,18,28,28,24,20,18,14,16,12,12,12,12,12,28,24,10,40,40] as const;
  const costWidths = [2,20,16,28,20,18,14,24,18] as const;
  const content = [sheetXml(instructions,{columnWidths:[90],protect:false}),sheetXml(products,{unlockedFrom:2,unlockedTo:20,hiddenFirst:true,validations,columnWidths:productWidths,protect:false}),...(input.includeCosts?[sheetXml(costs,{unlockedFrom:5,unlockedTo:8,hiddenFirst:true,columnWidths:costWidths,protect:false})]:[]),sheetXml(listRows),sheetXml(meta,{hiddenFirst:false})];
  content.forEach((xml,index)=>{files[`xl/worksheets/sheet${index+1}.xml`]=strToU8(xml);});
  return zipSync(files,{level:6});
}

function readUint16(bytes: Uint8Array, offset: number) { return bytes[offset] | (bytes[offset+1]<<8); }
function readUint32(bytes: Uint8Array, offset: number) { return (bytes[offset] | (bytes[offset+1]<<8) | (bytes[offset+2]<<16) | (bytes[offset+3]<<24))>>>0; }
export function validateCatalogEnrichmentArchive(file: File, bytes: Uint8Array) {
  if (!file.name.toLowerCase().endsWith(".xlsx") || file.name.toLowerCase().endsWith(".xlsm") || file.type!==CATALOG_EXCEL_MIME) throw new CatalogExcelError("XLSX_TYPE_INVALID","รองรับเฉพาะ .xlsx ที่มี MIME ถูกต้อง");
  if (bytes.length<4 || bytes.length>CATALOG_EXCEL_MAX_BYTES || bytes[0]!==0x50 || bytes[1]!==0x4b) throw new CatalogExcelError("XLSX_SIZE_OR_SIGNATURE_INVALID","ไฟล์ต้องไม่เกิน 10 MB และมี ZIP signature ถูกต้อง");
  let eocd=-1; for(let index=bytes.length-22; index>=Math.max(0,bytes.length-65557); index--){if(readUint32(bytes,index)===0x06054b50){eocd=index;break;}}
  if(eocd<0) throw new CatalogExcelError("XLSX_MALFORMED","ไม่พบ ZIP central directory");
  const count=readUint16(bytes,eocd+10); if(count<1||count>5000)throw new CatalogExcelError("XLSX_MALFORMED","จำนวน ZIP parts ผิดปกติ"); let offset=readUint32(bytes,eocd+16); let total=0; const names=new Set<string>();
  for(let index=0; index<count; index++){
    if(offset+46>bytes.length||readUint32(bytes,offset)!==0x02014b50) throw new CatalogExcelError("XLSX_MALFORMED","ZIP central directory เสียหาย");
    const flags=readUint16(bytes,offset+8), compressed=readUint32(bytes,offset+20), uncompressed=readUint32(bytes,offset+24), nameLength=readUint16(bytes,offset+28), extraLength=readUint16(bytes,offset+30), commentLength=readUint16(bytes,offset+32);
    if(offset+46+nameLength+extraLength+commentLength>bytes.length)throw new CatalogExcelError("XLSX_MALFORMED","ZIP part ถูกตัดไม่ครบ");
    const name=strFromU8(bytes.subarray(offset+46,offset+46+nameLength));const normalizedName=name.toLowerCase();
    if((flags&1)!==0) throw new CatalogExcelError("XLSX_ENCRYPTED","ไม่รองรับไฟล์เข้ารหัส");
    if(!name||name.includes("\\")||name.startsWith("/")||name.split("/").includes("..")||names.has(normalizedName)) throw new CatalogExcelError("XLSX_UNSAFE_PATH","พบ path หรือ part ซ้ำที่ไม่ปลอดภัย");
    names.add(normalizedName); total+=uncompressed;
    if(uncompressed>CATALOG_EXCEL_MAX_PART_BYTES||total>CATALOG_EXCEL_MAX_UNCOMPRESSED_BYTES||(uncompressed>0&&(compressed===0||uncompressed/compressed>CATALOG_EXCEL_MAX_RATIO))) throw new CatalogExcelError("XLSX_ZIP_BOMB","ไฟล์ขยายตัวเกินขีดจำกัดความปลอดภัย");
    offset+=46+nameLength+extraLength+commentLength;
  }
  const lower=[...names];
  if(lower.some(name=>name.includes("vbaproject")||name.startsWith("xl/externallinks/")||name==="encryptedpackage"||name==="encryptioninfo")) throw new CatalogExcelError("XLSX_ACTIVE_CONTENT","ห้าม Macro, encryption และ external links");
  const entries=unzipSync(bytes); const xmlText=Object.entries(entries).filter(([name])=>name.endsWith(".xml")||name.endsWith(".rels")).map(([,value])=>strFromU8(value)).join("\n");
  if(/<(?:[A-Za-z0-9_]+:)?f(?:\s|>)/i.test(xmlText)) throw new CatalogExcelError("XLSX_FORMULA_NOT_ALLOWED","ห้ามใช้สูตรใน Workbook");
  if(/TargetMode\s*=\s*["']External["']/i.test(xmlText)||/macroEnabled|vbaProject/i.test(xmlText)) throw new CatalogExcelError("XLSX_ACTIVE_CONTENT","ห้าม Macro และ external links");
  const workbookXml=entries["xl/workbook.xml"]?strFromU8(entries["xl/workbook.xml"]):"";const sheetNames=[...workbookXml.matchAll(/<sheet\s+[^>]*name="([^"]+)"/g)].map(match=>match[1]);
  if(sheetNames.length<4||sheetNames.length>5||new Set(sheetNames).size!==sheetNames.length||sheetNames.some(name=>!["Instructions","Products","Costs","Lists","__Meta"].includes(name))||!["Instructions","Products","Lists","__Meta"].every(name=>sheetNames.includes(name)))throw new CatalogExcelError("XLSX_SCHEMA_MISMATCH","ชื่อหรือจำนวน Sheet ไม่ตรง PXR-1.0");
  return entries;
}

function rowsToObjects(rows: Cell[][], expected: readonly string[], label: string) {
  const headers=(rows[0]??[]).map(value=>String(value??"").trim());
  if(headers.length!==expected.length||expected.some((header,index)=>headers[index]!==header)) throw new CatalogExcelError("XLSX_SCHEMA_MISMATCH",`${label} มีคอลัมน์ไม่ตรง PXR-1.0`);
  return rows.slice(1).filter(row=>row.some(cell=>cell!==null&&String(cell).trim()!=="")).map(row=>Object.fromEntries(expected.map((header,index)=>[header,row[index]??null])));
}

export async function parseCatalogEnrichmentWorkbook(file: File) {
  const bytes=new Uint8Array(await file.arrayBuffer()); validateCatalogEnrichmentArchive(file,bytes);
  const buffer=Buffer.from(bytes);
  let products: Cell[][], meta: Cell[][], costs: Cell[][]|null=null;
  try {
    const sheets=await readXlsxFile(buffer) as unknown as {sheet:string;data:Cell[][]}[];
    products=(sheets.find(sheet=>sheet.sheet==="Products")?.data??[]) as Cell[][];
    meta=(sheets.find(sheet=>sheet.sheet==="__Meta")?.data??[]) as Cell[][];
    costs=(sheets.find(sheet=>sheet.sheet==="Costs")?.data??null) as Cell[][]|null;
  } catch { throw new CatalogExcelError("XLSX_MALFORMED","อ่าน Workbook หรือ Sheet ที่บังคับไม่ได้"); }
  const productRows=rowsToObjects(products,productColumns,"Products");
  const metaRows=rowsToObjects(meta,metaColumns,"__Meta");
  const costRows=costs?rowsToObjects(costs,costColumns,"Costs"):[];
  if(productRows.length>CATALOG_EXCEL_MAX_ROWS||metaRows.length>CATALOG_EXCEL_MAX_ROWS||costRows.length>CATALOG_EXCEL_MAX_ROWS) throw new CatalogExcelError("XLSX_ROW_LIMIT","รองรับสูงสุด 1,000 รายการ");
  return {bytes,productRows,metaRows,costRows,hasCosts:costs!==null};
}
