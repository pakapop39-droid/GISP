# GO-LIVE-MVP-INITIAL-OPERATIONS-01 — Migration Shape Diagnostic Auth Bootstrap 06A v0.1

วันที่จัดทำ: 2026-09-24 (Asia/Bangkok)  
สถานะ: รอเจ้าของอนุมัติ Scope Amendment และ Stage B Execution  
ระดับความเสี่ยง: T3 Sensitive — Authentication และ External Network แบบจำกัด  
Production: ไม่อนุญาต

## 1. เหตุผลและทางเลือกที่เลือก

Stage A Migration Shape Diagnostic ผ่าน Independent QA แล้ว แต่ credential ปัจจุบันเป็น `VALID_SHORT` คือยังไม่หมดอายุแต่เหลือน้อยกว่า 45 นาที จึงหยุดก่อน marker และ Network ตามที่ออกแบบไว้

เลือกวิธี Lean ที่สุด:

1. รอ JWT หมดอายุตามธรรมชาติ
2. ใช้ official pinned CLI `whoami --json` หนึ่งครั้ง เพื่อให้ระบบใช้ refresh token ตามมาตรฐาน
3. ตรวจว่า User ID ตรงและ JWT ใหม่เหลืออย่างน้อย 45 นาที
4. รัน frozen one-command Migration Shape Diagnostic ภายใน 5 นาที

ไม่เลือก Device Login เพราะต้องเพิ่ม browser interaction, polling, `pending-device.json` และ transport contract ใหม่ และไม่เลือกการลบ/แก้ access token หรือเรียก OAuth endpoint โดยตรงเพื่อบังคับ refresh

## 2. หลักฐานและ Candidate Binding

- Stage A Independent QA SHA-256: `8E073317B5076A4F0C53DDE551CF0E820C9FC4F52D2933A74479625C50A6B062`
- Diagnostic source SHA-256: `5EEFE437154C77A18F147013288634998DC76F3D6C9904217549E8E747AD9BDD`
- Diagnostic test SHA-256: `11297C79B115BD8CD09A1B0843C5369C9AA69E65C424075492039FCE5DB9CCBF`
- Diagnostic manifest SHA-256: `72DBF30C63003D91B94CCBE03174705A0702D8CAB4DF19F8191821B3521820DE`
- CLI entrypoint SHA-256: `AF352BF5F5DD5FFB5F6A5FA3C15CC95F2BC428DB30642FF5FCBDC372A568B815`

ห้ามแก้หรือ re-seal Candidate ก่อน execution

## 3. Exact Target

- Temporary Staging: `gisp-lean-staging-20260923`
- Project ID: `a24aff68-a82e-41da-b64a-a128a1539769`
- Host marker: `5wjnzj4y`
- Context: `C:\codex\GISP\.insforge-audit-lean-staging-new`
- Expected User ID: `f3a87026-c41d-4ba0-83cf-e150a9ba1f93`
- Diagnostic ID: `glmvp-migration-shape-01-79b0b68d-4c58-4384-aedc-7cdf48fc87d2`

## 4. Credential State Gate

อนุญาต Local sanitized preflight ซ้ำได้โดยไม่สร้าง marker:

- `VALID_SUFFICIENT`: ข้าม Auth Network และรัน Diagnostic ได้ทันที
- `VALID_SHORT`: หยุดและรอจนหมดอายุ ห้ามบังคับ refresh
- `EXPIRED_REFRESH_ALLOWED`: ทำ Auth bootstrap ได้เมื่อ identity และ refresh-token presence ตรง
- state อื่น: หยุด

ห้ามแสดง token, email, raw credential, exact expiry หรือ value-derived hash

## 5. Exact Auth Bootstrap

- Executable: `C:\Program Files\nodejs\node.exe`
- CLI: pinned `@insforge/cli@0.2.8` entrypoint ตาม hash ในข้อ 2
- Command: `whoami --json`
- `shell: false`
- offline/no registry/no fallback
- ใช้ frozen auth transport preload ที่ผ่าน QA แล้ว
- อนุญาตหนึ่ง invocation เท่านั้น และถือว่าสิทธิ์ถูกใช้ทันทีที่ spawn

