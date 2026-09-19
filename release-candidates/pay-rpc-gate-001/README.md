# PAY-RPC-GATE-001 — isolated C/D migration candidate (provisional)

Authorization: `docs/GISP-APR-PAY-RPC-GATE-001-IMPLEMENTATION-20260918-v1.0.md` and bounded gap continuation `docs/GISP-APR-GLR-C-GAPS-20260919-v0.1.md`; AC `PAY-RPC-01`–`04` and `PAY-SEQ-02`. This directory remains a **local candidate package**, not a Production release. Its 12 SQL files were applied in order only to isolated rehearsal child `e902393a-ffe7-433d-96d8-a37256948959` on 2026-09-18; none were applied to Production. See `docs/GISP-PAY-SEQ-02-REHEARSAL-STATUS-20260918-v0.1.md`. Preserve the original `migrations/` history and unrelated working-tree files.

Read-only Production B check reported by the primary thread: latest applied migration `20260908170000 release-b-member-pilot` (prior `20260906020000 restrict-sequence-helper-rpc`). That is a point-in-time observation, **not** a complete lineage, signature, dependency, or ACL validation. The 20260920 candidate versions are provisional until an independent reviewer checks the exact target baseline and may need new numbers in a new isolated package. Never run `up --all` from the shared worktree. In an independently authorized clean rehearsal workspace, validate this package's lineage and apply only the explicitly selected next migration at each gate; no command is authorized by this document.

## Ordered SQL files and SHA-256

| Gate | SHA-256 | Local package file |
|---|---|---|
| C safety | `bbbf50032469ef407f287418d69cab33f64cd8b912a425e50e23c4f0994e5ffb` | `migrations/20260920010000_pay-close-legacy-entry.sql` |
| C prerequisite | `5a8cc2a7308fd78a7dba87244871dae08d30e1665b2193694e9b9e97eb94dac3` | `migrations/20260920010100_pay-evidence-binding.sql` |
| C prerequisite | `e9a4b2c4745cdf07278935cf079c8c5d3db4ab8e241b74626f72ac90148eb96c` | `migrations/20260920010200_pay-private-executor.sql` |
| C | `2abb7fc8e1ca11fb1c3376b211370908810b9dbe89184528084a913912c822a5` | `migrations/20260920010300_release-c-privileges.sql` |
| D7 prerequisite | `354f735ef430a5a15a06c1741591a3b74c47daced974e720102e039e65a50d0e` | `migrations/20260920010400_d7-qc-reopen-prerequisite.sql` |
| D7 | `9be89b775164025ee03368a83fd3a24bbaab3207203921f391ab56b96dcb855e` | `migrations/20260920010500_release-d7-privileges.sql` |
| D8 prerequisite | `df7de020ce9ab309b96e82a3551f653e228cb240ae5bddfaf96a3dfb01934ac3` | `migrations/20260920010600_d8-consolidation-prerequisite.sql` |
| D8 prerequisite | `6c30c0380cd841a92074d40103f2594e3fae3f6ef2c7efc72972f3db9f7d70b6` | `migrations/20260920010700_d8-customs-prerequisite.sql` |
| D8 | `41ecb7c4486caae0db5a2118a0fe062feed713e295131376d0d63c8632231970` | `migrations/20260920010800_release-d8-privileges.sql` |
| D8 final gate | `5cd45106a6bc4f36de1b16a2f09f606e2f48ff8961c56e778bae6b154258c577` | `migrations/20260920010900_d8-freight-payment-enable.sql` |
| D9 | `f80a8c0e2106a373333b86206c23322b3b6afe12f7504fee76c211bc0f5defd2` | `migrations/20260920011000_release-d9-privileges.sql` |
| D10 | `d38c80941b0172fd1d46638ea79edfbe17c7901f842318d49d39f7fbb7ced5ab` | `migrations/20260920011100_release-d10-privileges.sql` |

The files are renamed, forward-only copies from the corresponding root `migrations/` drafts: `20260918222900`, `20260918211000`, `20260918223000`, `20260918133858`, `20260918050000`, `20260918133905`, `20260916090000`, `20260916123000`, `20260918133916`, `20260918223100`, `20260918133927`, `20260918133933`. The D7 QC prerequisite copy adds a final `REVOKE` for the newly created `reopen_qc_inspection` RPC in the same migration transaction, because the source grants it before D7. The D7 permission migration is the only stage that restores its execution. All other copies preserve their source SQL content apart from file naming/line endings. The first C safety file revokes legacy direct Payment writes **before** the binding function replacement, closing the gap between migration transactions. The private executor checks a server-recorded evidence-preview receipt, and its 10-minute session/actor/transfer/file/hash binding; Finance rejection still works without file bytes. Direct Freight submit/verify stays false until the separately approved D8 final gate.

