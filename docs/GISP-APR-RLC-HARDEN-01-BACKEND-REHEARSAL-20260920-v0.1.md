# Approval Record — RLC-HARDEN-01 Isolated Backend Rehearsal v0.1

- `approval_level`: Scope Approved + Implementation Authorized
- `approved_by`: ภคภพ ช.เจริญยิ่ง
- `approval_text_or_reference`: “อนุมัติ Scope และ Implementation สำหรับ Isolated Backend Rehearsal ของ RLC-HARDEN-01 v0.1 โดยอนุญาตให้ลบเฉพาะ branch `production-completion-20260906` ID `2cff11a0-9e16-41d4-989a-dcfc9f48103d` เพื่อคืนโควตา และสร้าง branch ใหม่ชื่อ `rlc-harden-01-rehearsal-20260920` จาก Production เพื่อทดสอบเท่านั้น อนุญาตข้อมูลทดสอบเฉพาะใน branch ใหม่ ไม่อนุญาตแก้ข้อมูล Deploy Migration หรือเปลี่ยนค่าใด ๆ บน Production หากพบ Schedule ที่ชี้ Production ให้หยุดก่อน Apply หรือเขียนข้อมูล”
- `scope_document_version`: RLC-HARDEN-01 v0.1 — Isolated Backend Rehearsal Preflight
- `environment`: Exact new schema-only backend child `rlc-harden-01-rehearsal-20260920` created from Production parent ID `865860c2-49fa-4e53-908f-9396b2f75233`
- `data_migration_authorized`: No. Synthetic test data is authorized only on the new isolated child after preflight passes and a later explicit execution step; this preflight does not authorize fixture writes.
- `production_allowed`: No. No Production data/config/deploy/migration write is authorized.
- `approved_at`: 2026-09-20T14:10:33+07:00 (Asia/Bangkok)

## Exact bounded external mutations

1. Verify the CLI context is the Production parent and the exact reclaim target identity.
2. Permanently delete only backend branch `production-completion-20260906`, ID `2cff11a0-9e16-41d4-989a-dcfc9f48103d`, to reclaim branch quota.
3. Create only `rlc-harden-01-rehearsal-20260920` in `schema-only` mode from the Production parent.
4. Read the child identity, lineage, migration state and schedules. If any active schedule or any schedule URL/header/body points to Production host/appkey `m8ugbyak`, stop before Apply, Deploy or fixture writes.
5. Return the CLI context to the Production parent after collecting read-only evidence.

## Explicitly not authorized in this preflight

- Applying any migration, including RLC-HARDEN-01, or using `up --all`.
- Deploying frontend, function or compute code.
- Creating fixtures or changing schedules/configuration/secrets.
- Merging/resetting a branch, or changing Production data/config/schema/runtime.

Candidate source: commit `cf62215b0cb359de87700b35f45c6d4ba1aaf1c2`, tree `8345c23b52b2ddc102dbc8bc92d237f957eeb1ef`; evidence envelope `7656c4a6c55a169b8ce952a1d8c30d7864945f30`.
