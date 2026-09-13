# PDF Catalog Excel Round-trip v1.0 — Builder to QA Handoff

Date: 2026-09-13
Environment: isolated Full Development branch `pdf-excel-roundtrip-v1`
Production: not authorized and not changed
Status: implementation complete for independent QA; not merged or deployed

## Implemented

- Server-generated OOXML workbook using pinned `fflate@0.8.3`, with exact five-sheet contract and Costs omitted when `catalog.cost.read` is absent.
- Server parser using existing `read-excel-file`, with formula/macro/external/encryption/path/duplicate-part/ZIP-bomb/type/size/row limits.
- Confidential export/upload history, immutable row mapping and baseline hashes, staged Preview/Diff and exact row states.
- Feature-flagged APIs for export, upload, paginated/redacted preview, separate detail/cost apply and cancellation.
- Trusted, atomic and idempotent detail/cost RPCs that recheck PDF linkage, lifecycle, selected READY rows, current baselines and duplicate SKU. Detail apply resets QA/review. Cost apply uses the existing versioned cost and price-preview functions and never activates Member Price.
- Pre-Draft costs remain `WAITING_FOR_DRAFT`; authenticated refresh resolves them when the original PDF flow later links a Product Draft.
- Review UI offers Export, Upload, staged differences, separate selections and explicit Member Price warning.

## Backend branch

- Name: `pdf-excel-roundtrip-v1`
- ID: `5398a865-c466-4c6e-8bdf-e8f8ec1f56d8`
- API host: `https://kit6y4pj-uch.ap-southeast.insforge.app`
- Mode: Full; state observed ready
- Applied only on this branch: migrations `20260913091001` through `20260913091006`. Migration `...91005` is the additive fix for the table-specific lifecycle trigger record discovered by runtime testing; `...91006` binds imported targets to the immutable PDF import snapshot. Applied migration history is not rewritten.
- Development parent and Production were not merged, deployed or changed.

## Builder test evidence

- `npx vitest run src/lib/catalog/excel-roundtrip.test.ts src/lib/catalog/excel-roundtrip-migration.test.ts src/lib/catalog/excel-roundtrip-api.test.ts src/components/catalog-enrichment-panel.test.ts` — 4 files / 21 tests passed.
- `npx tsc --noEmit` — passed.
- `npm test` — 50 files / 230 tests passed.
- `npm run lint` — passed with zero warnings/errors.
- `npm run build` — passed; Next.js generated 119 pages and all six enrichment routes.
- `npm run test:pdf-excel-roundtrip:branch` — 14 live isolated-branch assertions passed: confidential-XLSX metadata guard, lifecycle stop after PDF cancellation, browser DML denial, Member/Purchasing/Product Admin RLS, Member RPC denial, trusted candidate details, review reset, immutable PDF snapshot/Product linkage, WAITING refresh, idempotent cost, ACTIVE/RETIRED Cost Version semantics, no Member Price, Product remains Draft/Not Reviewed.
- The 1,000-row multilingual in-memory workbook round-trip completed below the 30-second unit threshold.

## QA focus

1. Independently verify Anonymous, Member, Purchasing, Product Admin and Super Admin API/RLS matrix, including direct RPC/DML attempts.
2. Exercise actual Office/LibreOffice editing for blank, `#CLEAR`, numeric cells/strings, formulas and tampered hidden metadata.
3. Verify concurrent baselines, partial selection and repeated uploads/applies on synthetic branch data.
4. Regression-test existing Excel/CSV create-new, PDF Import, Product Lifecycle and Pricing Engine.
5. Confirm feature flag remains off until a separate Development Release Authorization.

## Known limits

- Builder integration used synthetic branch data only and did not deploy the frontend.
- Unit timing is local in-memory evidence; QA should capture API export/preview timings on the isolated Development branch.
- `npm audit --audit-level=moderate` reports five pre-existing dependency findings (Vitest, js-yaml, Next.js and Sharp: 2 moderate, 2 high, 1 critical). `fflate@0.8.3` did not introduce a finding. Remediation requires separately authorized framework/toolchain upgrades and was not forced into this bounded Slice.
- Owner Human UAT and Development merge/deploy are not authorized by this record.

Remaining steps to close this Development Slice: 3 — independent QA, Owner Human UAT, then separate Merge/Deploy Development authorization and post-deploy verification.
