# Integrated Five Fixes + Payment Candidate Manifest v1.0

Development closure recorded on 19 September 2026. The exact Development candidate passed final Hosted authenticated UAT. Production remains **NO-GO**.

## Git identity

- Integration branch: `codex/integration-five-fixes-payment`
- Five-fix base: `6d43b0278348dad4038f0408b76d87d8f94d9bf2`
- Payment integration: `a6eda24474f232f56eec24a9c404092f6ae88a7e`
- Production-media multi-link fix: `e27ec49edb1b62a18bd1cb38377fef619ea8e015`
- Pre-authorization manifest: `01c3064d1b7ec352402ca407dfa37e9e7d8a3aec`
- Exact PDF Release Stage allowlist: `ae1a0982c05d341cfd1fd6f003faefa4b3648fa4`
- Read-only RPC transport hardening: `01dc8dc9ee72aa998c111c7c0c9161e439cd1505`
- Malformed Production-media ID guard: `684477c23c5b94e460b55f23bdd7298b46183a20`
- Release D navigation hydration fix: `4e64c44f355ee742262cb89607bef3a521b718f9`
- **Final source candidate HEAD:** `4e64c44f355ee742262cb89607bef3a521b718f9`
- **Final source candidate tree:** `1d66c8ac30de2680ed783914fe4083c54381c791`
- This documentation-only closure commit records evidence and does not replace the source identity above.

## Hash convention

Every inventory value is a Git blob OID (SHA-1), not a filesystem SHA-256. Each table names the Git revision from which the blob was read. The manifest cannot embed its own final blob OID without changing that OID; its closure row is therefore `N/A — self-referential`, with the authoritative documentation commit reported in the handoff.

## Imported Payment/Release files

Historical import inventory at Payment integration revision `a6eda24474f232f56eec24a9c404092f6ae88a7e`. These were the only files brought from the owner’s dirty root checkout.

| Git blob OID (SHA-1) | Path |
| --- | --- |
| `3df92655c30c63e19dd66e2fd5aa57867945106e` | `release-candidates/pay-rpc-gate-001/README.md` |
| `263ed86c94e27e70e1ed5f6852a774e1aedf4d6d` | `src/app/api/admin/payment-transfers/[id]/verify/route.ts` |
| `d4a2def6b70dab172c84d95182c5a82e595a1067` | `src/app/api/admin/payment-transfers/[id]/verify/route.test.ts` |
| `f11f248ee73ab98b4affb29cba5e2d72dc5b683d` | `docs/GISP-APR-GLR-C-GAPS-20260919-v0.1.md` |
| `16f416c459894dd5b498abb62e5b1da9ddda802c` | `docs/GISP-GLR-C-PAYMENT-GAP-TEST-20260919-v0.1.md` |
| `f12b71955bbc41e6464ab409b26bc408577c1678` | `docs/GISP-PLAN-RELEASE-CD-ROLLBACK-20260919-v0.1.md` |
| `c56ae56617ab13b2520d3af6550f1e9befd0f243` | `docs/GISP-RELEASE-CD-GO-LIVE-READINESS-20260919-v0.1.md` |

## Integration and authenticated-read hardening

Blob OIDs below are from final source revision `4e64c44f355ee742262cb89607bef3a521b718f9`.

| Git blob OID (SHA-1) | Path | Bounded change |
| --- | --- | --- |
| `479d6b7635cc19ad42130b2668c71dc20cc2afb5` | `src/lib/payments/evidence-binding-migration.test.ts` | Normalize LF/CRLF test input; SQL and business behavior unchanged. |
| `45bd42d10ef05e6315a1ff402399f1f7e584254d` | `src/app/api/admin/logistics/production-media/[supplierOrderId]/[fileId]/route.ts` | Multi-link resolution, target-order/tenant checks and malformed UUID denial. |
| `a141c76cd1611e48a6f98bfed19508861b3aa89b` | `src/app/api/admin/logistics/production-media/[supplierOrderId]/[fileId]/route.test.ts` | Valid, malformed, multi-link and cross-organization regressions. |
| `54924473d0c8a2c61bcc005c1ea9c590fd5fd520` | `src/lib/orders/read-only-rpc.ts` | Retry once only for exact read-only `socket hang up`. |
| `5cc726f1c9ec81f0f91cc078ce0bac430cf04237` | `src/lib/orders/read-only-rpc.test.ts` | Retry-once and non-transient fail-closed tests. |
| `e7750d500d9899c9a1fb3cd201bd86dacc3952f3` | `src/lib/orders/organization-access.ts` | Sequential target-organization permission checks. |
| `9efbeaaaac7147bdc342e594eaf3e089217ef3fc` | `src/lib/orders/organization-access.test.ts` | Tenant permission and sequential-concurrency regression. |
| `12ad9e53e86dce8bb99a1834900487e21d35aebd` | `src/lib/orders/server.ts` | Sequential, retry-bounded Dispatch Gate reads. |

