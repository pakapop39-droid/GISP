# **GLOBAL INTERIOR SUPPLY PLATFORM**

## **GISP – CODEX DEVELOPMENT SPECIFICATION**

**Document Version:** 1.5  
**Reconciled Date:** 1 สิงหาคม 2569 (2026-08-01)  
**Authority:** เอกสารควบคุมการลงมือพัฒนา โดยต้องตีความตาม `MVP BUSINESS MASTER PLAN.md` และ `DECISION LOG.md`  
**Change Summary:** ล็อก Demo Gate Version 1.3, Core Scope, Canonical State, Document Number และ Production Role ตาม DEC-030 ถึง DEC-036  
**Document Type:** Software Development Specification  
**Project Stage:** MVP  
**Related Documents:**

1. GISP – MVP Business Master Plan  
2. GISP – Database Schema Specification  
3. GISP – UX/UI Flow Specification

**Primary Purpose:** ใช้เป็นข้อกำหนดหลักสำหรับสั่ง Codex หรือทีมพัฒนา Web Application ให้สร้างระบบ GISP ตาม Business Rules ที่กำหนดไว้ โดยลดการตีความเองของผู้พัฒนาให้น้อยที่สุด

---

# **0\. RECONCILED IMPLEMENTATION CONTRACT**

ข้อกำหนดส่วนนี้แทนข้อความเดิมที่ขัดแย้งกันในเอกสารฉบับนี้ และต้องอ่านร่วมกับ Approved Decisions ใน `MVP BUSINESS MASTER PLAN.md`

1. Source of Truth: Business Master Plan → Decision Log → Implementation Plan → Codex/Blueprint → Database → UX/UI
2. Frontend ใช้ Next.js App Router + TypeScript Strict + Tailwind CSS และ Deploy ผ่าน InsForge Frontend Deployments
3. Backend ใช้ InsForge Auth/PostgreSQL/RLS/Storage/Email/Migration/Backup
4. Login ใช้ Email + Password; `public.users` อ้าง `auth.users` และไม่เก็บรหัสผ่าน
5. Standard Product ที่มี Active Member Price ใช้ Product Schedule แล้ว Order ได้โดยไม่ผ่าน RFQ
6. RFQ และ GISP Custom Quotation แบบ Version ใช้เฉพาะ Custom Product และเป็น Core MVP
7. Member-branded Quotation Builder เป็น Post-MVP
8. Commission ทุกประเภทเป็น Post-MVP แม้มีชื่อ Table/API/Screen เก่าในเอกสารส่วนล่าง
9. Member Price ไม่รวม VAT; Default VAT 7% Configurable และ Snapshot ลงเอกสาร
10. Deposit/Balance 50/50 ของ Grand Total หลัง VAT แบ่งโอนได้หลายครั้ง; Freight แยก
11. ทุก State Transition ใช้ Action Endpoint/Trusted Database Function ห้าม PATCH Status ตรง
12. Dispatch ต้องผ่าน QC, Custom Member Approval, Customer Balance Verified และ Supplier Balance Paid
13. Email Failure ไม่ Rollback ธุรกรรมหลัก ต้อง Retry และ Log
14. พัฒนาตาม 10 Vertical Slices ใน `MVP IMPLEMENTATION PLAN.md`
15. ก่อนพัฒนา Application จริงต่อ ให้ตรวจ Workflow/UX ผ่าน Interactive Demo ที่แยกจาก Development ตาม `DEMO STORY AND MOCK DATA.md`
16. Interactive Demo ปัจจุบัน Deploy แยกแล้วที่ `https://gisp-mvp-demo.insforge.site` โดยใช้ Browser-local fixture และปิด Transaction API ทั้งหมด
17. Demo Version 1.3 มี Overview 10 ขั้น, Functional Prototype เดิม และหน้าจอเตรียม MVP ตามงาน 1–8; ต้องผ่าน UAT 8 Scenario และ Admin Sign-off ก่อนเริ่ม Vertical Slice 1 และผลจาก Demo ไม่ใช่สิทธิ์ให้ขยาย Scope
18. Full Demo Unified State Version 4 เป็น Demo Enhancement ที่ไม่เป็น Gate ใหม่; งาน Development ที่มีอยู่ก่อน Gate ผ่านเป็น Preliminary Baseline
19. Core MVP ต้องคง Account Recovery, Member Suspension, Excel/CSV Import, Cancellation,
Supplier Payment 50/50, Freight Verification และ Configuration/Backup/Logging ขั้นต่ำ
20. Custom Request และ Custom Quotation ใช้ State Machine แยกกันตาม `MVP IMPLEMENTATION PLAN.md`
21. Customer Payment/Order ใช้ `VERIFIED` หลัง Finance ตรวจ; Claim `REJECTED` ต้องมีเหตุผลและ `CLOSED` ต้องมี Resolution/Confirmation
22. Atomic Document Number ใช้ `QT`, `ORD`, `SO`, `PO`, `INV`, `PAY`, `SHP`, `DLV`, `CLM`;
Record Reference ใช้ `PRJ`, `CRQ`, `QCI`, `WRC`, `CNS`
23. Production Role ใช้ Role Catalog ตาม DEC-035; `GISP Admin` เป็น Demo Mapping เท่านั้น
24. Generic Task Center และ Generic API/Integration UI เป็น Post-MVP

---

# **1\. บทนำ**

Global Interior Supply Platform หรือ GISP คือ Web Application สำหรับบริหารการขายและสั่งซื้อเฟอร์นิเจอร์ งานบิลท์อิน วัสดุตกแต่ง และอุปกรณ์จากโรงงานต่างประเทศให้แก่สมาชิกและตัวแทนจำหน่ายในประเทศไทย

ระบบไม่ได้เป็น Marketplace แบบเปิดทั่วไป

GISP ใช้โมเดลธุรกิจดังนี้

โรงงานและซัพพลายเออร์  
        ↓  
บริษัทผู้บริหาร GISP  
        ↓  
สมาชิกและตัวแทนจำหน่าย  
        ↓  
ลูกค้าปลายทางหรือโครงการ

โรงงานไม่มีบัญชีผู้ใช้งานใน MVP

ทีมงาน GISP เป็นผู้

* เพิ่มสินค้า  
* กำหนดราคา  
* รับออเดอร์  
* แยกออเดอร์ตามโรงงาน  
* เปิด PO  
* ติดตามการผลิต  
* ตรวจสอบคุณภาพ  
* จัดการขนส่ง  
* ส่งมอบ  
* บริหารการชำระเงิน  
* จัดการการเคลม

---

# **2\. เป้าหมายของ Development Specification**

เอกสารนี้มีเป้าหมายเพื่อกำหนด

* ขอบเขตระบบ MVP  
* Architecture ที่แนะนำ  
* Technology Stack  
* Module Structure  
* Coding Standard  
* API Structure  
* Authentication และ Authorization  
* Database Access Rules  
* Business Workflow  
* Error Handling  
* Security  
* File Management  
* Testing  
* Deployment  
* Sprint Plan  
* Definition of Done  
* Prompt Structure สำหรับสั่ง Codex

ทีมพัฒนาหรือ Codex ต้องยึดเอกสารนี้เป็นข้อกำหนดหลัก และไม่เพิ่มฟังก์ชันที่อยู่นอก MVP โดยไม่ได้รับอนุมัติ

---

# **3\. หลักการพัฒนาระบบ**

## **3.1 Business Rules มาก่อน UI**

ระบบต้องตรวจสอบ Business Rules ที่ Backend ไม่พึ่งเฉพาะการปิดปุ่มใน Frontend

ตัวอย่าง

แม้ Frontend จะซ่อนปุ่มเปิด PO หากยังไม่ได้รับมัดจำ Backend ก็ต้องปฏิเสธคำสั่งเปิด PO เช่นกัน

## **3.2 Project First**

การสั่งซื้อทุกครั้งต้องเริ่มจาก Project

Project  
→ Project Item  
→ Customer Order  
→ Supplier Order  
→ Production  
→ QC  
→ Shipment  
→ Delivery

