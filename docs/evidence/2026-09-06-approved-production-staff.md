# Approved Production staff accounts

6 September 2026. Actual Production project: `865860c2-49fa-4e53-908f-9396b2f75233`.

Owner explicitly supplied three addresses and their job groups. Checked auth users
before provisioning: none of these addresses existed. Created these accounts only:

| Address | Group | Assigned roles |
| --- | --- | --- |
| pakapop39@yahoo.com | ระบบงานและออเดอร์ | MEMBER_ADMIN, PRODUCT_ADMIN, ORDER_ADMIN, PURCHASING, QC |
| vs01.modular@gmail.com | การเงิน | FINANCE |
| designershare6335@gmail.com | โลจิสติกส์ | LOGISTICS |

Display names initially use the supplied email addresses; no personal name was invented.
All three are ACTIVE. Existing Owner `4345ab88-f8c3-4e23-bfe2-8956cd3cafce`
retains SUPER_ADMIN. No MEMBER role or SUPER_ADMIN role was assigned to staff.

Used the existing `provision_internal_user` business function with Owner claims,
exact project checks and exact role verification. Recorded provisioning audit events.
Generated independent strong bootstrap passwords in memory only, tested sign-in,
and discarded them without printing, saving, or distributing them.

## Verification

For each new account:

- Actual Production HTTP sign-in succeeded.
- `/api/auth/session` returned ACTIVE and exactly the approved roles.
- `/admin/dashboard` returned 200.
- `/api/admin/roles` returned 403 (Owner-only management denied).
- Signed out after checking.

Nine checks passed across three accounts. No synthetic order or payment was created.
Detailed evidence: `output/production-completion-20260906/production/approved-staff-provisioning.json`.
Script: `scripts/provision-approved-production-staff.mjs`.

## Password handoff and launch scope

Users set their own password using https://m8ugbyak.insforge.site/forgot-password,
then follow the reset email. No reset/invitation email was sent by the agent.
Do not request or paste their passwords in chat.

Account creation and role verification are complete (0 steps remaining for this task).
Staff first sign-in with their own passwords is still a human check. Production
remains Release A: assigning an Order/Finance/Logistics role does not itself enable
the later release's transaction pages. Member pilot identities, onboarding policy
content, transaction/operations opening and final handoff remain in the main plan.
