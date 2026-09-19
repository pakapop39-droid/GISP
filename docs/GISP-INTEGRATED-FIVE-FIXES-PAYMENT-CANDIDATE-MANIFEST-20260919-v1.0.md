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
- Release-stage PDF allowlist commit: `ae1a0982c05d341cfd1fd6f003faefa4b3648fa4`
- Read-only RPC transport hardening: `01dc8dc9ee72aa998c111c7c0c9161e439cd1505`
- Final source candidate HEAD: `684477c23c5b94e460b55f23bdd7298b46183a20`
- Final source candidate tree: `921fc8a43296423ec4f568bf10dab038c88bd00e`
- This documentation-only closure commit is not a source candidate replacement.

## Hash convention

All source inventory values below are **Git blob OIDs (SHA-1)** read from final
source revision `684477c23c5b94e460b55f23bdd7298b46183a20`. They are not filesystem
SHA-256 values. The closure-document table names its separate documentation
revision explicitly.

## Imported Payment/Release files

These seven files are byte-for-byte identical to the explicitly named files in
the owner’s existing `C:\codex\GISP` checkout at freeze time. No other dirty
checkout file was imported.

| Git blob OID (SHA-1) | Path |
| --- | --- |
| `3df92655c30c63e19dd66e2fd5aa57867945106e` | `release-candidates/pay-rpc-gate-001/README.md` |
| `263ed86c94e27e70e1ed5f6852a774e1aedf4d6d` | `src/app/api/admin/payment-transfers/[id]/verify/route.ts` |
| `d4a2def6b70dab172c84d95182c5a82e595a1067` | `src/app/api/admin/payment-transfers/[id]/verify/route.test.ts` |
| `f11f248ee73ab98b4affb29cba5e2d72dc5b683d` | `docs/GISP-APR-GLR-C-GAPS-20260919-v0.1.md` |
| `16f416c459894dd5b498abb62e5b1da9ddda802c` | `docs/GISP-GLR-C-PAYMENT-GAP-TEST-20260919-v0.1.md` |
| `f12b71955bbc41e6464ab409b26bc408577c1678` | `docs/GISP-PLAN-RELEASE-CD-ROLLBACK-20260919-v0.1.md` |
| `9004033b605d8d46a72ec7e8d5f1be0244070d77` | `docs/GISP-RELEASE-CD-GO-LIVE-READINESS-20260919-v0.1.md` |

## Integration-only files

| Git blob OID (SHA-1) | Path | Bounded change |
| --- | --- | --- |
| `479d6b7635cc19ad42130b2668c71dc20cc2afb5` | `src/lib/payments/evidence-binding-migration.test.ts` | Normalize LF/CRLF in test input; SQL and business behavior unchanged. |
| `45bd42d10ef05e6315a1ff402399f1f7e584254d` | `src/app/api/admin/logistics/production-media/[supplierOrderId]/[fileId]/route.ts` | Resolve multiple links, enforce target-order/tenant relationships, and reject malformed UUIDs before database access. |
| `a141c76cd1611e48a6f98bfed19508861b3aa89b` | `src/app/api/admin/logistics/production-media/[supplierOrderId]/[fileId]/route.test.ts` | Valid, malformed-ID, multi-link and cross-organization regressions. |

## Final authenticated-read hardening

| Git blob OID (SHA-1) | Path | Bounded change |
| --- | --- | --- |
| `54924473d0c8a2c61bcc005c1ea9c590fd5fd520` | `src/lib/orders/read-only-rpc.ts` | Retry once only for exact read-only `socket hang up`. |
| `5cc726f1c9ec81f0f91cc078ce0bac430cf04237` | `src/lib/orders/read-only-rpc.test.ts` | Retry-once and non-transient fail-closed tests. |
| `e7750d500d9899c9a1fb3cd201bd86dacc3952f3` | `src/lib/orders/organization-access.ts` | Reuse one authenticated client and check target-organization permissions sequentially. |
| `9efbeaaaac7147bdc342e594eaf3e089217ef3fc` | `src/lib/orders/organization-access.test.ts` | Tenant permission and sequential-concurrency regression. |
| `12ad9e53e86dce8bb99a1834900487e21d35aebd` | `src/lib/orders/server.ts` | Sequential, retry-bounded Dispatch Gate reads. |

## Authorized Release-stage subset over `01c3064d`

This subsection describes only commit `ae1a0982c05d341cfd1fd6f003faefa4b3648fa4`:
the two exact PDF route gates, their positive/negative tests, and their approval
records. It is not the whole final delta. The complete local source delta from
`01c3064d1b7ec352402ca407dfa37e9e7d8a3aec` through `684477c23c5b94e460b55f23bdd7298b46183a20`
also includes the `01dc8dc` read-only RPC transport hardening and the `684477c`
malformed Production-media identifier guard inventoried above.

| Git blob OID (SHA-1) | Path | Bounded change |
| --- | --- | --- |
| `860595cef4e59c5329079277cc1d5d974127d72a` | `src/lib/release-stage.ts` | Exact Supplier PO PDF route at C and exact Warehouse Receipt PDF route at D8; no broad parent prefix. |
| `b685515226fe6a0bfeb427dcc3f3a654ebf1d3bd` | `src/lib/release-stage.test.ts` | Stage boundary plus invalid ID, parent and extra-child denials. |
| `7e643c5af41056e62c0c3b18a6b84d9c4a24b632` | `src/proxy.release-gate.test.ts` | Hosted proxy positive and broader-route negative regressions. |
| `17131ab2e6619aa8c3e30d399e56f7b47dc0bda4` | `docs/GISP-APR-INTEGRATION-FIVE-FIXES-PAYMENT-20260919-v1.0.md` | Approval blob present in source revision `684477c`; current closure document is inventoried separately below. |

## Current closure documents

Approval and readiness were last changed in documentation revision
`f90be9ed0a2262374e4322662dd5ad0e4d978c87` and remain unchanged in this
follow-up. Their current Git blob OIDs are therefore stable. The manifest cannot
truthfully embed its own final blob OID: adding that OID changes the blob again.
Its row is intentionally `N/A`; the authoritative manifest identity is the
documentation commit reported in the handoff after this file is committed.

| Git blob OID (SHA-1) | Path | Revision |
| --- | --- | --- |
| `488e8609253b9a2f3bf2ff3867fa8680fb03dd8c` | `docs/GISP-APR-INTEGRATION-FIVE-FIXES-PAYMENT-20260919-v1.0.md` | `f90be9ed0a2262374e4322662dd5ad0e4d978c87` |
| `bdae81b0e867903c1f0fd3c5f01d9cc08b509687` | `docs/GISP-RELEASE-CD-GO-LIVE-READINESS-20260919-v0.1.md` | `f90be9ed0a2262374e4322662dd5ad0e4d978c87` |
| `N/A — self-referential` | `docs/GISP-INTEGRATED-FIVE-FIXES-PAYMENT-CANDIDATE-MANIFEST-20260919-v1.0.md` | Documentation commit reported in final handoff |

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
