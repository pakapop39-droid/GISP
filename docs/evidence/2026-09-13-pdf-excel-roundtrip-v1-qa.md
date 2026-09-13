# PDF Catalog Excel Round-trip v1.0 — Independent QA Evidence

Date: 2026-09-13

QA role: `vs_qa_guardian`

Mode: Independent QA

Source commit: `1902db984ac7b5364d330b4abdeb263081417232`

Source branch: `codex/pdf-excel-roundtrip-v1`

Worktree: `C:\codex\GISP-pdf-excel-roundtrip-v1`

Backend under test: isolated Full Development branch `pdf-excel-roundtrip-v1` (`5398a865-c466-4c6e-8bdf-e8f8ec1f56d8`)

Production: **No — not authorized, not changed, not tested**

## Approval and scope

- Master scope: `PDF Catalog Excel Round-trip v1.0`.
- Scope/Implementation approval: ภคภพ ช.เจริญยิ่ง, recorded at `2026-09-13T12:08:36+07:00`, Development only.
- QA covered the five-sheet XLSX round-trip, validation/security limits, staged preview, separate Product-detail/Cost apply, permission and cost-redaction boundaries, idempotency, lifecycle and duplicate protections, no automatic Member Price activation, and regressions around the existing PDF/Product/Pricing workflows.
- This evidence records test results only. It is not Merge, Deploy, Development Release, or Production Release Authorization.

## Final verdict

**PASS** for the frozen source commit above.

- Blocker: none.
- Major: none remaining.
- Minor: none remaining.
- Observation: real Office/LibreOffice UAT, manual browser confirmation of the final History focus/scroll behavior, and hosted API timing remain outside this local/isolated-branch QA evidence.

## Import History UAT UX verification

The History selection finding is resolved in the frozen source:

- The selected History row has a distinct border/background/ring, visible `กำลังดู` badge, `aria-pressed="true"`, and `aria-current="true"`; unselected rows expose neither the badge nor `aria-current`.
- The current-job banner renders the exact resolved source filename and current Job status, and labels the focusable detail region through `aria-labelledby="catalog-import-current-job"`.
- Detail focus uses `{ preventScroll: true }` before smooth `scrollIntoView`, and the detail region uses `scroll-mt-24` to clear the sticky navigation.
- Only a successful intentional History selection passes `revealAfterLoad=true`. Upload completion, Confirm refresh, Review reload, and pagination retain the default `false`, so background operations do not auto-scroll.
- The detail API loads metadata by the authoritative `catalog_import_jobs.source_file_id`. The shared resolver accepts only bucket `gisp-confidential`, visibility `CONFIDENTIAL`, entity type `CATALOG_IMPORT`, and either the matching Job ID or legacy `entity_id=NULL`.
- Missing metadata, a missing `entity_id` property, mismatched non-null Job ID, public visibility, or the wrong bucket/type is rejected. Detail falls back to `—`; Excel export falls back to the sanitized Job-based filename.
- Detail and Excel export now use the same resolver, so legacy compatibility does not create divergent trust rules.

## Final CTA behavioral verification

The previously reported Pricing CTA Major is resolved:

- An applied Cost row creates `/admin/catalog?productId=<UUID>&tab=pricing#pricing` with the Product ID URL-encoded.
- The Catalog page validates the UUID and `tab` query before passing initial navigation to the workspace.
- A valid `productId` plus `tab=pricing` opens the Pricing workspace and keeps that exact Product selected when it exists in the authorized Product result set.
- The Pricing section has the matching `id="pricing"` anchor.
- No query, or invalid navigation values with no valid Pricing-tab request, preserves the former Supplier/first-Product behavior.
- Query input is used only for validated navigation and equality selection against API-returned Product IDs; it is not interpolated into SQL or HTML.

Direct behavioral helper results used during QA:

- valid UUID + `tab=pricing` → `{ initialTab: "pricing", initialProductId: <exact UUID> }`
- exact requested Product present in the loaded list → exact requested Product ID
- requested Product absent → first Product ID
- no query → Supplier tab and first Product
- invalid Product UUID without a valid tab → Supplier tab and first Product

## Export filename and partial-write verification

The previously reported Unicode export Major is resolved:

