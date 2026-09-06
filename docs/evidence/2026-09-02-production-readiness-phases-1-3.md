# Production Readiness — Phase 1–3 Audit

**วันที่ตรวจ:** 2–3 กันยายน 2569  
**เป้าหมาย:** เตรียม Production Release ตาม DEC-049 โดยไม่เปลี่ยน Production ก่อน Owner Approval  
**สถานะ:** `PHASE 1–3 COMPLETE — PHASE 4 APPROVED 4 SEPTEMBER 2026`

> อัปเดต 4 กันยายน 2569: Owner อนุมัติ Phase 4 และเริ่ม Phase 5 แล้ว ผลล่าสุดอยู่ที่
> [Phase 5 Execution Record](2026-09-04-production-release-a-phase-5.md)

## สรุป

Production ยังไม่ถูก Deploy หรือเปลี่ยน Config/Database การทำงานรอบนี้เป็น Read-only Audit บน
Production และ Security Hardening บน Development เท่านั้น

Development ผ่าน Automated Gate, Browser Smoke และ Integration Regression หลังแก้ Ownership/Grant
ของฟังก์ชัน `SECURITY DEFINER` แล้ว ไม่เหลือ Execute Grant สำหรับ `PUBLIC` หรือ `anon` และ
ไม่เหลือ RLS table ที่เปิดใช้ RLS แต่ไม่มี Policy

Security Advisor ยังรายงาน Critical 137 รายการจากกฎ `dangerous-function` ซึ่งตรงกับฟังก์ชัน RPC
ที่จำเป็นต้องเปิดให้ role `authenticated` เรียกใช้ ฟังก์ชันทั้งหมดตั้ง `search_path` แบบจำกัดแล้ว
และ Integration Test ยืนยัน Isolation/Permission สำคัญ การยอมรับความเสี่ยงคงเหลือนี้หรือการ Suppress
ต้องเป็นคำตัดสินของ Owner ใน Phase 4 ก่อนเปลี่ยน Production

## หลักฐาน Development

- Advisor scan ก่อนแก้ `f6ea9b35-1afb-4eed-be4d-e286709c06fc`
  - 547 รายการ: Critical 163 / Warning 277 / Info 107
  - Critical: `dangerous-function` 160 และ `rls-no-policy` 3
- ทุก `SECURITY DEFINER` ทั้ง 160 ฟังก์ชันตั้ง `search_path` แล้ว
- Migration `20260902014026_harden-runtime-security.sql` ถูก Apply สำเร็จ
  - เพิ่ม explicit deny policy ให้ `document_sequences`, `showroom_visit_requests`,
    `supplier_disclosure_grants`
  - ปิด Runtime Execute ของ Trigger/Compatibility RPC ที่ project_admin จัดการได้
  - ตั้ง Default Privilege ให้ฟังก์ชันใหม่ไม่เปิดผ่าน `PUBLIC` โดยอัตโนมัติ
- Advisor scan หลังแก้ `e5958548-b238-4a8f-885a-9638f7caa011`
  - 541 รายการ: Critical 157 / Warning 277 / Info 107
  - `rls-no-policy` ลดจาก 3 เหลือ 0
  - Critical ที่เหลือทั้งหมดเป็น `dangerous-function`
- ความพยายามแก้ Ownership ใน Migration ถัดไปถูก Transaction rollback ทั้งชุดเมื่อ PostgreSQL ตอบ
  `must be owner of function operator_find_auth_user_id`; ไฟล์ Migration ที่ล้มเหลวถูกนำออกแล้วและ
  ไม่ค้างใน Remote Migration History
- Owner อนุมัติลบ Branch `slice-11-samples-warranty` เมื่อ 2 กันยายน 2569; ลบสำเร็จโดยไม่กระทบ
  การเปลี่ยนแปลงที่ Merge เข้า Development แล้ว
- สร้าง Full Branch `release-security-hardening` เพื่อทดสอบการแก้ Owner/Grant กับข้อมูลและ RLS จริง
- Branch merge dry-run ไม่ตรวจพบการเปลี่ยน Owner/ACL (`0 added, 0 modified, 0 conflicts`) แม้ Catalog
  ยืนยันว่าแก้แล้ว จึงส่ง InsForge bug report `9d2f89ac-1f94-46e0-80f4-73eb8fbe6f04`
- ใช้ `db query --unrestricted` ซึ่งทำงานในบทบาท `postgres` แก้ Development โดยตรง:
  - เปลี่ยน Owner ของฟังก์ชันเดิม 25 รายการจาก `postgres` เป็น `project_admin`
  - ปิด Execute ของ `PUBLIC` และ `anon` จาก `SECURITY DEFINER` ทั้ง 160 รายการ
  - เปิด Execute เฉพาะ `authenticated` ให้ `current_member_profile_id()` เพราะ RLS policy ต้องเรียกใช้
