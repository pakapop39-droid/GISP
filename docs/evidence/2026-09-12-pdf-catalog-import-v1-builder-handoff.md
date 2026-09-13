# PDF Catalog Import v1.0 — Builder to QA Handoff

Date: 2026-09-12; status corrected 2026-09-13
Environment: Local implementation; current linked InsForge Full Backend Branch `pdf-catalog-import-v1` under `gisp-mvp-development`
Production: Not authorized and not changed

Latest Release Authorization: ภคภพ ช.เจริญยิ่ง approved Merge/Deploy to Development and post-deploy verification at 2026-09-13T10:48:37+07:00 with the exact text “โอเคตรวจแล้วผ่าน อนุมัติ Merge/Deploy Development และตรวจหลัง Deploy”. Production remains unauthorized. The active technical amendment remains Azure-only routing through OpenRouter, approved at 2026-09-13T09:06:36+07:00. See `2026-09-12-pdf-catalog-import-v1-approval.md`.

## Minimal PDF Catalog v1.0 release file manifest

Commit these PDF-owned files:

- Migrations: `migrations/20260912122859_pdf-catalog-import-v1.sql`, `migrations/20260912234654_fix-pdf-confirm-selection-alias.sql`, `migrations/20260913075421_fix-pdf-claim-normalizing.sql`, and `migrations/20260913091000_harden-pdf-ai-reservation-azure.sql`. All four are already recorded as applied on the isolated branch; commit them for history but do not re-apply them there.
- Application: `src/app/admin/catalog/imports/page.tsx`, `src/lib/catalog/pdf-import.ts`, `src/components/pdf-catalog-review.tsx`, `src/app/api/admin/catalog/imports/route.ts`, `src/app/api/admin/catalog/imports/[id]/route.ts`, `src/app/api/admin/catalog/imports/[id]/confirm/route.ts`, `src/app/api/admin/catalog/imports/[id]/artifacts/[fileId]/route.ts`, `src/app/api/admin/catalog/imports/[id]/cancel/route.ts`, `src/app/api/admin/catalog/imports/[id]/retry/route.ts`, `src/app/api/admin/catalog/imports/[id]/rows/[rowId]/route.ts`, `src/app/api/admin/catalog/imports/[id]/rows/[rowId]/decision/route.ts`, `src/app/api/admin/catalog/imports/[id]/rows/[rowId]/images/[fileId]/route.ts`, `src/app/api/internal/catalog-pdf-worker/wake/route.ts`, and the PDF security additions in `src/app/api/files/[id]/download/route.ts`.
- Application tests: `src/lib/catalog/pdf-import.test.ts`, `src/lib/catalog/pdf-import-migration.test.ts`, `src/components/pdf-catalog-review.test.ts`, `src/proxy.test.ts` and `workers/gisp-catalog-pdf-worker/tests/test_worker.py`.
- Worker: `workers/gisp-catalog-pdf-worker/Dockerfile`, `workers/gisp-catalog-pdf-worker/fly.toml`, `workers/gisp-catalog-pdf-worker/README.md`, `workers/gisp-catalog-pdf-worker/requirements.txt`, `workers/gisp-catalog-pdf-worker/app/__init__.py`, `workers/gisp-catalog-pdf-worker/app/entrypoint.sh`, and `workers/gisp-catalog-pdf-worker/app/main.py`. Exclude every `__pycache__` directory and `.pyc` file.
- UAT: `scripts/pdf-catalog-uat/evaluate.mjs`, `scripts/pdf-catalog-uat/evaluator-core.mjs`, `scripts/pdf-catalog-uat/evaluator-core.test.mjs`, `docs/uat/PDF-CATALOG-IMPORT-v1-UAT.md`, `docs/uat/pdf-catalog-import-v1/ground-truth.schema.json`, `docs/uat/pdf-catalog-import-v1/ground-truth.TEMPLATE.json`, `docs/uat/pdf-catalog-import-v1/results.schema.json`, and `docs/uat/pdf-catalog-import-v1/results.TEMPLATE.json`.
- Development backend configuration: `insforge.toml` for the approved 25 MB storage limit.
- Evidence/scope: this handoff, `docs/evidence/2026-09-12-pdf-catalog-import-v1-approval.md`, the PDF-only DEC-065–DEC-068 hunks in `docs/active/DECISION LOG.md`, and the PDF-only removal note in `docs/post-mvp/POST-MVP BACKLOG.md`.

