# Image Search — experiments and Development preview tools

The original inventory and local CPU benchmark scripts are read-only. Later tools
in this folder seed the Development database and configure its dedicated website
and indexing schedule. See `docs/evidence/2026-09-09-image-search-online-preview.md`
for scope and ordering; do not run every script as a batch. Private artifacts stay
under gitignored `output/image-search-spike/`.

## Reproduce from the repository root (PowerShell)

```powershell
New-Item -ItemType Directory -Force output/image-search-spike/runtime | Out-Null
npm install --prefix output/image-search-spike/runtime @huggingface/transformers@3.8.1
npx -y @insforge/cli current
$imageSearchSql = (Get-Content scripts/image-search-spike/catalog-inventory.sql | Where-Object { $_ -notmatch '^--' }) -join ' '
npx -y @insforge/cli db query $imageSearchSql --json | Set-Content -Encoding utf8 output/image-search-spike/inventory.json
node scripts/image-search-spike/prepare.mjs
node scripts/image-search-spike/benchmark.mjs Xenova/clip-vit-base-patch32
node scripts/image-search-spike/benchmark.mjs Xenova/clip-vit-base-patch16
node scripts/image-search-spike/build-review.mjs
node scripts/image-search-spike/build-contact.mjs
node scripts/image-search-spike/validate.mjs
```

Run each command only after the previous command succeeds. `prepare.mjs` refuses
projects other than the linked `gisp-mvp-development` / `kit6y4pj`; it reads the
existing CLI key without printing it. Credentials must never be copied into this
directory. Download operations use the installed InsForge SDK. Run `current`
before exporting SQL because that command uses the currently linked project.

The isolated runtime does not modify the application's dependencies. Its npm lock
file remains in the local runtime directory. Each result records the resolved
Hugging Face model revision, quantization, preprocessing identity and hardware.
Model downloads go to `output/image-search-spike/models`; images are processed on
the local machine. No inference API key is necessary for these two baselines.

## Dataset and interpretation

- Gallery: one primary (or first ordered) image for every eligible product.
- Eligibility reproduces PUBLISHED + PASSED QA + an active, currently valid,
  product-level price. This admin inventory is not a member authorization test.
- Query products: up to 50, category round-robin, deterministic SKU ordering.
  This covers small categories but is not a population-random sample.
- Alternate query: first differing image among the next two catalog images.
  This is a same-product proxy, not an independently photographed user query.
- Compression query: resize the primary image to fit 224px, JPEG quality 40.
- Product-disjoint calibration/holdout assignments are made before inference.
- Alternate query files are not indexed as that product's gallery image. Exact
  normalized byte duplication across other products is reported separately.
- Category-filter metrics were added as a post-hoc diagnostic. They assume a
  correct user-selected category and do not measure category prediction.
- Models return only rankings. There is no rejection threshold or negative-case
  acceptance claim without a human-labeled negative dataset.

`review.html` lets an operator inspect results and export exploratory ratings.
Ratings remain only in the browser page until explicitly downloaded. Exported
ratings must not be counted as pre-registered blind evaluation labels.

`costs.json` separates public-price scenarios from measured hosted response costs.
Voyage was subsequently tested with the existing project OpenRouter key retrieved
via `npx -y @insforge/cli ai setup`, written server-side to gitignored `.env.local`.
Do not place secrets in the review HTML or send private images to public demos.

Hosted comparison (billable; the owner accepted the budget):

```powershell
node --env-file=.env.local scripts/image-search-spike/benchmark-voyage.mjs --smoke-only
node --env-file=.env.local scripts/image-search-spike/benchmark-voyage.mjs
node scripts/image-search-spike/build-review.mjs
node scripts/image-search-spike/validate.mjs --require-hosted
```

The persistent local ledger enforces a $1 conservative experiment reservation.
Cached vectors are reused; timing calls are billable on every full run. Do not
delete/reset the ledger merely to evade its budget cap. The request uses
Voyage-only `data_collection: deny`; no provider ZDR guarantee is asserted.

## Checks

`validate.mjs` checks inventory reconciliation, product split separation,
alternate query exclusion, finite normalized vectors, product-unique ranking,
local report assets, pricing arithmetic, and absence of storage keys in the
review payload. These are benchmark-integrity checks, not production security
or hosted performance acceptance.

For timing comparisons run models sequentially after their downloads complete.
Repeat warm timing after concurrent initialization if necessary; cached vectors
avoid redoing the whole gallery. The script always bypasses its vector cache for
warm timing. Reported model load includes any downloads needed in that run.
