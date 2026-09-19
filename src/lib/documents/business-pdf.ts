import "server-only";

import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import { readFile } from "node:fs/promises";
import path from "node:path";

export type BusinessDocumentSection = { marker?: string; title?: string; lines: string[] };
export type BusinessDocument = {
  title: string;
  reference: string;
  companyLines: string[];
  summaryLines: string[];
  sections: BusinessDocumentSection[];
  signatureLabels: string[];
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 42;
const FOOTER_HEIGHT = 30;
const TEXT_SIZE = 9;
const LINE_HEIGHT = 15;

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const tokens = text.split(/\s+/).filter(Boolean);
  if (!tokens.length) return [""];
  const lines: string[] = [];
  let current = "";
  const fittedTokens = tokens.flatMap((token) => {
    if (font.widthOfTextAtSize(token, size) <= maxWidth) return [token];
    const chunks: string[] = [];
    let chunk = "";
    for (const character of Array.from(token)) {
      const candidate = `${chunk}${character}`;
      if (chunk && font.widthOfTextAtSize(candidate, size) > maxWidth) {
        chunks.push(chunk);
        chunk = character;
      } else chunk = candidate;
    }
    if (chunk) chunks.push(chunk);
    return chunks;
  });
  for (const token of fittedTokens) {
    const candidate = current ? `${current} ${token}` : token;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) current = candidate;
    else { if (current) lines.push(current); current = token; }
  }
  if (current) lines.push(current);
  return lines;
}

export async function buildBusinessDocumentPdf(document: BusinessDocument) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const fontBytes = await readFile(path.join(process.cwd(), "public", "fonts", "NotoSansThaiLooped.ttf"));
  // Embedding the complete Thai font avoids intermittent missing glyphs in
  // some PDF viewers when a subset spans many pages.
  const font = await pdf.embedFont(fontBytes, { subset: false });
  const markerFont = await pdf.embedFont(StandardFonts.Helvetica);
  let page!: PDFPage;
  let y = 0;
  const newPage = () => {
    page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN;
    page.drawText(document.title, { x: MARGIN, y, size: 16, font, color: rgb(0.06, 0.12, 0.16) });
    page.drawText(document.reference, { x: MARGIN, y: y - 21, size: 9, font, color: rgb(0.25, 0.3, 0.33) });
    y -= 44;
  };
  const ensureSpace = (height: number) => { if (y - height < MARGIN + FOOTER_HEIGHT) newPage(); };
  const drawLines = (lines: string[], options: { heading?: boolean; gapAfter?: number } = {}) => {
    const size = options.heading ? 10 : TEXT_SIZE;
    for (const source of lines) {
      const wrapped = wrapText(source, font, size, PAGE_WIDTH - MARGIN * 2);
      for (const line of wrapped) {
        ensureSpace(LINE_HEIGHT);
        page.drawText(line, { x: MARGIN, y, size, font, color: rgb(0.08, 0.08, 0.08) });
        y -= LINE_HEIGHT;
      }
    }
    y -= options.gapAfter ?? 4;
  };
  newPage();
  drawLines(document.companyLines, { gapAfter: 8 });
  drawLines(document.summaryLines, { gapAfter: 8 });
  for (const section of document.sections) {
    const firstLineHeight = section.lines[0]
      ? Math.min(wrapText(section.lines[0], font, TEXT_SIZE, PAGE_WIDTH - MARGIN * 2).length, 2) * LINE_HEIGHT
      : 0;
    ensureSpace((section.title ? LINE_HEIGHT + 2 : 0) + firstLineHeight);
    if (section.title) {
      drawLines([section.title], { heading: true, gapAfter: 2 });
      if (section.marker) {
        const markerWidth = markerFont.widthOfTextAtSize(section.marker, 6.5);
        page.drawText(section.marker, { x: PAGE_WIDTH - MARGIN - markerWidth, y: y + LINE_HEIGHT + 2, size: 6.5, font: markerFont, color: rgb(0.45, 0.47, 0.49) });
      }
    }
    drawLines(section.lines, { gapAfter: 8 });
    ensureSpace(5);
    page.drawLine({ start: { x: MARGIN, y: y + 4 }, end: { x: PAGE_WIDTH - MARGIN, y: y + 4 }, thickness: 0.5, color: rgb(0.8, 0.82, 0.84) });
  }
  ensureSpace(75);
  y -= 12;
  const signatureWidth = (PAGE_WIDTH - MARGIN * 2) / document.signatureLabels.length;
  document.signatureLabels.forEach((label, index) => {
    const x = MARGIN + index * signatureWidth;
    page.drawLine({ start: { x: x + 8, y: y - 34 }, end: { x: x + signatureWidth - 8, y: y - 34 }, thickness: 0.6, color: rgb(0.2, 0.2, 0.2) });
    page.drawText(label, { x: x + 8, y: y - 49, size: 8, font });
  });
  const pages = pdf.getPages();
  pages.forEach((current, index) => current.drawText(`${document.reference}  ·  หน้า ${index + 1}/${pages.length}`, { x: MARGIN, y: 22, size: 7.5, font, color: rgb(0.38, 0.4, 0.42) }));
  return pdf.save();
}
