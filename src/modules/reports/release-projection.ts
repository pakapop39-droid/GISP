import type { AdminOperationsDashboard, DashboardAction } from "./types";

function visibleAction(action: DashboardAction, slices: number[]) {
  return action.action_type === "PAYMENT_REVIEW" ||
    (action.action_type === "QC_ACTION" && slices.includes(7)) ||
    (action.action_type === "DELIVERY_DUE" && slices.includes(8)) ||
    (action.action_type === "CLAIM_ACTION" && slices.includes(9));
}

/** Removes unreleased operations, not merely their links, from C/D responses. */
export function projectAdminDashboardForRelease(
  dashboard: AdminOperationsDashboard,
  stage: string | undefined,
  slices: number[],
): AdminOperationsDashboard {
  if (stage !== "C" && stage !== "D") return dashboard;
  const actions = dashboard.actions.filter((action) => visibleAction(action, slices));
  return {
    ...dashboard,
    permissions: {
      ...dashboard.permissions,
      reports: slices.includes(10) && dashboard.permissions.reports,
      executive: slices.includes(10) && dashboard.permissions.executive,
    },
    metrics: {
      ...dashboard.metrics,
      action_required: actions.length,
      production_delays: slices.includes(7) ? dashboard.metrics.production_delays : null,
      qc_actions: slices.includes(7) ? dashboard.metrics.qc_actions : null,
      shipments_in_transit: slices.includes(8) ? dashboard.metrics.shipments_in_transit : null,
      deliveries_due: slices.includes(8) ? dashboard.metrics.deliveries_due : null,
      open_claims: slices.includes(9) ? dashboard.metrics.open_claims : null,
    },
    actions,
  };
}
