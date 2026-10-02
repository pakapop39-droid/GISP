# GO-LIVE-MVP-INITIAL-OPERATIONS-01 — Nested Migration Shape Diagnostic 06B v0.1

วันที่จัดทำ: 2026-09-24 (Asia/Bangkok)  
สถานะ: รอเจ้าของอนุมัติ Scope Amendment และ Implementation  
ระดับความเสี่ยง: T3 Sensitive — Authentication, External read-only integration และ Data contract  
Production: ไม่อนุญาต

## 1. จุดประสงค์

Diagnostic v1 ถูกใช้แล้วและหยุดแบบปลอดภัยด้วย `NESTED_ROW_VALUE` เพราะอย่างน้อยหนึ่ง migration row มี field ชนิด object หรือ array ขณะที่ขอบเขตเดิมห้ามจำแนกชนิด nested

Diagnostic v2 จะบันทึกเฉพาะ:

- ชื่อ field ชั้นแรก
- ชนิด JSON ชั้นแรก รวม `object` และ `array`
- จำนวนครั้งที่ field/type ปรากฏ

ห้ามเปิดหรือบันทึกข้อมูลภายใน object/array ทุกกรณี

## 2. หลักฐานตั้งต้น

- 06A Post-execution Independent QA SHA-256: `F7400EF0FA1E2EE3F33F2C97008EE5BDE51A1F5582A768251FFF5F626880D262`
- Diagnostic v1 ID: `glmvp-migration-shape-01-79b0b68d-4c58-4384-aedc-7cdf48fc87d2` ถูก consume แล้ว
- v1 runtime มีเฉพาะ STARTED/STOPPED ไม่มี Shape Evidence หรือ raw output
- v1 source/test/manifest และ runtime markers ต้องคงเดิม ห้าม retry หรือแก้ไข
- Current sanitized credential state ณ เวลาจัดทำ: `VALID_SUFFICIENT`

## 3. Exact Target และ Diagnostic v2

- Temporary Staging: `gisp-lean-staging-20260923`
- Project ID: `a24aff68-a82e-41da-b64a-a128a1539769`
- Host marker: `5wjnzj4y`
- Region: `ap-southeast`
- Context: `C:\codex\GISP\.insforge-audit-lean-staging-new`
- Expected User ID: `f3a87026-c41d-4ba0-83cf-e150a9ba1f93`
- New Diagnostic ID: `glmvp-migration-shape-02-432dc401-2fd8-4145-b599-acc5a1a3dbb5`

## 4. Stage A — Local v2 Candidate

Builder คนเดียวเป็นเจ้าของเฉพาะ 3 ไฟล์ใหม่:

1. `.codex-tmp/lean-staging-execution/accounts-migration-shape-diagnostic-v2.mjs`
2. `.codex-tmp/lean-staging-execution/accounts-migration-shape-diagnostic-v2.test.mjs`
3. `.codex-tmp/lean-staging-execution/ACCOUNTS-MIGRATION-SHAPE-DIAGNOSTIC-V2-MANIFEST.json`

ข้อกำหนด:

- copy/modify จาก v1 โดยไม่ refactor shared code และไม่แก้ v1
- ใช้ Local synthetic mocks เท่านั้น ไม่มี Network/Auth/Staging
- default network fail closed
- raw stdout+stderr รวมไม่เกิน 1 MiB และต้อง zero buffers
- classifier คืนเพียง `string|number|boolean|null|object|array`
- สำหรับ object/array ห้ามเรียก `Object.keys`, iterate, อ่าน nested key/value, อ่าน array length หรือ traverse ทุกชนิด
- Writer ต้อง revalidate exact evidence schema และ reject extra field
- ใช้ marker `wx`, mode `0600`, file fsync และ consumed/no-retry contract
- Independent QA ต้อง PASS แบบไม่มี Network ก่อน Stage B

## 5. Evidence ที่อนุญาต

Migration-derived evidence เขียนได้เฉพาะ:

- evidence format version V2
- top-level envelope type
- sorted top-level key names
- row count
- sorted union of row field names
- ต่อหนึ่ง field: `present`, `missing`, `nullable`
- ต่อหนึ่ง field: exact type counts `{string, number, boolean, null, object, array}`
- uniform-shape boolean
- containment booleans เช่น `rawPersisted:false`, `nestedTraversed:false`, `valueDerivedHashes:false`

ห้ามเขียน:

- nested key names หรือ nested schema
- nested content/value หรือ scalar value ใด ๆ
- array length หรือ element type
- row index, row object หรือ migration name/version/timestamp/status value
- raw stdout/stderr หรือ raw/value-derived hash
- pattern result ที่อนุมานค่าจริงได้

## 6. Credential Gate และ Conditional Official Refresh

อนุญาต Local sanitized preflight ซ้ำได้ก่อน directory/marker/Network:

- `VALID_SUFFICIENT`: ข้าม Auth Network และทำ Diagnostic v2 ได้ทันที
- `VALID_SHORT`: หยุดและรอจนหมดอายุ ห้ามบังคับ refresh
- `EXPIRED_REFRESH_ALLOWED`: อนุญาต exact official refresh หนึ่งครั้งตามข้อด้านล่าง
- state อื่น: หยุด