ห้ามสร้าง Customer Order ที่ไม่ผูกกับ Project ใน MVP

## **3.3 Member Price และ Factory Cost ต้องแยกกัน**

Member API ห้ามส่งข้อมูล

* Factory Cost  
* Supplier Payment  
* Margin  
* Supplier Commission (หากเพิ่มใน Post-MVP)  
* Internal Note

กฎนี้ใช้กับข้อมูล Core ที่มีอยู่จริงและข้อมูล Post-MVP หากถูกเพิ่มในอนาคต โดยไม่ถือว่า Commission
หรือ Margin View ต้องถูกสร้างใน Core MVP

## **3.4 Order Snapshot**

เมื่อสร้าง Customer Order ต้อง Snapshot ข้อมูลจาก Product และ Project Item ลง Order Item

Order เดิมต้องไม่เปลี่ยนเมื่อ

* Product ถูกแก้ไข  
* ราคาเปลี่ยน  
* รูปเปลี่ยน  
* Option ถูกยกเลิก  
* Supplier หยุดขายสินค้า

## **3.5 Human Approval ก่อนการเงินและโรงงาน**

การดำเนินการสำคัญต้องมีผู้อนุมัติ เช่น

* อนุมัติสมาชิก  
* ยืนยันสลิป  
* เปิด PO  
* ยืนยัน QC  
* ยืนยันการยกเลิก  
* ปิด Claim

## **3.6 MVP First**

ไม่ควรเพิ่มความซับซ้อนต่อไปนี้ใน MVP

* Microservices  
* Event Streaming Platform  
* ERP เต็มรูปแบบ  
* Payment Gateway  
* Supplier Portal  
* Accounting Automation  
* AI Recommendation  
* Native Mobile Application  
* Real-time Ship Tracking  
* Multi-tenant Billing

---

# **4\. Technology Stack ที่แนะนำ**

## **4.1 Frontend**

แนะนำ

* Next.js  
* TypeScript  
* App Router  
* React Server Components ตามความเหมาะสม  
* Tailwind CSS  
* shadcn/ui  
* React Hook Form  
* Zod  
* TanStack Table  
* TanStack Query เฉพาะกรณี Client Fetch  
* Recharts สำหรับ Dashboard  
* Lucide Icons

## **4.2 Backend**

ทางเลือกแนะนำสำหรับ MVP

### **Option A: Next.js Full-stack**

* Next.js API Routes หรือ Route Handlers  
* Server Actions สำหรับ Form ที่เหมาะสม  
* InsForge PostgreSQL  
* InsForge Email + Password Authentication ผ่าน SSR helpers  
* InsForge Storage และ Email

เหมาะสำหรับทีมเล็กและต้องการพัฒนาเร็ว

### **Option B: Separate Backend**

* Next.js Frontend  
* NestJS Backend  
* PostgreSQL  
* Object Storage  
* Redis ในอนาคต

เหมาะเมื่อมีทีม Backend แยกและต้องการขยายระบบมากขึ้น

## **4.3 Recommendation สำหรับ MVP**

ใช้

Next.js  
\+ TypeScript  
\+ InsForge Frontend Deployments  
\+ InsForge PostgreSQL  
\+ InsForge Auth  
\+ InsForge Storage/Email

เหตุผล

* พัฒนาเร็ว  
* Authentication พร้อมใช้  
* รองรับ Row-Level Security  
* PostgreSQL เหมาะกับ Workflow  
* File Storage เชื่อมง่าย  
* ลด DevOps ในระยะแรก  
* Codex สามารถทำงานกับ Stack นี้ได้ดี

---

# **5\. System Architecture**

## **5.1 High-Level Architecture**

Web Browser  
    ↓  
Next.js Frontend  
    ↓  
Application Service Layer  
    ↓  
InsForge Auth / PostgreSQL / Storage / Email  
    ↓  
Audit, Retry และ Notification Queue

## **5.2 Architecture Pattern**

ใช้ Modular Monolith

ระบบอยู่ใน Repository เดียว แต่แยก Module ชัดเจน

ตัวอย่าง

/modules  
  /auth  
  /members  
  /suppliers  
  /catalog  
  /projects  
  /custom-requests  
  /orders  
  /payments  
  /supplier-orders  
  /production  
  /qc  
  /logistics  
  /deliveries  
  /claims  
  /reports  
  /notifications  
  /audit

ไม่ควรแยกเป็น Microservices ใน MVP

## **5.3 Layer Structure**

แต่ละ Module ควรแยก

UI Layer  
Application Layer  
Domain Rules  
Repository / Data Access Layer  
Database

ตัวอย่าง

/modules/orders  
  /components  
  /actions  
  /services  
  /repositories  
  /validators  
  /types  
  /constants  
  /tests

---

# **6\. Repository Structure**

โครงสร้างที่แนะนำ

gisp/  
├── app/  
│   ├── (public)/  
│   ├── (auth)/  
│   ├── (member)/  
│   ├── (admin)/  
│   ├── api/  
│   └── layout.tsx  
│  
├── modules/  
│   ├── auth/  
│   ├── members/  
│   ├── suppliers/  
│   ├── catalog/  
│   ├── projects/  
│   ├── custom-requests/  
│   ├── orders/  
│   ├── payments/  
│   ├── production/  
│   ├── qc/  
│   ├── logistics/  
│   ├── deliveries/  
│   ├── claims/  
│   ├── reports/  
│   ├── notifications/  
│   └── audit/  
│  
├── components/  
│   ├── ui/  
│   ├── layout/  
│   ├── forms/  
│   ├── tables/  
│   └── shared/  
│  
├── lib/  
│   ├── auth/  
│   ├── database/  
│   ├── storage/  
│   ├── email/  
│   ├── permissions/  
│   ├── validation/  
│   ├── errors/  
│   ├── money/  
│   ├── dates/  
│   └── documents/  
│  
├── migrations/  
│   ├── foundation.sql  
│   ├── commerce.sql  
│   └── operations.sql  
├── insforge.toml  
│  
├── tests/  
│   ├── unit/  
│   ├── integration/  
│   └── e2e/  
│  
├── docs/  
│   ├── business/  
│   ├── database/  
│   ├── api/  
│   └── development/  
│  
└── scripts/

---

# **7\. Environment Configuration**

## **7.1 Environment Variables**

ตัวอย่าง

NEXT\_PUBLIC\_APP\_URL  
NEXT\_PUBLIC\_INSFORGE\_URL  
NEXT\_PUBLIC\_INSFORGE\_ANON\_KEY  
INSFORGE\_URL  
INSFORGE\_API\_KEY  
STORAGE\_BUCKET\_PUBLIC  
STORAGE\_BUCKET\_MEMBER  
STORAGE\_BUCKET\_CONFIDENTIAL
EMAIL\_PROVIDER\_API\_KEY  
EMAIL\_FROM\_ADDRESS  
APP\_TIMEZONE  
DEFAULT\_CURRENCY

## **7.2 Security Rule**

* ห้ามนำ Service Role Key ไปใช้ใน Browser  
* Environment Secret ต้องเก็บใน Hosting Platform  
* ห้าม Commit `.env` ลง Git  
* ต้องมี `.env.example`  
* Production และ Staging ใช้ Database แยกกัน

---

# **8\. Authentication**

## **8.1 Login Method**

MVP รองรับ

* Email  
* Password  
* Forgot Password  
* Reset Password  
* Logout

## **8.2 Registration Flow**

Register  
→ Create Auth User  
→ Create User Record  
→ Create Member Profile  
→ Status Pending Approval  
→ Admin Review  
→ Approved  
→ Member Access

## **8.3 Member Approval**

สมาชิก Pending สามารถ Login ได้ แต่ควรเห็นหน้า

> บัญชีอยู่ระหว่างการตรวจสอบ

และยังไม่สามารถ

* เห็น Member Price  
* สร้าง Project  
* เปิด Order

## **8.4 Session**

* ใช้ Secure HTTP-only Cookie  
* Session ต้อง Expire  
* รองรับ Refresh Token  
* Logout ต้อง Clear Session  
* Admin สามารถ Suspend User ได้

