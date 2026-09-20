# Approval Record — RLC-HARDEN-01 Local Rehearsal Preparation v0.4

- `approval_level`: Scope Approved + Implementation Authorized
- `approved_by`: ภคภพ ช.เจริญยิ่ง
- `approval_text_or_reference`: “อนุมัติให้ตั้งการตรวจ Ghost Schedule แบบอ่านอย่างเดียวทุก 1 ชั่วโมง และเตรียมชุดสคริปต์/หลักฐาน Rehearsal ใน Local isolated worktree โดยไม่ Apply, Deploy, เขียนข้อมูล Child หรือแก้ Production”
- `scope_document_version`: RLC-HARDEN-01 v0.1 — Local Rehearsal Preparation v0.4
- `environment`: Local isolated worktree `C:\Users\ASUS\.codex\worktrees\rlc-harden-01\GISP`, branch `codex/rlc-harden-01`; backend access is read-only only and automation setup is owned by the primary thread
- `data_migration_authorized`: No. Prepare local scripts, tests, validation and evidence templates only; do not apply migrations or create/modify/delete Child or Production data
- `production_allowed`: No. No Production mutation, deployment, migration, configuration or data write is authorized
- `approved_at`: 2026-09-20T20:20:05+07:00 (Asia/Bangkok)

## Approved local artifact scope

1. Inspect and reuse existing local rehearsal/evidence patterns.
2. Prepare a fail-closed package under `release-candidates/rlc-harden-01/rehearsal/` containing dry-run/default tooling, validators, tests, a synthetic-fixture plan, cleanup plan and sanitized evidence template.
3. Encode exact parent/child/schedule identity guards, Production target rejection and the approved five-file migration allow-list/order/hashes.
4. Add local automated tests for identity guards, schedule safety, hash/order validation, dry-run behavior and Production rejection.
5. Update the existing candidate manifest to identify the package as prepared but not executed while preserving candidate source commit/tree identity.

## Explicitly not authorized

- Applying any migration, including `up --all`, `up --to` or an explicit single-file apply.
- Creating synthetic fixtures or cleaning up any backend data.
- Deploying frontend, function or compute code.
- Updating/deleting schedules, secrets, configuration, branch state or Production state.
- Claiming backend rehearsal, QA, UAT or Production readiness from local package preparation.

Candidate source identity remains commit `cf62215b0cb359de87700b35f45c6d4ba1aaf1c2`, tree `8345c23b52b2ddc102dbc8bc92d237f957eeb1ef`. Later commits are approval/evidence/test-tooling envelopes only.
