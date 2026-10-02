# GO-LIVE-MVP-INITIAL-OPERATIONS-01 — One-Command Migration Row Shape Diagnostic and Conditional Local Parser Repair 06 v0.1

วันที่จัดทำ: 2026-09-24 (Asia/Bangkok)  
สถานะ: รอเจ้าของอนุมัติ Scope และ Implementation  
ระดับความเสี่ยง: T3 Sensitive — อ่านข้อมูลโครงสร้างจาก Backend ภายนอกหนึ่งครั้ง  
Production: ไม่อนุญาต

## 1. จุดประสงค์

แก้สาเหตุที่ Network Evidence Session 05 หยุดด้วย `MIGRATION_ROW` ด้วยวิธีที่เล็กและปลอดภัยที่สุด:

1. อ่านรายการ migration ด้วยคำสั่งมาตรฐานเพียงหนึ่งครั้ง
2. ไม่เก็บค่าของ migration แต่เก็บเฉพาะชื่อฟิลด์ ชนิดข้อมูล และจำนวนครั้งที่ฟิลด์ปรากฏ
3. ให้ Independent QA ตรวจหลักฐาน
4. แก้ Local parser เฉพาะเมื่อหลักฐานพิสูจน์ว่าเป็นเพียง metadata fields เพิ่มเติม โดยไม่ผ่อน validation เดิม

เอกสารนี้ไม่อนุญาตให้รัน Network Evidence Session ใหม่ ไม่อนุญาต Accounts execution และไม่อนุญาต Production

## 2. หลักฐานตั้งต้น

- Source commit: `8b2573729b7d2b8ad750414e1ba86daa633e4218`
- Source tree: `9cb01e050462ded9160ac2429667794b27ceaf00`
- Session 05: `glmvp-accounts-ro2-c6074126-949a-400e-981d-cafcc9ee40fc` ถูกใช้แล้วและห้าม retry
- Incident QA SHA-256: `A3AE81D1624F684579448B3763D42D082D697B40BD7DF31F45506A3F4FA0361A`
- Session 05 ยืนยันแล้วว่า migration count = 38 แต่มีอย่างน้อยหนึ่ง row ไม่ผ่าน strict parser
- ไม่มี raw CLI output เหลืออยู่ จึงห้ามเดารูปแบบข้อมูลหรือผ่อน parser แบบกว้าง

## 3. Environment และ Identity ที่อนุญาต

- Temporary Staging: `gisp-lean-staging-20260923`
- Project ID: `a24aff68-a82e-41da-b64a-a128a1539769`
- Host marker: `5wjnzj4y`
- Region: `ap-southeast`
- CLI context: `C:\codex\GISP\.insforge-audit-lean-staging-new`
- Expected User ID: `f3a87026-c41d-4ba0-83cf-e150a9ba1f93`
- Diagnostic ID: `glmvp-migration-shape-01-79b0b68d-4c58-4384-aedc-7cdf48fc87d2`

หาก identity, context, host, Project ID หรือ Production marker ไม่ตรง ต้องหยุดก่อน Network

## 4. Stage A — Local Diagnostic Package

อนุญาตให้ Builder สร้างเฉพาะไฟล์ต่อไปนี้ใน Local isolated worktree:

1. `.codex-tmp/lean-staging-execution/accounts-migration-shape-diagnostic-v1.mjs`
2. `.codex-tmp/lean-staging-execution/accounts-migration-shape-diagnostic-v1.test.mjs`
3. `.codex-tmp/lean-staging-execution/ACCOUNTS-MIGRATION-SHAPE-DIAGNOSTIC-MANIFEST.json`

ข้อกำหนด:

- ใช้ Local synthetic mocks เท่านั้น
- default network adapter ต้อง fail closed
- pin Node executable, CLI entrypoint, CLI version/hash, target, command, endpoint และ telemetry ceiling แบบ exact
- raw stdout/stderr อยู่ใน bounded process memory ไม่เกิน 1 MiB และห้าม echo, log, write หรือ hash
- marker ต้องเขียนแบบ create-exclusive และ `fsync`
- Independent QA ต้องตรวจแบบไม่มี Network ก่อน Stage B

## 5. Stage B — One-Command Read-only Diagnostic

ทำได้เมื่อ Stage A QA ผ่านเท่านั้น

คำสั่งเชิงตรรกะที่อนุญาตมีเพียง:

`db migrations list --json`

Physical launcher:

- Node: `C:\Program Files\nodejs\node.exe`
- pinned `@insforge/cli@0.2.8` entrypoint SHA-256: `AF352BF5F5DD5FFB5F6A5FA3C15CC95F2BC428DB30642FF5FCBDC372A568B815`
- `shell: false`
- offline/no registry/no fallback

Credential gate:

- User ID ต้องตรง
- JWT ต้องเหลืออายุอย่างน้อย 45 นาที
- ห้าม refresh, login, profile lookup หรือ OAuth ใน diagnostic นี้
- ถ้า credential ไม่พร้อม ให้หยุดก่อนสร้าง STARTED marker และก่อน Network

Network ceiling ต่อ diagnostic ทั้งหมด:

- GET `https://5wjnzj4y.ap-southeast.insforge.app/api/database/migrations`: ไม่เกิน 1 ครั้ง
- automatic Usage POST `/api/usage/mcp`: ไม่เกิน 1 ครั้ง และต้องเป็น exact tool contract ที่ manifest ระบุ
- PostHog v0 `/batch/`: ไม่เกิน 1 event และต้องเป็น exact command telemetry ที่ manifest ระบุ
- endpoint, method, redirect, command หรือ telemetry อื่นทั้งหมดต้องถูกบล็อกก่อนออก Network

## 6. Data Minimization

ข้อมูลจาก migration ที่เขียนลงหลักฐานได้มีเฉพาะ:

- top-level envelope type
- row count
- sorted top-level key names
- sorted union of row key names
- ต่อหนึ่ง key: primitive type counts เฉพาะ `string|number|boolean|null`
- ต่อหนึ่ง key: present/missing frequency และ nullability
- boolean ว่าทุก row มี shape เดียวกันหรือไม่

ห้ามเขียน:

- row index หรือ row object
- ค่า version, name, timestamp, status หรือค่า field ใด ๆ
- raw stdout/stderr
- regex/pattern result ที่อนุมานค่าจริงได้
- raw-output hash หรือ hash ที่สร้างจากค่าจริง
- nested object/array detail; หากพบให้หยุดแบบ generic โดยไม่บันทึกรายละเอียด

## 7. Marker และ No-retry Contract

Runtime files อยู่ใต้:

`.codex-tmp/lean-staging-execution/diagnostics/glmvp-migration-shape-01-79b0b68d-4c58-4384-aedc-7cdf48fc87d2/`

ลำดับ:

1. ผ่าน preflight ทั้งหมด
2. สร้าง `STARTED.json` แบบ exclusive + fsync ก่อน invocation
3. เรียก CLI หนึ่ง invocation เท่านั้น
4. สำเร็จจึงสร้าง `SHAPE-EVIDENCE.json` และ `COMPLETED.json` แบบ exclusive + fsync
5. ล้มเหลวให้สร้าง `STOPPED.json` ที่มีเพียง control metadata และ generic reason code

เมื่อมี STARTED marker แล้ว diagnostic ถือว่าถูกใช้ ไม่ว่าจะสำเร็จหรือล้มเหลว และห้าม retry

## 8. Stage C — Conditional Local Parser Repair

ทำได้เมื่อ Independent QA ยืนยันครบทุกข้อเท่านั้น:

- envelope เป็น object ที่มี key `migrations`
- row count = 38
- `version`, `name`, `createdAt` มีครบ 38/38 และเป็น non-null string
- drift เป็นเพียง exact additional primitive metadata keys ที่หลักฐานระบุ

อนุญาตให้แก้เฉพาะ:

1. `.codex-tmp/lean-staging-execution/accounts-readonly-session-contract.mjs`
2. `.codex-tmp/lean-staging-execution/accounts-readonly-evidence-session-v2.test.mjs`
3. `.codex-tmp/lean-staging-execution/ACCOUNTS-READONLY-SESSION-CONTRACT.md`
4. `.codex-tmp/lean-staging-execution/ACCOUNTS-MIGRATION-PARSER-REPAIR-MANIFEST.json`

Parser ที่แก้แล้วต้อง:

- ยอมรับเฉพาะ extra keys ที่พิสูจน์แล้วเท่านั้น
- บังคับ required/optional ตาม frequency ที่พิสูจน์แล้ว
- คง validation เดิมของ `version`, `name`, `createdAt`
- project/discard extra metadata หลังตรวจ
- ปฏิเสธ unknown key, nested value, type drift และ shape อื่นทั้งหมด

หาก required field ขาด, เป็น null, type ไม่ตรง, shape ไม่สม่ำเสมอ หรือหลักฐานไม่ชัด ให้หยุด ห้ามแก้ parser โดยเดา

หลังแก้ต้อง re-seal และให้ Independent QA ตรวจ Local candidate แบบไม่มี Network

## 9. นอกขอบเขตและข้อห้าม

- Network Evidence Session ใหม่
- Accounts runner, Auth user หรือ business fixture
- Backend/Staging data write หรือ RPC
- Deploy/redeploy
- Migration apply/DDL/ACL
- Config, secret, schedule หรือ notification change/send/retry
- Backup create/restore
- Cleanup/delete
- Staging อื่น, Ghost Child และ Production ทุกกรณี