---

# **9\. Authorization และ Permission**

## **9.1 Role Based Access Control**

Role หลัก

* MEMBER  
* PRODUCT\_ADMIN  
* ORDER\_ADMIN  
* FINANCE  
* QC\_TEAM  
* LOGISTICS  
* SUPER\_ADMIN

## **9.2 Permission Examples**

member.view\_catalog  
member.create\_project  
member.create\_order  
product.view  
product.create  
product.update  
product.view\_factory\_cost  
order.view\_all  
order.create\_supplier\_order  
order.issue\_po  
payment.verify\_customer\_payment  
payment.record\_supplier\_payment  
qc.create\_report  
qc.approve\_report  
logistics.create\_shipment  
delivery.confirm  
claim.manage  
report.view\_margin  
admin.manage\_roles

## **9.3 Access Control**

ต้องตรวจ Permission ใน

* Page Route  
* Server Action  
* API Route  
* Database Policy  
* File Access

ไม่ควรพึ่ง Frontend อย่างเดียว

---

# **10\. Row-Level Security**

## **10.1 Member Data**

Member อ่านและแก้ไขเฉพาะ

* Member Profile ตนเอง  
* End Customer ตนเอง  
* Project ตนเอง  
* Project Item ตนเอง  
* Customer Order ตนเอง  
* Payment ตนเอง  
* Shipment ตนเอง  
* Claim ตนเอง

## **10.2 Admin Data**

Admin เข้าถึงตาม Role

ตัวอย่าง

Finance เข้าถึง Payment ได้ แต่ไม่จำเป็นต้องแก้ Product Description

## **10.3 Confidential Tables**

ตารางต่อไปนี้ต้องไม่เปิดแก่ Member

* supplier\_payments  
* supplier\_payment\_schedules  
* supplier\_commissions (Post-MVP เท่านั้น)  
* supplier\_commission\_rules (Post-MVP เท่านั้น)  
* factory\_cost fields  
* audit\_logs  
* internal documents  
* margin views (Post-MVP เท่านั้น)

---

# **11\. File Storage Specification**

## **11.1 Storage Buckets**

แนะนำแยก Bucket

### **Public**

* Product Images  
* Public Catalog Assets

### **Member**

* Project Files  
* Custom Request Files  
* Payment Slips  
* Member-visible QC Files  
* Delivery Proof

### **Confidential**

* Price Lists  
* Supplier Contracts  
* Factory Invoices  
* Supplier Payment Evidence  
* Internal Cost Sheets

## **11.2 File Upload Rules**

ต้องตรวจ

* File Type  
* File Size  
* MIME Type  
* Extension  
* User Permission  
* Entity Ownership

## **11.3 File Types**

รองรับ

* PDF  
* JPG  
* JPEG  
* PNG  
* WEBP  
* XLSX  
* CSV  
* DWG  
* DXF  
* ZIP

CAD ไม่ต้อง Preview ใน MVP แต่ต้องดาวน์โหลดได้

## **11.4 Signed URL**

ไฟล์ Member และ Confidential ต้องใช้ Signed URL

ไม่ใช้ Public URL ถาวร

---

# **12\. Module Specification**

# **12.1 Authentication Module**

ฟังก์ชัน

* Register  
* Login  
* Logout  
* Forgot Password  
* Reset Password  
* Email Verification  
* Session Management

หน้า

* Login  
* Register  
* Pending Approval  
* Forgot Password  
* Reset Password

---

# **12.2 Member Management Module**

ฟังก์ชัน

* ดูสมาชิก  
* อนุมัติ  
* ปฏิเสธ  
* ระงับ  
* เปิดใช้งานใหม่  
* กำหนด Price Tier  
* กำหนด Role  
* ดูหลักสูตรที่เคยเรียน

Business Rules

* Pending ห้ามเห็นราคา  
* Suspended ห้ามสร้าง Order  
* Order เดิมยังดูได้  
* การเปลี่ยนสถานะต้องมี Audit Log

---

# **12.3 Supplier Module**

ฟังก์ชัน

* เพิ่ม Supplier  
* แก้ไข Supplier  
* ระงับ Supplier  
* เพิ่ม Contact  
* กำหนด Currency  
* กำหนด Deposit Rule  
* แนบ Catalog  
* แนบ Price List  
* แนบ Agreement

Business Rules

* Supplier Suspended ห้ามสร้าง Product ใหม่เพื่อขาย  
* Product เดิมใน Order เก่ายังแสดงได้  
* Supplier Contact บางส่วนเป็น Confidential

---

# **12.4 Product Catalog Module**

ฟังก์ชันฝั่ง Member

* ดู Catalog  
* Search  
* Filter  
* ดู Product Detail  
* เลือก Variant  
* เลือก Option  
* เพิ่ม Project

ฟังก์ชันฝั่ง Admin

* Create Product  
* Edit Product  
* Publish Product  
* Suspend Product  
* Discontinue Product  
* Manage Images  
* Manage Documents  
* Manage Options  
* Manage Variants  
* Manage Prices

Search Fields

* Product Code  
* Factory SKU  
* Name TH  
* Name EN  
* Name ZH  
* Category  
* Collection  
* Supplier  
* Tag  
* Material  
* Option Code

---

# **12.5 Price Module**

รองรับ

* Factory Cost  
* Member Price  
* Price Tier  
* Currency  
* Exchange Rate  
* Effective Date  
* Expiry Date  
* Price Version

Business Rules

* ห้าม Update ทับราคาเก่า  
* สร้าง Price Version ใหม่  
* ต้องมี Active Member Price จึง Order ได้  
* Factory Cost ห้ามออกผ่าน Member API  
* Order Snapshot ราคาเสมอ

---

# **12.6 Project Module**

ฟังก์ชัน

* Create Project  
* Edit Project  
* Archive Project  
* Add Customer  
* Set Site Address  
* Create Area  
* Add Product  
* Select Options  
* Set Quantity  
* Add Remark  
* Update Item Status  
* Download Product Schedule

Business Rules

* One Project \= One Member  
* One Project \= One End Customer  
* One Project \= One Main Delivery Address  
* One Project \= Many Orders  
* Project Item สั่งบางส่วนได้  
* Ordered Quantity ห้ามเกิน Quantity

---

# **12.7 Product Schedule Module**

สร้างเอกสาร

* PDF  
* Excel

ข้อมูล

* Project  
* Customer  
* Area  
* Product Image  
* Product Code  
* Product Name  
* Options  
* Quantity  
* Member Price  
* Total  
* Remark  
* Lead Time

ห้ามแสดง

* Factory Cost  
* Margin  
* Supplier Payment  
* Internal Note

---

# **12.8 Custom Request Module**

ฟังก์ชัน Member

* Create Request  
* Upload Files  
* Enter Dimensions  
* Enter Quantity  
* Add Note  
* Submit  
* View Linked Custom Quotation  
* Accept/Reject ผ่าน Custom Quotation Action

ฟังก์ชัน Admin

* Review Request  
* Assign Supplier  
* เปลี่ยน Request เป็น `READY_FOR_QUOTE`  
* สร้าง Custom Quotation Version  
* Enter Factory Cost/Member Price/Lead Time และ Attach Confirmed Spec ใน Quotation  
* ส่ง Quotation

Business Rules

* Custom Quotation ต้อง `ACCEPTED` ก่อน Custom Request เปลี่ยนเป็น `CONVERTED` และสร้าง Project Item  
* Confirmed Spec ต้อง Snapshot  
* Custom Product ต้อง Member Approve QC ก่อนส่ง

---

# **12.9 Customer Order Module**

ฟังก์ชัน

* Select Ready Project Items  
* Create Order  
* Preview Order  
* Confirm Order  
* Generate Order Number  
* Create Payment Schedule  
* Create Supplier Orders  
* Track Status  
* Request Cancellation

Business Rules

