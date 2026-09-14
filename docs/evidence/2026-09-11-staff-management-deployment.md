# Staff management deployment — 11 September 2026

User authorized deployment to both Development and Production after the two hostnames were clarified.

## Releases

| Target | URL | Deployment | Status |
| --- | --- | --- | --- |
| Production | https://m8ugbyak.insforge.site | a3cf70ea-4394-45bd-8874-166800adc93d | READY |
| Development | https://kit6y4pj.insforge.site | 012b5057-9eb1-4bc9-b99f-df7761dea2c5 | READY |

Source: Release B commit `45b7b03` with the 10 staff-management implementation/test files overlaid in `output/staff-management-deploy-20260911`. Existing persistent environment variables were used for each destination. No migrations, account modifications, or password changes were performed. The unrelated image-search working changes were not included.

Production previous deployment: `e992de1f-be9a-4344-89d9-0b502fe7d777`.
Development previous READY deployment: `526c7cf7-1354-42b1-92c6-e25cfad92f09`.

## Verification

- Isolated release source: Next.js production build passed; 23 owner/API tests passed.
- Both public login pages returned HTTP 200.
- Anonymous staff-list GET and password-reset POST returned HTTP 401 on both hosts.
- Production owner browser: staff list loaded 4 accounts; email search narrowed to one account; reset-recipient confirmation opened and was cancelled without sending email.
- Development owner browser: staff list loaded 11 accounts with names, emails, job groups, statuses, and reset-link buttons.
- Password recovery uses InsForge's email-link flow; it does not display old passwords or let the owner directly replace a password.
- Real email delivery and completion of a password change were not exercised, to avoid sending messages to staff or altering existing credentials.

Only development/release artifacts under `output/` contain environment files; these are excluded from upload. No secrets are recorded in this document.
