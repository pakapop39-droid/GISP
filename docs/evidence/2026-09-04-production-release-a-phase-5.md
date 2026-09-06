# Production Release A — Phase 5 Execution Record

**วันที่ดำเนินการ:** 4 กันยายน 2569  
**Production Project:** `gisp-mvp-production`  
**Production URL:** https://m8ugbyak.insforge.site  
**ขอบเขต:** DEC-049 Release A — Internal Catalog Operations  
**สถานะ:** `PHASE 5 COMPLETE — RELEASE A GO-LIVE APPROVED`

## คำอนุมัติ

เจ้าของระบบแจ้งว่า “อนุมัติ Phase 4 ยอมรับความเสี่ยงคงเหลือ และเริ่ม Phase 5 บน Production”
เมื่อ 4 กันยายน 2569 จึงถือว่า Phase 4 ผ่าน และอนุญาตให้เริ่มเปลี่ยน Production เฉพาะขอบเขต
Release A เท่านั้น ความเสี่ยงที่ยอมรับคือ RPC `SECURITY DEFINER` ที่จำเป็นต้องเปิดให้ role
`authenticated` เรียก โดยยังคง Permission Guard, RLS และ Audit ภายในฟังก์ชัน

## สิ่งที่ดำเนินการแล้ว

1. สร้าง Named Backup `pre-release-a-phase5-2026-09-04` สำเร็จ
   - Backup ID: `5ac12b90-5e92-4bb4-9e0d-d70dc049e730`
2. ใช้ Production Config แยกต่างหากและตรวจ Plan ก่อน Apply
   - Allowed Redirect: Production root และ `/reset-password`
   - Reset Password Method: `link`
   - Password ขั้นต่ำ: 10 ตัวอักษร
   - Storage Upload สูงสุด: 10 MB
   - Realtime Retention: 7 วัน
   - ตรวจซ้ำหลัง Apply: 0 pending changes
3. ใช้ Migration `20260904214500_release-a-runtime-hardening.sql`
   - ถอนสิทธิ์ Execute ของ `PUBLIC` และ `anon` จาก Public `SECURITY DEFINER` ทุกตัว
   - รักษาสิทธิ์ `authenticated` ของ `current_member_profile_id()` เพื่อให้ RLS ทำงาน
   - เพิ่ม Explicit Deny Policy ให้ `document_sequences`
4. ตรวจหลัง Migration
   - Public `SECURITY DEFINER` owner เป็น `project_admin` ทั้ง 87 ตัว
   - `PUBLIC`/`anon` Execute เหลือ 0
   - RLS-enabled table ที่ไม่มี Policy เหลือ 0
   - `authenticated` เรียก RLS helper ได้ และ `anon` เรียกไม่ได้
5. Security Advisor รอบหลังแก้ไข
   - Scan ID: `96323ff1-7af1-4237-96f8-ca69dc91ff4c`
   - ก่อนแก้: Critical 98 / Warning 126 / Info 40
   - หลังแก้: Critical 77 / Warning 126 / Info 40
   - Critical ที่เหลือเป็น `dangerous-function` สำหรับ RPC ของ `authenticated` ซึ่งอยู่ในขอบเขต
     Risk Acceptance ของ Phase 4; ไม่ซ่อนหรือ Suppress Finding เพื่อให้ยังตรวจติดตามได้
6. ตรวจระบบและขอบเขต Deployment เดิม
   - Deployment `b90108ef-3d6b-447e-97de-fc8bcd9a9f7e` ยังเป็น `READY`
   - `/api/health`, `/login` และ `/reset-password` ตอบ HTTP 200
   - `/admin/catalog` และ `/admin/catalog/batch` Redirect ไป Login เมื่อยังไม่ยืนยันตัวตน
   - `/member/catalog` ตอบ 404 และยังไม่เปิด Member Pilot
   - Notification Processor ปฏิเสธคำขอที่ไม่มี Secret ด้วย HTTP 401
7. ตรวจข้อมูล Production
   - Auth User, App User, Organization, Supplier, Product, Import Job และ Notification Job เป็น 0
   - ยังไม่มี `SUPER_ADMIN`
8. วันที่ 5 กันยายน 2569 Owner ยืนยันอีเมล Production เป็น `pakapop39@gmail.com`
   - ตรวจครั้งแรกแล้วยังไม่มีบัญชีอีเมลนี้ใน Production จึงรอให้ตั้ง SMTP ก่อนสร้างบัญชี