Conditional Auth bootstrap เมื่อหมดอายุเท่านั้น:

- exact direct Node + pinned `@insforge/cli@0.2.8 whoami --json`
- `shell:false`, offline/no registry/no fallback
- Profile GET `https://api.insforge.dev/auth/v1/profile` ไม่เกิน 2
- standard refresh POST `https://api.insforge.dev/api/oauth/v1/token` ไม่เกิน 1
- PostHog v0 whoami event ไม่เกิน 1
- official CLI rewrite เฉพาะ `C:\Users\ASUS\.insforge\credentials.json`
- raw profile/stdout/stderr ต้องทิ้ง ห้าม persist/echo/hash
- หลัง refresh ต้องตรวจ exact User ID, refresh present, no User API key และ JWT ≥45 นาที
- เริ่ม Diagnostic v2 ภายใน 5 นาที

ห้าม Device/Browser/Email Login และ User API Key fallback

## 7. Stage B — One-shot Diagnostic v2

- exact direct Node + pinned `@insforge/cli@0.2.8`
- command `db migrations list --json`
- `shell:false`, offline/no registry/no fallback
- หนึ่ง invocation เท่านั้น

Network ceiling:

- GET `https://5wjnzj4y.ap-southeast.insforge.app/api/database/migrations`: ไม่เกิน 1
- Usage POST `/api/usage/mcp`: ไม่เกิน 1 และ exact `cli.db.migrations.list`
- PostHog v0 `/batch/`: ไม่เกิน 1 และ exact `cli_db_invoked` / `migrations list`
- Diagnostic ห้าม OAuth/profile/refresh และ block request อื่นทั้งหมด

Runtime path:

`.codex-tmp/lean-staging-execution/diagnostics/glmvp-migration-shape-02-432dc401-2fd8-4145-b599-acc5a1a3dbb5/`

สร้าง `STARTED.json` แบบ exclusive+fsync ก่อน invocation เมื่อ STARTED แล้วถือว่า consume และห้าม retry สำเร็จจึงสร้าง `SHAPE-EVIDENCE.json` และ `COMPLETED.json`; ล้มเหลวสร้าง generic `STOPPED.json`

## 8. Stage C — Conditional Parser Repair

อนุญาตเฉพาะเมื่อ post-execution Independent QA ยืนยันครบ:

- envelope เป็น object key `migrations`
- row count = 38
- `version`, `name`, `createdAt` มีครบ 38/38 เป็น non-null string
- `status` (ถ้ามี) ยังคง primitive และผ่าน applied-status validation เดิม
- object/array ปรากฏเฉพาะ exact extra field names พร้อม type/presence frequency ที่ชัดเจน
- ไม่มี unknown key/type/shape drift หรือ ambiguity

อนุญาตให้แก้เฉพาะ:

1. `.codex-tmp/lean-staging-execution/accounts-readonly-session-contract.mjs`
2. `.codex-tmp/lean-staging-execution/accounts-readonly-evidence-session-v2.test.mjs`
3. `.codex-tmp/lean-staging-execution/ACCOUNTS-READONLY-SESSION-CONTRACT.md`
4. `.codex-tmp/lean-staging-execution/ACCOUNTS-MIGRATION-PARSER-REPAIR-MANIFEST.json`

Parser ต้อง:

- คง validation เดิมของ required fields, version/name/date format, duplicate, head และ status
- ยอมรับเฉพาะ extra field names/types/presence ที่ QA รับรอง
- ตรวจ object/array เพียง top-level type ถือเป็น opaque แล้ว discard โดยไม่ traverse/merge/spread/use
- reject unknown key/type/shape
- re-seal contract/collector bindings ที่ได้รับผลกระทบ และทำ Independent Local QA ก่อน Network Evidence Session ใหม่

หาก gate ไม่ครบให้หยุด ห้ามเดาหรือผ่อน parser

## 9. Exact File/Runtime Integrity

- v1 files/runtime ต้อง byte-identical
- source app, migrations, runner package และ historical evidence ห้ามแก้
- v2 Candidate ต้อง freeze exact SHA-256 ทั้ง 3 ไฟล์
- Stage A QA และ post-execution QA แยกจาก Builder/Executor
- Network Evidence Session ใหม่ต้องขอ authorization แยก

## 10. Stop Conditions

หยุดโดยไม่ retry/fallback เมื่อ:

- target, identity, context, hash, CLI, path หรือ marker ไม่ตรง
- v1 เปลี่ยนหรือ v2 runtime path มีอยู่
- credential ไม่เข้า gate
- มี CLI process อื่น
- Auth/Diagnostic invocation ล้มเหลวหรือผลไม่ชัด
- request/telemetry เกิน ceiling
- raw output ไม่สามารถจำกัด/zero ได้
- evidence schema มี value/nested detail/extra field
- required field type/presence ไม่ครบหรือ shape คลุมเครือ

## 11. ข้อห้าม

