# GO-LIVE-MVP-INITIAL-OPERATIONS-01 — Network Evidence Session 03 Session/Auth Amendment 01 v0.1

## 1. จุดประสงค์

แก้ Blocker สองจุดของ Network Evidence Session ครั้งที่ 3 โดยไม่ขยายไปถึง Accounts, ข้อมูลธุรกิจ, Deploy, Migration หรือ Production:

1. เปลี่ยน Session ID และ path ให้ตรงกับ contract ของ Collector ที่ผ่าน Independent QA แล้ว
2. อนุญาตการต่ออายุ Authentication หนึ่งครั้งก่อนเริ่ม Evidence Session โดยระหว่าง Evidence Session ยังคงห้าม OAuth refresh

งานนี้เป็น `T3 Sensitive` เพราะเกี่ยวข้องกับ Authentication และ External Network contract

## 2. Source binding ที่คงเดิม

- Temporary Staging: `gisp-lean-staging-20260923`
- Project ID: `a24aff68-a82e-41da-b64a-a128a1539769`
- Organization ID: `e93668ea-e8ab-4361-9872-282454438478`
- Host / region / tier / plan: `5wjnzj4y` / `ap-southeast` / `nano` / `pro`
- Candidate commit/tree: `8b2573729b7d2b8ad750414e1ba86daa633e4218` / `9cb01e050462ded9160ac2429667794b27ceaf00`
- Parent document SHA-256: `8FC521312494FFF70B649100C1367684FF1F931506682BDC95F7A338F6531BC4`
- Collector aggregate SHA-256: `AD4890F8E742A328030F1725BABAA1D8BE0F05B4096416F76E3F98CDD0C228DC`
- Auth User ID ที่ต้องตรง: `f3a87026-c41d-4ba0-83cf-e150a9ba1f93`
- Pinned CLI: offline `@insforge/cli@0.2.8` และ hashes ตาม Parent document

Collector ทั้ง 5 ไฟล์และ QA เดิมต้องไม่ถูกแก้ หาก hash ใดเปลี่ยนให้หยุดและขออนุมัติใหม่

## 3. Session binding ที่แก้ไข

- Exact Session ID: `glmvp-accounts-ro2-e4f9cac1-8d03-4ae9-80f9-0ecc445cc27c`
- Exact directory: `.codex-tmp/lean-staging-execution/runs/glmvp-accounts-ro2-e4f9cac1-8d03-4ae9-80f9-0ecc445cc27c/`
- Auth markers:
  - `AUTH-RENEWAL-STARTED.json`
  - `AUTH-RENEWAL-COMPLETED.json`
- Evidence markers:
  - `STARTED.json`
  - `STOPPED.json`
  - `FINAL-EVIDENCE.json`
  - `FINAL-EVIDENCE.payload.json`
  - `FINAL-EVIDENCE.commit-ready.json`

ทุก marker ต้องสร้างแบบ create-exclusive (`wx`) และ `fsync` ตามลำดับที่กำหนด ห้ามเขียนทับ path เดิม

## 4. Stage A — Exact Local file allow-list

Builder แก้หรือสร้างได้เฉพาะ:

1. `.codex-tmp/lean-staging-execution/accounts-readonly-cli-adapter-v2.mjs`
2. `.codex-tmp/lean-staging-execution/accounts-readonly-cli-adapter-v2.test.mjs`
3. `.codex-tmp/lean-staging-execution/ACCOUNTS-READONLY-NETWORK-MANIFEST.json`

Stage A ต้องไม่มี Network และใช้ injected process/network adapters ใน tests เท่านั้น Adapter และ Manifest ต้องเพิ่ม contract ต่อไปนี้:

- Pre-session `whoami` ได้หนึ่ง invocation และห้าม retry/fallback
- ตรวจ exact CLI/hash/context/session/identity แบบ fail closed
- ไม่ log หรือ persist token, refresh token, email หรือ raw profile
- Main Evidence Session ต้องมี transport guard ที่บล็อก OAuth refresh endpoint ก่อนออก Network หลังสร้าง `STARTED.json`
- Transport guard ต้องอยู่ภายใน exact Adapter file scope และทดสอบแบบ injected โดยไม่เพิ่ม runtime source file
- หาก main command ได้ `401` ต้องสร้าง `STOPPED.json` และหยุดโดยไม่ retry
- Manifest ต้อง pin Parent document SHA, Amendment SHA, Collector hashes/aggregate, Adapter/Test hashes, Session paths, Auth ceilings และ Main telemetry ceilings

