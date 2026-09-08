# GISP — MVP IMPLEMENTATION PLAN

**Document Version:** 2.1  
**Status:** Demo 1.4 Approved — MVP Build Authorized  
**Last Updated:** 6 กันยายน 2569 (2026-09-06)  
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

**สถานะ 18 สิงหาคม 2569:** Demo Version 1.3 ยังคงเป็น Baseline เชิงประวัติที่ `/v1-3` ส่วน Demo
Application 1.4 พัฒนาและ Deploy แล้วที่ `/v1-4` โดยแยก Member Application, GISP Back Office และ
Guided Overview คนละลิงก์ พร้อม Browser-local Shared State Schema 4 ตาม DEC-043

Demo 1.4 ผ่าน Human UAT 8/8 หมวด, `NEEDS FIX` 0, `NOT TESTED` 0 และได้รับ GISP Admin
Human Sign-off แล้วเมื่อ 18 สิงหาคม 2569 จึงเปลี่ยนสถานะเป็น `APPROVED FOR MVP BUILD`
หลักฐานอยู่ที่ `docs/evidence/2026-08-18-demo-1.4-uat-signoff.pdf` งาน Migration/API/UI
ใน Development ที่สร้างไว้ก่อน Gate ผ่านยังเป็น Preliminary Baseline และต้องตรวจตาม Definition of Done
ของแต่ละ Slice ก่อนนับว่าเสร็จ

### 3.2 Target MVP Contract สำหรับ Demo Version 1.4

Contract สำหรับส่งต่อ Vertical Slice 1 จำกัดเฉพาะสิ่งที่ผ่าน UAT ดังนี้:

- หน้าจอ: Foundation/Permission, Product/Supplier Admin, Role Dashboard/Action Required,
  Catalog/Project, RFQ/Quotation, Order/Payment, Production/QC, Shipment/Delivery/Claim,
  Price Structure Builder, Material Sample/Visit, Document Preview/Audit และ UAT & Sign-off
- Demo Role: Member, GISP Admin, Finance, QC, Logistics และ Executive แบบอ่านอย่างเดียว โดย
  `GISP Admin` เป็น Role Mapping เพื่อการนำเสนอ ไม่ใช่ Production Role
- Production Role: `MEMBER`, `MEMBER_ADMIN`, `PRODUCT_ADMIN`, `ORDER_ADMIN`, `PURCHASING`,
  `FINANCE`, `QC`, `LOGISTICS`, `EXECUTIVE_VIEWER`, `SUPER_ADMIN`; Multi-role ใช้กับทีมงาน GISP
  และ `MEMBER_ADMIN` เป็นทีมงานภายใน ไม่ใช่หัวหน้าทีมของ Member
- Transition: ทุกสถานะเปลี่ยนผ่าน Action พร้อม Guard และ Audit; ห้ามแก้สถานะย้อนหลังโดยตรง
- ราคาและเอกสาร: Formula แบบ Versioned `Global → Supplier → Product`, Member Price ก่อน VAT,
  Suggested Resale เพื่อแนะนำ, Freight Estimate 15–20%, VAT Snapshot และ Order/Warranty Snapshot
  ต้องไม่เปลี่ยนเมื่อแก้ Master ภายหลัง
- Payment/Dispatch: Deposit และ Balance 50/50, รองรับ Partial Payment และใช้ Dispatch Gate
  ตาม Business Master Plan ครบทุกเงื่อนไข
- Member-safe: ต้องตัด Factory Cost, Formula/Component, Margin, Supplier Payment, Internal Note,
  Confidential File และ Factory Identity ที่ยังไม่ถูกปลดล็อกก่อน Render/Serialize ให้ Member
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
Session ที่ถูกเพิกถอนใช้งานต่อไม่ได้, ไม่มี Password/Password Hash ใน App Table, Member หนึ่งรายมี
หนึ่ง Member Profile ต่อหนึ่ง Login และไม่มี Member Team/Sub-user/Invitation API; Action จาก Credential
เดียวกัน Audit เป็น Member Account เดียวและไม่อ้างว่าสามารถแยกผู้ใช้จริงได้

