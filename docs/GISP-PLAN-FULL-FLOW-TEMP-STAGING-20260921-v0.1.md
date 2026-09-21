# GISP — FULL-FLOW-GO-LIVE-01 Temporary Staging

**Document Version:** `v0.1`  
**Date:** 21 September 2026 (พ.ศ. 2569)  
**Status:** `PROPOSED — AWAITING SCOPE + IMPLEMENTATION APPROVAL`  
**Parent Scope:** `FULL-FLOW-GO-LIVE-01 v0.1`  
**Environment:** Proposed standalone Temporary Staging only  
**Production Allowed:** `No`  
**Resource Owner:** ภคภพ ช.เจริญยิ่ง

> เอกสารนี้เป็นคำขออนุมัติสำหรับสร้างและทดสอบ Temporary Staging ที่แยกจาก Production
> เท่านั้น การมีเอกสารนี้ยังไม่อนุญาตให้สร้าง Project, Apply Migration, Deploy, ส่งอีเมล,
> เขียนข้อมูล Backend หรือลบทรัพยากร จนกว่าเจ้าของจะอนุมัติข้อความในข้อ 13 โดยตรง

---

## 1. เป้าหมาย

สร้างพื้นที่ซ้อมที่แยกขาดจาก Production เพื่อพิสูจน์ว่า exact candidate ของ
`FULL-FLOW-GO-LIVE-01 v0.1` ใช้งานได้ครบตั้งแต่สมัคร Member, Catalog/Custom RFQ,
Project, Order, Manual Payment, PO, Production, QC, Logistics, Delivery และ Claim
รวมถึงการแยกองค์กร สิทธิ์ ไฟล์ลับ Backup/Restore และ Emergency Stop/Resume
ก่อนขออนุมัติ Production เป็นราย Gate `C → D7 → D8 → D9 → D10`

## 2. ทรัพยากรที่เสนอ

| รายการ | ค่าที่เสนอ |
| --- | --- |
| ประเภท | InsForge top-level project ใหม่ ไม่เป็น Child/Branch ของ Production |
| ชื่อ | `gisp-full-flow-staging-20260921` |
| Region | `ap-southeast` |
| Compute | ขนาดต่ำสุดที่รองรับ rehearsal; ห้าม resize หรือ paid upgrade โดยไม่มีอนุมัติใหม่ |
| Resource Owner | ภคภพ ช.เจริญยิ่ง |
| CLI context | `.codex-tmp/full-flow-staging-context` แยกจาก Development และ Production |
| ข้อมูล | Synthetic เท่านั้น ใช้ prefix `FFGL-STG-*` |
| Production | ห้ามแตะทุกกรณี (`production_allowed: No`) |

ห้ามใช้ Child `rlc-harden-01-rehearsal-20260920` ID
`41df0506-ef0a-4753-9426-b1c8ed4f9ff6` หรือ Child อื่นของ Production เพราะมีความเสี่ยง
เรื่อง shared identity/schedule และ Ghost Schedule เดิม

## 3. งบประมาณและอายุ

- เพดานค่าใช้จ่ายเพิ่มจากงานนี้: **USD 10 รวมทั้งหมด**
- ห้ามซื้อ add-on, paid upgrade, resize หรือทรัพยากรอื่นนอกเอกสาร
- ตรวจ usage/cost ทุกวันระหว่างเปิด Staging; หยุดก่อน mutation ถัดไปเมื่อคาดว่าจะเกินเพดาน
- อายุสูงสุด: **60 วันนับจากวันสร้าง** หรือ **14 วันหลัง Production D10** แล้วแต่ว่าอย่างใดถึงก่อน
- หากต้องใช้ต่อ ต้องขอ Extension Record ก่อนถึงกำหนด
- เอกสารนี้ **ไม่อนุญาตให้ลบ Project**; การลบต้องมี Deletion Authorization แยกหลังสรุปหลักฐาน

