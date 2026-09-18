import { describe, expect, it } from "vitest";
import { isQcReopenPending, projectQcReopenEvents, type QcReopenAuditRow } from "./qc-reopen-history";

const org = "00000000-0000-4000-8000-000000000001";
const item = "00000000-0000-4000-8000-000000000002";
const parent = "00000000-0000-4000-8000-000000000003";

function row(overrides: Partial<QcReopenAuditRow> = {}): QcReopenAuditRow {
  return {
    id: "00000000-0000-4000-8000-000000000004",
    organization_id: org,
    entity_type: "order_item",
    entity_id: item,
    action: "QC_REOPENED",
    actor_user_id: "00000000-0000-4000-8000-000000000005",
    after_data: { qc_status: "IN_PROGRESS", reason: "พบรอยตำหนิหลังตรวจผ่าน", parent_inspection_id: parent },
    created_at: "2026-09-18T04:00:00.000Z",
    ...overrides,
  };
}

describe("QC reopen audit projection", () => {
  it("only enters reinspection mode when a passed QC has been explicitly reopened", () => {
    expect(isQcReopenPending("IN_PROGRESS", "PASSED")).toBe(true);
    expect(isQcReopenPending("PASSED", "PASSED")).toBe(false);
    expect(isQcReopenPending("FAILED", "FAILED")).toBe(false);
    expect(isQcReopenPending("IN_PROGRESS", undefined)).toBe(false);
  });
  it("exposes reason, actor, time and passed-parent reference for the matching item", () => {
    expect(projectQcReopenEvents([row()], [item], org)).toEqual([{
      id: "00000000-0000-4000-8000-000000000004",
      order_item_id: item,
      actor_user_id: "00000000-0000-4000-8000-000000000005",
      parent_inspection_id: parent,
      reason: "พบรอยตำหนิหลังตรวจผ่าน",
      created_at: "2026-09-18T04:00:00.000Z",
    }]);
  });

  it("does not project another organization, another item, or malformed audit payloads", () => {
    expect(projectQcReopenEvents([
      row({ organization_id: "another-org" }),
      row({ entity_id: "another-item" }),
      row({ action: "QC_PASSED" }),
      row({ after_data: { reason: "", parent_inspection_id: parent } }),
      row({ after_data: { reason: "reason" } }),
    ], [item], org)).toEqual([]);
  });
});