### Slice 2 — Product และ Supplier Master

สร้าง Country, Supplier, Category, Collection, Tag, Product, Variant, Option, Media, Document,
Factory Cost, Versioned Price Structure, Formula Component/Override, Member Price, Suggested Resale,
Freight Estimate, Material Sample/Built-in Display, Partner Warranty Version, Approval/Publish,
Catalog QA และ Excel/CSV Import ขั้นพื้นฐาน พร้อม Admin CRUD และ Member Catalog

**Done เมื่อ:** Admin Import Excel/CSV เป็น Draft พร้อม Validation/Error Report ได้, Review/Publish
สินค้าได้เมื่อข้อมูลขั้นต่ำและ Active Member Price ครบ, Super Admin Preview/Activate สูตรได้,
ทุน 100 จาก Template แสดง Member Price 125 และ Suggested Resale 156.25, Member API เห็นเฉพาะ
Member Price/Suggested Resale/Freight Estimate และไม่เห็น Factory Cost/Formula/Margin/Internal Note
หรือ Factory Identity ที่ยังไม่ถูกปลดล็อกผ่าน UI/API/Export/URL

### Slice 3 — Project และรายการสินค้า

สร้าง End Customer, Project, Address, Area, Project Item, Quantity, Option, Product Schedule PDF/Excel,
Showroom Visit Request และ Supplier Disclosure Grant

**Done เมื่อ:** Member สร้าง Project, เพิ่ม Standard Product, เปลี่ยน Quantity/Option และทำรายการเป็น
`READY_TO_ORDER` ได้โดยไม่ผ่าน RFQ; Product Schedule มี Suggested Resale/Freight Estimate;
Visit เดิน `SUBMITTED → APPROVED → COMPLETED` ได้ และชื่อโรงงานเปิดเฉพาะ Member Profile + Supplier
หลัง Completed โดย Super Admin เพิกถอนได้พร้อมเหตุผล

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

**สถานะ 28 สิงหาคม 2569:** พัฒนาบน Backend Branch `slice-6-orders-payments` และผ่าน
Automated Gate แล้ว (`Lint`, TypeScript, Unit Test 88 รายการ, Production Build และ Branch
Integration 19 เงื่อนไข) พร้อม Preview `https://kit6y4pj-7s4.insforge.site`; คงเหลือ Human UAT
และการอนุมัติ Merge/ปิด Slice 6 เท่านั้น โดย Production ยังไม่ถูกเปลี่ยนแปลง

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

สร้าง Claim จาก Delivered Item, Warranty Snapshot, Evidence, Responsibility Suggestion/Confirmation,
Resolution, Rejection Reason, Member Confirmation และ Timeline

**Done เมื่อ:** Claim `REJECTED` ได้เฉพาะเมื่อมี Rejection Reason; Claim `CLOSED` ได้เมื่อมี
Resolution, หลักฐานการดำเนินการ และ Member Confirmation/Admin Review ตามประเภทเคส;
Member เห็นเฉพาะ Claim ของ Member Profile ตนเอง; Manufacturing/Spec ผูก `SUPPLIER`, Transit ผูก
`LOGISTICS_INSURANCE`, Installation ผูก `INSTALLER`, Order Admin ยืนยันผู้รับผิดชอบ และไม่มี Automatic Compensation

### Slice 10 — Dashboard และ Report ขั้นพื้นฐาน

สร้าง Member Dashboard, Admin Action Required, Executive Read-only Summary และ Fixed Reports

**Done เมื่อ:** รายงาน Order, Payment, Delay, Delivery และ Claim ตรง Permission, ระบุเวลา/Filter และไม่เปิดเผย Cost/Confidential Field

### Slice 12 — Member Shared Catalog

Member เลือกเฉพาะสินค้า `PUBLISHED` ที่มี Active Member Price, ตั้งราคาขายลูกค้าได้, จัดลำดับ,
ใส่ Branding/Contact และ Publish เป็น Snapshot ผ่านลิงก์ที่ลูกค้าเปิดได้โดยไม่ต้อง Login