- Advisor scan หลังแก้ `0924bc2e-f3a9-410e-974d-58310e011516`
  - 521 รายการ: Critical 137 / Warning 277 / Info 107
  - Critical ทั้งหมดเป็น `dangerous-function` สำหรับ role `authenticated`
  - `PUBLIC/anon` Execute = 0 และ `rls-no-policy` = 0

## Backup ก่อนเปลี่ยน Development

- Manual Backup quota เต็ม 5/5 จึงไม่ได้ลบ Backup เดิมโดยไม่มีคำอนุมัติ
- ใช้ Full JSON Export แทน:
  - `tmp/pre-release-readiness-security-20260902.json`
  - ขนาด 1,025,511 bytes
  - SHA-256 `81B8ADB2FCE0D0EC686EDB99A6151095F643F741931B40CEB699BECD078FB3AA`
- Scheduled Backup ล่าสุดของ Development สำเร็จเมื่อ 2 กันยายน 2569 09:00 น. เวลา Asia/Shanghai

## Automated Gate และ UAT Regression

- ESLint: PASS
- TypeScript: PASS
- Vitest: 28 test files / 118 tests PASS
- Next.js production build: PASS, 108 static pages
- Slice 3 integration: 22 assertions PASS
- Slice 11 integration: 21 assertions PASS
- Slice 11 Preview Smoke: 7 assertions PASS
- Full Branch หลัง Security Fix: Slice 2–7 Integration รวม 101 assertions PASS
- Development หลัง Security Fix: Slice 2–7 Integration รวม 101 assertions PASS
- Slice 1 integration ไม่เหมาะกับฐานข้อมูลที่ Bootstrap แล้ว เพราะ Fixture คาดว่าจะสร้าง
  SUPER_ADMIN คนแรกและจบด้วย `SUPER_ADMIN_ALREADY_EXISTS`; ไม่ใช่ Regression ของ Migration รอบนี้
- Browser smoke ที่ Preview:
  - Member product detail แสดงราคา Sample และ Partner Warranty ครบ
  - ไม่พบ console error/warning
  - Member session ถูก Redirect ออกจาก Admin route กลับ Member Dashboard ตามสิทธิ์

## สถานะ Production แบบ Read-only

- Project `gisp-mvp-production` (`865860c2-49fa-4e53-908f-9396b2f75233`) Active
- Deployment `b90108ef-3d6b-447e-97de-fc8bcd9a9f7e` READY
- Advisor scan `ab60c032-1b73-4e90-b664-b3d5e62f3d93`
  - 264 รายการ: Critical 98 / Warning 126 / Info 40
  - Critical: `dangerous-function` 97 และ `rls-no-policy` 1
- ข้อมูลธุรกิจและผู้ใช้จริงยังเป็น 0; Storage ทุก Bucket ว่าง
- Scheduled Backup ล่าสุดสำเร็จเมื่อ 2 กันยายน 2569 09:00 น. เวลา Asia/Shanghai
- Database health: 5/30 connections, ไม่มี Slow Query/Waiting Lock, cache hit 99.4%
- 7-day latest metrics: CPU 1.80%, Memory 51.45%, Disk 57.87%
- Environment Gate ที่ยังไม่ผ่าน:
  - SMTP ปิด
  - Password minimum 6 ตัว
  - Allowed Redirect URLs ว่าง
  - ไม่มี `CRON_SECRET`
  - ไม่มี Notification Retry Schedule
  - ยังไม่มี First `SUPER_ADMIN`

## สิ่งที่ต้องทำต่อ

1. Phase 4: Owner พิจารณายอมรับ Critical 137 รายการที่เหลือในฐานะ RPC สำหรับผู้ใช้ที่ล็อกอิน
   และอนุมัติให้เริ่มเปลี่ยน Production โดยชัดเจน
2. Phase 5 หลังอนุมัติ: ทำ Named Production Backup, Environment Config, Migration/Privileged Grant Fix,
   Deployment, Smoke Test, UAT และบันทึกผล Go/No-Go

## จำนวนขั้นตอนที่เหลือ

- **Slice 11:** เหลือ **0 ขั้นตอน** — ปิดงานแล้วบน Development
- **Production Release ณ วันที่เอกสารนี้ตรวจ:** เหลือ **2 ขั้นตอน** ตามรายการด้านบน;
  สถานะล่าสุดให้ยึด Phase 5 Execution Record
