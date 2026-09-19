# GISP Hosted Rehearsal Findings HR-FIX-01–03 — Implementation Approval Record v1.0

- `approval_level`: Scope Approved and Implementation Authorized for the named Child rehearsal only; not Production Release Authorized.
- `approved_by`: ภคภพ ช.เจริญยิ่ง.
- `approval_text_or_reference`: Owner message authorizing HR-FIX-01 through HR-FIX-03, including deletion of the exact Child schedule metadata clone after identity and Parent checks; Source Code, Automated Tests, Emergency Resume SQL, non-secret Deployment Attestation, one Child deploy/apply/retest, one fresh backup and one restore.
- `scope_document_version`: `HR-FIX-01–03 v1.0`, derived from the independent QA findings recorded in `docs/evidence/2026-09-19-release-cd-hosted-rehearsal.md`.
- `environment`: Child `pay-seq-02-rehearsal-20260918`, ID `e902393a-ffe7-433d-96d8-a37256948959`, only; Local worktree for implementation and tests.
- `data_migration_authorized`: Yes, limited to deleting the single Child schedule metadata clone ID `aefecf8b-5b02-4649-a9b2-47aa448af0e8`, applying individually named rehearsal Stop/Resume SQL, synthetic security fixtures/evidence, and system-generated audit/events in that Child. No business Master Data or real transaction data.
- `backup_restore_authorized`: One new named Child backup after successful schedule isolation and one restore of that backup to the same Child.
- `production_allowed`: No. Production project `865860c2-49fa-4e53-908f-9396b2f75233`, its schedule, data, permissions, deployment and configuration are read-only verification targets.
- `approved_at`: `2026-09-19T19:29:43+07:00`.

## Acceptance criteria

- `HR-FIX-01`: verify exact Child and Parent identities; remove exactly one matching Child schedule metadata row; Child schedule remains absent or observably inactive before backup and after restore; Parent schedule remains active and otherwise unchanged.
- `HR-FIX-02`: retain a reproducible exact 54-function snapshot/hash method; Stop and Forward Resume restore exact definitions, owner, security mode, search path and ACL as well as the approved semantic permission matrix; reconciliation reports no unexplained business-data delta.
- `HR-FIX-03`: bind the hosted deployment to the frozen commit/tree and Child backend without exposing secrets; retain immutable raw Advisor and suppression evidence with hashes; retain anonymous, no-eligible-role, cross-organization and trusted-internal runtime evidence; independent QA must pass.

## Preflight platform constraint

Read-only inspection found that `schedules.jobs` is owned by the managed `postgres` role and `project_admin` has no `DELETE` privilege. The normal Schedule update/delete APIs fail because the inherited Child metadata points to a missing Cron Job `4`. No grant, owner change, `SET ROLE`, system-table bypass or Production mutation is authorized. HR-FIX-01 therefore requires an InsForge platform metadata-only repair before any Child deploy, backup, Apply or Retest. Local HR-FIX-02/03 implementation may proceed while that external blocker is open.

This record does not authorize Production Release C or D.
