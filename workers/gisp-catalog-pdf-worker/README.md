# GISP Catalog PDF Worker

Development-only worker for PDF Catalog Import v1.0. It verifies each PDF with qpdf and ClamAV, extracts native text or OCR (`eng+chi_sim`), renders at no more than 25 megapixels, and makes at most one OpenRouter request per page.

Required secrets: `INSFORGE_URL`, `INSFORGE_API_KEY`, `OPENROUTER_API_KEY`, and `PDF_WORKER_TOKEN`. Do not commit their values.

Deploy through InsForge Custom Compute only after the Full Backend Branch is active:

```text
npx -y @insforge/cli compute deploy workers/gisp-catalog-pdf-worker --name gisp-catalog-pdf-worker --region sin --cpu performance-4x --memory 8192
```

The included `fly.toml` enables scale-to-zero. The current CLI cannot create a schedule in a paused state. Keep all schedules absent by default. After branch migration, smoke tests, and verified provider pricing, schedule the application gateway `/api/internal/catalog-pdf-worker/wake` every 2 minutes and `/api/internal/catalog-pdf-worker/wake?action=cleanup` daily using `PDF_WORKER_WAKE_SECRET`; never schedule compute endpoints directly. The gateway reserves the maximum 25-minute run cost before waking compute and stops at USD 20/month. Each run performs expired-lease recovery before draining the queue. Verify every schedule with `schedules get` and `schedules logs`.

InsForge currently exposes usage-based compute and scale-to-zero but no provider-billing hard stop. App-side reservations, an 80% warning, and the USD 20 database ceiling prevent new wakes; they cannot stop provider billing outside this controlled gateway. `PDF_WORKER_URL` and `PDF_COMPUTE_USD_PER_HOUR` therefore default to blank, which blocks activation until the hourly rate and platform billing behavior are independently verified. The database independently enforces AI reservations of at most USD 1/job (including outstanding reservations) and USD 50/month.

Before each drain run, the worker reads every live Azure endpoint price for `openai/gpt-4o-mini` from OpenRouter and reserves against the highest applicable allowed-endpoint rate. It computes a rounded-up worst-case reservation from a byte-conservative input-token limit, the maximum completion-token limit, request price and image price. The same prices are persisted in the database and sent as OpenRouter `provider.max_price`; unavailable, unsupported, unaccounted or over-cap pricing disables AI for that run and leaves local candidates review-required. Every completion request sets both `provider.only` and `provider.order` to `azure`, disables fallbacks, requires supported parameters, denies data collection and requires ZDR; Azure policy/capacity failure is terminal for that AI attempt and never relaxes routing.

The image matcher uses unique nearest-neighbour proximity between normalized product bounding boxes and embedded-image rectangles; candidates without a defensible unique match remain review-required. This is a safety mechanism, not evidence that the 90% image UAT target has passed. Measure it against the owner-approved ground truth before activation.

For scanned pages without reusable embedded product images, the worker crops each validated normalized product bounding box from the bounded page render. Crops use content hashes for confidential-storage deduplication and receive confidence `0.75` plus `IMAGE_MATCH_REVIEW_REQUIRED`, so they never pass the 0.90 image gate without a human review.

The container refreshes ClamAV signatures at build time, gates health/run on qpdf and signature availability, runs as UID 10001, limits OCR to 90 seconds, and enforces 25-megapixel render/decompression bounds. The current Custom Compute CLI has no documented read-only-root-filesystem switch; activation remains blocked until that setting is verified at platform level. `/tmp/gisp-worker` is the only intended writable runtime path.
