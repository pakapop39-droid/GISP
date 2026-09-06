# Production Release A — Authenticated UAT and Notification Schedule

**วันที่ตรวจ:** 5 กันยายน 2569  
**Production Project:** `gisp-mvp-production`  
**Production URL:** https://m8ugbyak.insforge.site  
**ขอบเขต:** DEC-049 Release A — Internal Catalog Operations  
**ผล:** `OWNER_ACCEPTED — RELEASE A GO-LIVE APPROVED`

## Owner Authentication

- Owner ยืนยันว่าเปิดลิงก์และตั้งรหัสผ่านแล้ว
- Login Production สำเร็จ และ Dashboard แสดง `Pakapop`, `ACTIVE`, `SUPER_ADMIN`
- Dashboard แสดง Active User 1, Active Session 1 และ Permission 36 รายการ
- Audit/Security UI และฐานข้อมูลยืนยันเหตุการณ์อย่างละ 1 รายการ:
  - `PASSWORD_RESET_COMPLETED`
  - `LOGIN_SUCCEEDED`
  - `SESSION_CREATED`
  - `OPERATOR_BOOTSTRAP`

## Authenticated Browser Smoke

ผ่านการโหลดข้อมูลจริงจาก Production โดยไม่สร้างข้อมูลธุรกิจ:

1. `/admin/dashboard` — แสดง Session, Role และ Permission ถูกต้อง
2. `/admin/catalog` — Supplier/Product/Formula/Price เป็น 0 และฟอร์ม Supplier พร้อมใช้งาน
3. `/admin/catalog/imports` — Template, File Validation, Mapping และ Import History พร้อมใช้งาน
4. `/admin/catalog/batch` — Validation, Enrichment, Cost Version และ Member Price พร้อมใช้งาน
5. `/admin/users` — ฟอร์มสร้าง Internal User และ Role Catalog พร้อมใช้งาน
6. `/admin/roles` — Permission Matrix 10 Role โหลดครบ และ `SUPER_ADMIN` มีสิทธิ์จัดการ
7. `/admin/settings` — Company Settings โหลดค่า VAT 7%, THB และ Asia/Bangkok
8. `/admin/logs` — Audit และ Security Event แสดงผลจริง

## Production Notification Schedule

- เพิ่ม Edge Function `notification-retry` เฉพาะ Release A โดยไม่ Redeploy Frontend Artifact
- Function status: `active`
- เพิ่ม Secret `CRON_SECRET` แบบสุ่ม และไม่แสดง/ไม่บันทึกค่าลงเอกสาร
- Security test:
  - ไม่มี Secret → HTTP 401
  - มี Secret → HTTP 200, `processed: 0`, `failed: 0`
- สร้าง Schedule `GISP-Notification-Retry`
  - ID: `aefecf8b-5b02-4649-a9b2-47aa448af0e8`
  - Cron: `*/10 * * * *`
  - Method: `POST`
  - Active: Yes
  - รอบจริง 5 กันยายน 2569 เวลา 08:40 น. → HTTP 200, Success, 2,207 ms

## Known Issue

- `/admin/members` และ `/api/admin/members` ของ Frontend Artifact ปัจจุบันตอบ 404;
  Chrome แสดง `ERR_BLOCKED_BY_CLIENT` เมื่อเปิดจากเมนู
- ไม่กระทบ Release A เพราะ DEC-049 ยังไม่เปิด Member Pilot และไม่มี Member/Application จริง
- ต้องแก้หรือเอาเมนูออกก่อน Release B

## ข้อสรุป

Engineering Gate ของ Release A ผ่านแบบมี Known Issue โดยยังไม่สร้าง Supplier, Product, Import Job,
Member หรือข้อมูล CN01 บน Production

## Owner Sign-off

วันที่ 5 กันยายน 2569 Owner แจ้งว่า
“อนุมัติ Go-Live Release A โดยรับทราบ Known Issue หน้า Member Requests และให้แก้ก่อน Release B”
จึงกำหนดผลเป็น `RELEASE_A_GO_LIVE_APPROVED` ตาม DEC-055

Final verification หลัง Sign-off:

- Production Health: HTTP 200
- Deployment `b90108ef-3d6b-447e-97de-fc8bcd9a9f7e`: `READY`
- Schedule 3 รอบล่าสุดเวลา 09:30, 09:40 และ 09:50 น.: HTTP 200 ทั้งหมด
- Auth User 1, Active App User 1 และ Active `SUPER_ADMIN` 1
- Supplier 0, Product 0 และ Notification Job 0

## จำนวนขั้นตอนที่เหลือ

- **Production Release A:** เหลือ **0 ขั้นตอน** — Go-Live ได้รับอนุมัติแล้ว
- **Slice 11:** เหลือ **0 ขั้นตอน** — ปิดแล้วบน Development
