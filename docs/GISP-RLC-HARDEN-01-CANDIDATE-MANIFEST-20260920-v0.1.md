# GISP RLC-HARDEN-01 Candidate Manifest — v0.1

สถานะ: **LOCAL IMPLEMENTATION CANDIDATE / INDEPENDENT QA PENDING / NOT PRODUCTION READY**

## Source identity

- Approval: `docs/GISP-APR-RLC-HARDEN-01-IMPLEMENTATION-20260920-v0.1.md`
- Baseline commit/tree: `11db3010245b3094120903fa4c2623e5e6b2473c` / `eb30e105663609bd01815f33884f23be13ea513b`
- Initial implementation commit/tree: `a816a755c41b085ac27ebcc95c03188b93181b85` / `d75567247926eb8860211d0d7247a5922dbf3866`
- **Exact tested candidate HEAD/tree after QA fixes:** `cf62215b0cb359de87700b35f45c6d4ba1aaf1c2` / `8345c23b52b2ddc102dbc8bc92d237f957eeb1ef`
- This manifest is a non-executable evidence envelope committed after the tested source candidate; the candidate identity is the exact HEAD/tree above, not the earlier implementation commit.
- Branch/worktree: `codex/rlc-harden-01` / isolated local worktree
- Scope: Release C hardening only; D7/D8/Freight/D9/D10 gates and pricing/business formulas unchanged.

## Migration order and hash

Apply order is explicit but **not authorized to execute**:

1. Existing package `20260920010200_pay-private-executor.sql`
2. New `release-candidates/rlc-harden-01/migrations/20260920010250_release-c-org-scope-hardening.sql`
3. Existing package `20260920010300_release-c-privileges.sql`

The root draft and package copy have identical SHA-256:
`0d2fac819d158a2a87962b181f2f637ada298b7973240341dfcef46f4be9bfa2`.

The migration is forward-only. It adds/replaces functions, a trigger and RLS policy; it contains no `DELETE FROM`, `TRUNCATE` or `DROP TABLE` business-data operation.

## Local gate evidence on the exact tested candidate

| Gate | Result |
|---|---|
| Focused QA-fix Vitest | PASS — 3 files / 40 tests |
| Full `npm test` | PASS — 102 files / 548 tests |
| `npm run typecheck` | PASS |
| `npm run build` | PASS — Next.js 16.2.12 optimized production build, 128/128 static pages |
| `git diff --check` | PASS |

The first build attempt was invalidated by Turbopack rejecting an out-of-root `node_modules` junction. Dependencies were then installed locally with `npm ci`; the exact candidate build passed. `npm ci` reported 5 dependency advisories (2 moderate, 2 high, 1 critical), matching the package-lock dependency set; no automatic dependency or lockfile change was authorized or made.

## Release-control fields

- `backend_apply`: NOT RUN — prohibited by approval.
- `production_deploy`: NOT RUN / NOT AUTHORIZED.
- `data_write_or_transform`: NONE.
- `backup`: NOT CREATED — no backend target was accessed; must be completed under a separate rehearsal/release authorization.
- `hosted_smoke`: NOT RUN — no backend/hosted environment access authorized.
- `rollback_restore_drill`: NOT RUN — requires an authorized isolated rehearsal.
- `emergency_stop_package`: existing `release-candidates/pay-rpc-gate-001/emergency/` left unchanged and not executed. Independent QA must verify it against the integrated candidate before release authorization.
- `independent_qa`: RETEST PENDING after Builder addressed the preliminary FAIL findings; Builder does not approve its own work.
- `known_release_blocker`: exact migration lineage/signature/ACL/dependency validation, isolated rehearsal including cross-org/direct-RPC negatives, backup/restore drill, hosted smoke, independent QA and explicit Production Release Authorization remain mandatory.

## SHA-256 inventory (exact tested candidate)

The commit/tree above is the authoritative whole-candidate identity. Key file hashes:

| SHA-256 | File |
|---|---|
| `0d2fac819d158a2a87962b181f2f637ada298b7973240341dfcef46f4be9bfa2` | `migrations/20260918133857_release-c-org-scope-hardening.sql` |
| `0d2fac819d158a2a87962b181f2f637ada298b7973240341dfcef46f4be9bfa2` | `release-candidates/rlc-harden-01/migrations/20260920010250_release-c-org-scope-hardening.sql` |
| `37761f1237cd4ce26379fdef15b760492c39da9549c63bc53159687865cce9ca` | `src/lib/auth/organization-scope.ts` |
| `e7db06d62bfa7cbb872083640446139b724e3365724a0da28180ddf34f2ec4a3` | `src/lib/auth/session.ts` |
| `dd8c01c0104b8ef7cdf840fa8ad594121ea108d5d6d8be1363a92327c924e923` | `src/lib/auth/types.ts` |
| `f2774e21cad191ee3932af80702731ae98d17428eeb8039eb6b44fb936260227` | `src/lib/orders/server.ts` |
| `ea62ffb75a9590bf83fb31ab4faed7b9e749a0f0cb826dbc78c9b38397f2ac27` | `src/lib/custom-quotation/server.ts` |
| `36571b865e6b45010fe3b71310363396b5d428aa708ae2865ba595a43a5646d7` | `src/app/api/member/orders/route.ts` |
| `7caa5f8d36910a2bd82beb2fadf56030f29697243dac7f1cb6593535fc5a7085` | `src/app/api/files/route.ts` |
| `a89ac00f8557f3e7c219b886a90de113fc19078d9938f1a667775e45bbe74d57` | `src/app/api/files/[id]/download/route.ts` |
| `91f32e02e097469ca70408db04162f21c81511b44e2f96d14263fcf36980cfbe` | `src/app/api/admin/supplier-payments/[id]/mark-paid/route.ts` |
| `adbfbc0607dbb7f6f91a137e996af75a08b801a2187867405b0e7c85c4753a5c` | `src/lib/release-c-org-scope-hardening.test.ts` |
| `4cd64758326bd3102f7e39712053396927aa86fd96f92b1414526972fadb4d4a` | `src/lib/auth/release-c-org-scope-app.test.ts` |
