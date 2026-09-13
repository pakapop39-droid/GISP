# PDF Catalog Excel Round-trip v1.0 — Independent QA Evidence

Date: 2026-09-13

QA role: `vs_qa_guardian`

Mode: Independent QA

Source commit: `a76791a2e7bc8dc69daecf4c7e00ac90ad1870bb`

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
- Observation: real Office/LibreOffice UAT, hosted frontend navigation, and hosted API timing remain outside this local/isolated-branch QA evidence.

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

## Regression findings re-tested

- Actual calculated Member Price preview renders a two-decimal amount, `THB`, and explicit `ยังไม่เปิดใช้ราคา` state.
- Preview/cost fields remain removed from the API projection and UI for users without `catalog.cost.read`.
- Preview pagination uses deterministic `row_number`, then UUID `id`; the 1,000-row fixture has no duplicate or missing row across page boundaries.
- `INVALID` and `CONFLICT` batch summaries count once per staging row for each status.
- An `INVALID` or `CONFLICT` row without `error_codes` renders a warning instead of the green `พร้อม` state.
- Member Price is never activated by Cost apply; Product remains `DRAFT / NOT_REVIEWED`.

## Exact automated evidence

All commands ran from the frozen clean worktree.

1. Focused regression:

   `npm test -- --run src/app/admin/catalog/page.test.ts src/components/catalog-enrichment-panel.test.ts src/lib/catalog/excel-roundtrip-api.test.ts src/lib/catalog/excel-roundtrip.test.ts src/lib/catalog/excel-roundtrip-migration.test.ts`

   Result: **5 test files / 27 tests passed**.

2. Full unit/regression suite:

   `npm test -- --run`

   Result: **51 test files / 236 tests passed**.

3. Type checking:

   `npm run typecheck`

   Result: **passed**.

4. Lint:

   `npm run lint`

   Result: **passed with no reported warning or error**.

5. Production build:

   `npm run build`

   Result: **passed; 119 pages generated**, including the six Excel enrichment API routes.

6. Isolated Development branch integration:

   `npm run test:pdf-excel-roundtrip:branch`

   Result: **14/14 assertions passed**:

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

7. Repository integrity:

   - `git rev-parse HEAD` matched the full source commit above.
   - `git status --short` and `git diff --stat` were empty before and after source testing.
   - The CTA fix commit changed UI/navigation/test/evidence files only; no migration, worker, dependency, feature-flag, secret, or environment configuration changed.

## Security and data status

- Existing RLS/browser DML denial and trusted-RPC boundaries passed the isolated-branch integration suite.
- Cost preview redaction still requires `catalog.cost.read`; Cost apply still requires the approved stronger permissions.
- The navigation change validates UUID input and does not weaken authentication or authorization.
- The branch integration script creates traceable synthetic test data in the isolated Development branch. It does not touch the Development parent or Production.
- Five pre-existing dependency audit findings remain documented in the Builder handoff (1 critical, 2 high, 2 moderate). This CTA-only commit did not change `package.json` or `package-lock.json`; `fflate@0.8.3` did not introduce an advisory in the earlier independent audit.

## Remaining limitations and next actions

Not yet verified:

- real Microsoft Excel/LibreOffice edit-and-upload Human UAT;
- the CTA in a deployed hosted frontend;
- hosted API export/preview timing at the 1,000-row boundary;
- Development merge/deploy and post-deploy smoke test.

Remaining steps to close the Development Slice: **3**

1. Owner Human UAT with Excel/LibreOffice.
2. Obtain a separate Merge/Deploy Development Authorization.
3. Merge/deploy to Development and complete post-deploy verification.