The following shared files require selective hunk staging, not whole-file staging: `.env.example` (PDF/OpenRouter variables only), `next.config.ts` (26 MiB proxy body allowance only), `package.json` (the two PDF UAT scripts only), and `src/proxy.ts` (the `/api/internal/catalog-pdf-worker` allowlist line only). `package-lock.json`, `.gitignore`, `next-env.d.ts`, Sharp/image-search hunks and DEC-069 are not PDF Catalog dependencies and must not enter this release through these shared files.

`src/components/catalog-import-workspace.tsx` is a required PDF UI integration file but is currently interwoven with an untracked Finish Import feature through `FinishImportPanel`. It cannot be committed as-is in a PDF-only release without also bringing in unrelated Finish files. Before committing, the Release Executor must either isolate the PDF-owned hunks into a compilable version based on the tracked workspace or include the Finish slice only under its own independent authorization. The PDF Release Authorization does not authorize silently widening scope to Finish Import.

## Implemented locally

- Additive SQL migration for PDF jobs, page leases, normalized candidates, deduplicated candidate images, AI/compute reservation audit, RLS and trusted RPCs.
- Existing Excel/CSV upload and confirm paths remain available; PDF upload returns HTTP 202 and is disabled unless `ENABLE_PDF_CATALOG_IMPORT=true`.
- PDF validation covers the 25 MB and 100-page limits, exact MIME/extension/signature, malformed/encrypted files and embedded portfolios.
- Paginated review API/UI includes source-page comparison, candidate editing, image selection, warnings, approve/reject, duplicate links, cancel/retry and reviewed-only bulk confirm.
- Confirm revalidates category, selected confidential image, warnings, review state and duplicate SKU in the database. It copies the approved image to an idempotent durable key before creating only `products` in `DRAFT/NOT_REVIEWED`, primary media and a confidential source document. It never creates prices, costs, variants/options or a published product.
- Trusted rollback is PDF-only and idempotent. It compares an immutable import snapshot and refuses deletion if the Product changed or any non-import relation/downstream reference exists; it deletes only the exact media/document relations created by the import.
- Python 3.12 worker uses qpdf, ClamAV, PyMuPDF, Poppler and Tesseract `eng+chi_sim`; one run drains repeated four-page concurrent batches for up to 25 minutes, with ten-minute leases and recovery. It falls back to review-required local extraction after AI failure/budget denial.
- Malware, unavailable malware signatures, encryption, malformed PDFs and portfolios are terminal whole-job failures; unverified bytes are never published to the shared cache or sent to AI.
- OpenRouter calls are one-attempt-per-page with `openai/gpt-4o-mini`, Azure-only routing through both `provider.only=['azure']` and `provider.order=['azure']`, no fallback/tools, temperature zero, strict JSON Schema, `data_collection: deny` and `zdr: true`. Each run loads the live per-endpoint list, considers only operational Azure tags that support every required parameter, and reserves against the highest applicable Azure rate before sending the same ceiling as `provider.max_price`. Missing Azure capacity, privacy compatibility, required parameters or complete pricing disables AI without relaxing routing. Database locks count both actual and outstanding reservations against USD 1/job and USD 50/month, using Asia/Bangkok month boundaries.
- Full native/OCR text and raw AI responses are stored only as confidential file artifacts. The database keeps bounded summaries, hashes and normalized evidence. Transient rendered pages, artifacts and unused candidate images become eligible for purge 30 days after the job becomes terminal. Approved images are copied to durable Product Media first; the original PDF has no automatic purge.
- The internal wake gateway reserves compute before starting work, warns at USD 16 and blocks new work above USD 20/month. Activation variables and schedules remain unset by default until the provider billing cap is independently verifiable.
- A deterministic UAT evaluator and non-evidence JSON templates are available under `scripts/pdf-catalog-uat` and `docs/uat/pdf-catalog-import-v1`. The evaluator refuses unapproved templates, incomplete CN/EN × native/scanned coverage, reused PDF hashes, manifests below 100 real products, duplicate truth mappings and missing 100-page timing; it exits nonzero when any locked accuracy/time threshold fails. No PDF or UAT result was fabricated.

## Test evidence