Independent QA ต้องตรวจ Stage A แบบไม่มี Network และรายงาน PASS ก่อน Auth Bootstrap หรือ Evidence Session

## 5. Pre-session Authentication Renewal

หลัง Stage A QA PASS และก่อนสร้าง main `STARTED.json` ให้ Adapter ทำตามลำดับ:

1. ตรวจ CLI hashes, context, Auth marker collision และไม่มี InsForge CLI process อื่นกำลังทำงาน
2. สร้าง `AUTH-RENEWAL-STARTED.json` แบบ `wx` + `fsync`
3. รันหนึ่งครั้งด้วย `shell:false` และ `npm_config_offline=true`:

   `npx --offline -y @insforge/cli@0.2.8 whoami --json`

4. อนุญาตเฉพาะผลอัตโนมัติจาก invocation นี้:
   - GET `https://api.insforge.dev/auth/v1/profile` ไม่เกิน 2 ครั้ง
   - POST `https://api.insforge.dev/api/oauth/v1/token` ไม่เกิน 1 ครั้ง เฉพาะ standard `grant_type=refresh_token`
   - POST `https://us.i.posthog.com/batch/` ไม่เกิน 1 ครั้ง เฉพาะ command event/selector ของ `whoami`
   - Local credential update โดย official CLI เฉพาะ `C:\Users\ASUS\.insforge\credentials.json`
5. ตรวจใน Local ว่า User ID ตรง `f3a87026-c41d-4ba0-83cf-e150a9ba1f93` และ JWT เหลืออายุอย่างน้อย 45 นาที
6. สร้าง `AUTH-RENEWAL-COMPLETED.json` แบบ sanitized และ `fsync`
7. เริ่ม main Evidence Session ภายใน 5 นาทีหลัง Auth renewal สำเร็จ

ห้ามแสดงหรือบันทึก credential, token, refresh token, email หรือ raw profile ห้าม registry access, retry, Device Login, Browser Login, Email Login และ User API Key fallback หากขั้นใดล้มเหลวหรือไม่ชัดเจน ให้หยุดและห้ามสร้าง main `STARTED.json`

## 6. Main Evidence Session

หลัง `AUTH-RENEWAL-COMPLETED.json` ผ่านทุก gate จึงเริ่ม main Session ตาม Parent document:

- ใช้ exact read-only command plan 13 คำสั่งเดิม อย่างละหนึ่งครั้งและตามลำดับ
- Main telemetry maxima เดิม: InsForge usage ไม่เกิน 5 และ PostHog ไม่เกิน 13
- Auth traffic และ `whoami` ไม่เป็นส่วนหนึ่งของ Main evidence และห้ามเกิดซ้ำ
- หลัง `STARTED.json` ห้าม OAuth refresh ทุกกรณี; Adapter transport guard ต้องบล็อกก่อน Network
- หากพบ `401`, identity/hash/path/command/telemetry/billing/usage/evidence ไม่ตรง หรือผลไม่ชัด ให้สร้าง `STOPPED.json` และหยุดโดยไม่ retry
- Final evidence ใช้ได้ต่อเมื่อ verifier ผ่าน, ไม่มี `STOPPED.json` และ Independent QA หลัง Session รายงาน PASS

## 7. ข้อห้ามที่คงเดิม

- ห้าม Runner phase `accounts` และ `GLMVP_STAGING_WRITE`
- ห้าม RPC, business/data write, POST ธุรกิจ, PUT/PATCH/DELETE
- ห้าม Deploy/redeploy, Migration apply, Config/Secret/Schedule change, Notification, Backup create/Restore, Cleanup/Delete
- ห้าม Staging เก่า, Ghost Child และ Production
- ห้าม retry Auth Bootstrap หรือ Main Session
- Accounts execution ต้องขออนุมัติแยกภายหลัง

## 8. Acceptance criteria