* One Order ใช้ Project เดียว  
* One Order มีหลาย Supplier ได้  
* ต้อง Snapshot Product และราคา  
* ต้องสร้าง Supplier Order ตาม Supplier อัตโนมัติ  
* Project Item ต้อง Update Ordered Quantity  
* การสร้าง Order ต้องอยู่ใน Transaction

---

# **12.10 Supplier Order Module**

ฟังก์ชัน

* Auto-create Supplier Order  
* View Supplier Items  
* Generate PO  
* Record Factory Confirmation  
* Record Production Dates  
* Record Factory Payment  
* Update Production Status

Business Rules

* หนึ่ง Customer Order มีหนึ่ง Supplier Order ต่อ Supplier  
* เปิด PO ได้หลัง Deposit Verified  
* Supplier Order เป็น Internal Data  
* Member เห็นเฉพาะสถานะภาพรวมที่เปิดเผย

---

# **12.11 Payment Module**

## **Customer Payment**

* Deposit 50%  
* Balance 50%  
* Freight

Flow

Payment Schedule  
→ Member Upload Slip  
→ Finance Review  
→ Verify / Reject  
→ Update Order  
→ Notification

## **Supplier Payment**

* Factory Deposit  
* Factory Balance

Business Rules

* Member Payment และ Supplier Payment แยกกัน  
* Finance เท่านั้นที่ Verify ได้  
* Slip ต้องมี File  
* Verified Payment แก้ไขโดยตรงไม่ได้  
* หากต้องแก้ ให้สร้าง Adjustment Log

---

# **12.12 Production Module**

ฟังก์ชัน

* Add Production Update  
* Add Progress Percentage  
* Add Estimated Completion  
* Upload Photo  
* Upload Video  
* Member Visibility Setting  
* Delay Flag

Business Rules

* ทีมงานเป็นผู้บันทึก  
* โรงงานไม่มี Login  
* Member เห็นเฉพาะ Update ที่อนุญาต  
* Status History ห้ามหาย

---

# **12.13 QC Module**

ฟังก์ชัน

* Create Inspection  
* Select Items  
* Fill Checklist  
* Upload Images  
* Upload Video  
* Set Result  
* Request Rework  
* Reinspect  
* Request Member Approval  
* Member Approve

Standard Product

* ทีมงาน Approve  
* Member ดู Report

Custom Product

* ทีมงาน Approve  
* Member ต้อง Approve for Shipping

---

# **12.14 Warehouse Module**

ฟังก์ชัน

* Create Warehouse Receipt  
* Record Expected Quantity  
* Record Received Quantity  
* Record Package Count  
* Record Actual Weight  
* Record CBM  
* Record Damage  
* Upload Evidence

Business Rules

* Received Quantity ห้ามติดลบ  
* Discrepancy ต้องมี Note  
* Supplier Order Update ตาม Receipt

---

# **12.15 Consolidation Module**

ฟังก์ชัน

* Create Consolidation Group  
* Add Warehouse Items  
* Remove Items ก่อน Ship  
* Confirm Packing  
* Set Planned Ship Date

Default Rule

* Consolidate All

Partial Shipment

* Admin จัดการ  
* ต้องแยก Shipment  
* ต้องบันทึกเหตุผล

---

# **12.16 Shipment Module**

ฟังก์ชัน

* Create Shipment  
* Add Shipment Items  
* Select Shipping Method  
* Set Carrier  
* Set Tracking  
* Set Container  
* Upload Documents  
* Update Status  
* Update ETA  
* Add Delay Note

Business Rules

* Quantity ที่จัดส่งต้องไม่เกิน Remaining Quantity  
* Shipment รองรับ Partial  
* Customer Order Status ต้อง Aggregate จาก Shipment

---

# **12.17 Logistics Cost Module**

ฟังก์ชัน

* Add Cost Item  
* Record Supplier Cost  
* Record Member Charge  
* Group Costs by Order  
* Generate Freight Invoice  
* Track Freight Payment

Business Rules

* Product Price ไม่รวม Freight  
* Freight Invoice ออกหลัง Delivery ตามนโยบาย MVP  
* Member เห็น Charge แต่ไม่เห็น Internal Cost  
* Finance เห็น Margin

---

# **12.18 Delivery Module**

ฟังก์ชัน

* Schedule Delivery  
* Assign Driver  
* Record Vehicle  
* Update Out for Delivery  
* Confirm Delivered  
* Upload Proof  
* Record Recipient  
* Signature  
* Record Damage  
* Create Claim

Business Rules

* Delivered ต้องมี Recipient  
* Delivered ต้องมี Proof  
* Delivered with Issue เชื่อม Claim ได้  
* รองรับ Partial Delivery

---

# **12.19 Claim Module**

ฟังก์ชัน Member

* Create Claim  
* Select Order Item  
* Select Issue Type  
* Upload Evidence  
* Track Status  
* Confirm Resolution

ฟังก์ชัน Admin

* Review Claim  
* Assign Owner  
* Request Information  
* Coordinate Supplier  
* Approve Repair  
* Approve Replacement  
* Record Compensation  
* Close Claim

---

# **12.20 Notification Module**

ช่องทาง MVP

* In-App  
* Email

Trigger สำคัญ

* Member Approved  
* Deposit Awaiting  
* Payment Verified  
* Production Started  
* QC Ready  
* Custom QC Approval Required  
* Balance Payment Required  
* Shipment Departed  
* Shipment Arrived  
* Delivery Scheduled  
* Freight Invoice Issued  
* Claim Updated

---

# **12.21 Dashboard Module**

## **Member Dashboard**

* Active Projects  
* Orders Awaiting Payment  
* Orders In Production  
* Orders In Transit  
* Delivery Schedule  
* Outstanding Amount  
* Claim Status  
* Action Required

## **Admin Dashboard**

* Pending Members  
* Open Orders  
* Supplier Orders Delayed  
* Awaiting QC  
* Awaiting Payment Verification  
* Shipment In Transit  
* Delivery Pending  
* Open Claims

## **Executive Dashboard**

Core MVP แสดงแบบ Read-only เฉพาะ

* Order Count และ Order Value ขั้นพื้นฐาน  
* Payment Verified และ Outstanding  
* Production/Shipment Delay  
* Delivery On-time/Issue  
* Open Claim และ Claim Rate

Factory Cost, Product/Logistics Margin, Conversion และ Advanced BI เป็น Post-MVP สำหรับหน้า Executive

---

# **13\. API Design Standard**

## **13.1 API Style**

ใช้ REST API หรือ Route Handlers แบบ Resource-based

ตัวอย่าง

GET    /api/products  
GET    /api/products/:id  
POST   /api/admin/products  
PATCH  /api/admin/products/:id

GET    /api/projects  
POST   /api/projects  
GET    /api/projects/:id  
PATCH  /api/projects/:id

POST   /api/orders  
GET    /api/orders/:id  
POST   /api/orders/:id/cancellation-request

## **13.2 API Response Format**

Success

{  
  "success": true,  
  "data": {},  
  "meta": {}  
}

Error

{  
  "success": false,  
  "error": {  
    "code": "ORDER\_DEPOSIT\_NOT\_VERIFIED",  
    "message": "ยังไม่สามารถเปิด PO ได้ เนื่องจากยังไม่ได้ยืนยันเงินมัดจำ",  
    "details": {}  
  }  
}

## **13.3 Pagination**

{  
  "page": 1,  
  "pageSize": 20,  
  "totalItems": 250,  
  "totalPages": 13  
}

## **13.4 Filtering**

ตัวอย่าง

/api/products?category=sofa\&supplier=SUP-001\&status=active

## **13.5 Sorting**

sortBy=createdAt  
sortOrder=desc

---

# **14\. API Endpoint Specification**

# **14.1 Authentication**

POST /api/auth/register  
POST /api/auth/login  
POST /api/auth/logout  
POST /api/auth/forgot-password  
POST /api/auth/reset-password  
GET  /api/auth/session

# **14.2 Members**

GET   /api/member/profile  
PATCH /api/member/profile

