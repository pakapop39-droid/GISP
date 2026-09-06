# GISP — MVP IMPLEMENTATION PLAN

**Document Version:** 1.4  
**Status:** Approved Implementation Baseline  
**Last Updated:** 1 สิงหาคม 2569 (2026-08-01)  
**Business Authority:** `MVP BUSINESS MASTER PLAN.md`  
**Decision Authority:** `DECISION LOG.md`

---

## 1. วิธีพัฒนา

ใช้ Modular Monolith บน Next.js App Router และแบ่งงานเป็น Workflow Vertical Slice ทุก Slice ต้องมีข้อมูล,
Permission/RLS, API หรือ Server Action, หน้าหลังบ้าน/หน้าสมาชิกตามผู้เกี่ยวข้อง, เอกสารและ Notification
เฉพาะเหตุการณ์ที่กำหนด, Audit และ Automated Test ก่อนเริ่ม Slice ถัดไป

ห้ามสร้างหน้าจอทั้งหมดก่อนฐานข้อมูล และห้ามขยายฐานข้อมูลลึกเกิน Core MVP โดยยังไม่มี End-to-End Scenario ที่ใช้งานได้

## 2. Architecture Baseline

| Layer | Technology / Rule |
|---|---|
| Frontend | Next.js App Router, React, TypeScript Strict, Tailwind CSS 3.4 |
| Frontend Hosting | InsForge Frontend Deployments |
| Auth | InsForge Email + Password, SSR cookies |
| Database | InsForge PostgreSQL, Migration, RLS |
| Storage | InsForge Storage: public, member-private, confidential |
| Email | InsForge Email บนแพ็กเกจที่รองรับ Custom Email |
| Validation | Zod ที่ Boundary และ SQL Constraint/Trigger ที่ Database |
| State | Action Endpoint / Trusted SQL Function เท่านั้น |
| Money | Decimal, Round Half-up 2 ตำแหน่ง, Snapshot |
| Audit | Append-only Audit Event |
| Architecture | Modular Monolith แบ่งตาม Business Module |

## 3. Environment

Application จริงมี 3 Environment คือ Development, Staging/UAT และ Production ส่วน Demo เป็น
Browser-local Sandbox แยกต่างหากและไม่นับเป็น Backend Environment ที่สี่

| Environment | Frontend | Backend | ใช้สำหรับ |
|---|---|---|---|
| Demo Sandbox | `https://gisp-mvp-demo.insforge.site` | Browser-local fixture; Transaction API disabled | ตรวจภาพรวม Workflow/UX ก่อนทำระบบจริง |
| Development | Local / InsForge Development Deployment | InsForge Development Branch/Project | พัฒนาและ Automated Test |
| Staging | InsForge Staging Deployment | InsForge Staging | UAT และ E2E |
| Production | InsForge Production Deployment | InsForge Production | ผู้ใช้งานจริง |

Browser เก็บเฉพาะ `NEXT_PUBLIC_INSFORGE_URL` และ `NEXT_PUBLIC_INSFORGE_ANON_KEY` ส่วน `INSFORGE_URL` และ `INSFORGE_API_KEY` เป็น Server-only

Frontend ต้อง Deploy จาก Source Root ด้วย `npx @insforge/cli deployments deploy .` หลัง Local Build ผ่าน และต้องตรวจ `deployments env list` ก่อน Deploy ทุกครั้ง ส่วน Notification Retry ใช้ InsForge Schedule เรียก Endpoint/Function ที่ได้รับการป้องกันด้วย Secret

### 3.1 Demo Gate ก่อนพัฒนา Application จริงต่อ

ก่อนเริ่ม Vertical Slice ถัดไป ให้สร้าง Interactive Demo แยกชื่อ
`gisp-mvp-demo` โดยใช้ Guided Story และข้อมูลสมมติจาก
`DEMO STORY AND MOCK DATA.md`

Demo ใช้ Browser-local state, Role Switcher และ Reset ได้ ห้ามเขียนข้อมูลหรือ
Deploy ทับ `gisp-mvp-development`

**สถานะ 1 สิงหาคม 2569:** ตาม DEC-030 ให้ Demo Version 1.3 ที่ Deploy อยู่เป็น Baseline สำหรับ
Human UAT และ Demo Gate ปัจจุบัน โดยต่อเติมบน URL และ Riverstone Data เดิม พร้อม
Foundation/Permission, Product/Supplier Admin, Role Dashboard, Exception/Recovery และหน้า
UAT & Sign-off 8 Scenario ใช้ Browser-local State Version 3 เท่านั้น การทดสอบอัตโนมัติ 30 ข้อ,
Lint, Type Check และ Production Build ผ่านแล้ว สถานะ Demo Gate ยังคง `IN UAT` จนผู้ดูแล
ทำ UAT ครบ 8 Scenario และกด Sign-off เอง จึงเปลี่ยนเป็น `APPROVED FOR MVP BUILD`

