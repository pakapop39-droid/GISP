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

- `npx vitest run src/lib/catalog/excel-roundtrip.test.ts src/lib/catalog/excel-roundtrip-migration.test.ts src/lib/catalog/excel-roundtrip-api.test.ts src/components/catalog-enrichment-panel.test.ts` — 4 files / 25 tests passed after QA rework.
- `npx tsc --noEmit` — passed.
- `npx vitest run src/app/admin/catalog/page.test.ts src/components/catalog-enrichment-panel.test.ts src/lib/catalog/excel-roundtrip-api.test.ts` — 3 files / 11 tests passed after Pricing deep-link rework.
- `npx vitest run src/lib/catalog/excel-roundtrip.test.ts src/lib/catalog/excel-roundtrip-api.test.ts` — 2 files / 17 tests passed after Unicode-safe source-filename rework.
- `npx vitest run src/lib/catalog/excel-roundtrip.test.ts src/components/catalog-import-workspace.test.ts` — 2 files / 15 behavioral, resolver and component tests passed after the legacy source-metadata UX rework.
- `npm test` — 52 files / 245 tests passed after QA rework.
- `npm run lint` — passed with zero warnings/errors.
- `npm run build` — passed; Next.js generated 119 pages and all six enrichment routes.
- `npm run test:pdf-excel-roundtrip:branch` — 15 live isolated-branch assertions passed: confidential PDF source metadata resolution, confidential-XLSX metadata guard, lifecycle stop after PDF cancellation, browser DML denial, Member/Purchasing/Product Admin RLS, Member RPC denial, trusted candidate details, review reset, immutable PDF snapshot/Product linkage, WAITING refresh, idempotent cost, ACTIVE/RETIRED Cost Version semantics, no Member Price, Product remains Draft/Not Reviewed.
- `npx vitest run src/lib/catalog/excel-roundtrip.test.ts src/lib/catalog/excel-roundtrip-api.test.ts` — 2 files / 20 tests passed after the runtime export linkage hotfix.
- `npm test` — 52 files / 247 tests passed after the runtime export linkage hotfix.
- `npx tsc --noEmit`, `npm run lint`, `npm run build` — passed after the hotfix; the production build generated all 119 pages and six enrichment API routes.
- `npm run test:pdf-excel-roundtrip:branch` — all 15 isolated-branch integration assertions passed again after the hotfix.
- The 1,000-row multilingual in-memory workbook round-trip completed below the 30-second unit threshold.

## QA rework included

- Cost rows in `APPLIED` now render the calculated Member Price amount in THB, an explicit `ยังไม่เปิดใช้ราคา` state and a link back to the existing Pricing workflow. Cost preview remains absent from the redacted API projection and UI for users without `catalog.cost.read`.
- Preview pagination now orders by `row_number` and UUID `id`, so equal timestamps cannot duplicate or omit rows at page boundaries.
- Upload summaries count `INVALID` and `CONFLICT` once per staging row, matching the trusted refresh RPC.
- `INVALID` or `CONFLICT` rows without an error code render as warning states instead of `พร้อม`.
- The Pricing CTA now carries `tab=pricing` and the Product UUID. The Catalog page validates those query values, opens `Cost & Formula`, selects that exact Product when it exists, and falls back to the original Supplier/first-Product behavior otherwise.
- Export filename resolution now follows `catalog_import_jobs.source_file_id` to a matching `CATALOG_IMPORT` file in `gisp-confidential`. Untrusted/missing/mismatched metadata uses a sanitized job-based filename; it never references the nonexistent `catalog_import_jobs.file_name` column.
- Export filenames are truncated by Unicode code point, preserve complete astral characters such as emoji, and replace lone UTF-16 surrogates. The final filename is URI-validated before any Storage or database write, preventing response-header encoding failure from leaving a partial export.
- History rows now expose a visible and accessible selected state (`aria-pressed`, `aria-current`, border/background and `กำลังดู`). The detail API resolves `original_name` only from same-job `CATALOG_IMPORT` metadata in `gisp-confidential`, so the banner renders the active filename and status. It receives focus and smooth scrolling with a sticky-header-safe offset only after an intentional History selection succeeds; background refresh and Candidate pagination do not move the viewport.
- The job's `source_file_id` is the authoritative file link. Both Detail and Excel Export accept legacy metadata whose `entity_id` is null or matches the job, while a non-null ID for another job is rejected and cannot leak its filename.
- Export now treats a row as linked to an imported Product only when `imported_at` exists and the immutable `imported_product_snapshot.id` matches `product_id`. An untrusted/manual `product_id` without those markers is exported as the pre-Draft Candidate instead of failing the database linkage guard.
- Export persistence now compensates a mid-flight failure by deleting the new EXPORTED batch (and staged rows via cascade), its export metadata and its just-uploaded Storage object. Diagnostics log only the failed stage, a bounded error code and cleanup outcome.

## Runtime export hotfix evidence

- Real isolated-branch UAT job `b40d54a3-3020-4198-9b06-e14e85d8782a` reproduced `CONFLICT: PDF_PRODUCT_LINKAGE`: its manually linked `product_id` had both `imported_at` and `imported_product_snapshot` null.
- After the fix, two live UAT retries returned HTTP 200 in about 4.4 seconds. Batches `bf16316c-16d2-4a4c-b66a-a90fa1252966` and `8539bc14-9daf-44e7-a9c9-cb7f5ae6a406` each have one staged row, export metadata, confidential Storage object and `CATALOG_ENRICHMENT_EXPORTED` audit evidence.
- Two failed UAT attempts were cleaned from the isolated Development branch after exact authorization: batches `25bda986-09cc-48f3-9293-08e063602d93` and `4da2821e-f9f9-4f15-9c99-6cc8a0960db8`, metadata `29e6eb33-5e14-43e8-b1ba-1813788ba150` and `4ce6871e-4a27-4cea-abfc-908ef89b7f5c`, plus their two Storage objects. Verification returned zero remaining records/objects. This cleanup is not recoverable from the application, but the attempts had zero staged rows, no audit event and never returned a successful download.

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