**Done เมื่อ:** Draft และ Snapshot แยกกัน, แก้ Draft แล้วหน้า Public ไม่เปลี่ยนจน Publish ใหม่,
Token หมดอายุ/ถูกปิด/ถูกเปลี่ยนแล้วใช้ไม่ได้, รูป Private เปิดผ่าน Signed URL อายุ 5 นาที,
Public Payload ไม่มี Member Price, Suggested Resale, Freight, Supplier, Cost, Formula หรือ Internal Note
และผ่าน RLS Test ระหว่าง Member สองบริษัทกับ Human UAT บน Development

**สถานะ 6 กันยายน 2569:** `DONE` บน Development หลังสร้าง Backend Branch
`slice-12-shared-catalog` แบบ `schema-only`, ผ่าน Integration/RLS/Public Link/Private Signed URL
28 Assertions, Hosted UAT, Browser Responsive Gate, Human UAT 7/7, Development Integration,
Deployment `823d2a68-d5c2-4286-b0ad-0b1247b1b17a` และ Post-merge Smoke แล้ว
เปิด Feature Flag เฉพาะ Shared Catalog ขณะที่ Product Sourcing ยังปิดอยู่ Production Release A ไม่เปลี่ยน
และเหลือ 0 ขั้นตอนเพื่อปิด Slice 12

### Slice 12.1 — Customer Browse Catalog

ต่อยอด Shared Catalog ให้ Member สร้างลิงก์แบบ `PRODUCT`, `PROJECT`, `CURATED` และ `FULL_CATALOG`
โดยหน้า Public ไม่มีราคา ลูกค้าค้นหา/เลือกหมวด เปิดรายละเอียด เก็บรายการที่สนใจใน Browser และติดต่อ
Member ผ่าน LINE โทรศัพท์หรืออีเมล Product/Project/Curated ใช้ Snapshot ส่วน Full Catalog ใช้รายการ
`PUBLISHED` ที่มี Active Member Price แบบ Live Public-safe และ Snapshot เฉพาะ Branding/Contact/Link Config

**Done เมื่อ:** ลิงก์ทั้ง 4 แบบผ่าน Token Lifecycle, Snapshot/Live Contract, Pagination, Private Signed URL,
Cross-member RLS และ Confidential-field Isolation; Public API/UI ไม่มีราคาและข้อมูล Project/Supplier ภายใน;
Interest List ไม่เขียนข้อมูลลูกค้าลง Backend และผ่าน Responsive/Human UAT บน Development

**สถานะ 6 กันยายน 2569:** `DONE` บน Development ตาม DEC-061/DEC-062 หลัง Backend/Security,
Member Flow, Public Browse Flow, Hosted Integration 69 Assertions, Unit 162 Tests, Production Build,
Mobile/Desktop Responsive Test และ Human UAT 7/7 ผ่าน เจ้าของระบบยืนยันว่า “ใช้ได้หมด”
รวม Schema/Migration เข้า Development และ Deploy ล่าสุด `526c7cf7-1354-42b1-92c6-e25cfad92f09`
พร้อม Post-merge Smoke 54 Assertions แล้ว Full Catalog ผ่านกับสินค้าพร้อมขาย 635 รายการ
หลังล้างสินค้าทดสอบ UAT 4 รายการเมื่อ 7 กันยายน 2569 Full Catalog เหลือสินค้าพร้อมขาย 631 รายการ
คงเหลือ 0 ขั้นตอนเพื่อปิด Slice 12.1; Production Release A ไม่เปลี่ยน

### Slice 13 — Visual Product Sourcing

Member ส่งภาพสินค้าสำเร็จรูปที่หาไม่พบพร้อมจำนวน ขนาด สี วัสดุ งบ วันที่ต้องการและ URL ต้นทาง
ทีม `PRODUCT_ADMIN`, `PURCHASING` หรือ `SUPER_ADMIN` ตรวจ ขอข้อมูลเพิ่ม และเสนอตัวเลือก
Candidate ที่ Member เลือกต้องเชื่อม Product เดิมหรือสร้าง Product Draft เพื่อผ่าน Product Lifecycle

