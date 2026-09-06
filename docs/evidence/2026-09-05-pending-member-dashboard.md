# Pending Member Dashboard — implementation and verification

Date: 5 September 2026. Status: **IMPLEMENTED / LOCAL VERIFICATION PASSED / NOT DEPLOYED**.

The user explicitly selected “ส่งผลทดสอบก่อน ยังไม่เผยแพร่รวมงานอื่น”. No frontend deployment, production configuration, database migration, or permission change was performed.

## Delivered behavior

- `/pending-approval` renders a dedicated dashboard for PENDING and UNDER_REVIEW applications. Existing accessHome redirects and other application-state views remain unchanged.
- Status, read-only company information, application documents, section navigation, sign-out, and a check-status button are available. No transaction dashboard/reports are loaded.
- Uses existing `/api/member/profile`, `/api/files`, and `/api/auth/session`; there are no new API contracts or database states.
- Document count says “อัปโหลดแล้ว X ไฟล์ — รอทีมตรวจสอบ”. Zero files shows the primary-document guidance; count never implies verified completeness.
- Profile/files load independently with retry. Shared document component supports an optional pending summary (off by default), recoverable loading failures, browser-side file validation, and a mobile hidden-input width fix.
- Status checking navigates using the existing server policy; route replacement and refresh are not run concurrently.

## Verification evidence

| Check | Result |
|---|---|
| Automated suite | 29 files / 122 tests passed, including four pending-dashboard tests |
| TypeScript | Passed in final isolated build |
| Lint of all changed application/test files | Passed |
| Final isolated production build | Passed with Webpack; original Google font files downloaded separately and supplied using Next's test font-response hook due network fetch failures. Source font configuration unchanged. Earlier normal Turbopack builds also passed before final UI refinements. |
| Browser desktop 1440×1000 / mobile 390×844 | Passed; no horizontal overflow on final mobile page |
| Browser page errors | None in successful final browser flows |
| Signup/onboarding submission and subsequent login | Two independent test runs created and submitted new Development applicants successfully |
| Profile ownership and pending edit denial | Passed via real APIs; applicant receives own profile, PATCH remains 403 |
| Pending catalog/projects/orders/reports API denial | All returned 403 |
| Cross-member file list/upload/download | Denied |
| File validation and quota | Invalid type rejected; files 1–5 accepted; sixth rejected with 409; own signed download allowed |
| Browser upload failure/retry | Aborted POST showed error and enabled retry; retry returned 201 and displayed uploaded file |
| Browser oversize validation | File over 10 MB rejected before upload |
| Profile load failure | Isolated error/retry rendered while documents remained available; retry recovered |
| Status network failure/retry | Error displayed, subsequent retry succeeded |
| Approval transition | Real admin approval, then browser check-status button reached full member dashboard without page errors |
| Rejection | Existing rejection destination returned after real admin action |
| Suspension/reactivation | Existing session revoked; new session routed to account-suspended; admin reactivation succeeded |
| Existing admin and approved-member dashboards | Loaded successfully |
| Logout | Sign-out succeeded and old session returned 401 |

Browser screenshots:
- `output/pending-dashboard-desktop-final.png`
- `output/pending-dashboard-mobile-final.png`

Integration runner: `scripts/pending-dashboard-smoke.mjs`, guarded to the Development backend and explicit local/Development host allowlist. It creates test users only in setup phase. Test fixtures and authentication state are stored under excluded `tmp/pending-dashboard/`; do not publish these files.

## Limits and concurrent work

- Production is Release A and does not open member routes. This change does not lift that restriction.
- Other work changed the landing page, admin guide, navigation, and release-stage files during this task. Build output was also shared. Final browser verification therefore used a separate source snapshot at `tmp/pending-dashboard/release`, backed by the Development database, at localhost:3117.
- Full-repository lint in that snapshot failed on an unrelated existing `src/app/admin/guide/page.tsx` set-state-in-effect error. This task's files pass lint. No unrelated guide edits were made.
- Direct oversized HTTP requests hit Next's existing 10 MB proxy buffering limit and return HTTP 500 rather than the API's intended 400. Browser validation now prevents this case through the upload UI. The global proxy/API limit was not changed.
- Direct URL denial beyond the pending route was not exhaustively browser-tested; underlying page/API guards are unchanged, and the transaction APIs were verified to reject the pending account. No claim of complete Production UAT is made.
- Test-only Development accounts and small file fixtures remain for reproducibility; no existing customer records were changed. SMTP registration delivery was not tested: fixtures were auto-confirmed with the established test-account mechanism.

## Backup and rollback

Original modified files are backed up at `output/backups/pending-dashboard-20260905/`:
- `page.tsx`: original pending page.
- `member-application-files.tsx`: original shared file component.
- `final-hashes.json`: hashes of final changed application files.

For a scoped rollback, compare the saved files with current versions first to protect subsequent work, restore only the two original files, and remove this change's pending-dashboard component/test if no later work references them. No database rollback is needed. Git has no baseline commit in this workspace and must not be the only recovery method.

## Remaining: 2 steps

1. Review and isolate the release source from concurrent work, then verify the hosted test deployment.
2. Publish the agreed release and perform post-deployment smoke checks. Deployment is intentionally paused per the user's latest instruction.
