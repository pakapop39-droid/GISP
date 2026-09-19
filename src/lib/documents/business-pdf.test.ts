import { PDFArray, PDFDocument, PDFRawStream, decodePDFRawStream } from "pdf-lib";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { buildBusinessDocumentPdf } from "./business-pdf";

function extractAsciiMarkers(pdf: PDFDocument, pageIndex: number, prefix: string) {
  const contents = pdf.getPages()[pageIndex].node.Contents();
  if (!contents) return [];
  const refs = contents instanceof PDFArray ? contents.asArray() : [contents];
  const text = refs.map((ref) => {
    const stream = pdf.context.lookup(ref) as PDFRawStream;
    return new TextDecoder().decode(decodePDFRawStream(stream).decode());
  }).join("\n");
  return [...text.matchAll(/<([0-9A-F]+)> Tj/g)]
    .map((match) => Buffer.from(match[1], "hex").toString("latin1"))
    .filter((value) => value.startsWith(prefix));
}

describe("business PDF", () => {
  it("renders every marker exactly once across an 80-row Thai document", async () => {
    const expected = Array.from({ length: 80 }, (_, index) => `ROW-${String(index + 1).padStart(3, "0")}`);
    const bytes = await buildBusinessDocumentPdf({
      title: "ใบสั่งซื้อสินค้า",
      reference: "PO-2026-000001",
      companyLines: ["บริษัท Global Interior Supply Platform"],
      summaryLines: ["เอกสารทดสอบหลายหน้า"],
      sections: expected.map((marker, index) => ({
        marker,
        title: `รายการ ${index + 1}`,
        lines: [
          `รายละเอียดสินค้า ${"ทดสอบข้อความภาษาไทย".repeat(5)}`,
          `จำนวน ${index + 1} ชิ้น × 100.00 CNY`,
        ],
      })),
      signatureLabels: ["ผู้จัดทำ", "ผู้อนุมัติ", "ผู้รับเอกสาร"],
    });
    const pdf = await PDFDocument.load(bytes);
    const byPage = pdf.getPages().map((_, pageIndex) => extractAsciiMarkers(pdf, pageIndex, "ROW-"));
    const rendered = byPage.flat();

    expect(pdf.getPageCount()).toBeGreaterThan(5);
    expect(rendered).toEqual(expected);
    expect(new Set(rendered).size).toBe(expected.length);
    expect(byPage.slice(1, -1).every((markers) => markers.length > 0)).toBe(true);
  }, 20_000);
});
