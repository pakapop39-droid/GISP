import { describe, expect, it } from "vitest";
import { createFinishImportPreviewToken, finishImportPreviewTtlMs, verifyFinishImportPreviewToken } from "./finish-import-preview";
import { finishImportHeaders, type FinishImportSource } from "./finish-import";

const row = (code = "A9-1") => ({ rowNumber: 2, source: Object.fromEntries(
  finishImportHeaders.map((header) => [header, header === "finish_code" ? code : header]),
) as FinishImportSource });
const base = { fileBytes: new TextEncoder().encode("manifest"), supplierId: "supplier-1", rows: [row()], signingKey: "server-only-test-key", now: 1_000 };

describe("finish import preview token", () => {
  it("accepts the same file, supplier and normalized result before expiry", () => {
    const token = createFinishImportPreviewToken(base);
    expect(verifyFinishImportPreviewToken({ ...base, previewToken: token.previewToken, now: token.expiresAt })).toBe(true);
  });

  it.each([
    ["file", { fileBytes: new TextEncoder().encode("changed") }],
    ["supplier", { supplierId: "supplier-2" }],
    ["result", { rows: [row("A9-2")] }],
    ["expiry", { now: 1_000 + finishImportPreviewTtlMs + 1 }],
  ])("rejects changed %s", (_name, changed) => {
    const token = createFinishImportPreviewToken(base);
    expect(verifyFinishImportPreviewToken({ ...base, ...changed, previewToken: token.previewToken })).toBe(false);
  });

  it("rejects a tampered token", () => {
    const token = createFinishImportPreviewToken(base);
    expect(verifyFinishImportPreviewToken({ ...base, previewToken: `${token.previewToken}x` })).toBe(false);
  });
});