ราคา/ค่าบริการจริงให้ตรวจจาก [InsForge Pricing](https://insforge.dev/pricing) ก่อนสร้าง
และค่าที่ระบบแสดง ณ เวลาสร้างต้องไม่ทำให้เกินเพดานข้างต้น

## 4. Exact Candidate และการผนึก

ก่อนสร้าง Staging ต้องมีทั้งหมด:

1. Independent QA ให้ผล `PASS` บน Local corrective candidate
2. Git worktree สะอาดและมี immutable commit/tree ใหม่
3. Candidate Manifest ระบุ migration, baseline และ emergency hashes ครบ
4. นำ exact commit/tree ที่ผนึกแล้วมาใส่ใน Approval Record; ห้ามใช้ commit เก่า `7eb9743`

หาก commit/tree, package hash หรือไฟล์ใดไม่ตรง ให้หยุดก่อนสร้างหรือเขียนข้อมูล

## 5. Baseline และ Migration Authority ที่เสนอ

อนุญาตเฉพาะเมื่อข้อ 13 ได้รับอนุมัติแล้ว:

1. Bootstrap standalone Staging ด้วย schema/runtime migration history ของ Production B
   จำนวน 26 ไฟล์จาก `release-candidates/full-flow-go-live-01/production-b-baseline/`
2. ตรวจ baseline head ต้องเป็น `20260908170000_release-b-member-pilot.sql`
3. Apply candidate migration จำนวน 16 ไฟล์ **ทีละไฟล์ตามลำดับและ SHA-256** ใน
   `release-candidates/full-flow-go-live-01/CANDIDATE-MANIFEST.md`
4. ห้ามใช้ `migrations up --all`, ห้ามไฟล์นอก allow-list และห้ามแก้ migration หลัง seal
5. ห้าม clone/export/import Production rows, PII, secret, key หรือ Storage object จริง

## 6. Test Fixture Authority ที่เสนอ

- สร้างประมาณ 20 Member สังเคราะห์ในอย่างน้อย 2 องค์กร
- มีบทบาท Member, Member Admin, Product/Sourcing, Order Admin, Finance, Purchasing,
  Production, QC, Logistics, Claim และ Report เท่าที่ Test Matrix ต้องใช้
- ครอบคลุม Catalog flow และ Custom RFQ/Quotation flow
- ใช้ Order, Payment evidence, confidential customs evidence, POD และ Claim evidence สังเคราะห์
- ทุก record/file ตั้งชื่อหรือ metadata ด้วย prefix `FFGL-STG-*` เพื่อค้นหาและพิสูจน์ขอบเขต
- ห้ามเงินจริง, บัญชีธนาคารจริง, เอกสารลูกค้าจริง, Member จริง หรือ Production identifier

## 7. Notification และ Schedule

- Schedule ทุกตัวต้องเริ่มและคงสถานะ `inactive` ตลอด rehearsal รอบนี้
- ทดสอบ retry ด้วยการเรียกแบบ manual เฉพาะ Staging หลัง identity preflight; ห้ามสร้าง cron/schedule
- In-App Notification ทดสอบได้ด้วยข้อมูลสังเคราะห์
- Outbound email อนุญาตได้เฉพาะเมื่อ Approval Record ระบุ exact recipients ต่อไปนี้:
  - `pakapop39+ffgl-member-a@gmail.com`
  - `pakapop39+ffgl-member-b@gmail.com`
  - `pakapop39+ffgl-staff@gmail.com`
- หาก alias ใดใช้ไม่ได้หรือผู้ใช้ต้องยืนยันเอง ให้หยุดและขอคำยืนยัน ห้ามเปลี่ยนไปส่งบุคคลอื่น
- ห้ามคัดลอก Production SMTP secret; ใช้การตั้งค่า Staging ที่แยกและตรวจ target ได้เท่านั้น

## 8. Backup, Restore และ Emergency Rehearsal

อำนาจที่เสนอจำกัดอยู่ใน Staging นี้:

- สร้าง named backup ก่อน baseline/candidate migration, หลัง migration และก่อน recovery
- Restore กลับเข้า Staging เดิมได้หนึ่งครั้ง โดยใช้ synthetic sentinel ตรวจ Database/Storage/ACL
- ใช้ exact package ใน `release-candidates/full-flow-go-live-01/emergency/`
- ซ้อม `stop → no-write delta → SELECT-only reconcile → resume`
- เก็บหลักฐานแบบ sanitized ห้ามบันทึก secret, token, password หรือเนื้อหาไฟล์ลับ
- การ Restore/Stop/Resume บน Production ไม่อยู่ในอำนาจนี้

## 9. Preflight บังคับก่อน Mutation

ต้องผ่านทุกข้อ:

1. Project ID, host, API key และ Storage ไม่ตรง Production ID
   `865860c2-49fa-4e53-908f-9396b2f75233` และ host ไม่ใช่ `m8ugbyak`
2. CLI context อยู่ในโฟลเดอร์แยกและแสดงชื่อ/ID ของ Staging ตรงเอกสาร
3. ไม่มี active schedule และไม่มี URL/header/body/secret/recipient ชี้ Production
4. Deployment และ browser/server environment ชี้ Staging host เดียวกัน
5. Exact commit/tree, baseline head และ package hashes ตรง Approval Record/Manifest
6. Named pre-migration backup มีสถานะ `completed`
7. Recipient อยู่ใน exact allow-list หากมีการส่งอีเมล

อ่านข้อมูลไม่ครบหรือยืนยันข้อใดไม่ได้ให้ถือว่า `FAIL CLOSED`

## 10. Acceptance Criteria

| ID | เกณฑ์ผ่าน |
| --- | --- |
| `FFSTG-AC-001` | เป็น top-level project ใหม่; ID/host/key/JWT/Storage แยกจาก Production และ Child เดิม |
| `FFSTG-AC-002` | Source commit/tree และ baseline/candidate/emergency hashes ตรง Candidate ที่ seal |
| `FFSTG-AC-003` | ไม่มี URL, header, body, secret, recipient หรือ Schedule ชี้ Production |
| `FFSTG-AC-004` | Bootstrap 26 และ candidate 16 migrations Apply ตามลำดับ/hash โดยไม่ใช้ `up --all` |
| `FFSTG-AC-005` | ใช้ synthetic fixture เท่านั้นและข้อมูลหลายองค์กรไม่ปะปน |
| `FFSTG-AC-006` | Signup/Onboarding และ Catalog/Custom RFQ → Project → Order ผ่านครบ |
| `FFSTG-AC-007` | Partial/Exact/Overpayment/Reject/Adjustment/Reversal และ maker/checker ผ่าน |
| `FFSTG-AC-008` | Duplicate/concurrent Order, PO และ Payment ถูกป้องกัน |
| `FFSTG-AC-009` | Cross-org, inactive user, direct RPC และ private file ถูกปฏิเสธ |
| `FFSTG-AC-010` | Production/QC/Logistics/Delivery/Claim และ C→D10 gates ผ่านตามลำดับ |
| `FFSTG-AC-011` | Stop/no-write/reconcile/resume ผ่านและไม่มี delta ที่อธิบายไม่ได้ |
| `FFSTG-AC-012` | Backup/Restore คืน Database, Storage, ACL และ sentinel ได้ตรง baseline |
| `FFSTG-AC-013` | Notification ส่งเฉพาะ allow-list; Schedule ไม่มี active item |
| `FFSTG-AC-014` | Independent QA ไม่มี Blocker; Production baseline ไม่เปลี่ยน |

## 11. Stop Conditions

หยุดทันทีเมื่อพบอย่างใดอย่างหนึ่ง:

- Project identity, commit/tree, migration hash, baseline head หรือ backup ไม่ตรง
- พบ Production host/ID/secret/recipient/data ใน Staging config หรือ payload
- มี Active Schedule หรืออ่าน schedule/config ไม่ครบ
- พบข้อมูลจริงหรือ recipient นอก allow-list
- Cross-org/direct-RPC/private-file negative test กลับผ่าน
- Order, PO, Payment, file หรือ reconciliation delta อธิบายไม่ได้
- Restore ไม่คืน baseline หรือ Emergency Resume คืน function/ACL ไม่ตรง
- ค่าใช้จ่ายใกล้เกิน USD 10 หรือต้อง paid upgrade/resize
- ต้องเปลี่ยน business rule, financial formula, scope หรือแตะ Production

## 12. สิ่งที่ไม่อยู่ในขอบเขต

- Production Apply/Deploy/Data/Config/Permission/Schedule/Backup/Restore ทุกชนิด
- Production Release Authorization สำหรับ C, D7, D8, D9 หรือ D10
- ใช้ Child/Ghost Schedule เดิม
- Member/เงินจริง, Production data/PII และการส่งอีเมลนอก allow-list
- เปลี่ยนราคา, VAT, 50/50 Deposit/Balance, Freight หรือ Manual Payment rule
- ลบ Temporary Staging

## 13. Proposed Approval Record

ข้อความที่เจ้าของสามารถอนุมัติได้หลัง Primary Thread แจ้ง exact commit/tree ใหม่:

> ผม ภคภพ ช.เจริญยิ่ง อนุมัติ Scope และ Implementation ตามเอกสาร
> `FULL-FLOW-GO-LIVE-01 Temporary Staging v0.1` สำหรับ exact candidate commit `[COMMIT]`
> และ tree `[TREE]` อนุญาตให้สร้าง InsForge top-level project ใหม่ชื่อ
> `gisp-full-flow-staging-20260921` ที่ region `ap-southeast` ภายใต้เพดานค่าใช้จ่ายเพิ่ม
> USD 10 โดยห้าม paid upgrade/resize และมี ภคภพ ช.เจริญยิ่ง เป็น Resource Owner
> อนุญาตให้ Bootstrap เฉพาะ Production-B baseline 26 ไฟล์, Apply เฉพาะ candidate migration
> allow-list 16 ไฟล์ตามลำดับ/hash, Deploy exact candidate, สร้าง synthetic fixture `FFGL-STG-*`,
> ส่งอีเมลเฉพาะ 3 aliases ที่ระบุในเอกสาร, สร้าง named backups และ Restore Staging หนึ่งครั้ง,
> และทดสอบ Full-flow/UAT/Recovery ตาม `FFSTG-AC-001` ถึง `FFSTG-AC-014`
> Schedule ทุกตัวต้อง inactive ตลอดและทดสอบ retry แบบ manual เฉพาะ Staging
> ห้ามใช้ Child `41df0506-ef0a-4753-9426-b1c8ed4f9ff6`, ห้าม Production data/PII/เงินจริง/Member จริง,
> ห้าม `up --all`, ห้ามเปลี่ยนกฎราคา/การเงิน และห้ามแก้ Production ทุกกรณี
> อายุสูงสุด 60 วันนับจากวันสร้างหรือ 14 วันหลัง Production D10 แล้วแต่ว่าอย่างใดถึงก่อน;
> การขยายอายุและการลบต้องอนุมัติแยก หาก identity/hash/backup/schedule/recipient/cost ไม่ตรง
> ให้หยุดก่อน mutation ถัดไป ใช้เวลาของข้อความอนุมัติเป็นเวลาอนุมัติ และกำหนด
> `production_allowed: No`

## 14. ขั้นตอนหลังได้รับอนุมัติ

1. สร้าง standalone project และบันทึก ID/host/cost/owner ใน Environment Registry
2. ทำ identity/schedule preflight และ named backup
3. Bootstrap 26 migrations แล้ว Apply candidate 16 migrationsทีละไฟล์
4. Deploy exact candidate และสร้าง synthetic fixture
5. ทำ Full-flow, security, financial, recovery และ Owner UAT
6. Independent QA สรุปผลและยืนยันว่า Production baseline ไม่เปลี่ยน
7. จัดทำ Production Release C Authorization แยก; Staging approval ไม่อนุญาต Production

## 15. Source of Truth

- `docs/GISP-PLAN-FULL-FLOW-GO-LIVE-01-20260920-v0.1.md`
- `docs/GISP-APR-FULL-FLOW-GO-LIVE-01-LOCAL-IMPLEMENTATION-20260920-v1.0.md`
- `release-candidates/full-flow-go-live-01/CANDIDATE-MANIFEST.md`
- `release-candidates/full-flow-go-live-01/production-b-baseline/MANIFEST.md`
- `release-candidates/full-flow-go-live-01/emergency/README.md`
- `docs/active/ENVIRONMENT REGISTRY.md`
- `docs/active/PRODUCTION OPERATIONS RUNBOOK.md`

