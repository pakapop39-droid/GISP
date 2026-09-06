# Company setup and staff preparation

6 September 2026, actual Production `865860c2-49fa-4e53-908f-9396b2f75233`.

## Owner-provided information

Owner reported entering company settings. Read-only verification confirmed nonempty
legal company name (VS Innovation.co.,ltd), tax ID, address and company email.
Do not replace these with member company data. VAT remains 7%.

Owner has two employees organized by job group and asked whether staff should be
created first. Confirmed separate staff accounts are appropriate. Owner then asked
to use their alternate email to test Production staff access; agreed and requested
the exact email, display name and desired job groups. No account has been created
from an inferred address. No password was requested in chat.

## Work completed while awaiting identities

- Rechecked rehearsal authenticated HTTP smoke: 20/20 passed.
- Extended staff creation to accept one or more of OPERATIONS, FINANCE, LOGISTICS.
- Kept legacy single `jobGroup` requests compatible by normalization.
- Server expands only the allowlisted groups; arbitrary roles and SUPER_ADMIN
  remain rejected, and endpoint still requires Owner/SUPER_ADMIN.
- UI uses checkboxes for group selection; one person can cover several duties.
- Schema and group tests: 8 passed; TypeScript, ESLint and production build passed.
- Production deployment `cf3a78a2-5962-449b-aea7-cb299f70b402` is READY.
  Verified the Owner browser at `/admin/users` shows three group checkboxes and
  no owner-role choice. No new staff account was submitted without its identity.
  Release stage remains A while staff/pilot setup is underway.

## Backup evidence

Cloud manual backup quota is full at 5/5. No existing backup was deleted.
The completed full checkpoint `7fc7db66-0ca1-4640-aa47-c9c6e7736940` remains available.
Exported current Production database after company setup, including functions,
views and sequences, with explicit 10,000-row limit; no truncated tables reported.
Default export had truncated tables at 1,000 rows and was replaced, not accepted.
The CLI export file wraps SQL in JSON: extracted its `data` into the final `.sql`.
Evidence: `output/production-completion-20260906/production/pre-member-opening.sql`,
hash file beside it, and `company-opening-record.json`. This export complements
the earlier complete backup; it is not described as a new cloud Storage backup.

## Remaining launch checks

Staff identities/groups and member pilot identities are still required. New staff
test accounts on Production must be specifically identified by Owner; no fixture
users or synthetic financial transactions are copied from rehearsal.

Found another onboarding readiness gap: the form asks for terms/privacy consent
version 2026-08-18 but there is no linked full policy document in the source.
Prepare reviewable policy content and connect the links before public onboarding;
do not claim the existing checkbox alone proves informed review.

Remaining main steps are still 5: finish business/team setup, member pilot,
transaction opening, post-order operations opening, and final UAT/handoff.
Company legal fields are now complete; the earlier missing-company blocker is resolved.

Follow-up: Owner supplied three specific staff addresses and groups; all three were provisioned and verified. See 2026-09-06-approved-production-staff.md. Account identity request is resolved.
