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
  }, 20_000);
});
