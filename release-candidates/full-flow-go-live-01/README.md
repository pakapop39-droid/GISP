# FULL-FLOW-GO-LIVE-01 v0.1 — Local Candidate

Local-only candidate package for the owner-approved implementation scope.

- Baseline: `2bb809791ea809c6f5b8fc9472a2430240cb840c`
- Branch: `codex/full-flow-go-live-01`
- Worktree: `C:\Users\ASUS\.codex\worktrees\full-flow-go-live-01\GISP`
- Production allowed: `No`
- Migration apply/deploy/backend write: `Not authorized`

For a future standalone isolated Staging rehearsal, apply the 26-file
`production-b-baseline/` first and the 17-file `migrations/` allow-list second,
using only the exact order and SHA-256 inventory recorded in their manifests.
The `emergency/` directory contains the #17-compatible exact-candidate stop/resume package
and the hash-pinned SELECT-only reconciliation runner/template that must be
rehearsed on the same candidate. Do not run
`migrations up --all` or use the shared migration tree. None of these files
authorizes Staging creation, migration apply, deployment or Production access.
