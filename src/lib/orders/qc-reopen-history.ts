import type { QcReopenEvent } from "./types";

export function isQcReopenPending(qcStatus: string, latestResult?: string) {
  return qcStatus === "IN_PROGRESS" && latestResult === "PASSED";
}

export type QcReopenAuditRow = {
  id: string;
  organization_id: string | null;
  entity_type: string;
  entity_id: string | null;
  action: string;
  actor_user_id: string | null;
  after_data: unknown;
  created_at: string;
};

/** Keep the internal audit projection narrow and tied to this order's items. */
export function projectQcReopenEvents(
  rows: QcReopenAuditRow[],
  orderItemIds: readonly string[],
  organizationId: string,
): QcReopenEvent[] {
  const allowedItems = new Set(orderItemIds);
  return rows.flatMap((row) => {
    if (row.organization_id !== organizationId || row.entity_type !== "order_item"
      || row.action !== "QC_REOPENED" || !row.entity_id || !allowedItems.has(row.entity_id)
      || !row.after_data || typeof row.after_data !== "object" || Array.isArray(row.after_data)) return [];
    const data = row.after_data as Record<string, unknown>;
    if (typeof data.reason !== "string" || !data.reason.trim()
      || typeof data.parent_inspection_id !== "string" || !data.parent_inspection_id) return [];
    return [{
      id: row.id,
      order_item_id: row.entity_id,
      actor_user_id: row.actor_user_id,
      parent_inspection_id: data.parent_inspection_id,
      reason: data.reason.trim(),
      created_at: row.created_at,
    }];
  });
}
