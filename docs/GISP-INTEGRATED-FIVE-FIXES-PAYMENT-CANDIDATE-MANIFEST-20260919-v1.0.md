# Integrated Five Fixes + Payment Candidate Manifest v1.0

Frozen on 19 September 2026 after independent QA, Development migration
execution and authenticated local-to-Development-backend UAT. Development
deployments are `READY`, but their domains still return HTTP 404. Production
remains **NO-GO**.

## Git identity

- Integration branch: `codex/integration-five-fixes-payment`
- Five-fix base: `6d43b0278348dad4038f0408b76d87d8f94d9bf2`
- Payment integration commit: `a6eda24474f232f56eec24a9c404092f6ae88a7e` (`test(payment): integrate verification gate`)
- Production media hardening commit: `e27ec49edb1b62a18bd1cb38377fef619ea8e015` (`fix(logistics): disambiguate production media links`)
- Pre-authorization manifest commit: `01c3064d1b7ec352402ca407dfa37e9e7d8a3aec`
- Read-only RPC transport hardening: `01dc8dc9ee72aa998c111c7c0c9161e439cd1505`
- Final source candidate HEAD: `684477c23c5b94e460b55f23bdd7298b46183a20`
- Final source candidate tree: `921fc8a43296423ec4f568bf10dab038c88bd00e`
- This documentation-only closure commit is not a source candidate replacement.

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
| `561c5c73810e875953f709612d34ec68dacacf8603d76ae9369e3cc8a59dcdd7` | `src/app/api/admin/logistics/production-media/[supplierOrderId]/[fileId]/route.ts` | Resolve multiple links, enforce target-order/tenant relationships, and reject malformed UUIDs before database access. |
| `3294e235e01f16563b1a9858d4484519502253cbe2af4036f1555c21dcf5c43d` | `src/app/api/admin/logistics/production-media/[supplierOrderId]/[fileId]/route.test.ts` | Valid, malformed-ID, multi-link and cross-organization regressions. |

## Final authenticated-read hardening

| SHA-256 | Path | Bounded change |
| --- | --- | --- |
| `c6fc8555d5df96ed6ae5841d7145457709a4eaf10292b3b53b140b55f41948bc` | `src/lib/orders/read-only-rpc.ts` | Retry once only for exact read-only `socket hang up`. |
| `01c962e6d609f83ca56400863019a2698769eb0c711b0669880e77c24cbcbdce` | `src/lib/orders/read-only-rpc.test.ts` | Retry-once and non-transient fail-closed tests. |
| `ac48925ce012b7e5294a7cd0e546d688600e3c4b4a4f42f6cd8c84d8cd1d1e03` | `src/lib/orders/organization-access.ts` | Reuse one authenticated client and check target-organization permissions sequentially. |
| `1dbabf15a89cbf49ac6b5227f55330a2b392484c874f67b8370084339645004e` | `src/lib/orders/organization-access.test.ts` | Tenant permission and sequential-concurrency regression. |
| `490b6daf83ad7830b88a48a9372cdc8a7f4a2852185f2e58f8e7f90d46ba4959` | `src/lib/orders/server.ts` | Sequential, retry-bounded Dispatch Gate reads. |

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
- The 19 September Development backup was verified complete, then all 12 ordered
  `PAY-RPC-GATE-001` migrations were applied 12/12 to Development project
  `db09b94e-fc37-4f90-9530-3289afef0b79`.
- Release-stage source now opens only these exact UUID routes:
  - C: `/api/admin/supplier-orders/[id]/po/pdf`
  - D8: `/api/admin/warehouse-receipts/[id]/pdf`
  Parent resources, invalid IDs and extra child paths remain closed by tests.
- `/api/admin/logistics/production-media/...` is covered by the existing D8
  `/api/admin/logistics` prefix when D8 is explicitly enabled.
- Authenticated local frontend UAT against the Development backend passed.
- Development deployments beginning `551...` and `23bb...` report `READY`, but
  their configured domains return HTTP 404. Feedback reference `c1794...` records
  the unresolved hosted-routing blocker; hosted-domain UAT is not complete.
- Production remains prohibited. The route source change is present for later
  separately authorized staged Production execution; it is not Production Release
  Authorization.

## Local verification on the final working tree

- Independent QA: 530 automated tests passed.
- TypeScript and optimized Next.js build: passed.
- Lint: 0 errors.
- Authenticated local + Development-backend UAT: passed.
- Candidate HEAD/tree and migration order/count were recorded above.

## Required next gates

1. Resolve the Development domain HTTP 404 under feedback reference `c1794...`
   without changing the frozen source candidate.
2. Run authenticated UAT through the working hosted Development domain and record
   the deployment/domain evidence.
3. Keep Production closed until a separate Production Release Authorization is
   recorded.