GET   /api/admin/members  
GET   /api/admin/members/:id  
POST  /api/admin/members/:id/approve  
POST  /api/admin/members/:id/reject  
POST  /api/admin/members/:id/suspend  
POST  /api/admin/members/:id/reactivate

# **14.3 Suppliers**

GET    /api/admin/suppliers  
POST   /api/admin/suppliers  
GET    /api/admin/suppliers/:id  
PATCH  /api/admin/suppliers/:id  
POST   /api/admin/suppliers/:id/suspend

# **14.4 Products**

GET    /api/products  
GET    /api/products/:id

GET    /api/admin/products  
POST   /api/admin/products  
PATCH  /api/admin/products/:id  
POST   /api/admin/products/:id/publish  
POST   /api/admin/products/:id/suspend  
POST   /api/admin/products/:id/discontinue

# **14.5 Product Prices**

GET  /api/admin/products/:id/prices  
POST /api/admin/products/:id/prices  
POST /api/admin/product-prices/:id/approve  
POST /api/admin/product-prices/:id/deactivate

# **14.6 Projects**

GET    /api/projects  
POST   /api/projects  
GET    /api/projects/:id  
PATCH  /api/projects/:id  
POST   /api/projects/:id/archive

GET    /api/projects/:id/areas  
POST   /api/projects/:id/areas

GET    /api/projects/:id/items  
POST   /api/projects/:id/items  
PATCH  /api/projects/:id/items/:itemId  
DELETE /api/projects/:id/items/:itemId

# **14.7 Product Schedule**

GET /api/projects/:id/product-schedule/pdf  
GET /api/projects/:id/product-schedule/excel

# **14.8 Custom Requests**

GET    /api/custom-requests  
POST   /api/custom-requests  
GET    /api/custom-requests/:id  
PATCH  /api/custom-requests/:id  
POST   /api/custom-requests/:id/submit  
POST   /api/custom-requests/:id/accept  
POST   /api/custom-requests/:id/reject

POST   /api/admin/custom-requests/:id/quote  
POST   /api/admin/custom-requests/:id/assign-supplier

# **14.9 Orders**

GET  /api/orders  
POST /api/orders  
GET  /api/orders/:id  
POST /api/orders/:id/confirm  
POST /api/orders/:id/cancellation-request

# **14.10 Supplier Orders**

GET  /api/admin/supplier-orders  
GET  /api/admin/supplier-orders/:id  
POST /api/admin/supplier-orders/:id/issue-po  
POST /api/admin/supplier-orders/:id/factory-confirm  
POST /api/admin/supplier-orders/:id/transition  

> `transition` รับชื่อ Action ที่อนุญาตและผ่าน Backend Guard เท่านั้น ห้ามรับค่า Status ปลายทางจาก Frontend โดยตรง

# **14.11 Customer Payments**

GET  /api/orders/:id/payment-schedules  
POST /api/payment-schedules/:id/upload-slip  
GET  /api/admin/customer-payments  
POST /api/admin/customer-payments/:id/verify  
POST /api/admin/customer-payments/:id/reject

# **14.12 Supplier Payments**

GET  /api/admin/supplier-orders/:id/payment-schedules  
POST /api/admin/supplier-orders/:id/payments  
GET  /api/admin/supplier-payments/:id

# **14.13 Production**

GET  /api/orders/:id/production  
POST /api/admin/supplier-orders/:id/production-updates  
PATCH /api/admin/production-updates/:id

# **14.14 QC**

GET  /api/orders/:id/qc  
POST /api/admin/supplier-orders/:id/qc-inspections  
PATCH /api/admin/qc-inspections/:id  
POST /api/admin/qc-inspections/:id/pass  
POST /api/admin/qc-inspections/:id/request-rework  
POST /api/qc-inspections/:id/member-approval

# **14.15 Warehouse**

GET  /api/admin/warehouse-receipts  
POST /api/admin/warehouse-receipts  
GET  /api/admin/warehouse-receipts/:id

# **14.16 Consolidation**

GET  /api/admin/consolidations  
POST /api/admin/consolidations  
POST /api/admin/consolidations/:id/items  
POST /api/admin/consolidations/:id/confirm

# **14.17 Shipments**

GET  /api/orders/:id/shipments  
GET  /api/admin/shipments  
POST /api/admin/shipments  
GET  /api/admin/shipments/:id  
PATCH /api/admin/shipments/:id  
POST /api/admin/shipments/:id/status

# **14.18 Delivery**

GET  /api/orders/:id/deliveries  
POST /api/admin/deliveries  
PATCH /api/admin/deliveries/:id  
POST /api/admin/deliveries/:id/confirm

# **14.19 Claims**

GET  /api/claims  
POST /api/claims  
GET  /api/claims/:id  
POST /api/claims/:id/add-evidence

GET   /api/admin/claims  
PATCH /api/admin/claims/:id  
POST  /api/admin/claims/:id/status  
POST  /api/admin/claims/:id/close

---

# **15\. Order Creation Transaction**

การสร้าง Order ต้องทำใน Transaction เดียว

## **Step 1**

ตรวจสอบ

* Member Active  
* Project เป็นของ Member  
* Project Item พร้อมสั่ง  
* Quantity มากกว่า 0  
* Option ครบ  
* Product Active  
* Member Price Active  
* Supplier Active

## **Step 2**

Lock Project Items ที่กำลังสั่ง

## **Step 3**

คำนวณยอด

* Member Unit Price  
* Quantity  
* Line Total  
* Order Total  
* Deposit 50%  
* Balance 50%

## **Step 4**

สร้าง Customer Order

## **Step 5**

สร้าง Customer Order Items พร้อม Snapshot

## **Step 6**

Group Items ตาม Supplier

## **Step 7**

สร้าง Supplier Orders

## **Step 8**

สร้าง Supplier Order Items

## **Step 9**

สร้าง Customer Payment Schedules

* Deposit  
* Balance  
* Freight แบบ Not Issued

## **Step 10**

Update Project Items

* ordered\_quantity  
* item\_status

## **Step 11**

สร้าง Timeline และ Audit Log

## **Step 12**

Commit Transaction

หากขั้นตอนใดผิด ต้อง Rollback ทั้งหมด

---

# **16\. State Machine Specification**

# **16.1 Customer Order**

DRAFT  
→ AWAITING\_DEPOSIT  
→ DEPOSIT\_SUBMITTED  
→ DEPOSIT\_VERIFIED  
→ PROCESSING  
→ IN\_PRODUCTION  
→ AWAITING\_BALANCE\_PAYMENT  
→ BALANCE\_PAID  
→ IN\_TRANSIT  
→ DELIVERED  
→ AWAITING\_FREIGHT\_PAYMENT  
→ COMPLETED

สถานะพิเศษ

* PARTIALLY\_IN\_PRODUCTION  
* PARTIALLY\_SHIPPED  
* CANCELLATION\_REQUESTED  
* CANCELLED  
* ON\_HOLD

## **Forbidden Transitions**

* AWAITING\_DEPOSIT → IN\_PRODUCTION  
* DEPOSIT\_SUBMITTED → PO\_ISSUED โดยไม่ Verify  
* DELIVERED → IN\_PRODUCTION  
* COMPLETED → DRAFT

Admin Override ต้องมีเหตุผลและ Audit Log

---

# **16.2 Supplier Order**

PENDING\_PO  
→ PO\_ISSUED  
→ FACTORY\_CONFIRMED  
→ MATERIAL\_PREPARATION  
→ IN\_PRODUCTION  
→ PRODUCTION\_COMPLETED  
→ AWAITING\_QC  
→ QC\_PASSED  
→ READY\_FOR\_BALANCE\_PAYMENT  
→ BALANCE\_PAID  
→ READY\_FOR\_FACTORY\_DISPATCH  
→ DELIVERED\_TO\_CHINA\_WAREHOUSE  
→ CONSOLIDATED  
→ SHIPPED

สถานะพิเศษ

* PARTIALLY\_COMPLETED  
* REWORK\_REQUIRED  
* AWAITING\_MEMBER\_APPROVAL  
* ON\_HOLD  
* CANCELLED

---

# **17\. Validation Standard**