- `AC-SAUTH-01`: Session ID และทุก path ใช้ exact prefixed value ตรงกัน
- `AC-SAUTH-02`: Collector 5-file hashes และ aggregate เดิมยังตรง
- `AC-SAUTH-03`: Stage A tests พิสูจน์ Auth renewal one-shot, no fallback, no secret logging และ fail closed
- `AC-SAUTH-04`: Stage A tests พิสูจน์ว่า OAuth refresh หลัง main `STARTED` ถูกบล็อกก่อน Network
- `AC-SAUTH-05`: Independent QA Stage A เป็น PASS ก่อน Network
- `AC-SAUTH-06`: Renewed JWT ตรง exact User ID, อายุคงเหลืออย่างน้อย 45 นาที และ main Session เริ่มภายใน 5 นาที
- `AC-SAUTH-07`: Main Session ไม่มี OAuth refresh และคำสั่ง/telemetry ไม่เกิน ceiling
- `AC-SAUTH-08`: Final evidence ผ่าน verifier, ไม่มี STOPPED และ Final Independent QA เป็น PASS

## 9. Exact approval text

> ผม ภคภพ ช.เจริญยิ่ง อนุมัติ Scope Amendment และ Implementation ตามเอกสาร `GO-LIVE-MVP-INITIAL-OPERATIONS-01 — Network Evidence Session 03 Session/Auth Amendment 01 v0.1` และ checksum companion ที่แนบ โดยแก้ Session ID เป็น `glmvp-accounts-ro2-e4f9cac1-8d03-4ae9-80f9-0ecc445cc27c` และใช้ exact Auth/STARTED/STOPPED/FINAL paths ใต้ directory ของ Session ID ใหม่นี้ ยืนยันให้คง Collector 5 ไฟล์และ aggregate SHA-256 `AD4890F8E742A328030F1725BABAA1D8BE0F05B4096416F76E3F98CDD0C228DC` โดยไม่แก้ไข อนุมัติให้แก้เฉพาะ Local CLI Adapter 2 ไฟล์และ Network Manifest 1 ไฟล์ตาม file allow-list เพื่อรองรับ Pre-session Authentication Renewal และ Main-session OAuth transport guard และให้ Independent QA ตรวจแบบไม่มี Network ก่อน
>
> หลัง Stage A QA ผ่าน อนุมัติให้รัน pinned offline `@insforge/cli@0.2.8 whoami --json` หนึ่งครั้งก่อนสร้าง main `STARTED.json` เพื่อใช้ OAuth refresh เดิม โดยอนุญาต GET `https://api.insforge.dev/auth/v1/profile` ไม่เกินสองครั้ง, POST `https://api.insforge.dev/api/oauth/v1/token` ไม่เกินหนึ่งครั้งเฉพาะ refresh-token grant, POST `https://us.i.posthog.com/batch/` ไม่เกินหนึ่งครั้งเฉพาะ event ของ `whoami` และอนุญาตให้ official CLI แก้เฉพาะ `C:\Users\ASUS\.insforge\credentials.json` ห้ามแสดงหรือบันทึก credential, token, refresh token, email หรือ raw profile ห้าม retry, Device/Browser/Email Login, User API Key fallback และ Registry access หาก renewal ล้มเหลวหรือ identity ไม่ตรงให้หยุด
>
> หลัง renewal ต้องยืนยันใน Local ว่า User ID เป็น `f3a87026-c41d-4ba0-83cf-e150a9ba1f93`, JWT เหลืออายุอย่างน้อย 45 นาที และเริ่ม Evidence Session ภายใน 5 นาที ระหว่าง Evidence Session ยังคงห้าม OAuth refresh ทุกกรณี โดย Adapter ต้องบล็อก refresh endpoint ก่อนออก Network หากพบ 401, identity/hash/path/command/telemetry/billing/usage/evidence ไม่ตรง หรือผลไม่ชัด ให้สร้าง STOPPED และหยุดโดยไม่ retry ข้อห้ามและขอบเขตอื่นทั้งหมดของ Network Evidence Session ครั้งที่ 3 v0.1 ยังคงเดิม Accounts execution ต้องขออนุมัติแยก ใช้เวลาของข้อความนี้เป็น `approved_at` กำหนด `data_authority: None`, `migration_authority: None`, `auth_authority: Exact one pre-session OAuth refresh through pinned whoami only`, `network_authority: Exact bounded pre-session auth calls plus the previously approved one read-only evidence session`, `staging_allowed: Read-only evidence session only` และ `production_allowed: No`

## 10. เงื่อนไขการปิด Slice

Slice ปิดเมื่อ Stage A QA ผ่าน และ Main Evidence Session ได้ Final evidence ที่ Independent QA รับรอง หรือหยุดแบบ Fail Closed โดยไม่มี Backend/Staging/Production data write