## Release Stage and hydration inventory

Blob OIDs below are from final source revision `4e64c44f355ee742262cb89607bef3a521b718f9`. The exact PDF allowlist remains the authorized subset from `ae1a098`; `4e64c44` only makes the server-authorized D-slice navigation snapshot deterministic across hydration.

| Git blob OID (SHA-1) | Path | Bounded change |
| --- | --- | --- |
| `71d6e575dab4592bc223c7fa4d23dc8aa836961c` | `src/lib/release-stage.ts` | Exact PDF gates plus explicit server D-slice snapshot support; defaults preserve server gate behavior. |
| `21199811d373a478c4489461d21fb6f3424d4936` | `src/lib/release-stage.test.ts` | Stage boundaries, broader-route denials and build/runtime snapshot regression. |
| `7e643c5af41056e62c0c3b18a6b84d9c4a24b632` | `src/proxy.release-gate.test.ts` | Hosted proxy positive and broader-route negative regressions. |
| `b8ad6cbe789c22fef2d48b911916314352990637` | `src/components/production-shell.tsx` | Use the server-provided D-slice list when rendering navigation. |
| `5cc54f807673ed68f4f930c968d59daf20bb336e` | `src/components/production-shell.test.ts` | Server/client Release D navigation drift regression. |
| `8e61bcd65ea10d758051853b1e90c0d67367e9e9` | `src/app/admin/layout.tsx` | Serialize authorized D slices into Admin shell. |
| `cb4a4c9c9841b54f9f3fc38798b71ccf6dde209d` | `src/app/member/layout.tsx` | Serialize authorized D slices into Member shell. |

## Development execution evidence

- Target project: `db09b94e-fc37-4f90-9530-3289afef0b79` only.
- Environment: `RELEASE_STAGE=D`, `RELEASE_D_ENABLED_SLICES=7,8,9,10`.
- Backup verified complete before migrations; `20260920010000` through `20260920011100` applied once and in order, 12/12.
- Final deployment references: application `0d7a2641-ed83-4014-b5a7-6d737b7b9e8f`; provider `dpl_7U8bJJx7CpugmAhAxx18gmCDkHXi`.
- `/api/health` and login returned HTTP 200.
- Final Hosted authenticated UAT: **PASS**.
- Admin Order Detail hydration fix retest: browser errors `[]`.
- Independent QA: 532 tests passed; typecheck, optimized build and affected ESLint checks passed.
- Hosted credential limitation: UAT used separate shared credentials for Super Admin and Member. No Finance-only, Purchasing-only or Logistics-only Hosted credentials were available. Earlier local authenticated and automated evidence remains the basis for those role-specific allow/deny and cross-organization cases.
- Member Catalog performance observation: usual completion about 10–12 seconds; one automation probe timed out. Functional UAT passed; monitor this latency separately.
- Development Slice remaining steps: **0**.
- Production: **No / NO-GO**.

## Current closure documents

Approval and readiness Git blob OIDs below are calculated from the exact document contents staged for this closure. The documentation commit is reported after commit creation. The manifest row is intentionally self-referential.

| Git blob OID (SHA-1) | Path | Revision provenance |
| --- | --- | --- |
| `3280b9f7ef02a5ec55fdd02b86933f60d22a3abe` | `docs/GISP-APR-INTEGRATION-FIVE-FIXES-PAYMENT-20260919-v1.0.md` | Traceability correction documentation commit reported in handoff |
| `90d1615b0aa9dc016bc411e81ed9a63dbbb5ea3b` | `docs/GISP-RELEASE-CD-GO-LIVE-READINESS-20260919-v0.1.md` | Traceability correction documentation commit reported in handoff |
| `N/A — self-referential` | `docs/GISP-INTEGRATED-FIVE-FIXES-PAYMENT-CANDIDATE-MANIFEST-20260919-v1.0.md` | Traceability correction documentation commit reported in handoff |

## Exclusions and Production status

No `pnpm-lock`, tools, caches, `.env`, credentials, unrelated dirty files or root-checkout state are included. No Production deployment, migration, data mutation or environment change occurred. Development UAT closure does not grant Production authority. Production C and each D slice still require separate readiness evidence and exact owner Release Authorization.
