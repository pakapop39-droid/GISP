# RLC-HARDEN-01 isolated rehearsal package

Status: **PREPARED LOCALLY / NOT EXECUTED / NO BACKEND MUTATION AUTHORIZED BY THIS PACKAGE**

This directory freezes the target identities, schedule safety gate, five-file migration allow-list, synthetic fixture namespace, runtime test matrix, cleanup limits and sanitized evidence fields for a future independently authorized rehearsal.

## Local-only validation

Run from the repository root:

```text
node release-candidates/rlc-harden-01/rehearsal/validate-package.mjs
node --test release-candidates/rlc-harden-01/rehearsal/rehearsal-guard.test.mjs
node release-candidates/rlc-harden-01/rehearsal/prepare-rehearsal.mjs
```

All three commands are local-only. `prepare-rehearsal.mjs` defaults to dry-run and deliberately rejects `--execute` and `--mode execute`. It never invokes InsForge, applies SQL, deploys code or creates fixtures.

An optional sanitized snapshot can be checked without contacting a backend:

```text
node release-candidates/rlc-harden-01/rehearsal/prepare-rehearsal.mjs --snapshot <sanitized-snapshot.json>
```

The snapshot must contain `currentProject`, `branch`, `schedulesComplete: true`, `schedules` and `productionBaseline`. `schedules` must be the complete successfully parsed array returned by a single read-only list operation; missing, null, object-shaped, truncated or otherwise ambiguous schedule data produces `safe: false` with blockers and fails closed. Do not include credentials, cookies, authorization headers, tokens, real emails or business rows.

## Mandatory future execution gates

This package does not confer authorization. A future mutation-capable executor must be separately approved and must:

1. Require the deliberate non-secret execution latch defined in `rehearsal-contract.mjs`.
2. Re-read and validate current Child ID/name/appkey/region and branch lineage immediately before every backend write.
3. Re-read all schedules immediately before every backend write and abort if any active URL/header/body targets Production.
4. Re-hash the exact source migration immediately before each single-file apply.
5. Apply only the five files in `rehearsal-contract.mjs`, in order, with explicit `db migrations up <filename>` calls.
6. Reject `up --all`, `up --to`, identity mismatch, Production appkey/host, missing hash, changed hash or failed postcondition.
7. Stop on the first failure and return the CLI context to the Production parent after read-only Production verification.

The latch is an accident-prevention control, not a secret and not an Approval Record. Its presence never replaces owner authorization or independent QA.

## Fixture and runtime boundaries

- Every synthetic organization, actor, record label and evidence alias must begin with `REH-RLC-HARDEN-01`.
- Use non-deliverable example identities only; never use a real email address.
- Do not invoke notification functions, external URLs or real payment providers.
- Do not store secrets or raw authorization material in evidence.
- Execute the cases listed in `rehearsal-plan.json`, recording before/after counts and immutable fixture IDs.
- Cleanup is limited to positively identified prefixed fixtures and captured IDs. See `cleanup-plan.md`; it is a plan only and must not be run under the local-preparation approval.

## Current blocker

Ghost Schedule `aefecf8b-5b02-4649-a9b2-47aa448af0e8` still read back as active and targeting Production after a supported disable reported success. No migration or fixture phase may start until InsForge repairs it and independent QA confirms the schedule gate.