- Export reads `catalog_import_jobs.source_file_id`; it does not query or access a nonexistent `catalog_import_jobs.file_name` column.
- A source name is trusted only when its metadata belongs to the same Import Job and has bucket `gisp-confidential`, visibility `CONFIDENTIAL`, and entity type `CATALOG_IMPORT`.
- Missing, public, or mismatched metadata uses the sanitized `pdf-catalog-<job prefix>` fallback.
- Path separators, ASCII controls, and filename-reserved characters are removed or replaced before the name reaches the response header.
- Truncation now operates on Unicode code points. The exact `99 × "a" + 😀 + ".pdf"` boundary preserves the complete emoji and remains accepted by `encodeURIComponent`.
- A lone high surrogate at the same boundary is replaced with `-` and also remains accepted by `encodeURIComponent`.
- The final filename is resolved and URI-validated immediately after the read-only Job/source metadata lookup, before workbook generation, Storage upload, file metadata insert, batch insert, staging-row insert, or audit write. The response header therefore cannot encounter the prior encoding failure after persistent writes.

## Regression findings re-tested

- Actual calculated Member Price preview renders a two-decimal amount, `THB`, and explicit `ยังไม่เปิดใช้ราคา` state.
- Preview/cost fields remain removed from the API projection and UI for users without `catalog.cost.read`.
- Preview pagination uses deterministic `row_number`, then UUID `id`; the 1,000-row fixture has no duplicate or missing row across page boundaries.
- `INVALID` and `CONFLICT` batch summaries count once per staging row for each status.
- An `INVALID` or `CONFLICT` row without `error_codes` renders a warning instead of the green `พร้อม` state.
- Member Price is never activated by Cost apply; Product remains `DRAFT / NOT_REVIEWED`.

## Exact automated evidence

All commands ran from the frozen clean worktree.

1. Focused History/metadata/export regression:

   `npm test -- --run src/components/catalog-import-workspace.test.ts src/lib/catalog/excel-roundtrip.test.ts`

   Result: **2 test files / 15 tests passed**.

2. Unicode/export boundary coverage:

   The focused file above passed the exact `99 × "a" + emoji` and lone-surrogate filename cases, source metadata trust/fallback cases, XLSX gates, and round-trip parsing/building cases.

3. Full unit/regression suite:

   `npm test`

   Result: **52 test files / 245 tests passed**.

4. Type checking:

   `npm run typecheck`

   Result: **passed**.

5. Lint:

   `npm run lint`

   Result: **passed with no reported warning or error**.

6. Production build:

   `npm run build`

   Result: **passed; 119 pages generated**, including the six Excel enrichment API routes.

7. Isolated Development branch integration:

   `npm run test:pdf-excel-roundtrip:branch`

   Result: **15/15 assertions passed**:

   - PDF source filename resolves through linked confidential `file_metadata`;
   - non-XLSX confidential metadata rejection;
   - authenticated browser DML denial;
   - trusted detail apply and review reset;
   - Member/Purchasing/Product Admin permission matrix;
   - Member trusted-RPC denial;
   - immutable PDF/Product linkage enforcement;
   - `WAITING_FOR_DRAFT` refresh;
   - Cost apply idempotency;
   - one ACTIVE Cost Version and retirement of the previous version;
   - no Member Price activation;
   - Product remains Draft/Not Reviewed;
   - lifecycle rejection after PDF job cancellation.

8. Repository integrity:

   - `git rev-parse HEAD` matched the full source commit above before the evidence-only commit.
   - `git status --short` and `git diff --stat` were empty before and after source testing.
   - The final legacy-linkage fix changed the shared metadata resolver, detail route, focused tests, and Builder handoff only; no migration, worker, dependency, feature flag, secret, or environment configuration changed.

## Security and data status

- Existing RLS/browser DML denial and trusted-RPC boundaries passed the isolated-branch integration suite.
- Cost preview redaction still requires `catalog.cost.read`; Cost apply still requires the approved stronger permissions.
- The navigation change validates UUID input and does not weaken authentication or authorization.
- Detail and export filename input is constrained to the Job's exact `source_file_id` plus the shared confidential metadata trust rule; export output remains sanitized, Unicode-safe, and URI-validated before persistent writes.
- The branch integration script creates traceable synthetic test data in the isolated Development branch. It does not touch the Development parent or Production.
- Five pre-existing dependency audit findings remain documented in the Builder handoff (1 critical, 2 high, 2 moderate). The final CTA/export fixes did not change `package.json` or `package-lock.json`; `fflate@0.8.3` did not introduce an advisory in the earlier independent audit.

## Remaining limitations and next actions

Not yet verified:

- real Microsoft Excel/LibreOffice edit-and-upload Human UAT;
- manual browser re-check of the final selected-state focus/scroll behavior;
- the CTA in a deployed hosted frontend;
- hosted API export/preview timing at the 1,000-row boundary;
- Development merge/deploy and post-deploy smoke test.

Remaining steps to close the Development Slice: **3**

1. Owner Human UAT with Excel/LibreOffice.
2. Obtain a separate Merge/Deploy Development Authorization.
3. Merge/deploy to Development and complete post-deploy verification.
