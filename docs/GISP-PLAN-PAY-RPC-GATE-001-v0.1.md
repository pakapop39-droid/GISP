# GISP-PAY-RPC-GATE-001 — Payment Verification Boundary and C/D Migration Sequence

**Status:** Scope / Implementation proposal only; **not approved to implement, Apply, Deploy, or change Production**.

## Goal and source of truth

Close the remaining path by which a Finance user can approve a Customer Payment through a direct database RPC without the App retrieving the exact stored evidence. Prepare an executable, ordered Release C/D migration candidate from the current Production B baseline without applying unrelated pending work. Preserve approved 50/50 payment, separate Freight, prices, tax, document numbers, organization isolation, rejection, reconciliation and audit. Release gates remain separate under DEC-049.

Sources: `GISP-CLO-PAYMENT-EVIDENCE-LOCAL-20260918-v1.0.md`; `GISP-APR-PAYMENT-EVIDENCE-BINDING-20260918-v0.1.md`; `GISP-RELEASE-CD-CANDIDATE-MANIFEST-20260918-v0.2.md`; `docs/active/STAGED PRODUCTION RELEASE PLAN.md` v1.8; `docs/active/DECISION LOG.md` v3.2. Running code is evidence of current behavior, not an authorization.

## Acceptance criteria

| ID | Required observable result |
|---|---|
| PAY-RPC-01 | Direct `authenticated`/`anon` invocation of the approval RPC is denied without changing a Payment, schedule, Finance log or audit history. Only the dedicated server path can invoke the private executor. |
| PAY-RPC-02 | Finance in the correct organization can approve through the App only after the server opens the exact bound stored file and checks its bytes, size, signature and identity. The App captures an explicit Finance confirmation; approval records the real Finance actor, not `project_admin`. |
| PAY-RPC-03 | Finance can still reject a missing/corrupt/unbound file with a reason. Expired/revoked sessions, wrong organization/role, reused evidence and replay attempts fail closed. No cross-organization data leaks. |
| PAY-RPC-04 | Deposit, Balance and Freight reconciliation, overpayment handling, order completion, document references and existing 50/50/freight rules remain unchanged. Before D8, direct submission or verification of a Freight schedule is denied at the data boundary. |
| PAY-SEQ-01 | An isolated release worktree/package contains only approved forward migrations with Payment binding and verification guard **before C**, prerequisites before each D gate, then C→D7→D8→D9→D10 in approved order; no applied Production history is rewritten. |
| PAY-SEQ-02 | A later separately approved rehearsal on a Production-B-derived environment verifies migration signatures/ACLs, negative direct RPC, valid App approval/rejection, real stored-file access, reconciliation, backup and rollback. No full 33-step Development UAT rerun without a stale-risk reason. |

## Proposed technical boundary (subject to implementation approval and QA)

- Keep the existing Finance screen and its approval/rejection controls. A dedicated server endpoint obtains the active App session itself, checks `payments.verify` for the target organization, retrieves the bound file from private Storage, and records Finance's explicit confirmation. Do not accept actor ID or session hash from request JSON.
- Replace the direct verification surface with a server-only executor. In one forward migration, revoke `verify_payment_transfer(UUID,BOOLEAN,TEXT)` execution from `PUBLIC`, `anon`, and `authenticated`; grant the new executor only to `project_admin`. The old function must be disabled, not left as a second approval path. The private executor must resolve the real, active Finance user from a server-provided session token hash, recheck organization-scoped permission, and write that user's ID explicitly to the transfer, verification log and audit record. An admin SDK call using `auth.uid()` would lose the Finance actor and is unacceptable.
- Approval requires fresh server-side byte retrieval matching the exact transfer/file; rejection remains possible when bytes are absent or corrupt. A file-view receipt/hash and its validity/replay controls should be designed against existing audit storage without adding tables or columns unless separately approved. Server retrieval plus Finance attestation cannot prove a human actually read the slip or that the bank transfer occurred.
- Package from a read-only-verified Production B migration/ACL baseline. Create fresh, forward-only release versions in an isolated workspace; do not rename or modify already-applied history. Do not use `up --all` in the dirty main worktree. Keep Release C and each D gate separately testable and approvable.

## Proposed implementation file scope

New forward-only permission/function migration and focused migration tests; Finance evidence preview and verify API routes and tests; the existing bound-evidence helper and tests; only the Finance approval control needed to express the attestation; a new release-package manifest and rehearsal instructions. The exact paths/hunks must be frozen before Builder writes because the `development` worktree has unrelated uncommitted changes owned by other tasks. One writing Builder at a time, then independent QA on the exact candidate.

## Authorization boundary and next decision

No owner approval for this next slice has been recorded. Request one combined `Scope Approved` + `Implementation Authorized` record naming `GISP-PAY-RPC-GATE-001 v0.1`, approver, approval text/time, Local/Development source-only environment, migration **draft only**, no data migration, and `production_allowed=No`. Applying a migration, deploying, running hosted transaction retests, changing existing transaction rows, or opening Production requires separate approval. The owner should also ratify the delegated one-file/one-Payment policy before Production.