Network ceiling:

- GET `https://api.insforge.dev/auth/v1/profile`: ไม่เกิน 2 ครั้ง
- POST `https://api.insforge.dev/api/oauth/v1/token`: ไม่เกิน 1 ครั้ง และต้องเป็น standard refresh-token grant ตาม exact guard
- PostHog v0 `https://us.i.posthog.com/batch/`: ไม่เกิน 1 event ของ `whoami`
- ไม่มี InsForge Usage telemetry
- endpoint, method, redirect หรือ event อื่นต้องถูกบล็อก

Local write authority:

- official CLI rewrite ได้เฉพาะ `C:\Users\ASUS\.insforge\credentials.json` หนึ่งครั้ง รวม rotated refresh token หากระบบส่งคืน
- ห้าม manual edit, delete หรือ rename credential
- ห้ามสร้าง `pending-device.json`
- raw profile/stdout/stderr อยู่ใน memory และต้องถูกทิ้ง ห้าม echo, persist หรือ hash

## 6. Immediate Diagnostic Sequence

หลัง Auth สำเร็จ:

1. ตรวจ Local แบบ sanitized ว่า User ID ตรง, refresh token มี, User API key ไม่มี และ JWT เหลืออย่างน้อย 45 นาที
2. เริ่ม frozen Diagnostic ภายใน 5 นาที
3. Diagnostic ใช้ Stage B contract, endpoint/telemetry ceiling, shape-only evidence และ one-shot/no-retry marker ที่อนุมัติเดิมทั้งหมด
4. Diagnostic ยังคงห้าม OAuth, profile และ refresh
5. หลังจบให้ Independent QA ตรวจ sanitized evidence ก่อน Parser Repair

## 7. Stop Conditions

หยุดโดยไม่ retry และไม่ fallback เมื่อ:

- JWT ยังเป็น `VALID_SHORT`
- identity, refresh-token state, hash, path, context หรือ target ไม่ตรง
- พบ User API key หรือ `pending-device.json`
- มี InsForge CLI process อื่น
- Auth invocation ล้มเหลวหรือไม่ทราบแน่ว่าถูกใช้แล้วหรือไม่
- Network/telemetry เกิน exact ceiling
- หลัง refresh JWT ยังไม่ถึง 45 นาที
- ไม่สามารถทิ้ง raw output ได้อย่างแน่นอน
- Diagnostic marker/path มีอยู่แล้ว
- เริ่ม Diagnostic ไม่ทัน 5 นาที
- Frozen Candidate hash เปลี่ยน

ห้าม Device/Browser/Email Login, User API Key fallback และห้ามรัน Diagnostic ซ้ำ

## 8. ข้อห้าม

- Candidate/source change หรือ re-seal
- Network Evidence Session ใหม่
- Accounts/Auth user/business-data write
- Deploy/redeploy
- Migration apply/DDL/ACL
- Config, secret, schedule หรือ notification change/send/retry
- Backup/restore
- Cleanup/delete
- Staging อื่น, Ghost Child และ Production ทุกกรณี

## 9. Acceptance Criteria

- `AUTH-06A-01`: Auth Network เริ่มได้เฉพาะ `EXPIRED_REFRESH_ALLOWED`
- `AUTH-06A-02`: exact one guarded `whoami --json` invocation อยู่ภายใน ceiling
- `AUTH-06A-03`: official CLI เขียนได้เฉพาะ credentials file และไม่มี raw output persistence
- `AUTH-06A-04`: post-auth identity ตรงและ JWT ≥45 นาที
- `AUTH-06A-05`: frozen Diagnostic เริ่มภายใน 5 นาที หรือหยุดโดยไม่ retry
- `AUTH-06A-06`: Independent QA ตรวจ sanitized Diagnostic evidence ก่อน Parser Repair

