# GISP — DECISION LOG

**Document Version:** 1.3  
**Status:** Approved Decisions  
**Last Updated:** 1 สิงหาคม 2569 (2026-08-01)  
**Authority:** อยู่ลำดับถัดจาก `MVP BUSINESS MASTER PLAN.md`

---

## วิธีใช้เอกสาร

เอกสารนี้บันทึกคำตัดสินที่ได้รับอนุมัติแล้วเพื่อป้องกันการตีความซ้ำ หากต้องแก้คำตัดสิน ให้เพิ่มรายการใหม่ที่อ้างถึง Decision ID เดิมและระบุว่า Superseded ห้ามแก้ประวัติเดิมจนไม่เหลือร่องรอย

| Decision ID | คำตัดสินที่อนุมัติแล้ว | ผลต่อระบบ | สถานะ |
|---|---|---|---|
| DEC-001 | `MVP BUSINESS MASTER PLAN.md` เป็น Source of Truth สูงสุด | เอกสารอื่นต้องแก้ตาม ไม่สามารถ Override Business Rule ได้ | Approved |
| DEC-002 | Frontend ใช้ Next.js + TypeScript และ Deploy บน Vercel | คำตัดสินเดิม ถูกแทนที่ด้วย DEC-024 | Superseded |
| DEC-003 | Backend เปลี่ยนจาก Supabase เป็น InsForge | ใช้ InsForge Auth, PostgreSQL, RLS, Storage, Email, Migration และ Backup | Approved |
| DEC-004 | Login ใช้ Email + Password | Password อยู่ใน `auth.users`; `public.users` ห้ามมี `password_hash` | Approved |
| DEC-005 | พัฒนาแบบ Workflow Vertical Slice | ทำ DB/API/Admin/Member/Document/Notification/Test ให้จบเป็นโมดูล | Approved |
| DEC-006 | Standard Product ที่มี Active Price ไม่ผ่าน RFQ | ใช้ Product Schedule แล้วสร้าง Order ได้ | Approved |
| DEC-007 | RFQ และ Quotation ใช้เฉพาะ Custom Product | Quotation ออกในชื่อ GISP | Approved |
| DEC-008 | Commission ทุกประเภทเป็น Post-MVP | ไม่สร้าง Commission Table/API/UI/KPI ใน Core MVP | Approved |
| DEC-009 | Member Price เป็นราคาก่อน VAT | เอกสารแยก Subtotal, VAT และ Grand Total | Approved |
| DEC-010 | VAT เริ่มต้น 7% และ Configurable | Snapshot VAT ลง Quotation, Order และ Financial Document | Approved |
| DEC-011 | Deposit/Balance เป็น 50/50 ของยอดรวมหลัง VAT | แบ่งโอนได้หลายครั้ง; Balance = Grand Total - Deposit | Approved |
| DEC-012 | Freight แยกเอกสารและชำระภายหลัง | ไม่รวม Freight ใน Deposit/Balance สินค้า | Approved |
| DEC-013 | Custom Quotation เป็น Versioned Document | หนึ่ง Active Version; Revision เดิมเป็น SUPERSEDED; Accepted Immutable | Approved |
| DEC-014 | Quote Validity เริ่มต้น 30 วัน | Admin แก้ได้ก่อนส่ง | Approved |
| DEC-015 | ใช้ Decimal และ Round Half-up 2 ตำแหน่ง | ห้ามใช้ Binary Floating Point คำนวณยอดเงิน | Approved |
| DEC-016 | Payment VERIFIED จากยอด Finance-verified สะสม | ยอดเกินต้อง Flag และตรวจโดย Finance | Approved |
| DEC-017 | State Transition ใช้ Action Endpoint/Trusted Function | Frontend ห้าม PATCH Status โดยตรง | Approved |
| DEC-018 | Dispatch Gate มี 4 เงื่อนไข | QC ผ่าน, Custom Approved, Customer Balance Verified, Supplier Balance Paid | Approved |
| DEC-019 | Notification ใช้ In-App + InsForge Email | Email Failure ไม่ Rollback ธุรกรรมหลัก; Retry และ Log | Approved |
| DEC-020 | Volume 3-C/3-D ส่วนขั้นสูงเป็น Post-MVP | Core คง Finance, Permission, Configuration, Backup และ Logging ขั้นต่ำ | Approved |
| DEC-021 | Dashboard/Reports ใน MVP เป็นพื้นฐาน | คง Fixed Report: Order, Payment, Delay, Delivery และ Claim | Approved |
| DEC-022 | Storage แบ่งตามระดับความลับ | Public, Member-private, Confidential พร้อม Signed URL/File Metadata | Approved |
| DEC-023 | Environment แยก 3 ระดับ | Frontend และ Backend ใช้ InsForge Development, Staging/UAT และ Production ที่ตรงกัน | Approved — Revised by DEC-024 |
| DEC-024 | ใช้ InsForge ทั้ง Frontend Hosting และ Backend | Frontend Deploy ผ่าน InsForge Deployments; Auth/DB/RLS/Storage/Email/Migration/Backup ใช้ InsForge | Approved |
| DEC-025 | Scheduled Jobs ใช้ InsForge Schedules | Notification Retry และงานตามเวลาไม่ผูกกับ Cron ของ Frontend Host แยก | Approved |
| DEC-026 | ทำ Interactive Demo ก่อนพัฒนา Application จริงต่อ | ใช้ข้อมูลสมมติและ Guided Story เพื่อยืนยัน Workflow/UX ก่อนลงระบบจริง | Approved |
| DEC-027 | Demo แยกจาก Development | ใช้ชื่อ `gisp-mvp-demo`, URL `gisp-mvp-demo.insforge.site` และห้ามเขียนข้อมูลเข้า `gisp-mvp-development` | Approved |
| DEC-028 | Demo ระยะเตรียม MVP จำกัดเฉพาะงาน 1–8 ที่อนุมัติ | ต่อเติม Demo เดิมแบบ Browser-local เท่านั้น ไม่สร้าง Auth, Database, Migration, API หรือ Storage จริง และไม่เพิ่ม Feature นอก Core MVP | Approved |
| DEC-029 | Demo Gate ต้องผ่าน UAT 8 Scenario ก่อนเริ่ม MVP Build | รายการ `ต้องแก้` ไม่เป็น Approved Decision; ต้องผ่านครบและ Admin Sign-off จึงเปลี่ยนเป็น `APPROVED FOR MVP BUILD` | Approved |
| DEC-030 | Demo Version 1.3 ที่ Deploy อยู่เป็น Baseline สำหรับ Demo Gate ปัจจุบัน | ให้ทำ Human UAT 8 Scenario และ GISP Admin Sign-off บน Version 1.3; Full Demo/State Version 4 เป็นการปรับประสบการณ์เพิ่มเติมและไม่เป็น Gate ใหม่ เว้นแต่มี Decision ฉบับใหม่ | Approved |
| DEC-031 | งาน Development ที่สร้างไว้ก่อน Demo Gate ผ่านถือเป็น Preliminary Baseline | Migration/API/UI ที่มีอยู่ไม่ถือว่าได้รับ UAT Approval และห้ามใช้เป็นเหตุผลข้าม Gate; ก่อนเริ่ม Slice ถัดไปต้องปิดรายการ UAT ของ Version 1.3 | Approved |
| DEC-032 | Core MVP ต้องคง Account Recovery, Member Suspension, Excel/CSV Catalog Import, Cancellation Request, Supplier Payment 50/50, Freight Invoice/Payment Verification และ Configuration/Backup/Logging ขั้นต่ำ | ต้องผูกรายการเหล่านี้กับ Vertical Slice และ Definition of Done ที่เกี่ยวข้อง; การนำออกต้องมี Decision ใหม่ | Approved |
| DEC-033 | ใช้ Canonical State Dictionary แยก Custom Request, Custom Quotation, Payment/Order และ Claim | Custom Request ห้ามใช้สถานะ Quotation; Customer Payment/Order ใช้คำว่า `VERIFIED` หลัง Finance ตรวจ; Claim `REJECTED` ต้องมีเหตุผล ส่วน `CLOSED` ต้องมี Resolution และการยืนยันผล | Approved |
| DEC-034 | แยกเลขเอกสารหลักออกจากรหัสอ้างอิง Record | Atomic Document Number ใช้ `QT`, `ORD`, `SO`, `PO`, `INV`, `PAY`, `SHP`, `DLV`, `CLM`; `INV` แยก subtype Deposit/Balance/Freight ส่วน `PRJ`, `CRQ`, `QCI`, `WRC`, `CNS` เป็น Unique Record Reference | Approved |
| DEC-035 | Role ของ Demo ไม่ใช่ Role Catalog ของ Production | Production ใช้ `MEMBER`, `MEMBER_ADMIN`, `PRODUCT_ADMIN`, `ORDER_ADMIN`, `PURCHASING`, `FINANCE`, `QC`, `LOGISTICS`, `EXECUTIVE_VIEWER`, `SUPER_ADMIN`; `GISP Admin` เป็น Role Mapping สำหรับ Demo เท่านั้น | Approved |
| DEC-036 | ข้อความเก่าหรือส่วนรายละเอียดที่ขัดกับ Reconciled Scope ไม่มีผลขยาย Core MVP | Username ไม่เป็น Credential บังคับ, Generic Task Center และ Generic API/Integration UI เป็น Post-MVP; Core คงเฉพาะ Assignment บน Transaction และ Configuration/Backup/Logging ขั้นต่ำ | Approved |

---

## Open Decisions

ไม่มี Open Decision ที่ขัดขวาง Human UAT ของ Demo Version 1.3 ให้ใช้
`gisp-mvp-demo` ที่ Deploy อยู่เป็น Baseline ปัจจุบัน และต้องไม่เปลี่ยน Project Link
ของ `gisp-mvp-development` โดยไม่ตรวจสอบก่อน

## Post-MVP Backlog ที่ล็อกแล้ว

* Commission ทุกประเภท
* Advanced Executive BI
* Custom Report Builder และ Full Export Center
* AI Catalog Import
* Generic Task Center
* Advanced Integration/Infrastructure UI
* Member-branded Quotation Builder

## Demo Enhancement ที่ไม่เป็น MVP Gate

* Full Demo แบบ Unified State Version 4
* การยกเลิก Mode Chooser และรวม Progress/Reset เป็นชุดเดียว

รายการนี้ทำได้ภายหลังเพื่อปรับประสบการณ์นำเสนอ แต่ไม่เปลี่ยน Baseline สำหรับ UAT ตาม DEC-030
