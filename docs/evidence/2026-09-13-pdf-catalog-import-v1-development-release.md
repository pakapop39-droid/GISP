# PDF Catalog Import v1.0 — Development Release Evidence

Date: 2026-09-13 (Asia/Bangkok)
Environment: Development
Production: No — untouched and not authorized

## Authorization

- Approval level: Release Authorization — Merge/Deploy Development and post-deploy verification
- Approved by: ภคภพ ช.เจริญยิ่ง
- Approved at: `2026-09-13T10:48:37+07:00`
- Scope: PDF Catalog Import v1.0 only
- Owner text: “โอเคตรวจแล้วผ่าน อนุมัติ Merge/Deploy Development และตรวจหลัง Deploy”

This authorization covered the already approved Development release. It did not authorize Production, additional scope, new migrations, business-data mutation, or weaker security, privacy, provider, and budget controls.

## Source and backend release

- Release source commit: `a674de3c8e4cc9509c85ab00c3c080600457e047`
- Release branch: `codex/pdf-catalog-import-v1-release`
- Full backend branch ID: `e3cf37ee-4a03-4fe7-8beb-33807e9471f2`
- Full backend merge result: 34 objects added, 5 modified, 0 conflicts, after a clean merge dry-run.
- Pre-merge backup ID: `c2e06aee-e3cc-49c5-bc24-ee456a2ea84f`
- Backup export: `C:\codex\GISP\output\backups\pre-pdf-catalog-v1-merge-2026-09-13-full.json`
- Backup export SHA-256: `375FE380D8A0C05D77FBCC1C928185EB3B796BFB15338CC41D7CA695869497C1`
- Merge dry-run SQL: `C:\codex\GISP\output\backups\pdf-catalog-v1-merge-dry-run-2026-09-13.sql`
- Merge dry-run SQL SHA-256: `88BC64F916A2ED578D8BE1BD01C149BC8AC888146E800D44CDB8A0329E486BE4`

The Development database verification found seven PDF Catalog tables with RLS enabled and 18 trusted PDF functions present.

## Frontend, worker, and schedules

- Frontend deployment ID: `999ff236-e60c-4208-a6e5-62e56754ca4f`
- Frontend state: `READY`
- Development URL: `https://kit6y4pj.insforge.site`
- Custom Compute ID: `2d8d6286-fd10-444b-9a01-1ea78e5924e3`
- Compute configuration: `performance-4x`, 8192 MB, Singapore (`sin`), scale-to-zero.
- Worker health returned HTTP 200, after which compute was stopped and remained stopped when idle.
- Worker schedule ID: `b31df7ea-41fc-42e9-8482-bab6225cec5e`; cadence `*/2`; active; first recorded run returned HTTP 200 success.
- Cleanup schedule ID: `7d20cc17-d2d0-4af7-ab02-a476a6528987`; daily; active.
- Existing image and notification schedules were restored to active after the release work.
- AI and compute ledger tables contained no rows after the empty-queue post-deploy verification.

## Post-deploy verification

- `/api/health` returned HTTP 200.
- `/login` returned HTTP 200.
- Anonymous access to the admin page redirected to login with HTTP 307.
- Anonymous access to the protected admin API returned HTTP 401.
- Authenticated admin page and API returned HTTP 200, and the PDF Catalog option was visible.
- A missing or unauthorized worker wake bearer returned HTTP 401.
- An authorized empty-queue wake returned HTTP 200 with `claimed=0` and `wakeSkipped=true`.
- Compute remained stopped after the empty-queue check.
- Production was not changed.

## Remaining acceptance evidence

The infrastructure and Development post-deploy checks above are complete. The formal accuracy and performance benchmark remains an evidence gap unless the owner's UAT already supplied four distinct authorized PDFs covering Chinese/English × native/scanned, owner-approved ground truth for at least 100 products, and the locked evaluator output. No benchmark result is inferred or fabricated by this release record.

This document records evidence supplied by the Release Executor. This docs-only update did not merge, deploy, operate compute, change schedules, mutate backend data, or touch Production.
