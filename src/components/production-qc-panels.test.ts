import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "src/components/production-qc-panels.tsx"), "utf8");
const loader = readFileSync(resolve(process.cwd(), "src/lib/orders/server.ts"), "utf8");

describe("QC reopen UI integration", () => {
  it("shows a reason-required reopen command after pass", () => {
    expect(source).toContain("เปิดตรวจ QC ใหม่ก่อน Dispatch");
    expect(source).toContain("reopenReason.trim().length < 3");
    expect(source).toContain('post("/api/admin/qc-inspections/reopen"');
  });

  it("renders a passed-parent reinspection and internal audit history", () => {
    expect(source).toContain("isQcReopenPending(item.qc_status, latestInspection?.result)");
    expect(source).toContain('inspection_type: failed || reopenPending ? "REINSPECTION" : "INITIAL"');
    expect(source).toContain("parent_inspection_id: failed?.id ?? (reopenPending ? latestInspection?.id : undefined)");
    expect(source).toContain("qcReopenEvents?.filter");
    expect(source).toContain("reopen.reason");
    expect(source).toContain("reopen.actor_user_id");
    expect(source).toContain("qcHistoryTimeline(inspections, reopenEvents)");
    expect(source).toContain("qcHistoryTitle(inspection, parentResult)");
  });

  it("hides QC controls and audit projection when this order's organization lacks qc.manage", () => {
    expect(loader).toContain('database.rpc("has_permission", {');
    expect(loader).toContain('permission_code: "qc.manage"');
    expect(loader).toContain('target_organization_id: String(orderRow.organization_id)');
    expect(loader).toContain('capabilities: { ...capabilities, manageQc: canManageQcForOrder }');
    expect(loader).toContain('mode === "admin" && canManageQcForOrder && itemIds.length');
    expect(source).toContain("capabilities.manageQc ? <section");
  });
});