Full Demo แบบ Unified State Version 4 เป็น Demo Enhancement ที่ไม่เป็น Gate ใหม่ เว้นแต่มี
Approved Decision ฉบับใหม่ งาน Migration/API/UI ใน Development ที่มีอยู่ก่อน Gate ผ่านให้ถือเป็น
Preliminary Baseline ซึ่งยังไม่ใช่หลักฐานว่า Workflow ผ่าน UAT และห้ามใช้เพื่อข้าม Gate

### 3.2 MVP Contract ที่ล็อกจาก Demo Version 1.3

Contract สำหรับส่งต่อ Vertical Slice 1 จำกัดเฉพาะสิ่งที่ผ่าน UAT ดังนี้:

- หน้าจอ: Foundation/Permission, Product/Supplier Admin, Role Dashboard/Action Required,
  Catalog/Project, RFQ/Quotation, Order/Payment, Production/QC, Shipment/Delivery/Claim,
  Document Preview/Audit และ UAT & Sign-off
- Demo Role: Member, GISP Admin, Finance, QC, Logistics และ Executive แบบอ่านอย่างเดียว โดย
  `GISP Admin` เป็น Role Mapping เพื่อการนำเสนอ ไม่ใช่ Production Role
- Production Role: `MEMBER`, `MEMBER_ADMIN`, `PRODUCT_ADMIN`, `ORDER_ADMIN`, `PURCHASING`,
  `FINANCE`, `QC`, `LOGISTICS`, `EXECUTIVE_VIEWER`, `SUPER_ADMIN` และผู้ใช้หนึ่งคนมีหลาย Role ได้
- Transition: ทุกสถานะเปลี่ยนผ่าน Action พร้อม Guard และ Audit; ห้ามแก้สถานะย้อนหลังโดยตรง
- ราคาและเอกสาร: Member Price ก่อน VAT, VAT Snapshot, Quotation Version และ Order Snapshot
  ต้องไม่เปลี่ยนเมื่อแก้ Product Master ภายหลัง
- Payment/Dispatch: Deposit และ Balance 50/50, รองรับ Partial Payment และใช้ Dispatch Gate
  ตาม Business Master Plan ครบทุกเงื่อนไข
- Member-safe: ต้องตัด Factory Cost, Supplier Payment, Internal Note และ Confidential File
  ก่อน Render/Serialize ให้ Member
- Baseline: ใช้ Dynamic Document Preview และไฟล์ตัวอย่างที่อยู่ใน Demo เป็นเกณฑ์เฉพาะหน้าจอ
  และข้อมูลที่ผ่าน UAT ไม่ถือเป็น Full Export Center

รายการ UAT ที่เป็น `ต้องแก้` ยังไม่ถูกล็อกเป็น Contract และห้ามบันทึกเป็น Approved Decision

## 4. ลำดับ Vertical Slice และ Definition of Done

### Slice 1 — Login, บริษัท, ผู้ใช้ และสิทธิ์

สร้าง Organization, User Profile, Member Approval/Reject/Suspension, Account Recovery
(Forgot/Reset Password), Session Management, Multi-role, Permission Guard, RLS, App Shell,
Company Settings ขั้นต่ำ, Document Sequence/Record Reference, Audit/Security Log และ File Metadata

**Done เมื่อ:** สมัคร → อนุมัติ → Login ได้, Forgot/Reset Password ทำงานได้, Pending Member
เข้า Catalog/Project ไม่ได้, Suspended Member ดูประวัติเดิมแบบ Read-only ได้แต่ไม่เห็นราคาและสร้าง/แก้
ธุรกรรมใหม่ไม่ได้, แต่ละ Production Role เห็นเฉพาะข้อมูลตามสิทธิ์,
Session ที่ถูกเพิกถอนใช้งานต่อไม่ได้ และไม่มี Password/Password Hash ใน App Table

### Slice 2 — Product และ Supplier Master

สร้าง Country, Supplier, Category, Collection, Tag, Product, Variant, Option, Media, Document,
Factory Cost, Member Price/Price Version, Approval/Publish, Catalog QA และ Excel/CSV Import ขั้นพื้นฐาน
พร้อม Admin CRUD และ Member Catalog

