# FULL-FLOW-GO-LIVE-01 v0.1 — Candidate Manifest

**Candidate state:** Independent QA PASS; ready for immutable Local reseal (Staging/Production not authorized)
**Baseline:** `2bb809791ea809c6f5b8fc9472a2430240cb840c`  
**Branch:** `codex/full-flow-go-live-01`  
**Approval record:** `docs/GISP-APR-FULL-FLOW-GO-LIVE-01-LOCAL-IMPLEMENTATION-20260920-v1.0.md`  
**Production allowed:** `No`

## Implemented requirements

- `FFGL-AC-002/012`: inactive staff denial and organization-scoped authorization for Admin Client, private file, quotation/RFQ, Order and Supplier Payment paths.
- `FFGL-AC-003/005`: duplicate `project_item_id` rejection in the route plus atomic database guard before Order creation.
- `FFGL-AC-006`: existing bound evidence/private Finance verification retained; Verified transfers are immutable; negative Adjustment/Reversal records are append-only, audited and recalculate payment gates.
- `FFGL-AC-007`: Supplier Payment requester cannot approve the same request and the approver cannot attach/record payment evidence for the same item.
- Advanced Orders receive an active financial workflow hold after an approved reduction; direct writes to Order items, Supplier Payment, Production, QC/member decisions, Shipment, Delivery and Freight operation tables fail closed while the hold is active.
- Product Sourcing Admin Client and all five staff mutation RPCs resolve the target organization before reading or mutating; confidential file metadata requires `files.confidential.read`.
- `FULL-FLOW-DEP-SEC-01 v0.1`: dependency security gate pins Next.js/eslint-config-next `16.3.5`, Sharp `0.35.4` (direct and override), Vitest `4.1.11`, and resolved js-yaml `4.3.2`.

## Public interfaces

- `POST /api/admin/payment-transfers/{id}/adjustments`
  - `ADJUSTMENT`: positive UI/API amount is stored as a negative correction.
  - `REVERSAL`: database derives the full negative amount from the immutable Verified transfer.
- `POST /api/admin/payment-adjustments/{id}/review`
  - Approves/rejects a pending correction through a project-admin-only private executor bound to an active scoped staff session.
- `POST /api/admin/payment-workflow-holds/{id}/confirm`
  - Resumes only after the affected payment schedule is fully restored and two different active scoped actors confirm: Finance (`payments.adjust`) and Order Admin (`orders.manage`).
- Admin Order detail exposes payment adjustments and active financial holds only to authorized staff.

## Migration allow-list

SHA-256 values below use canonical UTF-8 content with CRLF/CR normalized to LF.

Apply only in this order after separate Staging authorization and identity/schedule preflight:

| Order | File | SHA-256 |
| --- | --- | --- |
| 1 | `migrations/20260920010000_pay-close-legacy-entry.sql` | `638E76E102E05E9F03CCB93357B74DC496DB50E398DE030C0A057F3021D73993` |
| 2 | `migrations/20260920010100_pay-evidence-binding.sql` | `01D0786DE19094572467E2DCAEB347E3FD6D672D91146B596643A54D185DEA1B` |
| 3 | `migrations/20260920010200_pay-private-executor.sql` | `448A6A37BCB13372BEAA9CEE59EF01E5B9D4F4436DE2C6F7208030233E511CF7` |
| 4 | `migrations/20260920010250_release-c-org-scope-hardening.sql` | `A0757E88DC351F361E89AD0048158E8F89D064D5A9B1FC0BA953E2A587DB7D8E` |
| 5 | `migrations/20260920010275_full-flow-financial-controls-pre-c.sql` | `FEED1EEFE48DCA46CCA530FDE25590FE29D87EED16F32920774F75122CD66A35` |
| 6 | `migrations/20260920010300_release-c-privileges.sql` | `4120E34C2CD7B590DFD4FF671FD9AF57DBD5601B45441B8920751AC9220F0593` |
| 7 | `migrations/20260920010400_d7-qc-reopen-prerequisite.sql` | `7D250449DF315AA100F929AC5499333DA3719D5AEFADC616A88981B1EBD463C1` |
| 8 | `migrations/20260920010500_release-d7-privileges.sql` | `403D71930043C356BB0A61CD6ABF704EF247C5FD4CE1F70F7A8262C95D17D309` |
| 9 | `migrations/20260920010600_d8-consolidation-prerequisite.sql` | `E6E97E5949598C443278ABC878E7853802367A84ACA50AA7E339B86F0635D135` |
| 10 | `migrations/20260920010700_d8-customs-prerequisite.sql` | `7A5075F3455B146F3A74983AB37A4D14C3691D618AAC0A02D30D572629F42D69` |
| 11 | `migrations/20260920010800_release-d8-privileges.sql` | `832C2E55B87355BA498758C33E3C410200AADFFC103D892A11F2FF66D02841B7` |
| 12 | `migrations/20260920010900_d8-freight-payment-enable.sql` | `DC2A9008FB506AF84EF1591A1420F632045778FA6907A8EACDC899C3D2FBE00A` |
| 13 | `migrations/20260920011000_release-d9-privileges.sql` | `A032E91BA8734345C9AD02FD3D11E113B9B43625214C106015576F1CA090D0FF` |
| 14 | `migrations/20260920011100_release-d10-privileges.sql` | `2B687DEF1689F317D9090E0B139F219E2A54CF916DC28D6AD111149F5F941451` |
| 15 | `migrations/20260920011200_full-flow-sourcing-scope-hardening.sql` | `F5754D8BC1A9BDDD9A11E8C48F4203CCF99564B32E73908062EA14760B74CD7F` |
| 16 | `migrations/20260920011300_full-flow-financial-controls.sql` | `7B4A870ADDED04C5D9A51D5B7439A6DBAB980B8CF633D7EF4C7074270C699476` |

