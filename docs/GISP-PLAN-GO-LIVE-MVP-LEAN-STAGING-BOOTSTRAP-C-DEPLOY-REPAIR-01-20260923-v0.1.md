# GO-LIVE-MVP-INITIAL-OPERATIONS-01 — Lean Staging Bootstrap C Deploy Repair 01 v0.1

## 1. Purpose and Risk

This T3 Amendment repairs one incomplete InsForge direct-upload deployment record on the already approved standalone Temporary Staging only. It does not change application source, business rules, migration, data, configuration values, Release stages or Production authority.

- Target Project: `gisp-lean-staging-20260923`
- Project ID: `a24aff68-a82e-41da-b64a-a128a1539769`
- Host marker: `5wjnzj4y`
- Region / instance: `ap-southeast` / `nano`
- Candidate commit: `8b2573729b7d2b8ad750414e1ba86daa633e4218`
- Candidate tree: `9cb01e050462ded9160ac2429667794b27ceaf00`
- `production_allowed`: `No`

## 2. Read-only Evidence

The first Bootstrap C CLI attempt uploaded the exact candidate and created deployment record `6efe4540-7e3c-463e-833d-cd90e3164981`, then the documented start operation rejected `meta.productionAllowed` because it received boolean `false` while the API requires metadata values to be strings.

Live read-only evidence shows:

- status `UPLOADING`
- `providerDeploymentId = null`
- `url = null`
- file count `689`, total size `13,744,426` bytes
- `currentDeploymentId = null`
- default and custom deployment URLs are null
- the deployment list contains exactly this one record
- no provider build/runtime was started, no App URL exists and no fixture/UAT write occurred

InsForge CLI `0.2.8` exposes standard `deployments cancel <id>` and `deployments deploy`; it exposes no standard resume/start-existing command. Raw API use is forbidden.

## 3. Exact Repair Authority

After a fresh read-only preflight, authorize exactly:

1. Verify exact Project ID/host/region/instance, migration count `38` and head `20260923090000_startup-initial-operations-guard`, Schedule `0`, SMTP `false`, completed post-Lean backup ID `0d506ed2-6cf1-42f0-813a-89e3a79c2df7`, exact three bucket visibilities and fresh independently attested Billing evidence `<= USD 10`.
2. Verify the deployment list contains exactly record `6efe4540-7e3c-463e-833d-cd90e3164981`, still `UPLOADING`, with null provider ID and URL, and deployment metadata still has no current/default/custom deployment URL.
3. Cancel that exact record once with the standard CLI command `deployments cancel 6efe4540-7e3c-463e-833d-cd90e3164981 --json` from `C:\codex\GISP\.insforge-audit-lean-staging-new`.
4. Verify the exact record is `CANCELED`, still has null provider ID and URL, no current/default/custom deployment exists and no additional record exists.
5. Reconfirm the exact archive source commit/tree, the approved deployment environment allow-list and Release `C + []` values. No optional worker/notification secret may be present.
6. Run one replacement Bootstrap C using standard `deployments deploy` only. Keep source, env and metadata unchanged except encode every metadata value as a string; specifically use `productionAllowed: "false"`.
7. Treat the metadata string only as audit evidence. It must never be interpreted through JavaScript truthiness or used as a security guard.
8. Require replacement status `READY`, a non-null provider deployment ID and stable App URL. Then set the approved `NEXT_PUBLIC_APP_URL` to that exact URL and follow the already approved plan. Fixture/UAT writes remain forbidden until Final C attestation passes.

## 4. Counters and Boundaries