**Done เมื่อ:** Admin Import Excel/CSV เป็น Draft พร้อม Validation/Error Report ได้, Review/Publish
สินค้าได้เมื่อข้อมูลขั้นต่ำและ Active Member Price ครบ, Member เห็นเฉพาะ Active Member Price
และไม่เห็น Factory Cost/Internal Note ผ่าน UI/API/Export/URL

### Slice 3 — Project และรายการสินค้า

สร้าง End Customer, Project, Address, Area, Project Item, Quantity, Option และ Product Schedule PDF/Excel

**Done เมื่อ:** Member สร้าง Project, เพิ่ม Standard Product, เปลี่ยน Quantity/Option และทำรายการเป็น `READY_TO_ORDER` ได้โดยไม่ผ่าน RFQ

### Slice 4 — Custom Request for Quotation

สร้าง Custom Request, Spec, Attachment, Supplier Candidate, Assignment, Due Date, Action Required และ Request History

**Done เมื่อ:** `DRAFT → SUBMITTED → UNDER_REVIEW → NEED_INFO → SUBMITTED` และ
`UNDER_REVIEW → READY_FOR_QUOTE` ทำงานครบ, ยกเลิกได้ก่อน Convert และ RLS ป้องกันคำขอข้ามสมาชิก

### Slice 5 — Custom Quotation

สร้าง GISP Custom Quotation แบบ Version, PDF, VAT, Lead Time, Validity, Confirmed Spec และ Accept/Reject

**Done เมื่อ:** `DRAFT → SENT → ACCEPTED / REJECTED / EXPIRED / CANCELLED` ทำงานครบ,
มี Active Version เดียว, Revision เดิมเป็น `SUPERSEDED`, Accepted Version แก้ไม่ได้,
Custom Request เปลี่ยนเป็น `CONVERTED` และสร้าง Project Item Snapshot เป็น `READY_TO_ORDER`

### Slice 6 — Order และ Payment

สร้าง Partial Selection/Quantity, Order Snapshot, Supplier Order, Customer Deposit/Balance 50/50,
Partial Payment, Finance Verification, Overpayment Flag, Supplier Deposit/Balance 50/50,
Supplier Payment Approval/History, PO และ Cancellation Request

**Done เมื่อ:** Customer Deposit Verified ครบจึงออก PO ได้, Customer/Supplier Payment
Reject/Resubmit หรือ Approval ตามสิทธิ์ได้, Cancellation ก่อน/หลังรับมัดจำทำตาม Business Rule,
Audit ย้อนหลังได้ และ Factory Cost/Supplier Payment ไม่รั่วถึง Member

### Slice 7 — Production และ QC

สร้าง Production Update, ETA, Delay, Media, QC Checklist, Result, Rework และ Reinspection

**Done เมื่อ:** Standard ใช้ GISP Approval, Custom ต้อง Member Approval และ Dispatch Gate ปิดกั้นสินค้าที่ยังไม่ครบเงื่อนไข

### Slice 8 — Shipment และ Delivery

สร้าง Warehouse Receipt, Consolidation, Partial Shipment, Tracking, Import Status,
Delivery Appointment/Reschedule, Partial Delivery, Delivered with Issue, Proof of Delivery,
Actual Logistics Cost, Freight Invoice หลัง Delivery, Freight Slip และ Finance Verification

**Done เมื่อ:** Shipment Quantity ไม่เกิน Dispatch-ready Quantity, Delivery ทุกครั้งมี Recipient/Evidence,
กรณีส่งบางส่วนหรือมีปัญหามีประวัติครบ, Freight แยกจากราคาสินค้าและ Order เป็น `COMPLETED`
เมื่อส่งครบและ Freight Payment ได้รับ Finance Verification แล้ว

### Slice 9 — Claim

สร้าง Claim จาก Delivered Item, Evidence, Resolution, Rejection Reason, Member Confirmation และ Timeline

**Done เมื่อ:** Claim `REJECTED` ได้เฉพาะเมื่อมี Rejection Reason; Claim `CLOSED` ได้เมื่อมี
Resolution, หลักฐานการดำเนินการ และ Member Confirmation/Admin Review ตามประเภทเคส;
Member เห็นเฉพาะ Claim ของ Organization ตนเอง

### Slice 10 — Dashboard และ Report ขั้นพื้นฐาน

สร้าง Member Dashboard, Admin Action Required, Executive Read-only Summary และ Fixed Reports

