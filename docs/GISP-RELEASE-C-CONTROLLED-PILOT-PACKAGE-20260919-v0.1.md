# GISP Release C Controlled Production Pilot — Prepared Package v0.1

Status: **PACKAGE AND FRESH BACKUP PREPARED; MEMBER SIGNUP REQUIRED / NOT AUTHORIZED FOR PRODUCTION**

Approval basis: `docs/GISP-APR-CONTROLLED-PRODUCTION-PILOT-01-20260919-v1.0.md`

## Exact source candidate

- Commit: `11db3010245b3094120903fa4c2623e5e6b2473c`
- Tree: `eb30e105663609bd01815f33884f23be13ea513b`
- Commit subject: `fix: harden rehearsal attestation evidence`
- The current branch differs from this candidate only by four documentation commits. Application source is unchanged.
- Existing unrelated untracked `pnpm-lock.yaml`, `tools_tmp/` and Python cache directories are excluded. A release package must be built from the exact commit, not from the shared dirty worktree.

Fresh local candidate verification on 19 September 2026:

- Vitest: **98 files / 518 tests passed**.
- TypeScript: **passed** (`tsc --noEmit`).
- Optimized Next.js build: **passed**, 128 static pages generated.
- Next.js `16.2.12` and Sharp `0.35.3` remain a separately recorded dependency risk; the owner must accept this risk for the limited pilot or authorize an upgrade before the final Release C decision.

## Production baseline — read-only verification

- Project: `gisp-mvp-production`
- Project ID: `865860c2-49fa-4e53-908f-9396b2f75233`
- App key: `m8ugbyak`
- Backend: `https://m8ugbyak.ap-southeast.insforge.app`
- Current frontend deployment: `a3cf70ea-4394-45bd-8874-166800adc93d`, status `READY`, URL `https://m8ugbyak.insforge.site`.
- Database migration baseline: 26 applied; head `20260908170000_release-b-member-pilot`.
- Business counts before Release C: 0 Orders, 0 Payment Transfers, 0 Shipments and 0 Notification Jobs. Existing File and Audit counts are 3,942 and 5,859 respectively.
- Production notification Schedule `aefecf8b-5b02-4649-a9b2-47aa448af0e8` remains active and points to the Production backend. It was not changed.
- The only Production mutation during preparation was the explicitly authorized Backup rotation recorded below. No Migration, Deploy, Release Stage, Schedule, Role, Permission or transaction was changed.

## Release C migrations — exact allow-list

Apply individually and only in this order. `up --all` is prohibited.

| Order | Migration | SHA-256 |
| --- | --- | --- |
| 1 | `20260920010000_pay-close-legacy-entry.sql` | `bbbf50032469ef407f287418d69cab33f64cd8b912a425e50e23c4f0994e5ffb` |
| 2 | `20260920010100_pay-evidence-binding.sql` | `5a8cc2a7308fd78a7dba87244871dae08d30e1665b2193694e9b9e97eb94dac3` |
| 3 | `20260920010200_pay-private-executor.sql` | `e9a4b2c4745cdf07278935cf079c8c5d3db4ab8e241b74626f72ac90148eb96c` |
| 4 | `20260920010300_release-c-privileges.sql` | `2abb7fc8e1ca11fb1c3376b211370908810b9dbe89184528084a913912c822a5` |

Expected post-C head: `20260920010300_release-c-privileges`.

All migrations from `20260920010400` through `20260920011100` are Release D and are explicitly excluded. Production/QC, Shipment/Delivery, Freight Payment, Claim and Reports remain closed.

## Permission and Payment evidence carried forward

The exact four SQL hashes above were exercised as the first four migrations of the isolated `PAY-SEQ-02` rehearsal. Existing retained evidence covers:

- Anonymous/no-role and cross-organization denial.
- Member A cannot submit Member B's Payment.
- Finance A cannot preview or verify Member B's Payment.
- Legacy/direct private Payment paths remain closed to authenticated users.
- Stored PDF bytes, SHA-256, Payment, Organization, Member, Finance actor and Audit binding.
- Missing/corrupt evidence, expired preview, partial settlement and overpayment behavior.
- One evidence file can be used by only one Customer Payment Transfer.

The owner has deferred the missing final Hosted Stop/Resume/Restore evidence for this limited pilot. This is accepted residual risk, not a QA claim that the Hosted Rehearsal passed. Finance must open the stored document in the App and independently verify real bank settlement before final approval of every real Customer Payment.

