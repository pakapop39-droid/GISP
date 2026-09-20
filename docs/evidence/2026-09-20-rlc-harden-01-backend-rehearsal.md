# RLC-HARDEN-01 Isolated Backend Rehearsal — Preflight Evidence

Date: 2026-09-20 (Asia/Bangkok)

Status: **STOPPED BEFORE APPLY — schedule disable reported success but did not persist; inherited Production-targeting schedule remains active**

Authorization: `docs/GISP-APR-RLC-HARDEN-01-BACKEND-REHEARSAL-20260920-v0.1.md`, committed as `cfd3609d419b9b5a42ed8dd636e459e1323e13d4` before any external mutation.

## Candidate identity

- Tested source commit/tree: `cf62215b0cb359de87700b35f45c6d4ba1aaf1c2` / `8345c23b52b2ddc102dbc8bc92d237f957eeb1ef`
- Evidence envelope before this preflight: `7656c4a6c55a169b8ce952a1d8c30d7864945f30`
- Local branch/worktree: `codex/rlc-harden-01` / isolated worktree

## Parent verification before mutation

- Production parent ID: `865860c2-49fa-4e53-908f-9396b2f75233`
- Production project: `gisp-mvp-production`
- Production appkey: `m8ugbyak`
- CLI authenticated: yes
- Reclaim target verified before deletion:
  - name: `production-completion-20260906`
  - ID: `2cff11a0-9e16-41d4-989a-dcfc9f48103d`
  - parent ID: `865860c2-49fa-4e53-908f-9396b2f75233`
  - state/status/mode: `ready` / `active` / `schema-only`
- New branch name `rlc-harden-01-rehearsal-20260920` was absent before creation.

## Authorized external mutations performed

1. Deleted only `production-completion-20260906`, exact ID `2cff11a0-9e16-41d4-989a-dcfc9f48103d`. CLI returned `deleted: true`; the target is absent from the subsequent branch list.
2. Created `rlc-harden-01-rehearsal-20260920` from the verified Production parent in `schema-only` mode.

New child identity:

- branch/project ID: `41df0506-ef0a-4753-9426-b1c8ed4f9ff6`
- parent ID: `865860c2-49fa-4e53-908f-9396b2f75233`
- appkey: `m8ugbyak-bd6`
- region: `ap-southeast`
- state/status/mode: `ready` / `active` / `schema-only`
- created at: `2026-09-20T07:13:30.888Z`
- serving: `true`

## Child read-only preflight

- Applied migration count: `26`
- Migration head: `20260908170000 release-b-member-pilot`
- No migration was applied and `up --all` was not run.

Schedule inspection found one schedule:

- ID: `aefecf8b-5b02-4649-a9b2-47aa448af0e8`
- name: `GISP-Notification-Retry`
- active: `true`
- cron: `*/10 * * * *`
- target URL: `https://m8ugbyak.ap-southeast.insforge.app/functions/notification-retry`
- risk result: **points directly to Production appkey/host `m8ugbyak`**

URL, headers and body were evaluated for the Production marker without printing secret values. The active state and Production URL independently satisfy the mandatory stop condition.

## Fail-closed action and Production check

- Stopped before migration Apply, deployment, fixture/data writes, schedule changes, config changes or secret changes.
- Did not disable, edit or delete the inherited schedule because schedule mutation was not authorized.
- Switched the dedicated CLI context back to the Production parent immediately after collecting child evidence.
- Final CLI current project is Production parent `865860c2-49fa-4e53-908f-9396b2f75233`, appkey `m8ugbyak`.
- Final read-only Production migration state remains `26` applied migrations with head `20260908170000 release-b-member-pilot`, matching the previously recorded Production baseline.
- No Production data/config/deploy/migration mutation was performed. The only destructive external action was deletion of the exact authorized old branch.

## Decision identified by the initial preflight

The initial preflight blocked migration Apply and fixture creation pending explicit authorization to make the child schedule safe and repeat the schedule preflight. That authorization was subsequently recorded in the continuation section below.

## Continuation attempt — approved schedule deletion

Continuation authorization: `docs/GISP-APR-RLC-HARDEN-01-BACKEND-REHEARSAL-CONTINUATION-20260920-v0.2.md`, committed as `4f8754d9d02f533f2aba919cec6ff6403c865e13` before the external mutation attempt.

Verified before the attempt:

