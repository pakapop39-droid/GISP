# RLC-HARDEN-01 Isolated Backend Rehearsal — Preflight Evidence

Date: 2026-09-20 (Asia/Bangkok)

Status: **STOPPED BEFORE APPLY — inherited active schedule points to Production**

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

## Required decision before rehearsal execution

Migration Apply and fixture creation remain blocked. A separate explicit authorization is required to decide how the child schedule should be made safe (for example, disable it or retarget it only to an isolated child endpoint) and then repeat schedule preflight before any migration or data write.
