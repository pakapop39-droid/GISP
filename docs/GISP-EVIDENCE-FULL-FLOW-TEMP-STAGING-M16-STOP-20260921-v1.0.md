# GISP Evidence — Temporary Staging Migration #16 Stop v1.0

## Approved target

- Project: `gisp-full-flow-staging-20260921`
- Project ID: `33481c06-9ac0-43e0-a13f-88480e409441`
- Host marker: `4tsmimwp`
- Region: `ap-southeast`
- Approved candidate: commit `aeeacdb40d48d7899b2764e8792f659541ae7f76`, tree `76eef75700d594a76b62afe3ecbbd0beaa01dd39`
- `production_allowed`: `No`

## Preflight result

- Project identity matched the approved standalone Staging.
- Project was active on the `nano` instance with no in-flight operation.
- Migration history contained the Production-B baseline 26 plus candidate #1–#4.
- Both existing named backups were `completed`.
- Schedule count was `0`.
- Deployment environment was empty; therefore no deployment was attempted.

## Execution result

- Candidate migration #5 retry succeeded with approved SHA-256 `82F5D3873589FB80BFEC59ABBBF53E46A0C57AE3127B47A72DD3CEF055D07A35`.
- Candidate migrations #6–#15 succeeded individually in manifest order.
- Candidate migration #16 with SHA-256 `89BCABA44B13B7B54157867E921FFA7752FC87B4078D2EF2E7C026BE427D1D1C` was rejected transactionally with `syntax error at end of input` at character `2376`.
- Post-stop read-only verification showed `41` applied migrations: baseline 26 plus candidate #1–#15.
- Migration head was `20260920011200_full-flow-sourcing-scope-hardening` (#15).
- Migration #16 was absent from history and schedule count remained `0`.
- No deployment, fixture, outbound notification, UAT or recovery mutation occurred.
- Production was not accessed for mutation and remained unchanged.

## Root cause and Local correction

The first PL/pgSQL trigger function in migration #16 had two unparenthesized `CASE` expressions after `IS NOT DISTINCT FROM`. The local correction adds only two parenthesis pairs. It does not change any financial formula, status mapping, ACL, RPC, trigger behavior, emergency package or application source.

- Corrected canonical/package #16 SHA-256: `198A1E5B8C15BF6C44C71D5E3183333ADC0C3B475935AA6643D7ED9F1196CC83`
- Local compile: PASS using an in-memory PostgreSQL-compatible engine without Backend access
- Builder: focused `13/13`, regression `606/606`, typecheck, lint `0 errors`, build `128/128`, diff check PASS
- Independent QA: PASS; Blocker `0`, Major `0`, Minor `0`

## Mandatory next gate

The owner must authorize the exact corrected commit/tree and corrected #16 hash before any Staging retry. The next execution may retry only migration #16 after identity/history/backup/schedule preflight. It must not replay baseline or candidate #1–#15 and must not use `up --all`.
