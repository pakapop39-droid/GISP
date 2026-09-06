# Slice 6 — Orders & Payments Acceptance

**Acceptance Date:** 29 August 2026 (พ.ศ. 2569)  
**Result:** `SLICE_6_ACCEPTED` / `DONE` on Development  
**Owner Approval:** “อนุมัติปิด Slice 6”

## Scope accepted

- Customer Order snapshot and exact VAT/50–50 payment schedule
- Member payment transfer with private evidence
- Finance evidence review, verification/rejection, partial payment and overpayment guard
- PO gate after verified customer deposit
- Supplier Order, supplier payment request/approval/paid evidence and append-only history
- Cancellation before deposit and approval workflow after deposit
- Member-safe projection that hides supplier identity, factory cost and internal payment data

## Quality evidence

- Lint: passed with 0 errors
- Typecheck: passed
- Unit tests: 20 files / 88 tests passed
- Next.js production build: passed, 90 routes
- Slice 6 branch integration: 19/19 assertions passed
- Human UAT: owner approved closure on 29 August 2026

## Development merge and deployment

- Backup: `pre-slice-6-merge-2026-08-29`
- Backend branch: `slice-6-orders-payments`
- Merge dry-run: 19 added, 9 modified, 0 conflicts
- Merge result: branch state `merged`
- Development deployment: `80b2dcc3-12ba-4762-a2b7-fda10cc35995` (`READY`)
- Development URL: `https://kit6y4pj.insforge.site`
- Post-merge checks: health HTTP 200, protected route redirect correct, Slice 6 migration/tables present
- Notification schedule: `GISP-Notification-Retry` recreated and manual execution returned HTTP 200

## Boundary

Production was not deployed or opened. Deleting backend branch `slice-6-orders-payments` is not part of this acceptance and requires separate explicit approval.

