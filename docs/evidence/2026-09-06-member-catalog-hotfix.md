# Member catalog media lookup hotfix

Target: Development, https://kit6y4pj.insforge.site/member/catalog.

## Diagnosis

The active member could open the portal but the catalog returned SERVER_ERROR.
Backend logs showed successful member_catalog and product_media reads, followed
by repeated file_metadata reads. Reproducing the SDK query against the linked
Development backend returned HTTP 502 from the gateway for 125 file IDs.
The same 125 records were retrieved successfully using batches of 40 IDs.
This isolates the failure to the large metadata request; a gateway response
header limit is the suspected underlying mechanism, not independently proven.

## Fix

src/lib/catalog/member-server.ts now retrieves metadata in bounded batches of
40 unique IDs, combining all results. Both product images and member-visible
documents use the helper. Existing access guards and private signed URLs remain.
Metadata failures still propagate; they are not silently reported as empty data.

## Verification

- Live SDK reproduction: 125-image lookup failed before, 125/125 metadata records
  retrieved with bounded batches.
- Regression: 125 images across multiple batches, empty input, failed batch.
- Full automated suite: 39 files / 147 tests passed.
- TypeScript, targeted ESLint, and Next.js production build passed.

Original helper backup: output/backups/member-catalog-20260906/member-server.ts.
Previous Development deployment: 67c2dfa3-0bda-43f5-b226-ae8e7bcd2d39.
Development deployment ea551c53-b38e-4c86-9c71-cf233bda79c6 is READY.
The deployed manifest has 465 files versus 464 previously (the regression test
is the added file).

The actual updated helper was also transpiled and executed against Development:
24/24 products had images, 125 signed URLs were generated, and a sample signed
image returned HTTP 200. No database or role changes were applied.

The browser session changed from the original member to Project Owner during
verification. Final member-browser catalog/detail verification requires the
user to sign back into the member account. Remaining: 1 verification step.