- Current CLI project was Production parent ID `865860c2-49fa-4e53-908f-9396b2f75233`, appkey `m8ugbyak`.
- Exact child `rlc-harden-01-rehearsal-20260920`, ID `41df0506-ef0a-4753-9426-b1c8ed4f9ff6`, remained `active` / `ready` / `schema-only` under that parent.
- Production schedule baseline remained ID `aefecf8b-5b02-4649-a9b2-47aa448af0e8`, name `GISP-Notification-Retry`, active, cron `*/10 * * * *`, targeting `https://m8ugbyak.ap-southeast.insforge.app/functions/notification-retry`.
- Production migration baseline remained 26 applied migrations with head `20260908170000 release-b-member-pilot`.

The CLI was switched to the exact child and current project identity was rechecked as ID `41df0506-ef0a-4753-9426-b1c8ed4f9ff6`, appkey `m8ugbyak-bd6`. The inherited schedule matched the exact authorized ID/name and was still active and targeting Production.

The supported command attempted was:

```text
npx -y @insforge/cli schedules delete aefecf8b-5b02-4649-a9b2-47aa448af0e8 -y --json
```

Result: **FAILED**. The backend returned `DATABASE_INTERNAL_ERROR` with sanitized message `could not find valid entry for job 4`; the Windows CLI process then terminated with assertion failure and exit code `-1073740791`.

Fail-closed postcheck:

- Child schedule ID `aefecf8b-5b02-4649-a9b2-47aa448af0e8` still exists, remains active and still targets the Production URL.
- No migration was applied; the approved allow-list was not started.
- No synthetic fixture or other business data was created or modified.
- No deployment, raw SQL, managed-schema change, schedule workaround, secret/config change, branch merge/reset or Production write was attempted.
- The dedicated CLI context was returned to the Production parent.
- Final Production read-only check remained unchanged: the same schedule is active with the same cron and URL; migration count/head remain `26` / `20260908170000 release-b-member-pilot`.

This is a hard stop under the owner's authorization. Rehearsal execution remains blocked until the schedule can be neutralized through an explicitly approved supported path; this evidence does not authorize a bypass or raw SQL workaround.

## Continuation attempt — one approved disable call

Authorization: `docs/GISP-APR-RLC-HARDEN-01-BACKEND-REHEARSAL-SCHEDULE-UPDATE-20260920-v0.3.md`, committed as `6aac84c46e6f1300f6e828b83ca60f0f59949a2b` (tree `4932d114dddb0c713e1b066c8276a3a5821cb0a6`) before the external mutation attempt.

Read-only preconditions were verified again:

- Production parent ID `865860c2-49fa-4e53-908f-9396b2f75233`, appkey `m8ugbyak`.
- Production schedule baseline: exact ID/name, active, cron `*/10 * * * *`, Production target URL.
- Production migrations: 26 applied; head `20260908170000 release-b-member-pilot`.
- Child `rlc-harden-01-rehearsal-20260920`, ID `41df0506-ef0a-4753-9426-b1c8ed4f9ff6`, remained `active` / `ready` / `schema-only` under the exact parent.
- On the child, schedule ID `aefecf8b-5b02-4649-a9b2-47aa448af0e8` was `GISP-Notification-Retry`, active and targeting Production.

Exactly one supported disable call was made:

```text
npx -y @insforge/cli schedules update aefecf8b-5b02-4649-a9b2-47aa448af0e8 --active false --json
```

CLI result:

- attempt count: `1`
- exit code: `0`
- response: `Schedule updated successfully`

Immediate read-only postcondition checks did **not** match the successful response:

- `schedules get` still returned `isActive: true`.
- `schedules list` still found one active schedule targeting the Production host.
- The schedule URL itself remained unchanged, which would have been acceptable only if inactive; because it remained active, the child is still unsafe.

No retry was made. No delete, raw SQL, permission bypass, migration Apply, fixture/data write, deployment, config/secret change, branch merge/reset or Production mutation was attempted.

The CLI context was returned to the Production parent. Final read-only Production verification was unchanged:

- same schedule ID/name, `isActive: true`, same cron/method/Production URL;
- migration count/head `26` / `20260908170000 release-b-member-pilot`.

One sanitized support report was sent through the authorized InsForge CLI feedback command:

- feedback ID: `0d52d335-9316-4e88-b2c5-433a5eb6ee3f`
- status: `received`
- classification: backend bug / database area / blocker
- request: repair or deactivate the ghost schedule on child ID `41df0506-ef0a-4753-9426-b1c8ed4f9ff6` only and do not alter parent ID `865860c2-49fa-4e53-908f-9396b2f75233`
- payload contained project/schedule identifiers and sanitized errors only; no secret or application data was included.

Migration Apply remains prohibited until the child schedule is verifiably inactive or absent and independent QA confirms there is no active child schedule pointing to Production.