- The rejected upload-only record counts as CLI attempt/backend record `1`, but as provider-started deployment `0` because provider ID, current deployment and URL are null.
- Maximum backend deployment records / CLI deploy attempts becomes `5`: one known canceled upload-only record plus replacement Bootstrap C, Final C, D7 and D8.
- Maximum provider-started exact-source deployments remains `4`: replacement Bootstrap C, Final C, D7 and D8.
- Cancel authority is one call against the exact rejected record only.
- Replacement Bootstrap authority is one call only; there is no second retry.
- No record deletion, direct API, CLI patch, Vercel-side workaround, source change, migration, data/fixture write, notification, Schedule/config change, other deployment, old-Staging/Ghost-Child mutation or Production action is authorized.

## 5. Stop Conditions

Stop before cancel or replacement if any of these occurs:

- Project, host, source, migration, backup, bucket, Schedule, SMTP, billing or package identity differs.
- The rejected record gains a provider ID or URL, changes to `QUEUED`, `BUILDING` or `READY`, or another deployment record appears.
- Current/default/custom deployment metadata becomes non-null before repair.
- Cancel fails, is ambiguous or does not end as `CANCELED` with provider ID and URL null.
- Replacement deploy fails, is ambiguous, uses a different source/env/metadata contract or does not reach `READY`.
- Any Production marker appears in a write target or payload.

After any stop condition: do not retry, do not call a raw endpoint and do not delete or alter a deployment record directly.

## 6. Verification

Independent QA must inspect read-only evidence after cancel and after replacement Bootstrap C. QA must bind both deployment record IDs/statuses, provider ID/URL, exact commit/tree, non-secret env key names, Release `C + []`, record/provider counters, exact Staging identity and confirmation that no fixture/UAT/Production write occurred.

## 7. Proposed Approval Text

> ผม ภคภพ ช.เจริญยิ่ง อนุมัติ Scope Amendment และ Implementation ตามเอกสาร `GO-LIVE-MVP-INITIAL-OPERATIONS-01 — Lean Staging Bootstrap C Deploy Repair 01 v0.1` และ checksum companion ที่แนบ เฉพาะ Temporary Staging `gisp-lean-staging-20260923` ID `a24aff68-a82e-41da-b64a-a128a1539769`, host marker `5wjnzj4y` อนุญาตให้ตรวจ preflight แบบ read-only แล้ว Cancel ด้วย InsForge CLI มาตรฐานหนึ่งครั้งเฉพาะ deployment record `6efe4540-7e3c-463e-833d-cd90e3164981` เมื่อยังเป็น `UPLOADING`, `providerDeploymentId=null`, `url=null` และยังไม่มี current/default/custom deployment จากนั้นต้องยืนยันสถานะ `CANCELED` และไม่มี drift ก่อนอนุญาตให้ retry replacement Bootstrap C หนึ่งครั้งด้วย exact commit `8b2573729b7d2b8ad750414e1ba86daa633e4218`, tree `9cb01e050462ded9160ac2429667794b27ceaf00`, env/source เดิม และ metadata เดิมที่แก้เฉพาะให้ทุกค่าเป็น string โดย `productionAllowed="false"` อนุญาต backend deployment records/CLI attempts รวมไม่เกิน 5 โดยรายการค้างเดิมเป็นหนึ่ง record แต่ provider-started deployments จริงยังไม่เกิน 4 ตาม Bootstrap C, Final C, D7, D8 หาก Cancel หรือ replacement ล้มเหลว/ไม่แน่นอน identity/hash/history/backup/bucket/schedule/SMTP/billing เปลี่ยน มี provider ID/URL เกิดบน record เดิม หรือมี record อื่นเพิ่ม ให้หยุด ห้าม retry ครั้งที่สอง ห้าม raw API, record deletion, CLI patch, Vercel workaround, fixture/UAT write ก่อน Final C attestation, Migration, notification, Schedule/Config change, old-Staging/Ghost-Child และ Production ทุกกรณี ใช้เวลาของข้อความนี้เป็น `approved_at` กำหนด `deployment_authority: exact cancel once + replacement Bootstrap C once`, `data_authority: None until Final C attestation under the parent plan`, `staging_allowed: exact project only` และ `production_allowed: No`
