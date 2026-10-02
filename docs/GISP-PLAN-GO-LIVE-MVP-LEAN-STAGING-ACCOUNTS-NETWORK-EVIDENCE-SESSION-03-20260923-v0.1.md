# GO-LIVE-MVP-INITIAL-OPERATIONS-01 — Network Evidence Session สำหรับ Accounts ครั้งที่ 3 v0.1

## 1. จุดประสงค์

อนุญาตแบบมีเงื่อนไขให้สร้างตัวเชื่อม CLI ใน Local, ให้ Independent QA ตรวจ และเมื่อ QA ผ่านจึงรัน Preflight/Billing แบบอ่านอย่างเดียวบน Temporary Staging ได้หนึ่ง session เพื่อสร้างหลักฐานใหม่สำหรับการพิจารณา Accounts Execution ภายหลัง

เอกสารนี้ **ไม่อนุญาตให้รัน Accounts หรือเขียนข้อมูลธุรกิจ**

## 2. Exact target และ source binding

- Temporary Staging: `gisp-lean-staging-20260923`
- Project ID: `a24aff68-a82e-41da-b64a-a128a1539769`
- Organization ID: `e93668ea-e8ab-4361-9872-282454438478`
- Host marker: `5wjnzj4y`
- Region / tier / plan: `ap-southeast` / `nano` / exact lowercase `pro`
- CLI context: `C:\codex\GISP\.insforge-audit-lean-staging-new`
- Candidate commit/tree: `8b2573729b7d2b8ad750414e1ba86daa633e4218` / `9cb01e050462ded9160ac2429667794b27ceaf00`
- Sealed runner semantic SHA-256: `2ABC5F6256AB15BB389D813FE7BCACC641C4E08F00F3EE2201E99A5D8AEF770D`
- Sealed runner aggregate SHA-256: `1155EFD89BDEB01ACD97BE1D1B535F45F093034A3BEEA3100C6979D5B0D6E73F`

## 3. Exact Local Collector ที่ผ่าน QA

- `accounts-readonly-evidence-session-v2.mjs`: `06B3EBCEE2734F91DC339F8B7C1BC7096BB61437999F836FEB3F68805BF3C544`
- `accounts-readonly-session-contract.mjs`: `8D4CB611D94490051ADF11677147799577FD1B1FF9D57CE083CA5283C5FC97BA`
- `accounts-readonly-telemetry-contract.mjs`: `470410956A453AC5A0F471B5A9B39E5E41A0E13FB9EB74E385A505F347E9F4BC`
- `accounts-readonly-evidence-session-v2.test.mjs`: `F53740B1E99D970C0B2FAEA5D4EFCC57964D1352F43E1B38E4640F44BE8C2D18`
- `ACCOUNTS-READONLY-SESSION-CONTRACT.md`: `23B5C70900C7011DABA00B50E19FB5D1341FD55919AF890A7693BA01DD5A8172`
- Collector aggregate: `AD4890F8E742A328030F1725BABAA1D8BE0F05B4096416F76E3F98CDD0C228DC`
- Final Independent QA report SHA-256: `1BB2AF318AC0E961CECDFAF6BF06069062CD646CB81E00460B3E72B20C50936F`

## 4. Stage A — Local CLI Adapter และ QA

อนุญาตให้ Builder สร้างเฉพาะ:

1. `.codex-tmp/lean-staging-execution/accounts-readonly-cli-adapter-v2.mjs`
2. `.codex-tmp/lean-staging-execution/accounts-readonly-cli-adapter-v2.test.mjs`
3. `.codex-tmp/lean-staging-execution/ACCOUNTS-READONLY-NETWORK-MANIFEST.json`

Stage A ต้องไม่มี Network และใช้ injected process adapter ใน tests เท่านั้น ตัว adapter ต้อง:

- เรียกเฉพาะ `npx --offline -y @insforge/cli@0.2.8` ด้วย `shell:false`
- Pin entrypoint/package/cache-lock hashes ตาม Local Collector contract และห้าม registry access
- รับเฉพาะ command token arrays ที่ Collector อนุญาต
- ไม่รับ `memory list`, `--sync`, RPC, mutation verb หรือ flag เพิ่ม
- ตรวจ Local authentication expiry/availability ก่อน session โดยไม่ส่งเครือข่าย และหยุดก่อน Network หากมีความเสี่ยงต้อง refresh
- ไม่ log token, key, raw credential หรือ raw business data
- Manifest ต้อง pin exact adapter file hashes, collector hashes, command plan, telemetry maxima และ Session paths

Independent QA ต้องตรวจ Stage A แบบไม่มี Network และรายงาน PASS ก่อน Stage B หาก QA ไม่ผ่าน Stage B ไม่ได้รับอนุญาต

## 5. Stage B — Exact one Network session

- Session ID: `e4f9cac1-8d03-4ae9-80f9-0ecc445cc27c`
- Session directory: `.codex-tmp/lean-staging-execution/runs/e4f9cac1-8d03-4ae9-80f9-0ecc445cc27c/`
- STARTED: `STARTED.json`
- STOPPED: `STOPPED.json`
- Final evidence commit: `FINAL-EVIDENCE.json`

ก่อน network call แรกต้องตรวจ exact hashes ทั้งหมดและสร้าง STARTED แบบ `wx` + `fsync` สำเร็จ หาก path ชน, auth อาจต้อง refresh, hash/identity/manifest ไม่ตรง หรือ QA Stage A ไม่ผ่าน ต้องหยุดโดย network call เป็นศูนย์

อนุญาต exact read-only CLI plan หนึ่งครั้งต่อคำสั่ง:

1. `current --json`
2. `projects get --project <exact Project ID> --json`
3. `billing status --org-id <exact Organization ID> --json`
4. `billing credits --org-id <exact Organization ID> --json`
5. `usage --org-id <exact Organization ID> --json`
6. `schedules list --json`
7. `metadata --json`
8. `db migrations list --json`
9. `backups list --project <exact Project ID> --json`
10. `secrets list --all --json`
11. `storage buckets --json`
12. `deployments list --json`
13. `deployments status <exact READY Deployment ID> --json` โดยห้าม `--sync`

## 6. Automatic CLI telemetry ที่อนุญาตเฉพาะ Session นี้

เนื่องจาก CLI `0.2.8` ส่ง telemetry อัตโนมัติ อนุญาตเฉพาะ:

- ไม่เกิน 5 POST ไปยัง `https://5wjnzj4y.ap-southeast.insforge.app/api/usage/mcp` โดย payload ต้องมีเพียง `{tool_name, success, timestamp}` และ tool ต้องตรงกับ `migrations`, `buckets`, `secrets`, `schedules`, `metadata` อย่างละไม่เกินหนึ่งครั้ง
- ไม่เกิน 13 POST ไปยัง `https://us.i.posthog.com/batch/` เฉพาะ command event/selector ที่ตรงกับ exact command plan อย่างละไม่เกินหนึ่งครั้ง

ห้าม OAuth refresh POST, `/api/memory/index`, host/path/payload อื่น, telemetry ซ้ำเกินจำนวน, Deployment sync และ business/data POST หาก CLI ต้อง refresh authentication หรือ contract ไม่สามารถยืนยันได้ ให้หยุดก่อน session โดยไม่เรียก Network

## 7. Evidence gates

- Migration ต้องมี `38` รายการและ head `20260923090000_startup-initial-operations-guard.sql`
- SMTP=false, Active Schedule=0, Bucket topology ตรง และ Deployment exact `READY`
- Billing และ Usage ต้องรายงาน plan exact lowercase `pro`; Project exact `nano`; projected incremental cost รวมไม่เกิน USD 10
- ทุก Usage row และ metric ต้องผ่าน contract; normalized evidence ห้ามเก็บ identity/metric ของ Project อื่น
- หากคำสั่งใดล้มเหลวหรือผลไม่ชัด ให้สร้าง STOPPED และห้าม finalize evidence
- Final evidence ใช้ได้เมื่อ `verifyFinalEvidenceCommit()` ผ่าน, ไม่มี STOPPED และ Independent QA หลัง session รายงาน PASS เท่านั้น
- Billing evidence/session นี้ยังไม่อนุญาต Accounts โดยอัตโนมัติ

## 8. สิ่งที่ห้าม

- ห้าม Runner phase `accounts` และ `GLMVP_STAGING_WRITE`
- ห้าม Auth/Organization/Member/data write, RPC, POST ธุรกิจ, PUT/PATCH/DELETE
- ห้าม Deploy/redeploy, Migration apply, Config/Secret/Schedule change, Notification, Backup create/Restore, Cleanup/Delete
- ห้าม Staging เก่า, Ghost Child และ Production
- ห้าม retry session นี้ หาก STOPPED หรือผลไม่ชัด ต้องขอ authorization ใหม่

## 9. ข้อความเสนอเพื่ออนุมัติ

> ผม ภคภพ ช.เจริญยิ่ง อนุมัติ Scope Amendment และ Implementation ตามเอกสาร `GO-LIVE-MVP-INITIAL-OPERATIONS-01 — Network Evidence Session สำหรับ Accounts ครั้งที่ 3 v0.1` และ checksum companion ที่แนบ เฉพาะ Temporary Staging `gisp-lean-staging-20260923` Project ID `a24aff68-a82e-41da-b64a-a128a1539769`, Organization ID `e93668ea-e8ab-4361-9872-282454438478`, host `5wjnzj4y`, region `ap-southeast`, tier `nano`, plan `pro` อนุมัติ Stage A ให้สร้าง exact Local CLI Adapter 2 ไฟล์และ Network Manifest 1 ไฟล์ตามเอกสารโดยไม่มี Network และให้ Independent QA ตรวจ เมื่อ Stage A QA ผ่านเท่านั้น อนุมัติ Stage B สำหรับ Session ID `e4f9cac1-8d03-4ae9-80f9-0ecc445cc27c` หนึ่งครั้ง โดยใช้ exact Collector aggregate `AD4890F8E742A328030F1725BABAA1D8BE0F05B4096416F76E3F98CDD0C228DC`, exact read-only command plan, pinned offline `@insforge/cli@0.2.8`, Local STARTED/STOPPED/FINAL paths และ automatic telemetry ตามข้อ 6 เท่านั้น ห้าม OAuth refresh, `memory list`, `--sync`, registry, RPC, business/data write, Accounts runner, Deploy, Migration apply, Config/Secret/Schedule change, Notification, Backup create/Restore, Cleanup/Delete, Staging เก่า, Ghost Child และ Production หาก identity/hash/auth/plan/tier/cost/command/telemetry/evidence ไม่ตรงหรือผลไม่ชัด ให้หยุดโดยไม่ retry หลัง session ต้องให้ Independent QA ตรวจหลักฐาน และ Accounts execution ต้องขออนุมัติแยกอีกครั้ง ให้ใช้เวลาของข้อความนี้เป็น `approved_at` กำหนด `data_authority: None`, `migration_authority: None`, `network_authority: Exact read-only CLI commands plus bounded automatic telemetry for one named session only`, `staging_allowed: Read-only evidence session only` และ `production_allowed: No`

## 10. เงื่อนไขการปิด Slice

Slice นี้ปิดเมื่อ Stage A QA ผ่านและ Stage B ได้ Final evidence ที่ Independent QA รับรอง หรือหยุด Fail Closed โดยไม่มีการเขียน Backend/Staging/Production
