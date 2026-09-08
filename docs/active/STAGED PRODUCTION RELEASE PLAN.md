# GISP — STAGED PRODUCTION RELEASE PLAN

**Document Version:** 1.7
**Approved:** 18 August 2026 (พ.ศ. 2569)  
**Status:** `APPROVED RELEASE STRATEGY`  
**Authority:** DEC-049

## 1. เป้าหมาย

นำ GISP ให้คนเริ่มใช้งานได้เร็ว โดยไม่ต้องรอครบทั้ง 10 Slice และไม่เปิด Workflow ที่เกี่ยวกับ
ธุรกรรมหรือเงินก่อนระบบส่วนนั้นผ่านการทดสอบ

## 2. Production Release ตามลำดับ

### Release A — Internal Catalog Operations

**ขึ้นเมื่อ:** Slice 2 ผ่าน Automated Gate และ Human UAT  
**ผู้ใช้:** เจ้าของระบบและทีมงานภายในที่ได้รับ Role เช่น `SUPER_ADMIN`, `PRODUCT_ADMIN`, `PURCHASING`

เปิดใช้:

- Login และการจัดการสิทธิ์จาก Slice 1
- Supplier, Product, Category, Option, Media และ Document
- Factory Cost และ Price Structure ตามสิทธิ์
- Excel/CSV Import, Review, Publish และ Catalog QA

ยังไม่เปิด:

- Member Pilot สำหรับบริษัทภายนอก
- Project/Showroom Visit
- Quotation, Order และ Payment จริง

### Release B — Member Pilot

**ขึ้นเมื่อ:** Slice 3 ผ่าน Automated Gate และ Human UAT  
**ผู้ใช้:** สมาชิกจริงกลุ่มเล็กประมาณ 3–5 บริษัทที่เจ้าของระบบคัดเลือก

เปิดเพิ่ม:

- Member Catalog และราคาที่ปลอดภัย
- Project, End Customer, Area และ Product Item
- Quantity/Option และ Product Schedule
- Showroom Visit Request และ Supplier Disclosure ตามสิทธิ์

ขอบเขต Pilot:

- ใช้เก็บ Feedback และตรวจ Workflow จริง
- ยังไม่รับ Quotation, Order หรือ Payment จริงผ่านระบบ
- ข้อมูลต้นทุน สูตรราคา และตัวตน Supplier ที่ยังไม่ปลดล็อกต้องไม่รั่ว

### Release C — Transaction Launch

**ขึ้นเมื่อ:** Slice 4–6 ผ่าน Automated Gate และ Human UAT โดยเฉพาะ Slice 6  
**ผู้ใช้:** ขยายจากสมาชิก Pilot ไปยังสมาชิกที่ได้รับอนุมัติ

เปิดเพิ่ม:

- Custom RFQ และ Versioned Quotation
- Order และ Price/Specification Snapshot
- Deposit/Balance Payment และ Finance Verification
- Supplier Order/Payment และ PO Gate

ก่อนเปิดธุรกรรมจริงต้องตรวจ Reconciliation, Invoice/Document Number, Permission, Audit,
Cancellation และ Member-safe Leakage Test ครบ

### Release D — Operations Expansion

หลัง Slice 7–10 ผ่าน UAT ให้เปิด Production เพิ่มทีละ Slice ได้แก่ Production/QC,
Shipment/Delivery, Claim และ Dashboard/Reports โดยไม่ต้องรอรวมเป็น Release ใหญ่ครั้งเดียว

## 3. Gate บังคับทุก Release

- Automated Gate ของ Slice ที่เกี่ยวข้องผ่าน
- Human UAT และ Owner Sign-off ผ่าน
- Migration Merge Dry-run ไม่มี Conflict หรือการลบข้อมูลที่ไม่อนุมัติ
- Backup/Restore Point และแผนย้อนกลับพร้อม
- Production Environment/Email/Storage/Permission ตรวจครบ
- Deploy แล้วทำ Smoke Test และบันทึกหลักฐาน
- ต้องได้รับคำอนุมัติ Production Deployment แยกสำหรับแต่ละ Release