9. ตั้ง Custom SMTP และสร้าง Production Owner สำเร็จเมื่อ 5 กันยายน 2569
   - Custom SMTP เปิดใช้งานด้วย `smtp.gmail.com:465` และมี Credential ครบ
   - สร้าง Auth User แบบ Operator Auto-confirm โดยรหัสผ่านชั่วคราวเป็นค่าสุ่มในหน่วยความจำ
     ไม่แสดงและไม่บันทึกลงไฟล์
   - สร้าง App User สถานะ `ACTIVE`, Bootstrap Role `SUPER_ADMIN` และตรวจพบ Audit
     `OPERATOR_BOOTSTRAP` อย่างละ 1 รายการ
   - ระบบรับคำขอส่งลิงก์ตั้งรหัสผ่านไปยัง Owner สำเร็จ โดย Redirect กลับ
     `https://m8ugbyak.insforge.site/reset-password`
10. Owner ตั้งรหัสผ่านและ Login Production สำเร็จเมื่อ 5 กันยายน 2569
   - Dashboard แสดง `Pakapop`, `ACTIVE`, `SUPER_ADMIN`, Active Session 1 และ Permission 36
   - ตรวจ `PASSWORD_RESET_COMPLETED`, `LOGIN_SUCCEEDED`, `SESSION_CREATED` และ
     `OPERATOR_BOOTSTRAP` ได้อย่างละ 1 รายการ
11. แก้ Notification Schedule โดยไม่ Redeploy Frontend Artifact
   - Deploy Edge Function `notification-retry` เฉพาะ Release A และเพิ่ม `CRON_SECRET` แบบสุ่ม
   - ทดสอบไม่มี Secret ได้ 401; มี Secret ได้ 200 และไม่มีงานค้าง
   - Schedule `GISP-Notification-Retry` ID `aefecf8b-5b02-4649-a9b2-47aa448af0e8`
     เปิดใช้งานทุก 10 นาที; รอบจริงเวลา 08:40 น. ผ่าน HTTP 200 ใน 2,207 ms
12. ทำ Authenticated Production Smoke/UAT โดยไม่สร้างข้อมูลธุรกิจ
   - Dashboard, Catalog, Import, Batch, Internal User, Role Matrix, Company Settings และ Audit
     โหลดข้อมูลจริงได้ครบ
   - พบ Known Issue: `/admin/members` และ `/api/admin/members` ตอบ 404 ใน Artifact ปัจจุบัน
     ไม่กระทบ Release A ซึ่งยังไม่เปิด Member Pilot แต่ต้องแก้ก่อน Release B
13. Owner อนุมัติ Go-Live Release A เมื่อ 5 กันยายน 2569
   - รับทราบ Known Issue หน้า Member Requests และกำหนดให้แก้ก่อน Release B
   - Final verification: Health 200, Deployment `READY`, Schedule 3 รอบล่าสุดผ่าน 200,
     Owner/Active User/SUPER_ADMIN อย่างละ 1 และข้อมูลธุรกิจยังเป็น 0

## เงื่อนไขที่ล็อกไว้หลัง Go-Live

1. ต้องแก้ `/admin/members` และ `/api/admin/members` ก่อน Release B / Member Pilot
2. ข้อมูล CN01 และไฟล์จริงต้องได้รับ Data Load Approval แยกและจะไม่ถูกนำขึ้นอัตโนมัติ

เพื่อรักษาขอบเขต Release A จึงไม่ Deploy Development Artifact ล่าสุด เพราะมีโค้ดของ Slice หลัง ๆ
แม้ Production Database จะยังมีเฉพาะ Migration ของ Slice 1–2 ก็ตาม

## ขั้นตอนที่เหลือเพื่อเปิด Release A

- ไม่มี — Owner อนุมัติ Go-Live แล้วตาม DEC-055

ข้อมูล CN01 และไฟล์จริงยังไม่ถูกนำขึ้น Production และต้องได้รับ Data Load Approval แยก

## Rollback

- หยุดการเชิญผู้ใช้และไม่เปิด Release A หาก Smoke/UAT ไม่ผ่าน
- คืนค่า Config จากหลักฐานก่อนเปลี่ยน หรือ Restore Named Backup ข้างต้นเมื่อจำเป็น
- รักษา Deployment เดิมไว้จนกว่า Artifact Release A ที่ตรวจแล้วจะพร้อม

## จำนวนขั้นตอนที่เหลือ

- **Production Release A:** เหลือ **0 ขั้นตอน** — Go-Live แล้ว
- **Slice 11:** เหลือ **0 ขั้นตอน** — ปิดงานแล้วบน Development

หลักฐานรอบนี้อยู่ที่
[Authenticated UAT and Notification Schedule](2026-09-05-production-release-a-authenticated-uat.md)