## 10. Acceptance Criteria

- `MRD-01`: Stage A QA ผ่านแบบไม่มี Network
- `MRD-02`: ใช้ exact command และ invocation เดียวภายใน network ceiling
- `MRD-03`: หลักฐานมีเฉพาะ shape fingerprint และไม่มี raw/value leak
- `MRD-04`: Independent QA รับรอง diagnostic evidence
- `MRP-01`: parser repair เกิดได้เฉพาะ additive-only gate ผ่าน
- `MRP-02`: required-field validation เดิมไม่อ่อนลง
- `MRP-03`: focused tests, collector regression, seal และ Independent QA ผ่าน
- `MRP-04`: Network Evidence Session ใหม่ต้องขออนุมัติแยก

## 11. ทางเลือกที่ง่ายที่สุดหากติดปัญหา

- หาก JWT ไม่เหลือ 45 นาที: หยุดก่อน Network และทำ Auth scope แยก ไม่ขยาย diagnostic
- หาก diagnostic พบเพียง extra primitive keys: แก้ parser ด้วย exact allow-list ตาม Stage C
- หาก diagnostic ยังไม่พอวินิจฉัย: หยุดและขอ diagnostic ที่แคบขึ้น ห้ามเพิ่ม logging กว้างหรือเก็บ raw output
- ห้ามย้อนกลับไปใช้ Session 05 หรือ retry คำสั่งเดิม

## 12. Exact Approval Text

> ผม ภคภพ ช.เจริญยิ่ง อนุมัติ Scope Amendment และ Implementation ตามเอกสาร `GO-LIVE-MVP-INITIAL-OPERATIONS-01 — One-Command Migration Row Shape Diagnostic and Conditional Local Parser Repair 06 v0.1` และ checksum companion ที่แนบ โดยอ้างอิง Incident QA SHA-256 `A3AE81D1624F684579448B3763D42D082D697B40BD7DF31F45506A3F4FA0361A` เฉพาะ Temporary Staging `gisp-lean-staging-20260923` Project ID `a24aff68-a82e-41da-b64a-a128a1539769`, host `5wjnzj4y`, context `C:\codex\GISP\.insforge-audit-lean-staging-new` และ Diagnostic ID `glmvp-migration-shape-01-79b0b68d-4c58-4384-aedc-7cdf48fc87d2` เท่านั้น อนุมัติ Stage A ให้สร้างและทดสอบ Local diagnostic package ตาม Exact File Allow-list และให้ Independent QA ตรวจแบบไม่มี Network ก่อน เมื่อ Stage A QA PASS อนุมัติ Stage B ให้รัน exact direct Node + pinned `@insforge/cli@0.2.8 db migrations list --json` เพียงหนึ่ง invocation โดยห้าม refresh/login และอนุญาตเฉพาะ GET migration endpoint หนึ่งครั้ง พร้อม bounded automatic Usage/PostHog telemetry ตาม manifest หลักฐานที่เขียนได้มีเฉพาะ sanitized shape fingerprint ตามข้อ 6 ห้าม raw output และค่าของ migration หากล้มเหลวหรือผลไม่ชัดให้หยุดโดยไม่ retry หลัง Independent QA ยืนยัน additive-only drift ครบตามข้อ 8 เท่านั้น อนุมัติ Stage C ให้แก้ Local parser/tests/contract docs ตาม Exact File Allow-list โดยคง required-field validation เดิมและให้ Independent QA ตรวจแบบไม่มี Network การอนุมัตินี้ไม่อนุญาต Network Evidence Session ใหม่, Accounts, Backend/Staging write, Deploy, Migration apply, Config/Secret/Schedule, Notification, Backup/Restore, Cleanup/Delete, Staging อื่นหรือ Production ให้ใช้เวลาของข้อความอนุมัติเป็น `approved_at` กำหนด `data_authority: Local sanitized diagnostic markers/result and synthetic test fixtures only`, `migration_authority: None`, `network_authority: One exact read-only migration-list command plus bounded automatic telemetry`, `staging_allowed: Exact one-command read-only diagnostic only` และ `production_allowed: No`

## 13. ขั้นตอนที่เหลือ

เพื่อปิด Diagnostic/Repair Slice นี้เหลือ 4 ขั้นตอน:

1. เจ้าของอนุมัติเอกสารนี้
2. Builder สร้าง Stage A และ Independent QA ตรวจ
3. รัน diagnostic หนึ่งครั้งและ Independent QA ตรวจผล
4. หาก additive-only gate ผ่าน ให้แก้ parser/re-seal และ Independent QA ตรวจ

หลัง Slice นี้ผ่าน ยังเหลือ Network Evidence Session ใหม่และ Final QA ซึ่งต้องมี authorization แยก
