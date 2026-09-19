# Integrated Five Fixes + Payment Candidate Manifest v1.0

Frozen locally on 19 September 2026 for independent QA and a separately
executed Development frontend deploy/UAT. Production remains **NO-GO**.

## Git identity

- Integration branch: `codex/integration-five-fixes-payment`
- Five-fix base: `6d43b0278348dad4038f0408b76d87d8f94d9bf2`
- Payment integration commit: `a6eda24474f232f56eec24a9c404092f6ae88a7e` (`test(payment): integrate verification gate`)
- Production media hardening commit: `e27ec49edb1b62a18bd1cb38377fef619ea8e015` (`fix(logistics): disambiguate production media links`)
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
| `f76409d8183b3a7d1e110418f74c0ce3ae949bc0d43973f1cd1307843df390f8` | `docs/GISP-APR-INTEGRATION-FIVE-FIXES-PAYMENT-20260919-v1.0.md` | Bounded owner approval and stop conditions. |

## Explicit exclusions and blockers

- No `pnpm-lock`, tools, caches, `.env`, keys, unrelated dirty files or root
  checkout state are part of this candidate.
- No database schema/data change or migration execution occurred.
- The 12 ordered `PAY-RPC-GATE-001` migrations remain **pending separate exact
  authorization**. This manifest does not authorize applying any of them.
- Production release-stage routing still blocks two new PDF endpoints:
  - `/api/admin/supplier-orders/[id]/po/pdf` is absent from the Release C/D
    positive route lists.
  - `/api/admin/warehouse-receipts/[id]/pdf` is absent from the D8 positive
    route list.
- `/api/admin/logistics/production-media/...` is covered by the existing D8
  `/api/admin/logistics` prefix when D8 is explicitly enabled.
- The PDF allowlist gaps are intentionally unchanged because opening Production
  routes is a permission/gate change requiring a new owner approval.
- Development frontend deployment/UAT is authorized in the approval record but
  was not performed while producing this local candidate.

## Required next gates

1. Independent QA verifies the final commit/tree and this SHA-256 inventory.
2. Release Executor deploys only this frozen frontend candidate to Development
   and records UAT evidence; no backend migration is implied.
3. Obtain separate owner approval before any 12-migration apply or release-stage
   allowlist change.
