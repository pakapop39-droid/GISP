# Integrated Five Fixes + Payment Candidate Manifest v1.0

Frozen locally on 19 September 2026 for independent QA and a separately
executed Development frontend deploy/UAT. Production remains **NO-GO**.

## Git identity

- Integration branch: `codex/integration-five-fixes-payment`
- Five-fix base: `6d43b0278348dad4038f0408b76d87d8f94d9bf2`
- Payment integration commit: `a6eda24474f232f56eec24a9c404092f6ae88a7e` (`test(payment): integrate verification gate`)
- Production media hardening commit: `e27ec49edb1b62a18bd1cb38377fef619ea8e015` (`fix(logistics): disambiguate production media links`)
- Pre-authorization manifest commit: `01c3064d1b7ec352402ca407dfa37e9e7d8a3aec`
- Final candidate HEAD is the commit containing this manifest and must be
  recorded by QA/deploy tooling before any deployment.

## Imported Payment/Release files

These seven files are byte-for-byte identical to the explicitly named files in
the owner’s existing `C:\codex\GISP` checkout at freeze time. No other dirty
checkout file was imported.

| SHA-256 | Path |
| --- | --- |
| `00fa6af7a1bd396e2d10f773d29ddd4ad00849b47213351ba42930c9b4828a0e` | `release-candidates/pay-rpc-gate-001/README.md` |
| `ecea79e228e32b98e5a01f62ab9036b4cb93c774da1542afd94b2982f3d7045a` | `src/app/api/admin/payment-transfers/[id]/verify/route.ts` |
| `595044765b35ae6dfbb2d294cdf5bc384773da66f40ffb831eaee883c19d2f36` | `src/app/api/admin/payment-transfers/[id]/verify/route.test.ts` |
| `0c9a860018c975fca4f6831cf62ab5443baccd4f979dfd483835048e866f23b8` | `docs/GISP-APR-GLR-C-GAPS-20260919-v0.1.md` |
| `9943a8095a177c7417bd84f6573855e23f886d44cef8fd605107fed9987507f2` | `docs/GISP-GLR-C-PAYMENT-GAP-TEST-20260919-v0.1.md` |
| `9cd73b71ac9693ee3dd62b6f7463617615f302fe42bd0966ff8e5f2715ea3633` | `docs/GISP-PLAN-RELEASE-CD-ROLLBACK-20260919-v0.1.md` |
| `d3fee1208f46bc36c400e977421f6eeea11e892a7c7c3897d65f95f493f7a11c` | `docs/GISP-RELEASE-CD-GO-LIVE-READINESS-20260919-v0.1.md` |

## Integration-only files

| SHA-256 | Path | Bounded change |
| --- | --- | --- |
| `ad97d61725e8a0b3bfc99c950d162b96ddbc27dd1405f6c4f16ad3137cf31713` | `src/lib/payments/evidence-binding-migration.test.ts` | Normalize LF/CRLF in test input; SQL and business behavior unchanged. |
| `79184acc9c3e80b4f52a0e2cf86d95b8e2e01fa136bb78c1a671e1b0117c3776` | `src/app/api/admin/logistics/production-media/[supplierOrderId]/[fileId]/route.ts` | Resolve multiple file links and require at least one update under the requested Supplier Order. |
| `b0a1d9c9db57f02dc79a5029e21325a69ccee7611fe04530320dd677647c2528` | `src/app/api/admin/logistics/production-media/[supplierOrderId]/[fileId]/route.test.ts` | Multi-link allow/deny regression and existing tenant checks. |

## Authorized Release Stage delta over `01c3064d`

This final local delta contains only the two exact PDF route gates, their positive
and negative regression tests, and the approval/manifest/readiness documents that
bind the candidate to the owner's authorization.

| SHA-256 | Path | Bounded change |
| --- | --- | --- |
| `3e4944809052c4f745432d1aea2b53484d65cc488f39ee76c206ef7270d74388` | `src/lib/release-stage.ts` | Exact Supplier PO PDF route at C and exact Warehouse Receipt PDF route at D8; no broad parent prefix. |
| `2dc3e63244b5416c1baf18d2f2660cbed07951e99f5234aac1657fb54a438a0e` | `src/lib/release-stage.test.ts` | Stage boundary plus invalid ID, parent and extra-child denials. |
| `1b1654ec5e8b17686197b499988cc23efb4de46911ca3f0d9c6a9f232c26567d` | `src/proxy.release-gate.test.ts` | Hosted proxy positive and broader-route negative regressions. |
| `c21dc73cc0ebfbb7f318bfd5830dd4252d362d3fa89e15104ee86f20f536085f` | `docs/GISP-APR-INTEGRATION-FIVE-FIXES-PAYMENT-20260919-v1.0.md` | Owner's exact Development migration/deploy/UAT and two-route gate authorization. |

## Explicit exclusions and blockers

- No `pnpm-lock`, tools, caches, `.env`, keys, unrelated dirty files or root
  checkout state are part of this candidate.
- No database schema/data change, migration execution, Development deployment or
  UAT mutation occurred while building this source candidate.
- The owner has authorized the 12 ordered `PAY-RPC-GATE-001` migrations for
  Development project `db09b94e-fc37-4f90-9530-3289afef0b79`, after verifying
  the 19 September backup completed. Execution evidence remains pending.
- Release-stage source now opens only these exact UUID routes:
  - C: `/api/admin/supplier-orders/[id]/po/pdf`
  - D8: `/api/admin/warehouse-receipts/[id]/pdf`
  Parent resources, invalid IDs and extra child paths remain closed by tests.
- `/api/admin/logistics/production-media/...` is covered by the existing D8
  `/api/admin/logistics` prefix when D8 is explicitly enabled.
- Development deployment and bounded UAT test-data mutation are authorized in the
  approval record but were not performed while producing this local candidate.
- Production remains prohibited. The route source change is present for later
  separately authorized staged Production execution; it is not Production Release
  Authorization.

## Local verification on the final working tree

- Focused Payment/PDF/media/release-gate suite: 7 files, 41 tests passed.
- TypeScript: `npm run typecheck` passed.
- Full Vitest suite: 103 files, 525 tests passed.
- Optimized Next.js build: passed; 128 static pages generated and both PDF routes
  were present in the route inventory.
- `git diff --check`: passed. Independent QA must still verify the committed HEAD
  and tree before Development execution.

## Required next gates

1. Independent QA verifies the final commit/tree, route boundaries and this
   SHA-256 inventory.
2. Release Executor verifies the completed 19 September Development backup, then
   applies exactly migrations `20260920010000` through `20260920011100` once and
   in order to project `db09b94e-fc37-4f90-9530-3289afef0b79`.
3. Release Executor deploys only the final frozen commit to Development, completes
   bounded UAT/test-data work and records migration, deploy and UAT evidence.
4. Keep Production closed until a separate Production Release Authorization is
   recorded.
