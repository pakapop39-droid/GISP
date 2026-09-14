import { describe, expect, it } from "vitest";
import {
  finishImportFieldLimits,
  finishImportHeaders,
  readFinishImportFile,
  validateFinishImportRows,
  type FinishImportSource,
  finishImportTemplateCsv,
} from "./finish-import";

function source(values: Partial<FinishImportSource>): FinishImportSource {
  return Object.fromEntries(
    finishImportHeaders.map((header) => [header, values[header] ?? ""]),
  ) as FinishImportSource;
}

describe("finish manifest dry-run validation", () => {
  it("generates a supplier-neutral finish template", () => {
    const template = finishImportTemplateCsv();
    expect(template).toContain("COLLECTION-001");
    expect(template).toContain("FINISH-001");
    expect(template).not.toMatch(/TIMEI|A9/i);
  });
  it("reads a reviewed CSV manifest with all required source references", async () => {
    const csv = [
      "collection_code,collection_name_th,finish_code,finish_name_th,source_document,source_page",
      "A9,ชุดสี A9,A9-6001,สี A9-6001,A9 large color card,1",
    ].join("\r\n");
    const rows = await readFinishImportFile(new File([csv], "finishes.csv", { type: "text/csv" }));
    expect(rows).toHaveLength(1);
    expect(rows[0].source.source_document).toBe("A9 large color card");
    expect(rows[0].source.source_page).toBe("1");
  });

  it("rejects a manifest missing source reference columns", async () => {
    const file = new File([
      "collection_code,collection_name_th,finish_code,finish_name_th\r\nA9,ชุดสี A9,A9-6001,สี",
    ], "finishes.csv", { type: "text/csv" });
    await expect(readFinishImportFile(file)).rejects.toThrow("FINISH_IMPORT_MISSING_HEADERS:source_document,source_page");
  });

  it("normalizes stable codes and accepts a complete reviewed row", () => {
    const [row] = validateFinishImportRows({
      existing: [],
      rows: [{ rowNumber: 2, source: source({
        collection_code: "a9", collection_name_th: "ชุดสี A9",
        finish_code: "a9-6001", finish_name_th: "สี A9-6001",
        source_document: "A9 large color card", source_page: "1",
      }) }],
    });
    expect(row.errors).toEqual([]);
    expect(row.source.collection_code).toBe("A9");
    expect(row.source.finish_code).toBe("A9-6001");
  });

  it("rejects missing provenance and duplicate collection+finish code", () => {
    const rows = validateFinishImportRows({
      existing: [{ collectionCode: "A9", finishCode: "A9-6001" }],
      rows: [{ rowNumber: 2, source: source({
        collection_code: "A9", collection_name_th: "ชุดสี A9",
        finish_code: "A9-6001", finish_name_th: "สี A9-6001",
      }) }],
    });
    expect(rows[0].errors.map((error) => error.code)).toEqual([
      "REQUIRED", "REQUIRED", "DUPLICATE_FINISH_CODE",
    ]);
  });

  it.each(Object.entries(finishImportFieldLimits))(
    "accepts %s exactly at its schema limit",
    (field, limit) => {
      const value = field === "color_hex" ? "#AABBCC" : "A".repeat(limit!);
      const [row] = validateFinishImportRows({
        existing: [],
        rows: [{ rowNumber: 2, source: source({
          collection_code: "A9", collection_name_th: "ชุดสี A9",
          finish_code: "A9-6001", finish_name_th: "สี A9-6001",
          source_document: "A9 large color card", source_page: "1",
          [field]: value,
        }) }],
      });
      expect(row.errors.filter((error) => error.code === "MAX_LENGTH")).toEqual([]);
    },
  );

  it.each(Object.entries(finishImportFieldLimits).filter(([field]) => field !== "color_hex"))(
    "rejects %s over its schema limit",
    (field, limit) => {
      const [row] = validateFinishImportRows({
        existing: [],
        rows: [{ rowNumber: 2, source: source({
          collection_code: "A9", collection_name_th: "ชุดสี A9",
          finish_code: "A9-6001", finish_name_th: "สี A9-6001",
          source_document: "A9 large color card", source_page: "1",
          [field]: "A".repeat(limit! + 1),
        }) }],
      });
      expect(row.errors).toContainEqual(expect.objectContaining({ fieldName: field, code: "MAX_LENGTH" }));
    },
  );
});
