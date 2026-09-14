# Synthetic Multi-tenant Rehearsal — SMTR-v1.0

## Approval and boundary

- Approved by: เจ้าของโครงการผ่าน Codex
- Approved at: `2026-09-12T14:15:52+07:00`
- Environment: Development/Rehearsal only
- Data authority: create five synthetic accounts/companies and their test data; safe cleanup only
- Production allowed: No

This rehearsal replaces the requirement to recruit 3–5 real companies for the **technical pilot gate only**. It does not replace feedback from a real customer, legal acceptance, business acceptance, or Production Release Authorization.

## Five deterministic scenarios

| Key | Scenario | Synthetic account |
| --- | --- | --- |
| C01 | Design/project workflow | `smtr-v1-company-01@example.com` |
| C02 | Contractor and Release C boundary | `smtr-v1-company-02@example.com` |
| C03 | Shared catalog | `smtr-v1-company-03@example.com` |
| C04 | Cross-tenant isolation | `smtr-v1-company-04@example.com` |
| C05 | Account lifecycle | `smtr-v1-company-05@example.com` |

All names, addresses, contacts and files are synthetic. Auth users are auto-confirmed so no email is sent. No payment, supplier message, deployment or Production operation is performed.

## Commands

Run from the repository root in PowerShell. The explicit flag is intentionally required for every command.

```powershell
$env:SMTR_ALLOW_DEVELOPMENT='true'
node --env-file=.env.local scripts/smtr/validate-target.mjs
node --test scripts/smtr/target-guard.test.mjs
node --env-file=.env.local scripts/smtr/setup.mjs
node --env-file=.env.local scripts/smtr/setup.mjs
node --env-file=.env.local scripts/smtr/verify.mjs
node --env-file=.env.local scripts/smtr/cleanup.mjs
```

The second setup proves idempotency. Normal verification is read-only for account lifecycle. To explicitly exercise C05 suspension/reactivation, set `SMTR_ALLOW_LIFECYCLE=true`; the verifier preflights ACTIVE state and restores ACTIVE in `finally`. Cleanup defaults to dry-run. Its optional `--execute` mode performs logical deactivation only and additionally requires `SMTR_ALLOW_CLEANUP=true`; it never physically deletes auth users, transactions or audit history.

Generated manifest and reports are under `output/smtr/`, which is gitignored. They contain fixture IDs and counts but no passwords, API keys or tokens.

## Acceptance boundary

The rehearsal verifies five independent users/organizations/profiles, signup/onboarding/approval/login, catalog read, project and ready-to-order standard item creation, shared-catalog draft creation, sourcing submission, private-file metadata visibility, and cross-tenant RLS. Release C coverage sends a valid C02 item selection from C01, requires the canonical project-not-found tenant denial, and proves the SMTR order count is unchanged. Full quotation/order/payment and Release D production/QC/shipping/claim workflows remain separate because their retained transaction/audit records cannot be safely erased by this logical-cleanup harness.

Before any optional cleanup mutation, the tool resolves each synthetic email to its Auth user ID and verifies the complete User → Member Profile → Organization → Shared Catalog ownership chain for all five companies. Tampered-manifest tests must pass before the cleanup tool is accepted.

Production remains prohibited until a separate Release Authorization record is approved.
