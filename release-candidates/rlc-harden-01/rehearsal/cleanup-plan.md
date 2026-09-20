# Synthetic fixture cleanup plan — not executed

Cleanup authority is intentionally absent from the local-preparation approval.

When separately authorized, cleanup must be bounded to records satisfying both conditions:

1. The record or owning actor carries the exact `REH-RLC-HARDEN-01` prefix; and
2. Its immutable ID appears in the rehearsal evidence fixture manifest.

Required fail-closed sequence:

1. Re-verify exact Child and parent lineage; reject Production identity.
2. Re-verify that no schedule is active against Production.
3. Capture dependency counts and audit IDs for every candidate fixture.
4. Refuse cleanup if any candidate lacks the prefix, captured ID, expected organization ownership or synthetic actor binding.
5. Delete in dependency-safe child-to-parent order defined only after fixture creation records the actual foreign-key graph.
6. Verify zero remaining prefixed rows and preserve non-prefixed before/after counts.
7. Preserve application audit evidence; do not erase audit history unless a later versioned approval explicitly identifies those exact synthetic audit IDs.

Rollback for migration behavior is forward-fix or isolated branch reset/delete under separate authorization. This cleanup plan is not a database schema rollback and must never run on Production.