**Done เมื่อ:** รายงาน Order, Payment, Delay, Delivery และ Claim ตรง Permission, ระบุเวลา/Filter และไม่เปิดเผย Cost/Confidential Field

## 5. Canonical State และ Role Contract

* Custom Request: `DRAFT`, `SUBMITTED`, `UNDER_REVIEW`, `NEED_INFO`, `READY_FOR_QUOTE`,
  `CONVERTED`, `CANCELLED`; ห้ามใช้ `QUOTED` หรือ `MEMBER_CONFIRMED` ซึ่งเป็นหน้าที่ของ Quotation
* Custom Quotation: `DRAFT`, `SENT`, `ACCEPTED`, `REJECTED`, `EXPIRED`, `CANCELLED`, `SUPERSEDED`
* Payment Transfer: `SUBMITTED`, `VERIFIED`, `REJECTED`; Payment Schedule ใช้ `PENDING`,
  `PARTIALLY_VERIFIED`, `VERIFIED` และ Overpayment เป็น Flag/Review ไม่ใช่การ Verify อัตโนมัติ
* Customer Order ใช้ `DEPOSIT_VERIFIED` และ `BALANCE_VERIFIED` หลัง Finance ตรวจ ห้ามใช้คำว่า
  `PAID` แทน `VERIFIED` ในสถานะที่ต้องผ่าน Finance
* Claim: `REJECTED` เป็น Terminal State พร้อม Rejection Reason; `RESOLVED` เป็นผลดำเนินการ;
  `CLOSED` ต้องมี Resolution และการยืนยันผล
* Production ใช้ Role Catalog ตามหัวข้อ 3.2; Demo Role Mapping ไม่มีผลต่อ RLS หรือ Permission จริง

## 6. Cross-cutting Rules

* Atomic Document Number ใช้ `QT`, `ORD`, `SO`, `PO`, `INV`, `PAY`, `SHP`, `DLV`, `CLM`
* `INV` แยก subtype `DEPOSIT`, `BALANCE`, `FREIGHT`; ส่วน `PRJ`, `CRQ`, `QCI`, `WRC`, `CNS`
  เป็น Unique Record Reference และต้องไม่ใช้เลขซ้ำ
* Quotation, Order และ Financial Document เก็บ VAT/Price/Spec Snapshot
* Email Job แยกจาก Business Transaction และ Retry ได้
* Audit Event เป็น Append-only
* Assignment/Due Date/Action Required ต้องผูก Business Record
* File Metadata เก็บ Bucket, Key, URL, Visibility, Owner Organization และ Uploader
* Member-private/Confidential ใช้ RLS และ Signed URL ตามสิทธิ์

* Company Settings ใน Core แก้ VAT Default ได้ แต่ Customer/Supplier Deposit/Balance คง 50/50
* Generic Task Center และ Generic API/Integration UI เป็น Post-MVP; Core ใช้ Assignment/Due Date
  ที่ผูก Business Record และ Logging/Retry ที่จำเป็นเท่านั้น

## 7. Test Gate ต่อ Slice

ทุก Slice ต้องผ่าน:

1. Type Check
2. Unit Test
3. Integration Test
4. Permission/RLS Test
5. Responsive Test
6. UAT Scenario

Test Scenario รวม Account Recovery/Suspension, Standard Flow, Custom Flow, Multi-supplier,
Catalog Import, Partial Order, Partial Payment, Reject/Resubmit, Cancellation, Supplier Payment,
Rework, Partial Shipment/Delivery, Delivery with Issue, Freight Verification, Snapshot Immutability
และ Confidential Data Leakage

## 8. Production Readiness Gate

* Backup/Restore Procedure ผ่านการทดลองใน Staging
* Security Review และ RLS Matrix Review
* Seed Data Review
* Smoke Test และ End-to-End Scenario
* InsForge Deployment Environment Variables ครบและไม่เปิดเผย API Key
* InsForge Paid Plan/Feature รองรับ Custom Email
* Rollback Plan และผู้รับผิดชอบ Incident ชัดเจน

## 9. Cloud Connection Checklist

ก่อน Apply Migration หรือ Deploy จริง ต้องมี:

* InsForge account ที่ Login แล้ว
* Development Project ที่ Link กับ workspace
* InsForge Organization และ Project/Environment ที่เลือกแล้ว
* Domain/Callback URL ของแต่ละ Environment
* ผู้รับผิดชอบ Finance/Admin คนแรกสำหรับ Bootstrap Role
