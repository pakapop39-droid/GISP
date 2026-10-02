# GO-LIVE-MVP-INITIAL-OPERATIONS-01 — Lean Staging Accounts Preflight Usage Scope Repair 01 v0.1

## 1. Purpose and Risk

This T3 Local Amendment repairs a fail-closed preflight false positive before Accounts fixture creation. The live Accounts attempt stopped before any adapter or Backend mutation with `FORBIDDEN_TARGET` because organization-wide provider Usage legitimately listed Production and other projects as read-only inventory.

- Local worktree: `C:\Users\ASUS\.codex\worktrees\full-flow-go-live-01\GISP`
- Branch: `codex/full-flow-go-live-01`
- Candidate commit/tree remain: `8b2573729b7d2b8ad750414e1ba86daa633e4218` / `9cb01e050462ded9160ac2429667794b27ceaf00`
- Target Staging remains: `a24aff68-a82e-41da-b64a-a128a1539769` / `5wjnzj4y`
- This Amendment authorizes Local runner code/tests/documentation/reseal only.
- `staging_allowed`: `No`
- `production_allowed`: `No`

## 2. Confirmed Cause and No-write State

`collect-preflight.mjs::buildEvidence()` currently calls `rejectForbiddenMarkers(parsed)` over every raw CLI response. `usage --org-id` intentionally returns all projects in the Organization, including Production, old Staging and Ghost Child. Those read-only inventory rows trigger the generic guard even though the exact write target remains the isolated Lean Staging context.

The runner order is package/billing validation → live preflight → runtime binding → adapter construction/mutation. The error occurred during live preflight. No runner state/checkpoint, Auth account, Organization, role, member fixture, notification or Production write was created by this attempt. Keep `ACCOUNTS_PHASE_STARTED.json` unchanged as evidence.

## 3. Exact Local File Allow-list

Builder may modify only:

1. `.codex-tmp/lean-staging-runner/collect-preflight.mjs`
2. `.codex-tmp/lean-staging-runner/collect-preflight.test.mjs`
3. `.codex-tmp/lean-staging-runner/README.md`
4. `.codex-tmp/lean-staging-runner/PACKAGE-MANIFEST.json` — reseal only

`core.mjs`, `manifest.mjs`, adapters, state, application source, migrations, release candidate, Backend, Staging and Production must not change.

## 4. Required Design

1. Keep `core.mjs::rejectForbiddenMarkers()` and its forbidden marker list unchanged.
2. In `buildEvidence()`, scan all target/write-binding raw responses with the existing guard: `current`, exact `project`, `schedules`, `metadata`, `migrations`, `backups` and `secrets`.
3. Treat raw `usage` as a hard-coded read-only provider inventory only; it must never select a write target or flow into adapters.
4. Strengthen `normalizeUsage()` to require:
   - exact Organization ID `e93668ea-e8ab-4361-9872-282454438478`;
   - every project row has UUID `id`, string `name` and string `status`;
   - exactly one row has target ID `a24aff68-a82e-41da-b64a-a128a1539769`;
   - target name is exactly `gisp-lean-staging-20260923` and status is `active` case-insensitively.
5. Normalized evidence may expose only aggregate inventory facts and exact target-binding facts. It must not expose other project IDs, names or metrics.
6. Preserve raw Usage audit provenance only through the existing `stdoutSha256` command hash.
7. Keep the final normalized-evidence guard, isolated CLI context, runtime binding, release attestation and all adapter guards unchanged.
8. The semantic manifest hash must remain unchanged. Package bytes and aggregate seal must be regenerated.

## 5. Acceptance Criteria

- `AC-USAGE-01`: Usage with exact target plus unrelated Production/old-Staging/Ghost rows passes preflight.
- `AC-USAGE-02`: Normalized evidence contains no identity or metrics for unrelated projects.
- `AC-USAGE-03`: Organization mismatch, missing target, duplicate target, name mismatch, inactive target, missing/non-UUID row ID or ambiguous shape stops fail-closed.
- `AC-USAGE-04`: A forbidden marker in current, exact project, schedules, metadata/config, migrations, backups, secrets, runtime env, attestation or normalized evidence still throws `FORBIDDEN_TARGET`.
- `AC-USAGE-05`: A forbidden marker only in an unrelated raw Usage inventory row does not select a target and does not stop the exact Staging preflight.
- `AC-USAGE-06`: Focused tests, full runner tests, syntax checks, package-seal/inventory test and dry-run all pass with no Network/Backend write.
- `AC-USAGE-07`: Independent QA confirms semantic manifest SHA remains `2ABC5F6256AB15BB389D813FE7BCACC641C4E08F00F3EE2201E99A5D8AEF770D`, pins the new aggregate SHA and confirms only the four allow-listed files changed.

## 6. Stop and Continuation Conditions

Stop before implementation or reseal if the solution requires modifying the generic forbidden-marker guard, manifest, adapter, target binding or application candidate. Stop if Usage cannot uniquely bind the exact target or any test/seal/QA check fails.

This Amendment does **not** authorize rerunning Accounts or any Backend write. After Builder and Independent QA complete, a separate exact Staging package-hash rebinding/execution authorization is required. Expired Billing quote/snapshot must not be reused; Accounts retry requires fresh provider-visible evidence and Independent QA.

## 7. Proposed Approval Text

> ผม ภคภพ ช.เจริญยิ่ง อนุมัติ Scope Amendment และ Local Implementation ตามเอกสาร `GO-LIVE-MVP-INITIAL-OPERATIONS-01 — Lean Staging Accounts Preflight Usage Scope Repair 01 v0.1` และ checksum companion ที่แนบ เฉพาะ Local isolated worktree `C:\Users\ASUS\.codex\worktrees\full-flow-go-live-01\GISP` branch `codex/full-flow-go-live-01` อนุญาตให้แก้เฉพาะ `.codex-tmp/lean-staging-runner/collect-preflight.mjs`, `collect-preflight.test.mjs`, `README.md` และ reseal `PACKAGE-MANIFEST.json` ตาม exact design/acceptance criteria ในเอกสาร โดยต้องคง `core.mjs`, forbidden marker list, `manifest.mjs`, adapters, state, app candidate, migration และ business scope เดิม อนุญาตเฉพาะ Local mocks/tests/dry-run/reseal ห้าม Backend/Staging write, Accounts retry, Deploy, Migration, Config/Schedule/Notification, data และ Production หลัง Builder และ Independent QA ผ่าน ต้องขอ package-hash rebinding และ Staging execution authorization แยกก่อน Accounts retry ใช้เวลาของข้อความนี้เป็น `approved_at` กำหนด `data_authority: Local mocks only`, `network_backend_authority: None`, `staging_allowed: No` และ `production_allowed: No`
