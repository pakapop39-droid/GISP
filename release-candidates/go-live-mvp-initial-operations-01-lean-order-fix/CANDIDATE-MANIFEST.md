# Lean Order cost-version candidate v0.2

Status: **Local candidate only; independent QA and environment-specific authorization required before Apply or Release.** This v0.2 addendum supersedes the v0.1 migration allow-list for this candidate only. The original 12-file package remains frozen and unchanged.

## Source and approval boundary

- Implementation commit: `02cf0a257ab2f5e9de0bcd6475de05d55a21813a`; tree: `b9470caafdcf59a7ca0a354ef767dda6fad0cc6b`.
- Base app commit: `6280c52d72c1182e40f7963c6255b218559b7615`; tree: `f0e43ab11e639be158f03f10d5777a1109fc6b57`.
- Original v0.1 manifest SHA-256: `89E51D111698D16467C16C2600218B9E1962468C6A09703152E5585026132ACD`.
- Scope + Local Implementation request: owner Pakapop Ch. Charoenying's “PLEASE IMPLEMENT THIS PLAN” message on 2026-09-26; recorded at `2026-09-26T13:54:11Z`. Local code/migration creation only. No Backend data write, no Staging Apply, and no Production release is inferred from the original exact 12-file approval.
- `data_authority: None`; `migration_authority: Create/local test only`; `staging_allowed: No until separate exact-candidate authorization`; `production_allowed: No until separate explicit Release Authorization`.

## Exact migration allow-list

Apply only one file at a time in the following order, only if the target's read-only migration history shows that file is not already applied. Never use `up --all`, and never reapply a file. Files #1–#12 remain in the frozen `go-live-mvp-initial-operations-01-lean/migrations/` package; on Staging they are expected to be present already, so verify rather than replay them. File #13 is the only file in this addendum's `migrations/` directory and may be applied only after identity, backup and QA gates.

| # | File | SHA-256 |
|---|---|---|
| 1 | `20260920010000_pay-close-legacy-entry.sql` | `638E76E102E05E9F03CCB93357B74DC496DB50E398DE030C0A057F3021D73993` |
| 2 | `20260920010100_pay-evidence-binding.sql` | `01D0786DE19094572467E2DCAEB347E3FD6D672D91146B596643A54D185DEA1B` |
| 3 | `20260920010200_pay-private-executor.sql` | `448A6A37BCB13372BEAA9CEE59EF01E5B9D4F4436DE2C6F7208030233E511CF7` |
| 4 | `20260920010250_release-c-org-scope-hardening.sql` | `A0757E88DC351F361E89AD0048158E8F89D064D5A9B1FC0BA953E2A587DB7D8E` |
| 5 | `20260920010300_release-c-privileges.sql` | `4120E34C2CD7B590DFD4FF671FD9AF57DBD5601B45441B8920751AC9220F0593` |
| 6 | `20260920010400_d7-qc-reopen-prerequisite.sql` | `7D250449DF315AA100F929AC5499333DA3719D5AEFADC616A88981B1EBD463C1` |
| 7 | `20260920010500_release-d7-privileges.sql` | `403D71930043C356BB0A61CD6ABF704EF247C5FD4CE1F70F7A8262C95D17D309` |
| 8 | `20260920010600_d8-consolidation-prerequisite.sql` | `E6E97E5949598C443278ABC878E7853802367A84ACA50AA7E339B86F0635D135` |
| 9 | `20260920010700_d8-customs-prerequisite.sql` | `7A5075F3455B146F3A74983AB37A4D14C3691D618AAC0A02D30D572629F42D69` |
| 10 | `20260920010800_release-d8-privileges.sql` | `832C2E55B87355BA498758C33E3C410200AADFFC103D892A11F2FF66D02841B7` |
| 11 | `20260920010900_d8-freight-payment-enable.sql` | `DC2A9008FB506AF84EF1591A1420F632045778FA6907A8EACDC899C3D2FBE00A` |
| 12 | `20260923090000_startup_initial_operations_guard.sql` | `287292A1D37DC7A31C64A738B9234D3D903EE427F531F6D70CC0ADC4700C1EF0` |
| 13 | `20260926150000_order-cost-version-snapshot.sql` | `897AF7B1ED8DE52FEF68CBF0DBECD41B0A33EEEF806A17EDFF788828C3514258` |

The #13 source file under `migrations/` and its package mirror have identical SHA-256. Focused test file `src/lib/orders/order-cost-version-migration.test.ts` SHA-256: `AF5FE893E85BF2786AB28D33D111DA512B14B2887757C77E0549BBC3ED87028D`.

## Gates remaining inside the original two Go Live steps

1. Independent QA on this exact Local candidate; Staging identity, migration history, cost/Schedule/SMTP and completed named backup; separate exact #13 Apply authority. Apply #13 once, then prove live STANDARD/variant/legacy/fail-closed, tenant and concurrency behavior with existing synthetic UAT scope and read-back evidence. Complete Recovery and obtain QA `GO`.
2. For Production, obtain explicit Release Authorization referencing this v0.2 candidate and its exact hashes; repeat baseline/backup/rollback checks, apply only not-yet-applied allow-list files individually, deploy the approved app artifact as needed, smoke, then monitor 24 hours. No synthetic Production data.

If any identity, history, hash, backup or result is unclear, stop before the next write. This manifest is evidence, not permission to Apply or Release.