ใช้ Zod Schema ร่วมกันระหว่าง

* Form  
* Server Action  
* API  
* Service Layer

ตัวอย่าง Validation

quantity \> 0  
width\_mm \>= 0  
amount \> 0  
deposit\_percent \+ balance\_percent \= 100  
ordered\_quantity \<= quantity  
shipment\_quantity \<= remaining\_quantity

Validation Error ต้องเป็นข้อความภาษาไทยที่ผู้ใช้เข้าใจได้

---

# **18\. Error Code Standard**

ตัวอย่าง Error Code

AUTH\_INVALID\_CREDENTIALS  
AUTH\_ACCOUNT\_PENDING  
AUTH\_ACCOUNT\_SUSPENDED  
PERMISSION\_DENIED  
PRODUCT\_NOT\_ACTIVE  
PRODUCT\_PRICE\_NOT\_AVAILABLE  
PRODUCT\_OPTION\_REQUIRED  
PROJECT\_NOT\_FOUND  
PROJECT\_ACCESS\_DENIED  
PROJECT\_ITEM\_ALREADY\_ORDERED  
ORDER\_INVALID\_STATUS  
ORDER\_DEPOSIT\_NOT\_VERIFIED  
ORDER\_BALANCE\_NOT\_VERIFIED  
PAYMENT\_ALREADY\_VERIFIED  
PAYMENT\_AMOUNT\_INVALID  
SUPPLIER\_NOT\_ACTIVE  
PO\_ALREADY\_ISSUED  
QC\_MEMBER\_APPROVAL\_REQUIRED  
SHIPMENT\_QUANTITY\_EXCEEDED  
DELIVERY\_PROOF\_REQUIRED  
CLAIM\_ACCESS\_DENIED  
FILE\_TYPE\_NOT\_ALLOWED

---

# **19\. Money Handling**

## **19.1 Database**

ใช้ Decimal หรือ Numeric เท่านั้น

ห้ามใช้ Floating Point สำหรับเงิน

## **19.2 Calculation**

* คำนวณใน Backend  
* Frontend แสดงผลเท่านั้น  
* กำหนดหลักการปัดเศษชัดเจน  
* เก็บ Currency Code ทุก Record

## **19.3 Display**

ตัวอย่าง

THB 125,000.00  
CNY 28,500.00

## **19.4 Exchange Rate**

ราคาทุน CNY สามารถเก็บ

* Original Amount  
* Exchange Rate  
* THB Equivalent

Order Snapshot ต้องเก็บอัตราแลกเปลี่ยนที่ใช้ หากราคา Member ถูกคำนวณจาก Currency ต่างประเทศ

---

# **20\. Date and Time**

* Database ใช้ UTC หรือ TIMESTAMPTZ  
* UI แสดง Asia/Bangkok  
* วันที่เอกสารใช้รูปแบบที่สอดคล้องกัน  
* ETA ต้องแยก Estimated และ Actual  
* Audit Log ใช้เวลาจริงจาก Server

---

# **21\. Audit and Timeline**

## **Audit Log**

ใช้สำหรับข้อมูลเชิงเทคนิค

* Old Value  
* New Value  
* User  
* Time  
* IP  
* Action

## **Timeline**

ใช้แสดงแก่ User และ Admin

ตัวอย่าง

Finance ยืนยันเงินมัดจำ  
โรงงานเริ่มผลิต  
QC ผ่าน  
สินค้าออกจากประเทศจีน

ไม่ควรใช้ Timeline แทน Audit Log

---

# **22\. Notification Architecture**

MVP ใช้ Database Queue แบบง่าย

Flow

Business Event  
→ Create Notification Record  
→ Send Email  
→ Update Delivery Status

ยังไม่จำเป็นต้องใช้ Kafka หรือ Message Broker

Retry ได้ 3 ครั้ง

สถานะ

* pending  
* sent  
* failed  
* read

---

# **23\. Document Generation**

ระบบต้องสร้าง

* Product Schedule PDF  
* Product Schedule Excel  
* Deposit Invoice  
* Balance Invoice  
* Freight Invoice  
* Order Summary  
* Supplier PO  
* QC Report  
* Delivery Note

## **Rules**

* เอกสารมีเลขไม่ซ้ำ  
* เอกสารที่ออกแล้วควรเก็บ File Version  
* หากแก้ไข PO ต้องเพิ่ม Version  
* Member Document ห้ามมี Factory Cost

---

# **24\. Admin UI Rules**

Admin Table ควรมี

* Search  
* Filter  
* Sort  
* Pagination  
* Column Visibility  
* Status Badge  
* Bulk Action เฉพาะที่ปลอดภัย  
* Export ตาม Permission

Action สำคัญต้องมี Confirmation Dialog

ตัวอย่าง

* Verify Payment  
* Issue PO  
* Cancel Order  
* Close Claim  
* Discontinue Product

---

# **25\. Member UI Rules**

Member UI ต้อง

* ใช้ภาษาง่าย  
* แสดง Action Required ชัดเจน  
* ไม่แสดงข้อมูลระบบภายใน  
* แสดง Timeline ของ Order  
* แสดงสถานะที่เข้าใจง่าย  
* รองรับมือถือและแท็บเล็ต  
* มี Empty State  
* มี Error State  
* มี Loading State  
* มี Upload Progress

---

# **26\. Responsive Design**

Breakpoints

* Mobile  
* Tablet  
* Desktop  
* Large Desktop

Member Catalog และ Project ต้องใช้งานบน Tablet ได้ดี เพราะนักออกแบบอาจใช้ที่หน้างานหรือโชว์รูม

Admin Dashboard เน้น Desktop แต่ต้องดูข้อมูลพื้นฐานบน Tablet ได้

---

# **27\. Accessibility**

ขั้นต่ำ

* Form Label ครบ  
* Keyboard Navigation  
* Focus State  
* Color Contrast  
* Error Message เชื่อมกับ Field  
* Button มี Accessible Name  
* รูปมี Alt Text  
* ไม่ใช้สีอย่างเดียวสื่อสถานะ

---

# **28\. Performance Requirements**

MVP เป้าหมาย

* หน้า Catalog โหลดข้อมูลแรกไม่เกินประมาณ 3 วินาทีในเครือข่ายปกติ  
* Pagination ฝั่ง Server  
* รูปใช้ Thumbnail  
* Lazy Load Gallery  
* Query ห้าม N+1  
* Dashboard ใช้ Aggregate Query  
* File Upload แยกจาก Main Transaction  
* Product Search มี Index

---

# **29\. Security Requirements**

## **29.1 OWASP Basics**

ต้องป้องกัน

* SQL Injection  
* XSS  
* CSRF  
* Broken Access Control  
* File Upload Attack  
* Credential Leakage  
* IDOR  
* Rate Abuse

## **29.2 Service Role**

ใช้เฉพาะ Server

## **29.3 Input**

* Validate ทุก Input  
* Sanitize Rich Text  
* Limit File Upload  
* ตรวจ MIME

## **29.4 Sensitive Data**

ไม่ Log

* Password  
* Token  
* Bank Account เต็ม  
* Confidential Document URL  
* Service Role Key

## **29.5 Admin Action**

Action การเงินควรบันทึก

* User  
* Date  
* IP  
* Before  
* After  
* Note

---

# **30\. Testing Strategy**

# **30.1 Unit Test**

ทดสอบ

* Price Calculation  
* Deposit Calculation  
* Balance Calculation  
* Ordered Quantity  
* Shipment Remaining Quantity  
* Status Transition  
* Permission Check  
* Order Grouping by Supplier

# **30.2 Integration Test**

ทดสอบ

* Registration  
* Approval  
* Project Creation  
* Order Creation Transaction  
* Payment Verification  
* Supplier Order Creation  
* QC Approval  
* Shipment Creation  
* Delivery Confirmation  
* Claim Creation

# **30.3 End-to-End Test**

Scenario หลัก