## 4. สถานะปัจจุบัน

- Slice 1: `DONE` บน Development
- Slice 2: `DONE` บน Development (`SLICE_2_ACCEPTED`)
- Slice 4: `DONE` บน Development (`SLICE_4_ACCEPTED`)
- Production: `RELEASE A LIVE — GO-LIVE APPROVED`; Deployment
  `b90108ef-3d6b-447e-97de-fc8bcd9a9f7e` ยังเป็น `READY` และรักษาขอบเขต Slice 1–2
- Owner อนุมัติ Phase 4 และยอมรับความเสี่ยง RPC สำหรับ `authenticated` เมื่อ 4 กันยายน 2569
- Phase 5 สร้าง Named Backup, Apply Production Config และ Runtime Hardening แล้ว Security Advisor
  ลดจาก 98 เหลือ 77 Critical; `PUBLIC/anon` Execute และ `rls-no-policy` เหลือ 0
- วันที่ 5 กันยายน 2569 Custom SMTP เปิดใช้งานแล้ว; Owner เป็น Auth/App User สถานะยืนยันและ
  `ACTIVE`, ได้ Role `SUPER_ADMIN`, มี Audit `OPERATOR_BOOTSTRAP` และระบบรับคำขอส่งลิงก์
  ตั้งรหัสผ่านสำเร็จ
- Owner ตั้งรหัสผ่านและ Login สำเร็จ; `PASSWORD_RESET_COMPLETED`, `LOGIN_SUCCEEDED` และ
  `SESSION_CREATED` ถูกบันทึกครบ
- Edge Function `notification-retry` และ Schedule ทุก 10 นาที Active; รอบจริงผ่าน HTTP 200
- Authenticated Production UAT เป็น `PASS WITH KNOWN ISSUE`; หน้า `/admin/members` ตอบ 404
  แต่ไม่อยู่ในขอบเขต Release A และต้องแก้ก่อน Release B
- Owner อนุมัติ Go-Live Release A เมื่อ 5 กันยายน 2569 โดยรับทราบ Known Issue และกำหนดให้
  แก้หน้า Member Requests ก่อน Release B; Production Data Load ยังต้องได้รับอนุมัติแยก
- วันที่ 8 กันยายน 2569 แก้และตรวจ `/admin/members` กับ `/api/admin/members` แล้ว โดย Admin
  ใช้งานได้, Member ถูกปฏิเสธ 403 และ Anonymous ถูกส่งไป Login/ตอบ 401 ตามประเภทเส้นทาง
- Release B Bundle ของ Slice 12, 12.1 และ 13 ผ่าน Merge Rehearsal บน Schema-only Branch ที่สร้าง
  จาก Production ปัจจุบันโดยตรง: Integration/RLS 39 Assertions, Hosted Smoke 16 Assertions,
  Unit Test 171 Tests, Build 118 Pages และ Responsive Browser 390×844 ผ่าน
- Security Advisor ก่อนและหลัง Bundle เท่ากัน 213 Findings และไม่มี Finding ใหม่จาก Shared Catalog
  หรือ Product Sourcing; Production ยังเป็น Release A และ Release B รอ Owner Approval แยก
- รายละเอียด Gate, Runbook และ Rollback อยู่ที่
  [Release A Readiness Audit](../evidence/2026-08-26-release-a-readiness.md) และ
  [Production Readiness Phase 1–3 Audit](../evidence/2026-09-02-production-readiness-phases-1-3.md) และ
  [Phase 5 Execution Record](../evidence/2026-09-04-production-release-a-phase-5.md) และ
  [Authenticated UAT and Notification Schedule](../evidence/2026-09-05-production-release-a-authenticated-uat.md) และ
  [Release B Production Readiness](../evidence/2026-09-08-release-b-production-readiness.md)

คงเหลือ **2 ขั้นตอนเพื่อเปิด Release B**: Owner อนุมัติ Production Deployment และดำเนินการ
Cutover/Post-deploy Smoke Test
