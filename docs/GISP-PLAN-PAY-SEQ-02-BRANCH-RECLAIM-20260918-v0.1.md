# PAY-SEQ-02 — Branch capacity reclaim decision v0.1

Status: **planning/read-only inventory only; no deletion, reset, backup creation, export, migration apply, deployment or transaction test authorized by this document.** The owner said “ทำตามที่คุณแนะนำ” after a recommendation to inspect preservation and request exact branch-deletion authority. It is not treated as deletion authorization.

## Exact target and observed impact

- Production parent: `gisp-mvp-production`, ID `865860c2-49fa-4e53-908f-9396b2f75233`.
- Proposed capacity-reclaim target: child branch `release-b-rehearsal-20260908`, ID `f0f9a36b-ec7d-4ceb-ae28-b2d5feef85f9`, schema-only, `active/ready`. The *other* child `production-completion-20260906` is out of scope and must be preserved.
- Production parent has 2/2 active branches. `branch delete` is irreversible and frees one slot; `branch reset` does not free a slot and restores the old creation-time snapshot, not current Production B.
- Read-only target inventory at 2026-09-18: 0 Customer Orders, 0 Payment Transfers; 11 auth users, 1 Project, 7 Member Profiles, 8 Sourcing Requests, 29 File Metadata rows, 77 Audit Events; one object of 68 bytes in private `gisp-member-private` Storage. These are not empty/disposable by inference and may contain personal/contact/audit data.
- Target also has one active `notification-retry` function and one active-schedule record; no frontend or compute deployment was listed. Removing the branch removes its own runtime/configuration. Schedule metadata should be checked immediately before any deletion.
- The target has 8 completed cloud backup records; latest displayed `20260918_010004.sql.gz`, 415121 bytes. This is not a current verified off-branch archive. A DB dump alone does not prove preservation of Storage object bytes; provider documentation does not guarantee a deleted branch's backup remains accessible or can recreate the deleted branch.

## Recommended bounded execution **after a new exact owner authorization**

1. Reconfirm branch name, ID, parent ID, state, row/object counts, and no new activity. Identify whether any test accounts or notification job still matter. Do not touch the other child or Production parent.
2. Place a fresh, access-restricted archive **outside this repository and outside the branch**: database dump/export including schema/data/functions/sequences/views and migration history, actual Storage object bytes plus metadata, and function/schedule/configuration inventory. Do not expose keys, URLs, tokens or personal data in chat, logs or Git. Record file SHA-256, row/object counts and a reproducible manifest; verify that the dump can be opened and the stored file's bytes match its manifest. A full service restore is not guaranteed by this archive; state that residual risk explicitly.
3. Only if every preservation check passes and the owner has explicitly accepted any residual irrecoverability, delete **only** branch ID `f0f9a36b-ec7d-4ceb-ae28-b2d5feef85f9`; verify the Production parent and other child remain unchanged and one branch slot is free. If archive or target check differs, stop **before delete**.
4. Create a new `schema-only` child from the then-current Production B parent for PAY-SEQ-02 and continue the already authorized 12-SQL isolated rehearsal only after checking its new Project ID, lineage, ACL/signatures, package hashes and backup/rollback. Never merge the old branch into Production as an archive workaround.

Alternative if old branch state must remain fully available: retain it and request additional branch capacity/another isolated project with explicit cost and environment authority. Neither alternative permits a Production migration or Release C/D.

## Decision needed

The owner must explicitly name the proposed child branch and ID, authorize or refuse off-branch preservation of its existing data and the irreversible deletion **conditional on verified preservation**, and accept that an export is not a one-click full restore. A general “ทำต่อ” is not sufficient for deleting the old branch.
