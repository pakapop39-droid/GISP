import { PDFArray, PDFDocument, PDFRawStream, decodePDFRawStream } from "pdf-lib";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { buildBusinessDocumentPdf } from "./business-pdf";

function markers(pdf: PDFDocument, prefix: string) {
  return pdf.getPages().flatMap((page) => {
    const contents = page.node.Contents();
    if (!contents) return [];
    const refs = contents instanceof PDFArray ? contents.asArray() : [contents];
    return refs.flatMap((ref) => {
      const stream = pdf.context.lookup(ref) as PDFRawStream;
      const source = new TextDecoder().decode(decodePDFRawStream(stream).decode());
      return [...source.matchAll(/<([0-9A-F]+)> Tj/g)].map((match) => Buffer.from(match[1], "hex").toString("latin1")).filter((value) => value.startsWith(prefix));
    });
  });
}

function textPositions(pdf: PDFDocument) {
  return pdf.getPages().flatMap((page) => {
    const contents = page.node.Contents();
    if (!contents) return [];
    const refs = contents instanceof PDFArray ? contents.asArray() : [contents];
    return refs.flatMap((ref) => {
      const stream = pdf.context.lookup(ref) as PDFRawStream;
      const source = new TextDecoder().decode(decodePDFRawStream(stream).decode());
      return [...source.matchAll(/1 0 0 1 [-\d.]+ ([-\d.]+) Tm\s*<[^>]+> Tj/g)].map((match) => Number(match[1]));
    });
  });
}

describe("business PDF", () => {
  it("renders every row marker exactly once across a multi-page Thai document", async () => {
    const expected = Array.from({ length: 60 }, (_, index) => `ROW-${String(index + 1).padStart(3, "0")}`);
    const bytes = await buildBusinessDocumentPdf({
      title: "เอกสารธุรกิจ", reference: "DOC-1", companyLines: ["บริษัททดสอบ"], summaryLines: ["สรุป"],
      sections: expected.map((marker, index) => ({ marker, title: `รายการ ${index + 1}`, lines: ["รายละเอียดภาษาไทย".repeat(5)] })),
      signatureLabels: ["ผู้จัดทำ", "ผู้อนุมัติ"],
    });
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBeGreaterThan(2);
    expect(markers(pdf, "ROW-")).toEqual(expected);
    expect(markers(pdf, "PAGE-")).toEqual(Array.from({ length: pdf.getPageCount() }, (_, index) => `PAGE-${String(index + 1).padStart(3, "0")}`));
  }, 20_000);

  it("repeats a continuation heading without dropping or clipping rows from one long section", async () => {
    const expected = Array.from({ length: 180 }, (_, index) => `LINE-${String(index + 1).padStart(3, "0")}`);
    const bytes = await buildBusinessDocumentPdf({
      title: "ใบสั่งซื้อ", reference: "PO-MULTIPAGE", companyLines: ["บริษัททดสอบ"], summaryLines: ["สรุป"],
      sections: [{ title: "รายการสินค้า", lines: expected }],
      signatureLabels: ["ผู้จัดทำ", "ผู้อนุมัติ"],
    });
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBeGreaterThan(2);
    expect(markers(pdf, "CONTINUED")).toHaveLength(pdf.getPageCount() - 1);
    expect(markers(pdf, "PAGE-")).toHaveLength(pdf.getPageCount());
    const positions = textPositions(pdf);
    expect(positions).toHaveLength((6 * pdf.getPageCount()) + 183);
    expect(positions.every((position) => position === 22 || position >= 42 + 30)).toBe(true);
  }, 20_000);
});