## 10. Exact Approval Text

> ผม ภคภพ ช.เจริญยิ่ง อนุมัติ Scope Amendment และ Stage B Execution ตามเอกสาร `GO-LIVE-MVP-INITIAL-OPERATIONS-01 — Migration Shape Diagnostic Auth Bootstrap 06A v0.1` และ checksum companion ที่แนบ โดยอ้างอิง Stage A Independent QA SHA-256 `8E073317B5076A4F0C53DDE551CF0E820C9FC4F52D2933A74479625C50A6B062` เฉพาะ Temporary Staging `gisp-lean-staging-20260923` Project ID `a24aff68-a82e-41da-b64a-a128a1539769`, host `5wjnzj4y`, context `C:\codex\GISP\.insforge-audit-lean-staging-new`, User ID `f3a87026-c41d-4ba0-83cf-e150a9ba1f93` และ Diagnostic ID `glmvp-migration-shape-01-79b0b68d-4c58-4384-aedc-7cdf48fc87d2` เท่านั้น ยืนยัน frozen candidate hashesตามข้อ 2 และห้ามแก้ไฟล์หรือ re-seal ก่อน execution ก่อน Network อนุญาต Local sanitized credential preflight ซ้ำได้โดยไม่สร้าง marker หากเป็น `VALID_SUFFICIENT` ให้ข้าม Auth Network และรัน Diagnostic ตาม contractเดิมทันที หากเป็น `VALID_SHORT` ให้หยุดและรอจนหมดอายุ ห้ามบังคับ refresh หากเป็น `EXPIRED_REFRESH_ALLOWED` และ identity/refresh-token presenceตรง อนุมัติ exact direct Node+pinned `@insforge/cli@0.2.8 whoami --json` หนึ่ง invocation ผ่าน frozen auth transport preload โดยอนุญาตเฉพาะ Profile GET ไม่เกินสองครั้ง, standard OAuth refresh POST ไม่เกินหนึ่งครั้ง และ PostHog v0 whoami event ไม่เกินหนึ่งครั้ง อนุญาต official CLI rewrite เฉพาะ `C:\Users\ASUS\.insforge\credentials.json` และห้าม persist/echo raw token, email, profile, stdout หรือ stderr หลัง Auth สำเร็จต้องตรวจ User ID ตรงและ JWT ≥45 นาที แล้วเริ่ม frozen one-command Migration Shape Diagnostic ภายใน5นาทีตาม Stage B contractเดิม หากล้มเหลวหรือผลไม่ชัดให้หยุดโดยไม่ retryและห้าม Device/Browser/Email Login/User API Key fallback หลัง Diagnostic ให้ Independent QA ตรวจ sanitized evidenceก่อน Parser Repair ไม่อนุญาต candidate/source change, Network Evidence Session ใหม่, Accounts, business-data write, Deploy, Migration apply, Config/Secret/Schedule, Notification, Backup/Restore, Cleanup/Delete, Stagingอื่นหรือ Production ใช้เวลาของข้อความอนุมัติเป็น `approved_at`; `data_authority: Local credentials.json rewrite by official refresh plus already-approved sanitized diagnostic markers/result only`, `migration_authority: None`, `network_authority: At most one bounded official whoami refresh when expired plus the already-approved one-command diagnostic`, `staging_allowed: Read-only diagnostic only` และ `production_allowed: No`

## 11. ขั้นตอนที่เหลือ

เพื่อปิด Diagnostic/Parser Repair Slice เหลือ 4 ขั้นตอน:

1. เจ้าของอนุมัติ Amendment นี้
2. รอ JWT หมดอายุหากยัง `VALID_SHORT` แล้วทำ Auth bootstrap + Diagnostic one-shot
3. Independent QA ตรวจ sanitized Shape Evidence
4. หาก additive-only gate ผ่าน ให้แก้ Parser/re-seal และ Independent QA ตรวจ
