# GISP-PAY-RPC-GATE-001 — Scope and Implementation Authorization Record v1.0

- `approval_level`: Scope Approved + Implementation Authorized; **not** Release Authorized.
- `approved_by`: ภคภพ ช.เจริญยิ่ง, owner, per this conversation.
- `approval_text_or_reference`: “ข้าพเจ้า ภคภพ ช.เจริญยิ่ง ยืนยันกฎหลักฐาน 1 ไฟล์ต่อ Customer Payment 1 รายการ และอนุมัติ Scope กับ Implementation ตาม GISP-PAY-RPC-GATE-001 v0.1 ให้แก้ Source Code, Automated Tests และร่าง Migration ด้านสิทธิ์/API/Audit ใน Local/Development เท่านั้น ไม่อนุญาตให้ Apply Migration, Deploy, แก้ข้อมูลเดิม หรือแก้ Production”
- `scope_document_version`: `docs/GISP-PLAN-PAY-RPC-GATE-001-v0.1.md`; AC `PAY-RPC-01`–`04`, `PAY-SEQ-01`–`02` (the latter rehearsal is **planned but not authorized for execution here**).
- `environment`: Local source workspace and Development-targeted **drafts** only; no live Development write.
- `data_migration_authorized`: No. No transaction insert/update/delete, historical repair, bulk transformation, or migration apply.
- `production_allowed`: No. No Production config, database, deployment, user activation or transaction.
- `approved_at`: recorded on receipt at `2026-09-18T21:55:27+07:00` (Asia/Bangkok); not claimed to be the user's message-send timestamp.

## Implementation boundary

1. Change only the Finance Payment evidence/verification application path, focused tests, and new forward-only **migration drafts** needed to deny direct RPC approval while keeping correct Finance actor and organization-scoped permission/audit. The existing rejection workflow must still work with missing evidence; 50/50, separated Freight, prices, taxes and terms stay unchanged.
2. Prepare an isolated and ordered C/D release migration candidate/manifest **without applying it**. Preserve every previously applied migration and unrelated dirty-worktree change. The exact working branch is `development`, HEAD `32f3e3cd2b338fe5685ecdbc4897c38bd9567a2e`, worktree `C:/codex/GISP`.
3. Existing uncommitted Finance API/UI files and C/D migration drafts are owned by the prior Release C/D builder; that same builder is assigned this bounded continuation. All other uncommitted files belong to other tasks or the user and must not be reset/overwritten. One writer at a time, then independent QA.
4. Do not create a backend branch, apply a migration, deploy, upload a file, call transaction RPCs, or mutate any backend as part of this authorization. Later rehearsal requires a separate bounded approval and target-environment verification.

Current status before work: local Payment evidence candidate QA `PASS WITH CONDITIONS` only; Production `FAIL`, per `GISP-CLO-PAYMENT-EVIDENCE-LOCAL-20260918-v1.0.md`. This record does not waive either result.