- retry หรือแก้ v1
- Network Evidence Session ใหม่
- Accounts/Auth user/business/backend write
- Deploy/redeploy
- Migration apply/DDL/ACL
- Config, secret, schedule หรือ notification change/send/retry
- Backup/restore
- Cleanup/delete
- Staging อื่น, Ghost Child และ Production ทุกกรณี

## 12. Acceptance Criteria

- `NSD-01`: v1 untouched และ v2 ใช้ new ID/path
- `NSD-02`: Stage A no-network QA PASS บน frozen hashes
- `NSD-03`: first-level type-only evidence และ synthetic nested sentinel ไม่รั่ว
- `NSD-04`: Auth/Diagnostic exact one-shot calls อยู่ใน ceilings
- `NSD-05`: post-execution QA รับรอง evidence/containment
- `NPR-01`: additive-only gate ครบก่อน Parser Repair
- `NPR-02`: original required validation ไม่อ่อนลง
- `NPR-03`: parser/collector re-seal และ Independent Local QA PASS
- `NPR-04`: future Network Evidence Session แยก authorization

## 13. Exact Approval Text

> ผม ภคภพ ช.เจริญยิ่ง อนุมัติ Scope Amendment และ Implementation ตามเอกสาร `GO-LIVE-MVP-INITIAL-OPERATIONS-01 — Nested Migration Shape Diagnostic 06B v0.1` และ checksum companion ที่แนบ โดยอ้างอิง Post-execution QA SHA-256 `F7400EF0FA1E2EE3F33F2C97008EE5BDE51A1F5582A768251FFF5F626880D262` เฉพาะ Temporary Staging `gisp-lean-staging-20260923` Project ID `a24aff68-a82e-41da-b64a-a128a1539769`, host `5wjnzj4y`, context `C:\codex\GISP\.insforge-audit-lean-staging-new`, User ID `f3a87026-c41d-4ba0-83cf-e150a9ba1f93` และ Diagnostic ID ใหม่ `glmvp-migration-shape-02-432dc401-2fd8-4145-b599-acc5a1a3dbb5` เท่านั้น Diagnostic v1 เดิมถูก consume แล้วและห้าม retryหรือแก้ marker อนุมัติ Stage A ให้ Builder copy/modify จาก v1 เฉพาะ 3 ไฟล์ตาม Exact File Allow-list ข้อ 4 โดยไม่แก้ v1/collector/app source ใช้ Local synthetic mocksเท่านั้นและให้ Independent QAตรวจ no-network/frozen hashesก่อน เมื่อ Stage A QA PASS อนุมัติ Stage B หนึ่งครั้งโดยใช้ credential gateและ conditional official refreshตามข้อ 6 และ exact direct Node+pinned `@insforge/cli@0.2.8 db migrations list --json` ตาม network/telemetry ceilingsข้อ 7 Raw stdout/stderrอยู่ใน bounded memoryไม่เกิน1MiBและต้อง wipe หลักฐาน migration-derivedเขียนได้เฉพาะ first-level type-only evidenceตามข้อ 5 ห้าม nested keys/content/values/array length, row index, raw outputหรือ value-derived hash Object/arrayต้องถูกนับเฉพาะชนิดชั้นแรกโดยไม่ traverse หากล้มเหลวหรือผลไม่ชัดให้เขียน generic STOPPED; STARTEDแล้วถือว่า consumeและห้าม retry แล้วให้ Independent QAตรวจ post-execution หากและเฉพาะเมื่อ QAพิสูจน์ gateข้อ 8ครบ อนุมัติ Stage C ให้แก้ Local parser/tests/contract docsและสร้าง repair manifestตาม Exact File Allow-list โดยคง validationเดิม ตรวจเฉพาะ exact extra fields/types/presence ถือ object/array extrasเป็น opaqueและ discardโดยไม่ traverse แล้ว re-seal + Independent Local QA หาก gateไม่ครบให้หยุด ห้ามเดาหรือผ่อน parser ไม่อนุญาต Network Evidence Sessionใหม่, Accounts/Auth user/business/backend write, Deploy, Migration apply, Config/Secret/Schedule, Notification, Backup/Restore, Cleanup/Delete, Stagingอื่นหรือ Production ใช้เวลาข้อความอนุมัติเป็น `approved_at`; `data_authority: Local sanitized v2 markers/result, official conditional credentials refresh and synthetic test fixtures only`, `migration_authority: None`, `network_authority: At most one bounded official whoami refresh when expired plus one exact read-only migrations-list command and bounded automatic telemetry`, `staging_allowed: Exact one-shot read-only diagnostic only` และ `production_allowed: No`

## 14. ขั้นตอนที่เหลือ

เพื่อปิด Nested Diagnostic/Parser Repair Slice เหลือ 4 ขั้นตอน:

1. เจ้าของอนุมัติเอกสารนี้
2. Builder สร้าง v2 และ Independent QA ตรวจ Stage A
3. รัน v2 one-shot และ Independent QA ตรวจ evidence
4. หาก gate ผ่าน ให้แก้ Parser/re-seal และ Independent QA ตรวจ

หลัง Slice นี้ผ่าน Network Evidence Session ใหม่ยังต้องขออนุมัติแยก
