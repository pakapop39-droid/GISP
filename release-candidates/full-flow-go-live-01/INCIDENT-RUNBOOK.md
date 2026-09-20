# Incident Runbook — Active Financial Workflow Hold

This is a local candidate runbook. It does not authorize migration Apply, data writes, deployment, or Production action.

1. Keep the Order paused. The database blocks Order-item, Supplier Payment, Production, QC/member-decision, Warehouse, Shipment, Delivery, and related logistics mutations while the hold is `ACTIVE`.
2. Finance reconciles the immutable verified transfers plus append-only approved Adjustment/Reversal records. The Member must submit replacement manual-bank-transfer evidence when money must be restored; Finance verifies it through the existing evidence-bound flow.
3. The resume executor recalculates the affected schedule. It fails closed unless `verified_amount = due_amount` and status is `VERIFIED`.
4. An active staff member with organization-scoped `payments.adjust` confirms the Finance step and records a note.
5. A different active staff member with organization-scoped `orders.manage` confirms the Order Admin step and records a note. One person cannot satisfy both steps even if they hold both permissions.
6. Only the second valid confirmation changes the hold to `RESOLVED`. Every confirmation/resolution is written to `audit_events`; operations remain blocked on any error.

Independent QA must verify same-organization success, cross-organization denial, inactive-session denial, insufficient-balance denial, same-actor denial, audit evidence, and operation blocking before any release decision.