Packaged copies live under `release-candidates/full-flow-go-live-01/migrations/`.
Contract tests compare normalized packaged content to the canonical migrations.
The pre-C safeguard is deliberately installed before `20260920010300_release-c-privileges.sql`. It installs the verified-transfer wrapper, adjustment request/review, Deposit/Balance recalculation, dual-control hold confirmation and hold triggers for the Release C tables (`order_items`, `supplier_orders`, `purchase_orders`, `supplier_payments`) without referencing any Release D object. The post-D migration runs only after every Release D dependency and extends the same functions/triggers for Production/QC/Logistics/Freight. Never use `up --all` for this package.

## Standalone Staging bootstrap and recovery package

- `production-b-baseline/` contains the 26-file LF-normalized schema/runtime baseline fetched read-only from Production-B migration history. Its head is `20260908170000_release-b-member-pilot.sql`; `production-b-baseline/MANIFEST.md` records every file hash. It contains no cloned Production row set, PII export or secret and does not authorize apply.
- Baseline manifest canonical-LF/trimmed SHA-256: `4A9E3AC84EEA1A826897D27667572D42D3A37FCB70131C92099FDDB4C2EFBE55`.
- `emergency/` is the exact-candidate stop/resume/reconcile package. `emergency/README.md` records all 12 SQL hashes. Stop C closes every new project-admin financial executor; Resume C restores exact pre-C bodies/ACL and Resume D8 restores exact post-D Freight-aware bodies. Reconciliation is SELECT-only and covers `payment_adjustments` and `payment_workflow_holds`.
- Emergency manifest canonical-LF/trimmed SHA-256: `758CD3486E68BBAEBF9B20163820D6911BBAE78AEB3EC415BDE268E780C8628C`.

## Explicit non-actions

- No migration was applied.
- No InsForge project, branch, schedule, storage object or backend row was changed.
- No deployment or Production configuration/data was changed.
- No price, VAT, 50/50 Deposit/Balance or Freight formula was changed.

## Local verification status

- The previous sealed Local candidate at `7eb97436074132ca9c21d7935ea8389f98677062` had Independent QA `PASS`, `109 files / 592 tests`, typecheck/build PASS and dependency audit `0 vulnerabilities`.
- This corrective candidate changes the Release C route boundary, two financial-control migrations, and recovery/bootstrap packaging. Builder verification passed: focused recovery/regression `7 files / 48 tests`, full regression `111 files / 600 tests`, typecheck, lint (`0` errors / `7` pre-existing warnings), and optimized Next.js `16.3.5` build (`128/128` pages). A final hash/newline-only adjustment then passed the affected migration/package tests (`2 files / 13 tests`) and `git diff --check`.
- Independent QA re-verified the exact corrective candidate and returned `PASS` with `0 Blocker / 0 Major / 0 Minor`: focused recovery/package/gate `7 files / 48 tests`, full regression `111 files / 600 tests`, typecheck PASS, lint `0 errors / 7 pre-existing warnings`, and optimized Next.js `16.3.5` build `128/128 pages`.
- Independent QA also verified the 26-file Production-B baseline package, all 16 candidate migration copies/hashes, the 12-file exact-candidate emergency package, the 60-routine snapshot, SELECT-only reconciliation, Release C route boundary and Release D fail-closed behavior.
- All 16 packaged migration hashes must match this manifest; the allow-list filenames/order remain unchanged.
- Isolated Staging migration/UAT/recovery rehearsal remains separately authorized work; this manifest does not authorize Apply, Deploy or Production.
- Create a new Git commit/tree seal and record that immutable identity in the Staging approval package before requesting owner authorization.