## Application snapshot changed for this slice

| SHA-256 | File |
|---|---|
| `ead316777d10f4ed0b85a2602129aae9c9a81d4040b0ff3d82fb321dbd60ae98` | `src/app/api/admin/payment-transfers/[id]/evidence/route.ts` |
| `e17f10973f7a69b6f6d02adc5bbbbb73a3633d43a0f765b398a899d7b634f34d` | `src/app/api/admin/payment-transfers/[id]/evidence/route.test.ts` |
| `ecea79e228e32b98e5a01f62ab9036b4cb93c774da1542afd94b2982f3d7045a` | `src/app/api/admin/payment-transfers/[id]/verify/route.ts` — HTTP 409 for missing Finance preview |
| `595044765b35ae6dfbb2d294cdf5bc384773da66f40ffb831eaee883c19d2f36` | `src/app/api/admin/payment-transfers/[id]/verify/route.test.ts` |
| `631e2c6b470f88edb71d6ad2fc205d9d1e7a7ddb8d0047d02c993c20ba41ef8c` | `src/lib/payments/bound-evidence.ts` |
| `7de510bd0e8366da1ddfbfa0beffb1a308d4efa1e847755c11f1ff446a17b14e` | `src/lib/payments/bound-evidence.test.ts` |
| `7bf7f014c7b7f55232c30372f12f7710e07f15a67ec17659f2aea3626f9dd3d2` | `src/lib/payments/finance-access.ts` |
| `45689ba895e10a9a9f7daed2461da5ef70a2e8a97f2fd05cf83694bc4c05e185` | `src/lib/payments/finance-access.test.ts` |
| `41c4ceb2e6c125020f380a60cf7a98dc9cead11fefdce0e498f42fa4f0ebf3da` | `src/lib/payments/pay-rpc-gate-migration.test.ts` |
| `e6e9f8f24454771b5b64afb2fc9489dd6af3c68a019a7477ae14baad66517ed1` | `src/lib/payments/pay-rpc-gate-package.test.ts` |
| `42499891d71408f7768148e5f2fe6217e057c97fffb0e1e9f31f54b8f813f7da` | `src/components/admin-order-detail.tsx` |

The application still needs the broader Release C/D files frozen in `docs/GISP-RELEASE-CD-CANDIDATE-MANIFEST-20260918-v0.2.md`; its Payment file hashes are superseded by this table. **Do not package the entire dirty worktree**. This document does not include `.env`, keys, roles, table/column changes, data migration, or live transactions.

## QA / release blockers

- Previous local checks: focused 7 test files/37 tests, full 95 files/495 tests, TypeScript typecheck, optimized Next.js build, and lint (0 errors, 1 unrelated pre-existing warning) passed before the HTTP 409 presentation fix. On the updated local source, independent QA passed 95 files/496 tests, typecheck and the optimized Next.js build. Missing/corrupt evidence, partial/exact settlement, overpayment review, and genuine expired-preview tests passed on the isolated child. QA verified 28/28 C/D manifest paths (21 original hashes plus 7 superseding Payment hashes) and all 12/12 SQL package hashes. This is PASS only for the bounded child gap rehearsal; no Production PASS is claimed.
- Development QC Reopen UAT was `PASS WITH CONDITIONS` with two minor UX issues requiring owner Production risk acceptance or fix/retest; cross-organization scoped-QC was `N/A`, not a pass. Payment SQL/Storage binding was exercised on the isolated hosted child and is `PASS WITH CONDITIONS` there; the exact integrated Production Release Candidate, real-bank settlement, and Production permission/rollback gates are **NOT VERIFIED**.
- A receipt proves exact server byte retrieval and a Finance confirmation click, not that a human visually read the slip or that money settled at the bank. Storage-object mutation between the final read and SQL commit remains a residual time-of-check/time-of-use risk; verify Storage immutability/version behavior in rehearsal.
- Recheck every function signature, ACL, table dependency, SQL syntax and applied migration lineage against a Production-B-derived rehearsal environment before any Apply. D7/D8 prerequisites listed here are the currently documented ones, not a guarantee that no others exist. Confirm backup and tested rollback, role/tenant negative cases, deposit/balance/freight reconciliation, and Release-stage configuration before seeking separate Production authorization.
