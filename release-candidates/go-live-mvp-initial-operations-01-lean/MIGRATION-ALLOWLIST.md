# Exact migration allow-list

Apply only these packaged bytes, one at a time, in order, after separate environment authorization:

1. `20260920010000_pay-close-legacy-entry.sql`
2. `20260920010100_pay-evidence-binding.sql`
3. `20260920010200_pay-private-executor.sql`
4. `20260920010250_release-c-org-scope-hardening.sql`
5. `20260920010300_release-c-privileges.sql`
6. `20260920010400_d7-qc-reopen-prerequisite.sql`
7. `20260920010500_release-d7-privileges.sql`
8. `20260920010600_d8-consolidation-prerequisite.sql`
9. `20260920010700_d8-customs-prerequisite.sql`
10. `20260920010800_release-d8-privileges.sql`
11. `20260920010900_d8-freight-payment-enable.sql`
12. `20260923090000_startup_initial_operations_guard.sql`

D9/D10, full-flow financial controls, sourcing hardening and private-executor repair are deliberately excluded.
