# GISP Release C Hardening — Implementation Approval Record v0.1

- `approval_level`: Scope Approved and Implementation Authorized; not Production Release Authorized.
- `approved_by`: ภคภพ ช.เจริญยิ่ง (owner).
- `approval_text_or_reference`: “อนุมัติ Scope และ Implementation RLC-HARDEN-01 v0.1 บน Local/isolated worktree ตามขอบเขตที่เสนอ โดยไม่อนุญาตแก้ข้อมูลหรือ Production”.
- `scope_document_version`: `RLC-HARDEN-01 v0.1`.
- `environment`: Local isolated worktree `C:\Users\ASUS\.codex\worktrees\rlc-harden-01\GISP` only, branch `codex/rlc-harden-01`, based on commit `11db3010245b3094120903fa4c2623e5e6b2473c` / tree `eb30e105663609bd01815f33884f23be13ea513b`.
- `data_migration_authorized`: No data writes or transformation. Forward-only source migration authoring and Local/static automated tests only.
- `production_allowed`: No. No Apply, Deploy, Production configuration, Production data mutation, backup rotation, or external-service mutation.
- `approved_at`: `2026-09-20T13:29:05+07:00`.

## Approved scope

1. Enforce organization-scoped staff authorization for Release C RFQ, quotation, Order, supplier-cost/payment and file surfaces that use privileged server clients, while preserving global staff and same-organization scoped staff behavior.
2. Author forward-only SQL that resolves the target organization before permission checks in Release C RPC/RLS paths, including `issue_supplier_orders`, the latest `create_supplier_payment`, `review_supplier_payment`, `mark_supplier_payment_paid`, `decide_order_cancellation`, and Supplier Payment staff read policy.
3. Reject duplicate `project_item_id` selections at the HTTP boundary and inside `create_customer_order` before any Order, Audit, or quantity write.
4. Reapply the inactive-account session/context/touch and application guard protections safely, based on `20260915103614_block-inactive-account-reentry.sql`.
5. Add focused automated coverage for global/same-org/cross-org/no-role access, direct RPC contracts, duplicate-order atomic rejection, inactive accounts and unchanged Release C/D/Freight gates.
6. Update candidate traceability, migration hashes and local evidence without claiming independent QA or Production readiness.

## Acceptance criteria

- `RLC-AC-01`: organization-scoped staff are denied list/detail/file/cost data for other organizations.
- `RLC-AC-02`: global staff and same-organization scoped staff retain approved access.
- `RLC-AC-03`: duplicate Project Item IDs are rejected atomically before Order/Audit/quantity writes.
- `RLC-AC-04`: inactive identities cannot register, read/touch a session context, retain role-based application access, or re-enter through the App guard.
- `RLC-AC-05`: anonymous/no-role direct calls are denied and all affected privileged functions retain pinned `search_path` and explicit ACLs.
- `RLC-AC-06`: Release C-only behavior remains bounded; Release D and Freight remain closed.
- `RLC-AC-07`: focused tests, full tests, typecheck, production build and `git diff --check` pass on one exact final candidate, with manifest fields for commit/tree/migrations/hashes/backup/smoke/stop status.

This record does not authorize independent QA acceptance or any Production release action.
