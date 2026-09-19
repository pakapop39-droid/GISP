# GISP Controlled Production Pilot C — Preparation Evidence

Date: 2026-09-19 (Asia/Bangkok)

Approval: `docs/GISP-APR-CPP-C-PREP-02-20260919-v1.0.md`

Environment: Production `gisp-mvp-production` (`865860c2-49fa-4e53-908f-9396b2f75233`) for the exact bounded preparation actions only.

## Backup rotation

Pre-delete verification:

- Target Backup ID: `9479ed9d-966e-4c63-9231-ea6b9618ec30`
- Target name: `pre-production-completion-20260906`
- Target status before deletion: `completed`
- Target Project ID: `865860c2-49fa-4e53-908f-9396b2f75233`
- Local export: `output/production-completion-20260906/20260906_002131.sql.gz`
- Export size: `278,412` bytes
- Export SHA-256: `dc12f56179dab0fba875dd4643a6fcc5234ad5dd320845e73a26cac34a1ca2bb`
- Local ACL was hardened after Architect review. Inheritance is disabled; only `LAPTOP-KEDOD2MB\\ASUS`, `BUILTIN\\Administrators` and `NT AUTHORITY\\SYSTEM` retain explicit Full Control. The SHA-256 remained unchanged after the ACL update.

Execution:

- The exact authorized Backup was deleted successfully. The deletion is irreversible; the retained local export is evidence and not an automatic InsForge restore point.
- No other Backup was deleted.
- Fresh Backup name: `pre-release-c-controlled-pilot`
- Fresh Backup ID: `e613b75c-ad3a-4f09-8bc5-82671576ce33`
- Triggered at: `2026-09-19T14:33:45.429Z`
- Trigger source: `manual`
- Final status: `completed`

Post-action read-only checks:

- Migration count remains 26; head remains `20260908170000_release-b-member-pilot`.
- Order count remains 0.
- Payment Transfer count remains 0.
- Shipment count remains 0.
- No Migration, Deploy, Release Stage, Schedule, Role or Permission change was made.

## Real Member preparation

- Approved email: `vsmodular@gmail.com`
- Approved company: `vs innovation.co.,ltd`
- Read-only check before signup: no matching Production Auth user or Member data exists.
- The same email and legal-company identity already appear in GISP operator company settings. This is therefore an internal/self-pilot, not evidence of isolation for an unrelated external customer. The Member must still be represented by a separate Auth/App user and a new Organization-scoped `MEMBER` role with no global staff role.
- Required owner-controlled action: create the account with an owner-controlled password, enter the six-digit email OTP, complete the real company form and submit the Member application.
- Codex must not invent, view, retain or transmit the real Member password or OTP.
- After submission, the bounded preparation authority allows approval only after the email, company, application, organization and Member-only role isolation match this record.

## Dependency decision

The owner accepted the unchanged Next.js/Sharp dependency risk only for the one-Member/one-Order Controlled Pilot, with AVIF/HEIF not used. This is not approval to upgrade dependencies and does not open Release C or D.

## Current status

Backup preparation is **PASS as a pre-onboarding checkpoint**. Because the new Member is not inside this Backup, a Restore would require onboarding the Member again. The final Release Authorization must accept that bounded limitation or authorize a fresh post-onboarding Backup. Member preparation is **WAITING FOR OWNER-CONTROLLED SIGNUP AND EMAIL VERIFICATION**. Production Release C remains `NO-GO`; no final Release Authorization exists.