**Done เมื่อ:** มีภาพ JPEG/PNG/WebP อย่างน้อย 1 และไม่เกิน 8 ภาพ ภาพละไม่เกิน 10 MB,
Workflow ทุกทางทำงานผ่าน Trusted Function, Member เห็นเฉพาะคำขอของตนและไม่เห็น Supplier/Cost/Internal Note,
ไฟล์ข้ามบริษัทเปิดไม่ได้ และ Product ที่ Publish แล้วเพิ่มเข้า Project หรือ Shared Catalog ได้

**สถานะ 8 กันยายน 2569:** Backend Branch, Migration, Integration/RLS/File/Workflow Test 20 Assertions,
Member/Admin UI, Member-safe Projection, Unit/Contract Test 42 Files / 171 Tests, Production Build
และ Local Browser/Responsive Test ผ่านแล้ว Merge เข้า Development สำเร็จโดยมี Backup และ Dry-run 0 Conflict
เปิด Development Feature Flag แล้ว Development Preview `dpl_J6A1Pk2SDtRZUMSn3XPhbshZzaJ5`
เป็น READY ที่ `https://gisp-slice-13-visual-sourcing.vercel.app` และ Post-deployment Smoke ผ่าน
ทั้ง Member/Admin, Candidate Image Upload, Member-safe Projection และ Mobile Responsive
แก้ UAT Finding ให้หน้าสร้างอัปโหลดภาพพร้อมร่าง และซ่อน Member Draft จาก Admin Queue/API/RLS แล้ว
ช่องขนาดกว้าง/ลึก/สูงรับมิลลิเมตรจำนวนเต็มและ Hosted Validation `500 × 500 × 700` ผ่านแล้ว
Human UAT ผ่านทั้งหมดและได้รับ Owner Sign-off เมื่อ 8 กันยายน 2569 จึงกำหนดสถานะ
`SLICE_13_ACCEPTED` / `DONE` บน Development และคงเหลือ 0 ขั้นตอนเพื่อปิด Slice 13
โดย Production Release A ไม่เปลี่ยน

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
* Showroom Visit: `SUBMITTED`, `APPROVED`, `COMPLETED`, `REJECTED`, `CANCELLED`; การ Complete
  ต้องผ่าน Action Guard และสร้าง Disclosure Grant แบบ Append-only/Audited
* Production ใช้ Role Catalog ตามหัวข้อ 3.2; Demo Role Mapping ไม่มีผลต่อ RLS หรือ Permission จริง

## 6. Cross-cutting Rules

* Atomic Document Number ใช้ `QT`, `ORD`, `SO`, `PO`, `INV`, `PAY`, `SHP`, `DLV`, `CLM`
* `INV` แยก subtype `DEPOSIT`, `BALANCE`, `FREIGHT`; ส่วน `PRJ`, `CRQ`, `QCI`, `WRC`, `CNS`
  เป็น Unique Record Reference และต้องไม่ใช้เลขซ้ำ
* Quotation, Order และ Financial Document เก็บ VAT/Price/Spec Snapshot
* Order Item เก็บ Price Formula Result และ Partner Warranty Snapshot โดยไม่แก้ย้อนหลัง
* Email Job แยกจาก Business Transaction และ Retry ได้
* Audit Event เป็น Append-only
* Assignment/Due Date/Action Required ต้องผูก Business Record
* File Metadata เก็บ Bucket, Key, URL, Visibility, Owner Organization และ Uploader
* Member-private/Confidential ใช้ RLS และ Signed URL ตามสิทธิ์
* Supplier Identity ใช้ Member Profile + Supplier Disclosure Grant ห้ามอาศัย Organization Membership
* Price Formula ใช้ Component ที่ระบบรองรับเท่านั้น ห้าม Arbitrary Executable Expression

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
และ Confidential Data Leakage พร้อม UAT 8 หมวดของ Demo 1.4 ซึ่งต้องครอบคลุม Formula Inheritance,
125/156.25 Preview, Member-safe Pricing, Material Sample, Visit Disclosure Isolation, Warranty Snapshot,
Claim Responsibility และการไม่มี Member Team/Sub-user

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