## Emergency Stop C package

Keep these exact files available before the first real Order:

| Purpose | File | SHA-256 |
| --- | --- | --- |
| Stop Release C writes | `emergency/stop-c.sql` | `f98316e9fd18ea9498f2f583663e401181b5de6adae90b208fef0d67ca0726d5` |
| Read-only reconciliation | `emergency/reconcile.sql` | `45e93f9c9ffe6c17b38a1994c53c72b08ec1c0e7a0d8df50c1bb30db172994e6` |
| Forward resume | `emergency/resume-c.sql` | `918e003e0ad0e6f559859e2f2dd33141b358903bb5e0b0fdf18fdd8ac90f9cf9` |
| Function/ACL snapshot | `emergency/function-snapshot.sql` | `ba6bc88ccbd5a554109785033a6b4ef338d34535c5dd0d35df586cb3c0a8337f` |

These are canonical UTF-8/LF hashes. Raw Windows worktree hashes can differ because of line-ending conversion and must not be used as the release identity.

Emergency SQL is not pre-authorized for Production by this package. The final Release Authorization may authorize `stop-c.sql` only under the named stop conditions; Resume or Restore after real transactions requires incident-specific reconciliation and approval.

## Backup inventory after authorized rotation

- Latest scheduled completed backup: `81ecaeac-41a7-436b-ac5e-c82284991ab0`, triggered `2026-09-19T01:00:07.291Z`.
- The owner authorized deletion of exact manual Backup `9479ed9d-966e-4c63-9231-ea6b9618ec30` after local archive/hash verification. That Backup is now absent.
- Fresh manual Backup `e613b75c-ad3a-4f09-8bc5-82671576ce33`, named `pre-release-c-controlled-pilot`, completed at `2026-09-19T14:33:45.429Z`.
- Other manual backups remain unchanged:
  1. `4ceb701e-fed3-4ee6-95e0-e821093526dd` — `pre-release-b-20260909`
  2. `7fc7db66-0ca1-4640-aa47-c9c6e7736940` — `cn01-catalog-ready-20260906`
  3. `e7a630a4-571b-4f4f-96f9-6e7faf0d0e55` — `pre-cn01-load-20260906`
  4. `7d82d2a6-b131-4e00-bed7-0022802f53b5` — `pre-mvp-upgrade-20260906`

The fresh Backup predates the new Member signup. If it is used for Restore, the Member must be onboarded again. The final Release C Authorization must either accept this bounded recovery limitation or authorize a new post-onboarding Backup action; no additional Backup deletion is authorized by this package.

## Real Member requirement

The nominated `pakapop39@yahoo.com` identity is email-verified and ACTIVE but has no Member Profile, no Member organization and currently holds five internal roles: `MEMBER_ADMIN`, `ORDER_ADMIN`, `PRODUCT_ADMIN`, `PURCHASING`, `QC`. Production has no Organization or Member Profile named `vs innovation.co.,ltd`.

For reliable cross-organization isolation, use a distinct real Member email for `vs innovation.co.,ltd`. Converting or dual-using the internal staff identity is outside this Amendment and requires a separate security/business decision.

## Final Release C authorization inputs still required

Completed preparation decisions:

- Distinct Member email selected: `vsmodular@gmail.com`; signup, email verification, onboarding submission and bounded approval remain to be completed.
- Exact old Backup deletion was authorized and completed after archive/hash verification.
- Fresh Backup `e613b75c-ad3a-4f09-8bc5-82671576ce33` (`pre-release-c-controlled-pilot`) is `completed`.
- The owner accepted the unchanged Next.js/Sharp dependency risk for the one-Member/one-Order pilot with AVIF/HEIF not used.

Still required:

1. Verified and approved Member IDs for `vsmodular@gmail.com` / `vs innovation.co.,ltd`, with Member-only role isolation.
2. Final Production Release C Authorization naming this Candidate, the four SQL hashes, Backup `e613b75c-ad3a-4f09-8bc5-82671576ce33`, `RELEASE_STAGE=C`, empty D flags, the approved Member, Finance verifier, first-Order owner, monitoring window, smoke checks and stop conditions.

Until both remaining items are recorded, status remains **NO-GO**. Production preparation changed only the explicitly authorized Backup; no Migration, Deploy, Stage, Schedule, Role, Permission or transaction was changed.
