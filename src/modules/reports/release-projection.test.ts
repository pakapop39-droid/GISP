import { describe, expect, it } from "vitest";
import type { AdminOperationsDashboard } from "./types";
import { projectAdminDashboardForRelease } from "./release-projection";

const dashboard = {
  generated_at: "2026-09-18T00:00:00Z",
  permissions: { reports: true, executive: true },
  metrics: {
    action_required: 4, active_orders: 2, payment_reviews: 1,
    production_delays: 2, qc_actions: 1, shipments_in_transit: 3,
    deliveries_due: 1, open_claims: 1,
  },
  actions: ["PAYMENT_REVIEW", "QC_ACTION", "DELIVERY_DUE", "CLAIM_ACTION"].map((action_type) => ({
    action_type, priority: 1, entity_id: action_type, order_id: "order-1",
    reference: action_type, title: action_type, due_at: null, created_at: "2026-09-18T00:00:00Z",
  })),
} satisfies AdminOperationsDashboard;

describe("admin dashboard C/D API projection", () => {
  it("keeps only C Payment data before D7", () => {
    const result = projectAdminDashboardForRelease(dashboard, "C", []);
    expect(result.metrics).toMatchObject({ action_required: 1, active_orders: 2, payment_reviews: 1,
      production_delays: null, qc_actions: null, shipments_in_transit: null,
      deliveries_due: null, open_claims: null });
    expect(result.actions.map((action) => action.action_type)).toEqual(["PAYMENT_REVIEW"]);
    expect(result.permissions).toMatchObject({ reports: false, executive: false });
  });

  it("adds D actions and metrics only as their slice opens", () => {
    const d7 = projectAdminDashboardForRelease(dashboard, "D", [7]);
    expect(d7.metrics.qc_actions).toBe(1);
    expect(d7.metrics.shipments_in_transit).toBeNull();
    expect(d7.actions.map((action) => action.action_type)).toEqual(["PAYMENT_REVIEW", "QC_ACTION"]);
    const d8 = projectAdminDashboardForRelease(dashboard, "D", [7, 8]);
    expect(d8.metrics.shipments_in_transit).toBe(3);
    expect(d8.metrics.open_claims).toBeNull();
    const d10 = projectAdminDashboardForRelease(dashboard, "D", [7, 8, 9, 10]);
    expect(d10.permissions).toMatchObject({ reports: true, executive: true });
    expect(d10.actions).toHaveLength(4);
  });

  it("does not change unstaged Development behavior or mutate the source", () => {
    expect(projectAdminDashboardForRelease(dashboard, undefined, [])).toBe(dashboard);
    expect(dashboard.metrics.qc_actions).toBe(1);
  });
});