- `npm run typecheck` — passed.
- `npm test -- --run src/lib/catalog/pdf-import.test.ts src/lib/catalog/pdf-import-migration.test.ts src/components/catalog-import-workspace.test.ts` — 3 files, 25 tests passed.
- `npm test` — 59 files, 284 tests passed.
- `npm run lint` — passed with one pre-existing warning in `scripts/smtr/verify.mjs` and zero errors.
- `npm run build` — passed; Next.js generated 127 pages and includes all PDF import API routes.
- Bundled Python 3.12 with dependencies installed transiently under ignored `.codex-tmp/pdf-worker-test-deps`: `python -m unittest discover -s tests -v` from the worker directory — 18 tests passed, including Azure-only routing, provider-specific price bounds and fail-closed absence; the temporary dependencies and generated `__pycache__` were removed afterward.
- Worker `compileall` — passed.
- Feature-scoped ESLint — passed with zero warnings/errors.
- `npm run test:pdf-catalog:uat` — 12 evaluator/CLI tests passed, covering thresholds, exact readable SKU semantics, missed/missing values, zero denominators, duplicate mappings, PDF hash binding/uniqueness, matrix/100-product gates and nonzero failure exit.
- Running the evaluator directly against both `.TEMPLATE.json` files returned the expected `INVALID_UAT_INPUT` and exit code 2; all four schema/template JSON files parsed successfully.
- `git diff --check` — passed (line-ending notices only).
- `insforge config plan --file insforge.toml` — parsed successfully and showed storage 10 MB → 25 MB; it was not applied.

## Infrastructure branch state — corrected 2026-09-13

- The earlier manual backup attempt was rejected because the manual backup quota was 5/5. A completed scheduled backup from 2026-09-12 08:00 existed at that time; no backup was deleted by that attempt.
- The earlier `insforge branch create pdf-catalog-import-v1 --mode full` attempt was rejected by the parent-project quota. That earlier failure is retained as historical evidence, but it is no longer the current branch status.
- Read-only `npx -y @insforge/cli branch list` on 2026-09-13 returned `pdf-catalog-import-v1` in state `ready`, mode `full`, and marked it as the CLI's current linked backend branch under `gisp-mvp-development`.
- The status correction does not establish how the earlier quota was resolved and does not claim that a fresh branch backup exists.
- Live evidence reviewed by QA confirms that migrations `20260912122859`, `20260912234654`, `20260913075421` and `20260913091000` are applied on the current PDF branch. Do not re-apply them.
- Runtime/RLS behavior, applied configuration, OpenRouter setup, secrets, compute, schedules, test-data writes, frontend deployment, branch merge and any Production action remain unverified until their own command output and QA evidence are recorded.
- The platform exposes scale-to-zero for compute, but no independently verifiable provider-billing hard stop or documented read-only-root switch was found. The application gateway is fail-closed when its verified hourly rate is absent and all schedules remain absent. This acceptance criterion is not claimed as passed.
- The earlier handoff had not executed the migrations because no isolated branch existed at that time. The four migrations listed above have since been applied to the ready isolated branch, but SQL runtime behavior and RLS roles remain unverified until branch test evidence is recorded.
- The worker unit tests cover policy payload, cache ordering, queue draining, image dedupe/proximity and bounds. The local Windows host did not execute qpdf, ClamAV or Tesseract binaries end-to-end; that belongs in the branch compute smoke test.
- Product/image accuracy and the 100-page under-30-minute target have not been measured against owner-approved ground truth. Safety fallbacks remain review-required and no accuracy claim is made.

## QA entry criteria

1. Confirm `pdf-catalog-import-v1` remains the intended ready Full Backend Branch and record an acceptable fresh backup/rollback point before any further mutation; do not delete anything without separate owner authorization.
2. Do not re-apply migrations `20260912122859`, `20260912234654`, `20260913075421` or `20260913091000`. Verify their recorded history/checksums, applied configuration, SQL runtime behavior and RLS roles for Anonymous, Member, Product Admin, Super Admin and Worker.
3. Run mergeability checks without merging and record exact command output.
4. Deploy the worker only on that branch, verify ClamAV signatures, read-only runtime controls and the provider compute cap, configure secrets there, then create the two-minute application-gateway schedule and daily cleanup schedule after smoke tests.
5. Obtain four authorized Chinese/English × native/scanned PDFs plus approved ground truth of at least 100 products; follow `docs/uat/PDF-CATALOG-IMPORT-v1-UAT.md` to export untouched normalized candidates and run the evaluator for accuracy, image matching and 100-page runtime acceptance criteria.

ENV2-v0.1 authorizes only Git/document organization. Nothing in ENV2-v0.1 authorizes migration/config changes, deployment, merge, deletion, or any Production action for PDF Catalog Import.

Development Merge/Deploy and post-deploy verification are now authorized, but have not been executed by this Builder. Remaining steps to close this Development slice: **3** — (1) Release Executor commits/merges and deploys the already-approved source/config to Development without re-applying migrations already recorded on the branch, (2) run and record post-deploy application/worker/security/budget smoke checks, and (3) complete human UAT with the four real PDFs and owner-approved ground truth where that evidence remains outstanding. Production remains a separate, unauthorized release.
