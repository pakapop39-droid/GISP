import { describe, expect, it } from "vitest";
import {
  fixedReportToCsv,
  parseReportFilters,
  reportColumns,
  reportFileName,
  translateStatus,
} from "./presentation";
import type { FixedReport } from "./types";

describe("Slice 10 report presentation", () => {
  it("accepts a valid report type, date range and status", () => {
    expect(
      parseReportFilters({
        type: "payment",
        from: "2026-08-01",
        to: "2026-08-31",
        status: "verified",
      }),
    ).toEqual({
      type: "payment",
      dateFrom: "2026-08-01",
      dateTo: "2026-08-31",
      status: "VERIFIED",
    });
  });

  it("normalizes reversed dates and rejects an unrelated status", () => {
    const filters = parseReportFilters({
      type: "claim",
      from: "2026-08-31",
      to: "2026-08-01",
      status: "VERIFIED",
    });
    expect(filters).toMatchObject({
      type: "claim",
      dateFrom: "2026-08-01",
      dateTo: "2026-08-31",
      status: "",
    });
  });

  it("keeps confidential fields out of every fixed report column set", () => {
    const forbidden = [
      "factory_cost",
      "supplier_cost",
      "paid_factory_amount",
      "internal_note",
      "claim_internal_costs",
      "recipient_phone",
      "contact_phone",
      "evidence_file_id",
    ];
    const keys = Object.values(reportColumns).flatMap((columns) =>
      columns.map((column) => column.key),
    );
    expect(keys.filter((key) => forbidden.includes(key))).toEqual([]);
  });

  it("exports only configured fields and neutralizes spreadsheet formulas", () => {
    const report: FixedReport = {
      report_type: "claim",
      generated_at: "2026-08-31T12:00:00.000Z",
      filters: {
        date_from: "2026-08-01",
        date_to: "2026-08-31",
        status: null,
        limit: 500,
        offset: 0,
      },
      row_count: 1,
      rows: [
        {
          id: "claim-id",
          claim_number: "CLM-2026-000001",
          order_number: "ORD-2026-000001",
          member_company: "GISP UAT",
          subject: "=HYPERLINK(\"https://example.com\")",
          issue_type: "DAMAGED",
          severity: "HIGH",
          status: "SUBMITTED",
          confirmed_responsibility: null,
          target_resolution_at: null,
          internal_note: "must never export",
          supplier_cost: 999999,
        },
      ],
    };
    const csv = fixedReportToCsv(report);
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).not.toContain("must never export");
    expect(csv).not.toContain("999999");
    expect(reportFileName(report)).toBe(
      "gisp-claim-report-2026-08-01-to-2026-08-31.csv",
    );
  });

  it("translates canonical statuses into Thai labels", () => {
    expect(translateStatus("OUT_FOR_DELIVERY")).toBe("กำลังนำส่ง");
    expect(translateStatus("WAITING_INFORMATION")).toBe("รอข้อมูลเพิ่มเติม");
  });
});