สมัครสมาชิก  
→ Admin อนุมัติ  
→ Member สร้าง Project  
→ เพิ่มสินค้า  
→ สร้าง Order  
→ อัปโหลดสลิป  
→ Finance Verify  
→ Purchasing เปิด PO  
→ Production Update  
→ QC  
→ Balance Payment  
→ Shipment  
→ Delivery  
→ Freight Payment  
→ Completed

# **30.4 Permission Test**

ต้องทดสอบว่า Member ไม่สามารถเรียก API เพื่อดู

* Factory Cost  
* Supplier Payment  
* Margin  
* Member คนอื่น

แม้แก้ URL หรือ Request เอง

---

# **31\. Seed Data**

ต้องมี Seed

* Country  
* Currency  
* Role  
* Permission  
* Price Tier  
* Product Status  
* Order Status  
* Supplier Order Status  
* Payment Status  
* QC Status  
* Shipment Status  
* Claim Status  
* Notification Template  
* Cost Type  
* Document Type

---

# **32\. Logging and Monitoring**

MVP ต้องมี

* Application Error Log  
* Authentication Failure Log  
* API Error Log  
* Payment Verification Audit  
* File Upload Error  
* Database Error  
* Notification Failure

ไม่จำเป็นต้องทำ Full Observability Platform ในระยะแรก แต่ควรเชื่อม Error Tracking เช่น Sentry หรือระบบเทียบเท่า

---

# **33\. Backup and Recovery**

ต้องมี

* Database Backup รายวัน  
* Point-in-Time Recovery ถ้ามี  
* Storage Backup  
* Restore Procedure  
* Staging Database แยก  
* Production Migration Backup ก่อน Deploy

---

# **34\. Deployment Environments**

ต้องมีอย่างน้อย

## **Development**

ใช้ Local Development ร่วมกับ InsForge Development Branch/Project และ InsForge Development Frontend Deployment

## **Staging**

ใช้ InsForge Staging Backend และ InsForge Staging Frontend Deployment สำหรับ UAT/E2E

## **Production**

ใช้ InsForge Production Backend และ InsForge Production Frontend Deployment สำหรับผู้ใช้งานจริง

ข้อมูล, Secret, Domain และ Deployment ของแต่ละ Environment ต้องแยกกันและต้องจับคู่ Frontend/Backend ให้ถูก Environment

---

# **35\. CI/CD**

เมื่อ Push Code

Lint  
→ Type Check  
→ Unit Test  
→ Build  
→ Deploy ไปยัง InsForge Development

เมื่อ Merge Main

Migration Check  
→ Production Build  
→ Deploy ไปยัง InsForge Environment เป้าหมาย  
→ Smoke Test

Database Migration ต้อง Review ก่อน Production

---

# **36\. Git Workflow**

แนะนำ

main  
develop  
feature/\*  
fix/\*  
release/\*

หรือใช้ Trunk-based Development หากทีมเล็ก

Commit ต้องชัดเจน เช่น

feat(projects): add project item workflow  
fix(payments): prevent duplicate verification  
chore(database): add shipment indexes

---

# **37\. Coding Standards**

## **TypeScript**

* เปิด Strict Mode  
* หลีกเลี่ยง `any`  
* ใช้ Type จาก Schema  
* Function ต้องทำหน้าที่เดียว  
* Business Logic ห้ามอยู่ใน UI Component

## **Naming**

* Component: PascalCase  
* Function: camelCase  
* Constant: UPPER\_SNAKE\_CASE  
* Database: snake\_case

## **Code Quality**

* ไม่ทำ Component ใหญ่เกินไป  
* ไม่ Query Database ตรงจาก Client  
* ไม่ Duplicate Business Rule  
* Shared Logic อยู่ Service Layer  
* Validation Schema Reusable

---

# **38\. Definition of Done**

Feature ถือว่าเสร็จเมื่อ

1. ตรงตาม Requirement  
2. มี Permission Check  
3. มี Validation  
4. มี Error State  
5. มี Loading State  
6. Responsive  
7. มี Unit Test ที่จำเป็น  
8. มี Integration Test สำหรับ Workflow สำคัญ  
9. มี Audit Log หากเป็น Action สำคัญ  
10. ไม่มี Factory Cost หลุดสู่ Member  
11. Migration ถูกบันทึก  
12. ผ่าน Code Review  
13. ผ่าน UAT  
14. Documentation ถูกอัปเดต

---

# **39\. MVP Development Phases**

## **Phase 0: Foundation**

* Repository  
* Next.js  
* InsForge Project/Branch  
* Authentication  
* Account Recovery และ Session Management  
* Database Migration  
* Role and Permission  
* Layout  
* Design System  
* File Storage  
* Company Settings และ Document Number ขั้นต่ำ  
* Backup Procedure และ Security/Notification Log ขั้นต่ำ

## **Phase 1: Member and Catalog**

* Registration  
* Approval/Suspension  
* Member Profile  
* Supplier  
* Category  
* Product  
* Variant  
* Option  
* Price  
* Excel/CSV Import  
* Catalog Search  
* Product Detail

## **Phase 2: Project**

* End Customer  
* Address  
* Project  
* Project Area  
* Project Item  
* Product Schedule  
* Custom Request  
* Custom Quotation

## **Phase 3: Order and Payment**

* Customer Order  
* Supplier Order  
* Snapshot  
* Payment Schedule  
* Upload Slip  
* Finance Verification  
* Supplier Payment 50/50 และ Approval  
* PO  
* Cancellation Request

## **Phase 4: Production and QC**

* Production Update  
* Media  
* QC  
* Rework  
* Member Approval

## **Phase 5: Logistics and Delivery**

* Warehouse Receipt  
* Consolidation  
* Shipment  
* Logistics Cost  
* Delivery  
* Proof of Delivery  
* Freight Invoice และ Finance Verification

## **Phase 6: Claim and Dashboard**

* Claim  
* Notifications  
* Admin Dashboard  
* Member Dashboard  
* Basic Executive Summary และ Fixed Report  
* Audit

---

# **40\. Recommended Sprint Plan**

## **Sprint 1**

* Project Setup  
* Auth  
* Roles  
* Member Registration  
* Admin Approval

## **Sprint 2**

* Supplier  
* Category  
* Product  
* Media  
* Product Price

## **Sprint 3**

* Product Catalog  
* Product Detail  
* Search  
* Filter  
* Product Options

## **Sprint 4**

* Customer  
* Project  
* Project Area  
* Project Item

## **Sprint 5**

* Product Schedule  
* Custom Request

## **Sprint 6**

* Order Creation  
* Snapshot  
* Supplier Order Splitting

## **Sprint 7**

* Payment Schedule  
* Slip Upload  
* Finance Verification  
* PO

## **Sprint 8**

* Production  
* QC  
* Member Approval

## **Sprint 9**

* Warehouse  
* Consolidation  
* Shipment

## **Sprint 10**

* Delivery  
* Freight  
* Claim  
* Dashboard  
* UAT

---

# **41\. Acceptance Test Scenarios**

## **Scenario 1: Standard Product Order**

1. Admin เพิ่ม Product  
2. Admin เพิ่ม Member Price  
3. Member สร้าง Project  
4. Member เพิ่ม Product  
5. Member เลือก Options  
6. Member สร้าง Order  
7. ระบบ Snapshot  
8. ระบบแยก Supplier Order  
9. ระบบสร้าง Deposit Schedule

Expected Result

* Order ถูกสร้าง  
* ราคาถูก Lock  
* Factory Cost ไม่แสดง Member  
* Project Item ถูก Mark Ordered

## **Scenario 2: Multi-Supplier Order**

1. Project มีสินค้า Supplier A และ B  
2. Member สร้าง Order เดียว

Expected Result

* Customer Order 1 รายการ  
* Supplier Order 2 รายการ  
* Member เห็น Order เดียว  
* Admin เห็น 2 Supplier Orders

## **Scenario 3: Payment Verification**

1. Member อัปโหลดสลิป  
2. Finance Verify

Expected Result

* Payment Status Verified  
* Order Status Updated  
* Purchasing เปิด PO ได้  
* Member ได้ Notification

## **Scenario 4: Custom Product**

