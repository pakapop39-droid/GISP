# Hosted rehearsal evidence tools

These tools are local-only helpers. They do not connect to InsForge unless the
operator explicitly invokes `verify-attestation.mjs` with a hosted URL. They do
not Apply SQL, Deploy, create/restore Backups, or change Schedules.

Required deployment variables for the attestation route:

- `RELEASE_CANDIDATE_COMMIT`: exact 40-character Git commit.
- `RELEASE_CANDIDATE_TREE`: exact 40-character Git tree.
- `RELEASE_TARGET_PROJECT_ID`: exact authorized Child UUID.
- `INSFORGE_URL` and `NEXT_PUBLIC_INSFORGE_URL`: same Child app key/host.
- `NEXT_PUBLIC_APP_URL`: the hosted deployment URL.
- `RELEASE_STAGE`: `C` or `D`.
- `RELEASE_D_ENABLED_SLICES`: empty for C or a contiguous prefix of `7,8,9,10` for D.

The route returns only identity/configuration values and a boolean admin probe.
It never returns credentials, credential hashes, database rows, or row counts.

After fetching raw CLI JSON into a restricted local temporary folder, sanitize
and freeze it outside the backend:

```text
node capture-evidence.mjs --out-dir <new-evidence-dir> advisor=<advisor.json> suppressions=<suppressions.json> deployment=<deployment.json> acl=<function-snapshot.json> runtime=<runtime-tests.json> attestation=<attestation.json>
```

Every source receives a raw-input SHA-256 and every sanitized file receives its
own SHA-256 in `manifest.json`. Hashing the raw input does not retain its secret
values. The command
refuses to replace an existing evidence file with different bytes. Retain the
original raw files only in the approved restricted store; do not commit them.

Verify the hosted attestation before capturing it:

```text
node verify-attestation.mjs --url <child-url>/api/health/release-attestation --commit <commit> --tree <tree> --project-id <child-uuid> --app-key <child-app-key> --app-host <child-host> --stage D --slices 7,8,9,10 --prohibited-host <production-host>
```

Run `emergency/function-snapshot.sql` before Stop and after Forward Resume. Both
results must report 54 rows and identical per-row and combined hashes.
