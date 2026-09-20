# Approval Record — RLC-HARDEN-01 Isolated Backend Rehearsal Continuation v0.2

- `approval_level`: Scope Approved + Implementation Authorized
- `approved_by`: ภคภพ ช.เจริญยิ่ง
- `approval_text_or_reference`: “อนุมัติให้ลบหรือปิด Schedule `GISP-Notification-Retry` ID `aefecf8b-5b02-4649-a9b2-47aa448af0e8` เฉพาะบน Child `rlc-harden-01-rehearsal-20260920` ID `41df0506-ef0a-4753-9426-b1c8ed4f9ff6` และตรวจยืนยันว่า Schedule ของ Production ไม่เปลี่ยนแปลง หากวิธีมาตรฐานล้มเหลวหรือพบ Project/ID ไม่ตรง ให้หยุดโดยไม่ใช้วิธีข้ามสิทธิ์ เมื่อ Child ไม่มี Active Schedule ที่ชี้ Production แล้ว อนุมัติให้ Apply เฉพาะ migration allow-list ของ RLC-HARDEN-01 และสร้างข้อมูลทดสอบสังเคราะห์เฉพาะ Child เพื่อทำ rehearsal โดยไม่อนุญาต Production”
- `scope_document_version`: RLC-HARDEN-01 v0.1 — Isolated Backend Rehearsal Continuation v0.2
- `environment`: Exact schema-only child `rlc-harden-01-rehearsal-20260920`, ID `41df0506-ef0a-4753-9426-b1c8ed4f9ff6`, whose verified parent is Production ID `865860c2-49fa-4e53-908f-9396b2f75233`
- `data_migration_authorized`: Yes, limited to applying the five exact allow-listed migration files below and creating synthetic test fixtures prefixed `REH-RLC-HARDEN-01` on the exact child only
- `production_allowed`: No. Production is read-only for identity, schedule and migration-state verification; no Production data/config/deploy/migration write is authorized
- `approved_at`: 2026-09-20T14:27:36+07:00 (Asia/Bangkok)

## Exact bounded external mutations

1. Verify the current Production parent, exact child identity/lineage, the Production schedule baseline and Production migration baseline before any write.
2. Switch to the exact child and delete only schedule `GISP-Notification-Retry`, ID `aefecf8b-5b02-4649-a9b2-47aa448af0e8`, using the supported InsForge CLI schedule command.
3. Verify that the child has no active schedule pointing to Production and that the Production schedule remains unchanged.
4. Apply each allow-listed migration separately, in the listed order, after verifying its SHA-256 and the current child identity immediately before each apply:
   - `release-candidates/pay-rpc-gate-001/migrations/20260920010000_pay-close-legacy-entry.sql` — `081e4105445f2b51be6d7798c6175345237c2ae20bb8966baf0f363ec959e26b`
   - `release-candidates/pay-rpc-gate-001/migrations/20260920010100_pay-evidence-binding.sql` — `c9f09a6dfe6c4a07472a2bbae40530b62707ad6be1d1b0d78a5747ee91cda11c`
   - `release-candidates/pay-rpc-gate-001/migrations/20260920010200_pay-private-executor.sql` — `4cc15afc0583b1b0e9f9183d3b194cea7da510c85480c1107eaa2e6c8f82c929`
   - `release-candidates/rlc-harden-01/migrations/20260920010250_release-c-org-scope-hardening.sql` — `0d2fac819d158a2a87962b181f2f637ada298b7973240341dfcef46f4be9bfa2`
   - `release-candidates/pay-rpc-gate-001/migrations/20260920010300_release-c-privileges.sql` — `852a12532b9103809361e396647cdb8cb303da2cbefcedbd8a36813fbb09b98f`
5. If all applies pass, create only synthetic child fixtures with prefix `REH-RLC-HARDEN-01` and run the authorized Release C/RLC security rehearsal. Do not send notifications, charge real money or use Production URLs.
6. Record sanitized evidence and return the dedicated CLI context to the Production parent.

## Fail-closed stop rules

- Stop immediately if parent/child/schedule identity does not exactly match, a supported standard CLI command fails, or the child schedule remains active or still points to Production after deletion.
- Before each migration apply, stop if the current CLI project is not child ID `41df0506-ef0a-4753-9426-b1c8ed4f9ff6` or the file hash differs from the approved value.
- Stop on the first migration failure. Do not use `up --all`, `up --to`, raw managed-schema SQL, permission bypasses or undocumented workarounds.
- Do not deploy a hosted app/function/compute runtime, modify secrets/config, merge/reset branches, or write any Production data/schema/config.

Candidate source identity remains commit `cf62215b0cb359de87700b35f45c6d4ba1aaf1c2`, tree `8345c23b52b2ddc102dbc8bc92d237f957eeb1ef`. Later local commits are approval/evidence/test-artifact envelopes only unless explicitly stated otherwise.