1. Member สร้าง Custom Request  
2. Admin ทำ Request เป็น `READY_FOR_QUOTE` และสร้าง Custom Quotation  
3. Admin ส่ง Quotation และ Member Accept  
4. Request เปลี่ยนเป็น `CONVERTED` และสร้าง Project Item  
5. Order  
6. QC  
7. Member Approve

Expected Result

* สินค้าส่งไม่ได้ก่อน Member Approve QC

## **Scenario 5: Partial Shipment**

1. Supplier A พร้อม  
2. Supplier B ล่าช้า  
3. Admin สร้าง Partial Shipment

Expected Result

* Shipment มีเฉพาะ Item พร้อม  
* Quantity ไม่เกิน Remaining  
* Order Status Partially Shipped

## **Scenario 6: Delivery with Issue**

1. Delivery ถึงหน้างาน  
2. พบสินค้าเสียหาย  
3. Record Delivered with Issue  
4. Create Claim

Expected Result

* Delivery Proof เก็บครบ  
* Claim เชื่อมกับ Order Item  
* Admin เห็น Action Required

---

# **42\. สิ่งที่ Codex ห้ามตัดสินใจเอง**

Codex ห้ามเปลี่ยน Business Rules ต่อไปนี้

1. โรงงานไม่มี Login ใน MVP  
2. Project เป็นศูนย์กลาง  
3. One Project มีหลาย Order  
4. One Order มีหลาย Supplier  
5. ระบบแยก Supplier Order ตามโรงงาน  
6. Member เห็น Member Price เท่านั้น  
7. Member Payment แยก Supplier Payment  
8. Deposit 50% และ Balance 50%  
9. Freight เรียกเก็บแยก  
10. Standard Product สั่งได้ทันทีเมื่อมีราคา Active  
11. Custom Product ต้องผ่าน Quote  
12. Custom Product ต้อง Member Approve QC  
13. Order ต้อง Snapshot ราคาและสเปก  
14. ห้ามเปิด PO ก่อน Deposit Verified  
15. Consolidate เป็นค่าเริ่มต้น  
16. Partial Shipment ควบคุมโดย Admin  
17. หลังรับมัดจำ Member ยกเลิกเองไม่ได้  
18. Delivered ต้องมี Proof  
19. Factory Cost ห้ามออกสู่ Member API  
20. Action สำคัญต้องมี Audit Log

---

# **43\. วิธีสั่ง Codex ทำงาน**

ไม่ควรสั่ง Codex ว่า

> สร้างแอป GISP ทั้งหมด

ควรสั่งเป็น Module หรือ Sprint

ตัวอย่าง

พัฒนา Sprint 1 ของ GISP ตาม Codex Development Specification

ขอบเขต:  
\- InsForge Email + Password Authentication  
\- users  
\- member\_profiles  
\- roles  
\- permissions  
\- user\_roles  
\- Registration  
\- Login  
\- Pending Approval  
\- Admin Member Approval

ข้อกำหนด:  
\- ใช้ Next.js App Router และ TypeScript  
\- ใช้ InsForge สำหรับ Frontend Deployment และ Backend  
\- เปิด TypeScript Strict Mode  
\- ใช้ Zod Validation  
\- ใช้ Row-Level Security  
\- Member Pending ห้ามเห็นราคาและสร้าง Project  
\- ทุกการอนุมัติสมาชิกต้องสร้าง Audit Log  
\- สร้าง Migration และ Seed Data  
\- สร้าง Unit Test และ Integration Test  
\- ห้ามพัฒนา Module อื่นนอกขอบเขต

---

# **44\. Codex Delivery Format**

เมื่อ Codex ทำแต่ละ Sprint ต้องส่ง

1. สรุปสิ่งที่พัฒนา  
2. File Structure ที่เพิ่ม  
3. Database Migration  
4. Environment Variable ที่ต้องเพิ่ม  
5. วิธี Run  
6. วิธี Test  
7. Test Result  
8. Known Limitations  
9. Screenshots หรือ Route ที่สร้าง  
10. รายการ Requirement ที่ครบและยังไม่ครบ

---

# **45\. Codex Review Checklist**

ก่อนยอมรับงาน ให้ตรวจ

* Build ผ่านหรือไม่  
* TypeScript Error หรือไม่  
* Migration ทำงานหรือไม่  
* Seed ทำงานหรือไม่  
* Permission ถูกหรือไม่  
* RLS ถูกหรือไม่  
* Member เห็น Factory Cost หรือไม่  
* Responsive หรือไม่  
* Error State มีหรือไม่  
* Audit Log ทำงานหรือไม่  
* Test ผ่านหรือไม่  
* มี Code ซ้ำหรือไม่  
* Business Logic อยู่ Backend หรือไม่

---

# **46\. MVP Release Criteria**

GISP MVP พร้อมเปิดใช้งานเมื่อ

* สมาชิกสมัครและอนุมัติได้  
* Product Catalog ใช้งานได้  
* Member Price แสดงถูกต้อง  
* Project ใช้งานได้  
* Product Schedule ดาวน์โหลดได้  
* Custom Request ใช้งานได้  
* Customer Order หลาย Supplier ได้  
* Supplier Order แยกถูกต้อง  
* Payment 50/50 ใช้งานได้  
* Finance Verify ได้  
* PO เปิดได้  
* Production Update ได้  
* QC และ Custom Approval ได้  
* Shipment ใช้งานได้  
* Delivery Proof ใช้งานได้  
* Freight Invoice ใช้งานได้  
* Claim ใช้งานได้  
* Permission และ RLS ผ่าน Test  
* Backup พร้อม  
* UAT ผ่าน  
* ไม่มี Critical Security Issue

---

# **47\. Post-MVP Roadmap**

หลังระบบ MVP มีผู้ใช้งานจริง สามารถพัฒนา

* AI Catalog Import  
* Google Drive Intake Automation  
* Supplier Portal  
* Quotation Builder  
* Dealer White-label  
* Smart BOQ Integration  
* Material Library Integration  
* Payment Gateway  
* Accounting API  
* Logistics API  
* Automatic Slip Verification  
* Real-time Shipment Tracking  
* Mobile Application  
* Recommendation Engine  
* Multi-company  
* Multi-country  
* Advanced Commission  
* Warehouse Stock  
* Sample Borrowing  
* Shop Drawing Revision Workflow

---

# **48\. ข้อสรุปสำหรับทีมพัฒนา**

GISP ต้องถูกพัฒนาเป็น Modular Monolith ที่มีโครงสร้างชัดเจน โดยใช้ Project เป็นศูนย์กลางและแยกข้อมูล Member กับข้อมูลภายในบริษัทอย่างเด็ดขาด

โครงสร้างระบบหลักคือ

Authentication  
→ Member  
→ Catalog  
→ Project  
→ Custom Request  
→ Customer Order  
→ Supplier Order  
→ Payment  
→ Production  
→ QC  
→ Warehouse  
→ Shipment  
→ Delivery  
→ Freight  
→ Claim  
→ Reporting

สิ่งสำคัญที่สุดในการพัฒนาไม่ใช่จำนวนหน้าจอ แต่คือความถูกต้องของ Workflow และ Business Rules

ระบบต้องรับประกันว่า

* สมาชิกไม่เห็นต้นทุน  
* ออเดอร์ไม่ถูกสั่งซ้ำ  
* ราคาไม่เปลี่ยนย้อนหลัง  
* การเงินตรวจสอบย้อนหลังได้  
* โรงงานแต่ละรายติดตามแยกกันได้  
* Shipment รองรับหลายโรงงาน  
* Custom Product ไม่ถูกส่งโดยไม่ได้รับอนุมัติ  
* ทุก Action สำคัญมีผู้รับผิดชอบและประวัติ

Codex ต้องพัฒนาทีละ Sprint และห้ามขยาย Scope โดยไม่ได้รับอนุมัติ เพื่อให้ MVP เปิดใช้งานได้เร็ว มีความเสี่ยงต่ำ และสามารถต่อยอดได้ในอนาคต
