# GISP Release C/D Hosted Rehearsal — Execution Evidence

Date: 2026-09-19

Environment: Child `pay-seq-02-rehearsal-20260918` (`e902393a-ffe7-433d-96d8-a37256948959`)

Production allowed: No

## Frozen source and hosted deployment

- Candidate commit: `55de0c854e8dc51e9dd547385a7ecd2ee418823a`.
- Tree: `0100f6078d9cffdc3f69bdcc20886e1faa060258`.
- Canonical emergency package hashes: `10/10` exact copies; reconciliation hash `45e93f9c9ffe6c17b38a1994c53c72b08ec1c0e7a0d8df50c1bb30db172994e6`.
- Local gates: TypeScript PASS; Vitest `96` files / `504` tests PASS; Next.js build PASS with `128` routes.
- Hosted deployment: `fd2df3af-89c6-4777-ace6-2760dc2577ab`, status `READY`, URL `https://m8ugbyak-3gg.insforge.site`.
- Hosted health returned `status=ok` and all four InsForge configuration-presence checks true. Environment names were recorded without exposing values. Admin Order without a session returned `307` to `/login`.

## Schedule isolation

- Child schedule metadata retained ID `aefecf8b-5b02-4649-a9b2-47aa448af0e8`, `isActive=true`, and the inherited Production URL.
- CLI disable, URL update, and Child-only delete could not persist because the Child has no valid underlying Cron Job `4`; update/delete returned `could not find valid entry for job 4`.
- Child execution logs: `0`; the inherited runtime timestamps remained stale from branch creation.
- Parent schedule retained the Production URL and remained active; it continued normal executions. No Parent configuration change was observed.
- InsForge issue previously reported as feedback `52b2344d-ca14-4376-a974-7c1b97b4726c`.

## Backup, Advisor, Stop and Resume

- Fresh backup: `RCD-HR-CD-001-PRE-STOP`, ID `cee78aca-27ff-4972-ab98-ff8223933c26`, status `completed`.
- Advisor was triggered exactly once: scan `a4a3d92f-9267-4e21-abf1-bb9d09dd8c9d`, completed with `567` findings (`158` critical, `310` warning, `99` info), and no suppression. The scan warned that the slow-query rule failed. Restore later returned the Advisor store to the pre-backup scan, so the fresh scan is retained in this execution evidence but is no longer the latest queryable scan on the restored Child.
- Baseline function inventory: `54` signatures; all owner `project_admin`, `SECURITY DEFINER`, and pinned `search_path=pg_catalog, public, pg_temp`. Combined baseline hash: `d8f90cc4669e2461024ba2e6d2f3024a`.
- Stop migrations were applied individually in order `20260920011200` through `20260920011600`; `up --all` was not used.
- Stop result: all `54` targets denied to `authenticated` and `anon`, all `54` remained callable by `project_admin`; Freight returned `false`; both private Payment executors contained `EMERGENCY_WRITE_DISABLED`; D7 Dispatch read helpers remained callable.
- Reconciliation cutover: `2026-09-19T11:58:00Z`. The CLI rejected the multi-result template, so the exact eight read-only result sets were executed separately. Orders, payment schedules, payment transfers, shipments, file metadata, notifications, notification jobs and audit events all reported `changed_since_cutover_count=0`.
- Resume migrations were applied individually in order `20260920011700` through `20260920012100`.
- Resume permission semantics: `47` intended active functions callable by `authenticated`, `0` by `anon`, and all `54` by `project_admin`; legacy Payment and retired Shipment/Delivery functions remained closed; Freight returned `true`.
- The pre-Restore combined definition/ACL hash after Forward Resume was `026857b03f13bd8b0fc1774b2590d3b7`, not the baseline combined hash. The normalized permission matrix was correct, but this exact-hash drift is an open QA finding for the emergency Forward Resume package.

## Restore proof

- Database sentinel: audit event `efdf0d9c-7d15-45cf-ae89-2e8fe897f471`, request prefix `REH-RCD-CD-001`.
- Storage sentinel: `gisp-confidential/REH-RCD-CD-001/sentinel.txt`, 154 bytes, SHA-256 `c49395cd292eb0e061f26103d738d4c4eb23f22b39908a6d2d74e8311f3f38b1`.
- Backup restore was invoked exactly once using backup `cee78aca-27ff-4972-ab98-ff8223933c26`. Initial database requests returned transient `502` while recovery completed; no retry of the restore command was made.
- After recovery: migration count returned to `38`, head `20260920011100 release-d10-privileges`; both sentinels were absent; business counts returned to `8` Orders, `12` Payment Transfers, `0` Shipments, `12` File Metadata, `49` Audit Events and `4` Notification Jobs.
- The combined function hash returned exactly to baseline `d8f90cc4669e2461024ba2e6d2f3024a` and the Hosted health check passed after Restore.

## Parent/Production protection

- Production remained at `26` migrations with head `20260908170000 release-b-member-pilot`.
- Production remained at `0` Orders, `0` Payment Transfers and `0` Shipments during the final verification.
- No Production Apply, Deploy, Restore, role/permission change, branch operation, real Member, real payment or real shipment was performed.

## Status before independent QA

- `RCD-HR-01`, `02`, `03`, `04`, `05`, and `08`: evidence collected.
- `RCD-HR-06`: semantic ACL passed, but the pre-Restore combined hash drift requires QA classification.
- `RCD-HR-07`: fresh Advisor completed with no suppression; runtime tenant/role evidence is limited to prior PAY-SEQ-02 tests plus this rehearsal's ACL matrix and hosted authentication smoke.
- `RCD-HR-09`: pending independent QA verdict.

This rehearsal evidence is not Production Release Authorization.

## Independent QA verdict

Independent QA completed its read-only review on 2026-09-19 with verdict **FAIL**. The Hosted Rehearsal Slice remains open and Production Release C/D remains **NO-GO**.

- `RCD-HR-02A` blocker: the Child schedule metadata is still active and retains the Production notification URL. The Child has no observed execution and its underlying cron job appears absent, but the approved acceptance criterion required an observably inactive Child schedule before backup and after restore.
- `RCD-HR-06` blocker: Forward Resume restored the intended permission semantics but did not restore the exact combined function-definition/ACL hash. The exact SQL used to produce the recorded combined MD5 was not retained as a reproducible artifact, so the post-Restore hash claim cannot be independently recomputed.
- `RCD-HR-07` major: the fresh Advisor scan completed without suppression, but its raw immutable output was not retained before Restore returned the Advisor store to the inherited scan. Exact-candidate hosted negative tests for anonymous, no-role, cross-organization and trusted internal execution were not retained as a complete evidence set.
- `RCD-HR-03` major evidence gap: the hosted deployment is READY and its health endpoint reports configuration presence, but the retained evidence does not independently bind encrypted environment values and deployed source identity to the Child.

QA independently verified the completed backup and restore, restored migration head and business counts, absence of both sentinels, the live 54-function semantic ACL matrix, hosted authentication redirect, and unchanged Production B state. These passing checks do not waive the blockers above.

Remaining actions before another QA decision: obtain persistent Child schedule isolation; make Forward Resume deterministic and retain a reproducible hash query/output; retain durable Advisor, deployment-binding, role and tenant-negative evidence and submit the exact candidate for independent QA again.
