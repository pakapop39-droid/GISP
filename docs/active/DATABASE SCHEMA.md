# **GLOBAL INTERIOR SUPPLY PLATFORM**

## **GISP – DATABASE SCHEMA SPECIFICATION**

**Document Version:** 2.1  
**Reconciled Date:** 1 สิงหาคม 2569 (2026-08-01)  
**Authority:** รายละเอียดโครงสร้างข้อมูลภายใต้ `MVP BUSINESS MASTER PLAN.md` และ `DECISION LOG.md`  
**Change Summary:** เพิ่ม Logical Schema สำหรับ Price Formula, Material Visit Disclosure และ Partner Warranty  
**Document Type:** Logical Database Schema Specification  
**Project Stage:** Minimum Viable Product  
**Related Document:** `MVP BUSINESS MASTER PLAN.md` ฉบับ Active  
**Primary Database:** InsForge PostgreSQL  
**Initial Market:** ประเทศไทย  
**Initial Supplier Country:** ประเทศจีน  
**Primary Currency Display:** THB  
**Supported Source Currency:** CNY และสกุลเงินอื่นในอนาคต

---

# **0\. RECONCILED SCHEMA CONTRACT**

Migration SQL ในโฟลเดอร์ `migrations/` เป็น Physical Schema สำหรับ Core MVP ส่วนเอกสารฉบับนี้เป็น Logical Reference หากชื่อ Field/Status เดิมขัดกับ Migration และ Approved Decisions ให้แก้เอกสารตาม Source of Truth ก่อนใช้

กฎที่บังคับใช้:

* `public.users.id` อ้าง `auth.users(id)` และไม่มี `password_hash`
* ทุก Business Table อยู่ใน `public`; ใช้ SQL Grant + RLS
* Role เป็น Many-to-many ผ่าน `user_roles`
* Standard Product ไม่สร้าง RFQ; Custom เท่านั้นที่ใช้ `custom_requests` และ `custom_quotations`
* Custom Quotation มี Version, Active Version เดียว และ Accepted Version แก้ไม่ได้
* Quotation, Order และ Financial Document มี Price/Spec/VAT Snapshot
* Price Structure เป็น Versioned `Global → Supplier → Product`; เฉพาะ `SUPER_ADMIN` จัดการและ Activate
* Member Response แสดง Member Price, Suggested Resale และ Freight Estimate แต่ตัด Cost/Formula/Margin
* Member หนึ่งรายมีหนึ่ง Member Profile ต่อหนึ่ง Login ไม่มี Member Team/Sub-user/Invitation ใน Core
* Supplier Identity เปิดเฉพาะเมื่อมี Active Disclosure Grant ของ Member Profile + Supplier
* Partner Warranty มี Version และ Snapshot ลง Order Item; Claim แยก Responsibility ตามสาเหตุ
* Payment รองรับหลาย Transfer ต่อ Schedule และ Verify จากยอดสะสม
* State Transition และ Dispatch Gate บังคับใน Trusted Function/Trigger
* Audit Event และ Status History เป็น Append-only
* Storage Metadata เก็บ Bucket, Key และ URL แยก Visibility
* Production Role Catalog ใช้ `MEMBER`, `MEMBER_ADMIN`, `PRODUCT_ADMIN`, `ORDER_ADMIN`,
  `PURCHASING`, `FINANCE`, `QC`, `LOGISTICS`, `EXECUTIVE_VIEWER`, `SUPER_ADMIN`
* Core Schema ต้องรองรับ Account Recovery ผ่าน Auth, Member Suspension, Catalog Import,
  Cancellation, Supplier Payment, Freight Verification และ Configuration/Backup/Logging ขั้นต่ำ
* Canonical State และ Numbering ใช้ตาม `MVP IMPLEMENTATION PLAN.md` Version 1.6 และ DEC-033/DEC-034/DEC-037 ถึง DEC-042

---

# **1\. วัตถุประสงค์ของเอกสาร**

เอกสารฉบับนี้กำหนดโครงสร้างฐานข้อมูลสำหรับ Global Interior Supply Platform หรือ GISP เพื่อให้ทีมธุรกิจ ทีม UX/UI และทีมพัฒนาระบบเข้าใจข้อมูลและความสัมพันธ์ในแนวทางเดียวกัน

ฐานข้อมูลต้องรองรับกระบวนการหลักดังนี้

สมาชิก  
→ โครงการ  
→ รายการสินค้าในโครงการ  
→ ออเดอร์  
→ คำสั่งซื้อแยกตามโรงงาน  
→ การชำระเงิน  
→ การผลิต  
→ การตรวจสินค้า  
→ การรวมสินค้า  
→ การขนส่ง  
→ การส่งมอบ  
→ การเคลม

ระบบต้องรองรับตั้งแต่ MVP โดยไม่ออกแบบซับซ้อนเกินจำเป็น แต่ต้องสามารถขยายในอนาคตไปยัง

* หลายโรงงาน  
* หลายประเทศ  
* หลายสกุลเงิน  
* หลายบริษัท  
* หลายคลังสินค้า  
* หลายรูปแบบการขนส่ง  
* ระบบสมาชิกหลายระดับ  
* Smart BOQ  
* Material Library  
* Supplier Portal  
* ระบบบัญชีและ ERP

---

# **2\. หลักการออกแบบฐานข้อมูล**

## **2.1 Project First**

Project เป็นศูนย์กลางของการใช้งานฝั่งสมาชิก

หนึ่ง Project สามารถมี

* ลูกค้าหนึ่งราย  
* ที่อยู่ส่งหลักหนึ่งแห่ง  
* หลายห้อง  
* หลายรายการสินค้า  
* หลายออเดอร์  
* หลายโรงงาน  
* หลาย Shipment  
* หลาย Claim

## **2.2 แยก Customer Order และ Supplier Order**

สมาชิกเห็น Customer Order หนึ่งรายการ แต่ระบบหลังบ้านแยกออกเป็น Supplier Order ตามโรงงาน

Customer Order ORD-0001  
├── Supplier Order SO-0001 โรงงาน A  
├── Supplier Order SO-0002 โรงงาน B  
└── Supplier Order SO-0003 โรงงาน C

## **2.3 แยกราคาทุนและราคาสมาชิก**

ราคาทุนโรงงานและราคาขายสมาชิกต้องเก็บคนละ Field และกำหนดสิทธิ์แยกกัน

สมาชิกห้ามเข้าถึง

* ราคาทุน  
* อัตรากำไร  
* เอกสารโรงงาน  
* การจ่ายเงินให้โรงงาน  

## **2.4 Snapshot ข้อมูลเมื่อสร้าง Order**

ข้อมูลที่อาจเปลี่ยนในอนาคต เช่น ราคา ชื่อสินค้า ขนาด วัสดุ สี และ Option ต้องถูกคัดลอกเก็บไว้ใน Order Item เมื่อสมาชิกยืนยัน Order

Order เดิมต้องไม่เปลี่ยนตาม Product Master

## **2.5 Soft Delete**

ข้อมูลธุรกิจสำคัญไม่ควรถูกลบถาวร

ใช้ข้อมูล เช่น

* `is_active`  
* `archived_at`  
* `deleted_at`

เพื่อปิดการใช้งาน แต่ยังเก็บประวัติ

## **2.6 Auditability**

กิจกรรมสำคัญต้องตรวจสอบย้อนหลังได้ เช่น

* การแก้ราคา  
* การแก้สเปก  
* การเปลี่ยนสถานะ  
* การยืนยันเงิน  
* การอนุมัติ QC  
* การยกเลิก  
* การเปลี่ยนสิทธิ์

## **2.7 รองรับหลายภาษา**

ชื่อและรายละเอียดสำคัญควรรองรับ

* ไทย  
* อังกฤษ  
* จีน

MVP อาจแสดงไทยเป็นหลัก แต่ฐานข้อมูลต้องเก็บแยกภาษา

## **2.8 รองรับหลายสกุลเงิน**

ห้ามผูกระบบกับเงินบาทหรือหยวนเพียงสกุลเดียว

จำนวนเงินทุกชุดควรมี

* Amount  
* Currency  
* Exchange Rate ถ้ามี  
* Effective Date

---

# **3\. มาตรฐานการตั้งชื่อ**

## **3.1 ชื่อตาราง**

ใช้รูปแบบพหูพจน์และตัวอักษรเล็กแบบ Snake Case

ตัวอย่าง

* `users`  
* `projects`  
* `products`  
* `customer_orders`  
* `supplier_orders`

## **3.2 Primary Key**

ใช้ `id` ชนิด UUID สำหรับทุกตารางหลัก

ตัวอย่าง

id UUID PRIMARY KEY

## **3.3 Foreign Key**

ใช้ชื่อเอกพจน์ตามตารางที่อ้างอิง ตามด้วย `_id`

ตัวอย่าง

* `project_id`  
* `product_id`  
* `supplier_id`  
* `customer_order_id`

## **3.4 วันที่และเวลา**

ใช้ `TIMESTAMPTZ`

Field มาตรฐาน

* `created_at`  
* `updated_at`  
* `deleted_at`

## **3.5 ผู้สร้างและผู้แก้ไข**

ตารางสำคัญควรมี

* `created_by`  
* `updated_by`

## **3.6 เลขเอกสาร**

ใช้ Field แยกจาก Primary Key โดยแยก Atomic Document Number และ Unique Record Reference
ตาม DEC-034 และหัวข้อ 42 ของเอกสารนี้

UUID ใช้ภายในระบบ ส่วนเลขเอกสารใช้แสดงแก่ผู้ใช้งาน

---

# **4\. ภาพรวมกลุ่มตาราง**

ฐานข้อมูล MVP แบ่งเป็น 15 กลุ่ม

1. Organization และผู้ใช้งาน  
2. สมาชิกและลูกค้าปลายทาง  
3. Supplier และประเทศ  
4. Catalog และสินค้า  
5. ราคาและอัตราแลกเปลี่ยน  
6. Material Sample, Showroom Visit และ Supplier Disclosure  
7. Project  
8. Custom Request  
9. Customer Order  
10. Supplier Order และ Purchase Order  
11. Payment และเอกสารการเงิน  
12. Production และ QC  
13. Logistics และ Shipment  
14. Delivery และ Claim  
15. Notification, File และ Audit Log

---

# **5\. Organization และผู้ใช้งาน**

## **5.1 organizations**

เก็บข้อมูลบริษัทที่ใช้งานแพลตฟอร์ม

MVP อาจมีบริษัทหลักเพียงบริษัทเดียว แต่สร้างตารางนี้ไว้เพื่อรองรับ Multi-company

| Field | Type | Required | Description |
| ----- | ----- | ----- | ----- |
| id | UUID | Yes | Primary Key |
| organization\_code | VARCHAR(50) | Yes | รหัสบริษัท |
| organization\_name\_th | VARCHAR(255) | Yes | ชื่อบริษัทภาษาไทย |
| organization\_name\_en | VARCHAR(255) | No | ชื่อบริษัทภาษาอังกฤษ |
| tax\_id | VARCHAR(30) | No | เลขผู้เสียภาษี |
| email | VARCHAR(255) | No | อีเมลบริษัท |
| phone | VARCHAR(50) | No | เบอร์โทร |
| address\_json | JSONB | No | ที่อยู่บริษัท |
| logo\_url | TEXT | No | Logo |
| default\_currency | CHAR(3) | Yes | เช่น THB |
| timezone | VARCHAR(50) | Yes | เช่น Asia/Bangkok |
| is\_active | BOOLEAN | Yes | สถานะใช้งาน |
| created\_at | TIMESTAMPTZ | Yes | วันที่สร้าง |
| updated\_at | TIMESTAMPTZ | Yes | วันที่แก้ไข |

**Unique Constraint**

* `organization_code`

---

## **5.2 users**

เก็บบัญชีผู้ใช้งานทุกประเภท

| Field | Type | Required | Description |
| ----- | ----- | ----- | ----- |
| id | UUID | Yes | User ID |
| organization\_id | UUID | Yes | บริษัทหลัก |
| email | VARCHAR(255) | Yes | Email |
| phone | VARCHAR(50) | No | เบอร์โทร |
| first\_name | VARCHAR(150) | Yes | ชื่อ |
| last\_name | VARCHAR(150) | Yes | นามสกุล |
| display\_name | VARCHAR(255) | No | ชื่อแสดงผล |
| user\_type | VARCHAR(50) | Yes | member, staff, admin |
| status | VARCHAR(50) | Yes | pending, active, suspended, rejected |
| email\_verified\_at | TIMESTAMPTZ | No | วันที่ยืนยันอีเมล |
| last\_login\_at | TIMESTAMPTZ | No | Login ล่าสุด |
| approved\_at | TIMESTAMPTZ | No | วันที่อนุมัติ |
| approved\_by | UUID | No | ผู้อนุมัติ |
| suspended\_at | TIMESTAMPTZ | No | วันที่ระงับ |
| suspension\_reason | TEXT | No | เหตุผลระงับ |
| is\_active | BOOLEAN | Yes | Active Flag |
| created\_at | TIMESTAMPTZ | Yes | วันที่สร้าง |
| updated\_at | TIMESTAMPTZ | Yes | วันที่แก้ไข |
| deleted\_at | TIMESTAMPTZ | No | Soft Delete |

**Unique Constraint**

* `email`

**Business Rule**

* ผู้ใช้สถานะ `pending` ยังไม่เห็นราคาสมาชิก  
* ผู้ใช้สถานะ `suspended` Login เพื่อดูประวัติเดิมแบบ Read-only ได้ แต่ไม่เห็นราคาและห้ามสร้าง/แก้ธุรกรรมใหม่  
* Password และ Password Hash จัดการโดย InsForge `auth.users` เท่านั้น ห้ามเก็บใน `public.users`

---

## **5.3 roles**

เก็บบทบาทในระบบ

ตัวอย่าง Role

* MEMBER  
* PRODUCT\_ADMIN  
* ORDER\_ADMIN  
* FINANCE  
* QC\_TEAM  
* LOGISTICS  
* SUPER\_ADMIN

| Field | Type | Required |
| ----- | ----- | ----- |
| id | UUID | Yes |
| role\_code | VARCHAR(50) | Yes |
| role\_name\_th | VARCHAR(150) | Yes |
| role\_name\_en | VARCHAR(150) | No |
| description | TEXT | No |
| is\_system\_role | BOOLEAN | Yes |
| is\_active | BOOLEAN | Yes |
| created\_at | TIMESTAMPTZ | Yes |

---

## **5.4 user\_roles**

เชื่อม User กับ Role

| Field | Type | Required |
| ----- | ----- | ----- |
| id | UUID | Yes |
| user\_id | UUID | Yes |
| role\_id | UUID | Yes |
| assigned\_by | UUID | No |
| assigned\_at | TIMESTAMPTZ | Yes |
| revoked\_at | TIMESTAMPTZ | No |

**Unique Constraint**

* `user_id + role_id` เมื่อยังไม่ถูกยกเลิก

---

## **5.5 permissions**

เก็บ Permission รายละเอียด

ตัวอย่าง

* `product.view_cost`  
* `product.edit`  
* `order.create_po`  
* `payment.verify`  
* `qc.approve`  
* `report.view_margin`

| Field | Type |
| ----- | ----- |
| id | UUID |
| permission\_code | VARCHAR(100) |
| permission\_name | VARCHAR(255) |
| module\_code | VARCHAR(50) |
| description | TEXT |

---

## **5.6 role\_permissions**

เชื่อม Role กับ Permission

| Field | Type |
| ----- | ----- |
| id | UUID |
| role\_id | UUID |
| permission\_id | UUID |

---

# **6\. ข้อมูลสมาชิกและตัวแทน**

## **6.1 member\_profiles**

เก็บข้อมูลสมาชิกที่มากกว่าบัญชี User

| Field | Type | Required | Description |
| ----- | ----- | ----- | ----- |
| id | UUID | Yes | Member Profile ID |
| user\_id | UUID | Yes | User |
| member\_code | VARCHAR(50) | Yes | รหัสสมาชิก |
| member\_type | VARCHAR(50) | Yes | student, dealer, professional, partner |
| company\_name | VARCHAR(255) | No | ชื่อบริษัท |
| business\_type | VARCHAR(100) | No | Designer, Contractor, Showroom |
| tax\_id | VARCHAR(30) | No | เลขผู้เสียภาษี |
| company\_address\_json | JSONB | No | ที่อยู่บริษัท |
| service\_areas | JSONB | No | พื้นที่ให้บริการ |
| interested\_categories | JSONB | No | หมวดที่สนใจ |
| course\_student | BOOLEAN | Yes | เคยเรียนหรือไม่ |
| approval\_status | VARCHAR(50) | Yes | pending, approved, rejected |
| approval\_note | TEXT | No | หมายเหตุ |
| approved\_at | TIMESTAMPTZ | No | วันที่อนุมัติ |
| approved\_by | UUID | No | ผู้อนุมัติ |
| price\_tier\_id | UUID | No | ระดับราคาสมาชิก |
| created\_at | TIMESTAMPTZ | Yes | วันที่สร้าง |
| updated\_at | TIMESTAMPTZ | Yes | วันที่แก้ไข |

**Unique Constraint**

* `user_id` — หนึ่ง Login มี Member Profile ได้เพียงหนึ่งรายการ

**Business Rule**

* Core MVP ไม่มี Member Team, Sub-user หรือ Team Invitation  
* Ownership ของ Project/Order/Claim/Visit/Disclosure ผูก `member_profile_id` ไม่ใช้ Organization เป็นตัวขยายสิทธิ์  
* Action จาก Credential เดียวกัน Audit เป็น User/Member Account เดียว ระบบไม่อ้างว่าสามารถแยกบุคคลจริงที่ใช้บัญชีร่วมกันได้

---

## **6.2 training\_courses**

เก็บหลักสูตร

| Field | Type |
| ----- | ----- |
| id | UUID |
| course\_code | VARCHAR(50) |
| course\_name\_th | VARCHAR(255) |
| course\_name\_en | VARCHAR(255) |
| start\_date | DATE |
| end\_date | DATE |
| location | VARCHAR(255) |
| status | VARCHAR(50) |
| created\_at | TIMESTAMPTZ |

---

## **6.3 member\_course\_enrollments**

เชื่อมสมาชิกกับหลักสูตร

| Field | Type |
| ----- | ----- |
| id | UUID |
| member\_profile\_id | UUID |
| course\_id | UUID |
| enrollment\_status | VARCHAR(50) |
| completion\_status | VARCHAR(50) |
| enrolled\_at | TIMESTAMPTZ |
| completed\_at | TIMESTAMPTZ |
| note | TEXT |

---

# **7\. ลูกค้าปลายทางและที่อยู่**

## **7.1 end\_customers**

เก็บข้อมูลลูกค้าของสมาชิก

| Field | Type | Required |
| ----- | ----- | ----- |
| id | UUID | Yes |
| member\_profile\_id | UUID | Yes |
| customer\_code | VARCHAR(50) | Yes |
| customer\_name | VARCHAR(255) | Yes |
| phone | VARCHAR(50) | No |
| email | VARCHAR(255) | No |
| customer\_type | VARCHAR(50) | No |
| note | TEXT | No |
| created\_at | TIMESTAMPTZ | Yes |
| updated\_at | TIMESTAMPTZ | Yes |

**Data Ownership**

สมาชิกเห็นเฉพาะลูกค้าของตนเอง

---

## **7.2 addresses**

ตารางกลางสำหรับเก็บที่อยู่

| Field | Type | Required |
| ----- | ----- | ----- |
| id | UUID | Yes |
| address\_type | VARCHAR(50) | Yes |
| address\_line\_1 | VARCHAR(255) | Yes |
| address\_line\_2 | VARCHAR(255) | No |
| subdistrict | VARCHAR(150) | No |
| district | VARCHAR(150) | No |
| province | VARCHAR(150) | Yes |
| postal\_code | VARCHAR(20) | No |
| country\_code | CHAR(2) | Yes |
| latitude | DECIMAL(10,7) | No |
| longitude | DECIMAL(10,7) | No |
| google\_maps\_url | TEXT | No |
| contact\_name | VARCHAR(255) | No |
| contact\_phone | VARCHAR(50) | No |
| delivery\_note | TEXT | No |
| created\_at | TIMESTAMPTZ | Yes |
| updated\_at | TIMESTAMPTZ | Yes |

---

# **8\. ประเทศ โรงงาน และซัพพลายเออร์**

## **8.1 countries**

| Field | Type |
| ----- | ----- |
| id | UUID |
| iso2\_code | CHAR(2) |
| iso3\_code | CHAR(3) |
| country\_name\_th | VARCHAR(150) |
| country\_name\_en | VARCHAR(150) |
| default\_currency | CHAR(3) |
| is\_active | BOOLEAN |

---

## **8.2 suppliers**

เก็บโรงงานหรือ Supplier

| Field | Type | Required | Description |
| ----- | ----- | ----- | ----- |
| id | UUID | Yes | Supplier ID |
| supplier\_code | VARCHAR(50) | Yes | รหัสโรงงาน |
| supplier\_name\_th | VARCHAR(255) | No | ชื่อไทย |
| supplier\_name\_en | VARCHAR(255) | Yes | ชื่ออังกฤษ |
| supplier\_name\_local | VARCHAR(255) | No | ชื่อภาษาท้องถิ่น |
| country\_id | UUID | Yes | ประเทศ |
| supplier\_type | VARCHAR(50) | Yes | factory, trading, brand |
| main\_categories | JSONB | No | หมวดหลัก |
| contact\_person | VARCHAR(255) | No | ผู้ติดต่อ |
| email | VARCHAR(255) | No | Email |
| phone | VARCHAR(50) | No | โทรศัพท์ |
| wechat\_id | VARCHAR(100) | No | WeChat |
| address\_json | JSONB | No | ที่อยู่ |
| default\_currency | CHAR(3) | Yes | สกุลเงิน |
| default\_deposit\_percent | DECIMAL(5,2) | No | Core MVP ต้องเป็น 50 และใช้เป็น Read-only default |
| default\_balance\_percent | DECIMAL(5,2) | No | Core MVP ต้องเป็น 50 และใช้เป็น Read-only default |
| standard\_lead\_time\_days | INTEGER | No | Lead Time |
| status | VARCHAR(50) | Yes | prospect, active, suspended, inactive |
| internal\_note | TEXT | No | หมายเหตุภายใน |
| created\_at | TIMESTAMPTZ | Yes | วันที่สร้าง |
| updated\_at | TIMESTAMPTZ | Yes | วันที่แก้ไข |
| deleted\_at | TIMESTAMPTZ | No | Soft Delete |

Core MVP ต้องมี Constraint/Validation ให้ `default_deposit_percent + default_balance_percent = 100`
และล็อกค่าเป็น 50/50; การอนุญาตให้เปลี่ยนเปอร์เซ็นต์ต้องมี Approved Decision ใหม่

---

## **8.3 supplier\_documents**

เก็บเอกสารโรงงาน

| Field | Type |
| ----- | ----- |
| id | UUID |
| supplier\_id | UUID |
| document\_type | VARCHAR(50) |
| document\_name | VARCHAR(255) |
| file\_id | UUID |
| effective\_date | DATE |
| expiry\_date | DATE |
| is\_confidential | BOOLEAN |
| created\_at | TIMESTAMPTZ |

ตัวอย่าง `document_type`

* catalog  
* price\_list  
* certificate  
* agreement  
* warranty  
* factory\_profile

---

# **9\. หมวดหมู่สินค้า**

## **9.1 product\_categories**

ใช้โครงสร้างแบบ Parent-Child เพื่อเพิ่มหมวดใหม่ได้

| Field | Type | Required |
| ----- | ----- | ----- |
| id | UUID | Yes |
| parent\_id | UUID | No |
| category\_code | VARCHAR(50) | Yes |
| category\_name\_th | VARCHAR(255) | Yes |
| category\_name\_en | VARCHAR(255) | No |
| category\_name\_zh | VARCHAR(255) | No |
| category\_level | INTEGER | Yes |
| display\_order | INTEGER | No |
| is\_active | BOOLEAN | Yes |
| created\_at | TIMESTAMPTZ | Yes |
| updated\_at | TIMESTAMPTZ | Yes |

ตัวอย่าง

Furniture  
├── Seating  
│   ├── Sofa  
│   ├── Armchair  
│   └── Dining Chair  
├── Table  
└── Storage

---

## **9.2 collections**

| Field | Type |
| ----- | ----- |
| id | UUID |
| supplier\_id | UUID |
| collection\_code | VARCHAR(50) |
| collection\_name\_th | VARCHAR(255) |
| collection\_name\_en | VARCHAR(255) |
| collection\_name\_zh | VARCHAR(255) |
| description | TEXT |
| is\_active | BOOLEAN |
| created\_at | TIMESTAMPTZ |

---

## **9.3 tags**

เก็บ Tag เช่น Modern, Luxury, Japandi, Wellness

| Field | Type |
| ----- | ----- |
| id | UUID |
| tag\_code | VARCHAR(50) |
| tag\_name\_th | VARCHAR(150) |
| tag\_name\_en | VARCHAR(150) |
| tag\_type | VARCHAR(50) |
| is\_active | BOOLEAN |

---

# **10\. Product Master**

## **10.1 products**

เก็บข้อมูลสินค้าหลัก

| Field | Type | Required | Description |
| ----- | ----- | ----- | ----- |
| id | UUID | Yes | Product ID |
| product\_code | VARCHAR(50) | Yes | รหัสภายใน GISP |
| supplier\_id | UUID | Yes | โรงงาน |
| factory\_sku | VARCHAR(100) | No | SKU โรงงาน |
| category\_id | UUID | Yes | หมวด |
| collection\_id | UUID | No | Collection |
| product\_type | VARCHAR(50) | Yes | standard, custom\_base, material, built\_in |
| name\_th | VARCHAR(255) | Yes | ชื่อไทย |
| name\_en | VARCHAR(255) | No | ชื่ออังกฤษ |
| name\_zh | VARCHAR(255) | No | ชื่อจีน |
| short\_description\_th | TEXT | No | คำอธิบายสั้น |
| description\_th | TEXT | No | รายละเอียด |
| description\_en | TEXT | No | รายละเอียดอังกฤษ |
| description\_zh | TEXT | No | รายละเอียดจีน |
| main\_material | VARCHAR(255) | No | วัสดุหลัก |
| surface\_material | VARCHAR(255) | No | วัสดุปิดผิว |
| standard\_width\_mm | DECIMAL(12,2) | No | กว้าง |
| standard\_depth\_mm | DECIMAL(12,2) | No | ลึก |
| standard\_height\_mm | DECIMAL(12,2) | No | สูง |
| standard\_weight\_kg | DECIMAL(12,3) | No | น้ำหนัก |
| standard\_cbm | DECIMAL(12,4) | No | CBM |
| moq | DECIMAL(12,3) | No | MOQ |
| moq\_unit | VARCHAR(30) | No | หน่วย MOQ |
| lead\_time\_days | INTEGER | No | ระยะเวลาผลิต |
| warranty\_text | TEXT | No | ข้อความสรุปเพื่อแสดงผล; เงื่อนไขที่มีอำนาจใช้ `supplier_warranty_versions` |
| packing\_description | TEXT | No | การบรรจุ |
| installation\_note | TEXT | No | หมายเหตุติดตั้ง |
| showroom\_sample\_available | BOOLEAN | Yes | มี `material_swatch` หรือ `built_in_display` ที่ Active หรือไม่; ไม่หมายถึงเฟอร์นิเจอร์ตัวอย่างทั่วไป |
| source\_catalog\_id | UUID | No | Catalog ต้นทาง |
| source\_page | INTEGER | No | หน้า PDF |
| sales\_status | VARCHAR(50) | Yes | draft, active, suspended, discontinued |
| is\_orderable | BOOLEAN | Yes | สั่งได้หรือไม่ |
| published\_at | TIMESTAMPTZ | No | วันที่ Publish |
| created\_by | UUID | Yes | ผู้สร้าง |
| updated\_by | UUID | No | ผู้แก้ไข |
| created\_at | TIMESTAMPTZ | Yes | วันที่สร้าง |
| updated\_at | TIMESTAMPTZ | Yes | วันที่แก้ไข |
| deleted\_at | TIMESTAMPTZ | No | Soft Delete |

**Unique Constraint ที่แนะนำ**

* `product_code`  
* `supplier_id + factory_sku` เมื่อ Factory SKU มีค่า

---

## **10.2 product\_tags**

เชื่อม Product กับ Tag

| Field | Type |
| ----- | ----- |
| id | UUID |
| product\_id | UUID |
| tag\_id | UUID |

---

## **10.3 product\_media**

เก็บรูปและวิดีโอ

| Field | Type | Required |
| ----- | ----- | ----- |
| id | UUID | Yes |
| product\_id | UUID | Yes |
| file\_id | UUID | Yes |
| media\_type | VARCHAR(50) | Yes |
| media\_role | VARCHAR(50) | Yes |
| display\_order | INTEGER | No |
| alt\_text | VARCHAR(255) | No |
| is\_primary | BOOLEAN | Yes |
| created\_at | TIMESTAMPTZ | Yes |

ตัวอย่าง `media_role`

* main  
* gallery  
* lifestyle  
* detail  
* dimension\_drawing  
* material\_swatch  
* packing

---

## **10.4 product\_documents**

| Field | Type |
| ----- | ----- |
| id | UUID |
| product\_id | UUID |
| document\_type | VARCHAR(50) |
| document\_name | VARCHAR(255) |
| file\_id | UUID |
| source\_page | INTEGER |
| is\_member\_visible | BOOLEAN |
| created\_at | TIMESTAMPTZ |

---

## **10.5 supplier\_warranty\_versions**

เก็บเงื่อนไขรับประกันจากโรงงาน Partner แบบ Version เพื่อใช้ Snapshot ลง Order Item

| Field | Type | Required | Description |
| ----- | ----- | ----- | ----- |
| id | UUID | Yes | Warranty Version ID |
| supplier\_id | UUID | Yes | โรงงานเจ้าของเงื่อนไข — Confidential |
| product\_id | UUID | No | ถ้าว่างใช้กับสินค้าทั้งโรงงาน |
| version\_number | INTEGER | Yes | Version |
| warranty\_title | VARCHAR(255) | Yes | ชื่อที่แสดงเป็น Partner Warranty ก่อนปลดล็อกโรงงาน |
| warranty\_terms | TEXT | Yes | เงื่อนไข ระยะเวลา ข้อยกเว้น และหลักฐานที่ต้องใช้ |
| effective\_from | TIMESTAMPTZ | Yes | วันที่เริ่มใช้ |
| effective\_to | TIMESTAMPTZ | No | วันที่สิ้นสุด |
| status | VARCHAR(30) | Yes | draft, active, retired |
| created\_by | UUID | Yes | ผู้สร้าง |
| activated\_by | UUID | No | ผู้เปิดใช้ |
| activated\_at | TIMESTAMPTZ | No | เวลาเปิดใช้ |
| created\_at | TIMESTAMPTZ | Yes | เวลาสร้าง |

ห้ามเปลี่ยน Record ที่ Active/Retired ย้อนหลัง ให้สร้าง Version ใหม่ และ Member-safe Response
ต้องปกปิด `supplier_id`/ชื่อโรงงานจนกว่าจะมี Disclosure Grant

---

# **11\. Product Variant และตัวเลือกสินค้า**

## **11.1 option\_groups**

กลุ่มตัวเลือก เช่น สี ผ้า ขนาด หิน มือจับ

| Field | Type |
| ----- | ----- |
| id | UUID |
| option\_group\_code | VARCHAR(50) |
| option\_group\_name\_th | VARCHAR(150) |
| option\_group\_name\_en | VARCHAR(150) |
| selection\_type | VARCHAR(30) |
| is\_required | BOOLEAN |
| display\_order | INTEGER |
| is\_active | BOOLEAN |

`selection_type`

* single  
* multiple  
* informational

---

## **11.2 option\_values**

ค่าตัวเลือก เช่น W301, F001

| Field | Type | Required |
| ----- | ----- | ----- |
| id | UUID | Yes |
| option\_group\_id | UUID | Yes |
| option\_code | VARCHAR(50) | Yes |
| option\_name\_th | VARCHAR(255) | Yes |
| option\_name\_en | VARCHAR(255) | No |
| option\_name\_zh | VARCHAR(255) | No |
| color\_hex | VARCHAR(10) | No |
| material\_description | TEXT | No |
| image\_file\_id | UUID | No |
| price\_adjustment\_type | VARCHAR(30) | No |
| price\_adjustment\_value | DECIMAL(14,2) | No |
| is\_standard | BOOLEAN | Yes |
| is\_active | BOOLEAN | Yes |
| created\_at | TIMESTAMPTZ | Yes |

---

## **11.3 product\_option\_groups**

กำหนดว่า Product ใดเลือก Option Group ใดได้

| Field | Type |
| ----- | ----- |
| id | UUID |
| product\_id | UUID |
| option\_group\_id | UUID |
| is\_required | BOOLEAN |
| display\_order | INTEGER |
| created\_at | TIMESTAMPTZ |

---

## **11.4 product\_option\_values**

กำหนด Option Value ที่ใช้กับ Product นั้น

| Field | Type |
| ----- | ----- |
| id | UUID |
| product\_id | UUID |
| option\_value\_id | UUID |
| is\_default | BOOLEAN |
| additional\_member\_price | DECIMAL(14,2) |
| additional\_factory\_cost | DECIMAL(14,2) |
| lead\_time\_adjustment\_days | INTEGER |
| is\_available | BOOLEAN |

---

## **11.5 product\_variants**

ใช้เมื่อต้องมี SKU แตกตามขนาด สี หรือวัสดุ

| Field | Type | Required |
| ----- | ----- | ----- |
| id | UUID | Yes |
| product\_id | UUID | Yes |
| variant\_code | VARCHAR(100) | Yes |
| factory\_variant\_sku | VARCHAR(100) | No |
| variant\_name | VARCHAR(255) | No |
| width\_mm | DECIMAL(12,2) | No |
| depth\_mm | DECIMAL(12,2) | No |
| height\_mm | DECIMAL(12,2) | No |
| weight\_kg | DECIMAL(12,3) | No |
| cbm | DECIMAL(12,4) | No |
| option\_signature | JSONB | No |
| lead\_time\_days | INTEGER | No |
| is\_active | BOOLEAN | Yes |
| created\_at | TIMESTAMPTZ | Yes |
| updated\_at | TIMESTAMPTZ | Yes |

`option_signature` ตัวอย่าง

{  
  "fabric": "F001",  
  "wood": "W301",  
  "size": "1800MM"  
}

---

# **12\. ระบบราคา**

## **12.1 price\_tiers**

ระดับราคาสมาชิก

MVP อาจมีเพียง `MEMBER` แต่รองรับ Dealer หรือ Partner ในอนาคต

| Field | Type |
| ----- | ----- |
| id | UUID |
| price\_tier\_code | VARCHAR(50) |
| price\_tier\_name | VARCHAR(150) |
| description | TEXT |
| is\_active | BOOLEAN |

---

## **12.2 product\_prices**

เก็บราคาตาม Product หรือ Variant

| Field | Type | Required |
| ----- | ----- | ----- |
| id | UUID | Yes |
| product\_id | UUID | Yes |
| variant\_id | UUID | No |
| price\_tier\_id | UUID | No |
| price\_type | VARCHAR(50) | Yes |
| amount | DECIMAL(18,2) | Yes |
| currency\_code | CHAR(3) | Yes |
| exchange\_rate | DECIMAL(18,6) | No |
| amount\_thb | DECIMAL(18,2) | No |
| effective\_from | TIMESTAMPTZ | Yes |
| effective\_to | TIMESTAMPTZ | No |
| status | VARCHAR(30) | Yes |
| version\_number | INTEGER | Yes |
| source\_reference | TEXT | No |
| calculation\_snapshot\_id | UUID | No |
| approved\_by | UUID | No |
| approved\_at | TIMESTAMPTZ | No |
| created\_at | TIMESTAMPTZ | Yes |

`price_type`

* factory\_cost  
* member\_price  
* suggested\_retail  
* promotional\_price

**Business Rule**

* ต้องมี Member Price Active จึงสั่ง Standard Product ได้  
* `suggested_retail` เป็น Core Price Type สำหรับคำแนะนำและห้ามนำไปคำนวณ Order/Invoice/Payment  
* Factory Cost, Formula Component, Formula Scope และ Margin ต้องไม่ถูกส่งออกผ่าน Member API  
* Member API ส่ง Member Price, Suggested Resale และ Freight Estimate จาก Calculation Snapshot เท่านั้น  
* ห้าม Update ราคาทับ Record เก่า ให้สร้าง Version ใหม่

---

## **12.3 exchange\_rates**

| Field | Type |
| ----- | ----- |
| id | UUID |
| base\_currency | CHAR(3) |
| quote\_currency | CHAR(3) |
| rate | DECIMAL(18,6) |
| effective\_date | DATE |
| source | VARCHAR(100) |
| is\_manual | BOOLEAN |
| created\_by | UUID |
| created\_at | TIMESTAMPTZ |

---

## **12.4 price\_formula\_versions**

| Field | Type | Required | Description |
| ----- | ----- | ----- | ----- |
| id | UUID | Yes | Formula Version ID |
| formula\_code | VARCHAR(50) | Yes | รหัสสูตร |
| scope\_type | VARCHAR(30) | Yes | global, supplier, product |
| supplier\_id | UUID | No | Required เมื่อ Scope เป็น supplier |
| product\_id | UUID | No | Required เมื่อ Scope เป็น product |
| inherited\_formula\_id | UUID | No | Formula ระดับบนที่สืบทอด |
| version\_number | INTEGER | Yes | Version ภายใน Scope |
| status | VARCHAR(30) | Yes | draft, active, retired |
| effective\_from | TIMESTAMPTZ | Yes | เริ่มใช้ |
| effective\_to | TIMESTAMPTZ | No | สิ้นสุด |
| rounding\_mode | VARCHAR(30) | Yes | half\_up |
| decimal\_places | SMALLINT | Yes | Core ใช้ 2 |
| created\_by | UUID | Yes | ต้องเป็น Super Admin |
| updated\_by | UUID | No | ผู้แก้ Draft ล่าสุด; ต้องเป็น Super Admin |
| activated\_by | UUID | No | ต้องเป็น Super Admin |
| activated\_at | TIMESTAMPTZ | No | เวลา Activate |
| created\_at | TIMESTAMPTZ | Yes | เวลาสร้าง |
| updated\_at | TIMESTAMPTZ | Yes | เวลาแก้ล่าสุด |

**Formula Resolution**

`Product Override → Supplier Override → Global Default` โดยระดับล่างเปลี่ยนเฉพาะ Component
ที่กำหนดและสืบทอดรายการอื่นจากระดับบน Active Version ใน Scope เดียวกันห้ามช่วงเวลาซ้อนกัน
ทุก Create/Edit/Preview/Activate/Retire ต้องสร้าง Audit Event พร้อม Actor, Scope, Formula Version และ Before/After
Active/Retired Version ห้ามแก้ย้อนหลัง; การเปลี่ยนราคาอนาคตต้องสร้าง Version ใหม่และไม่ Recalculate Order Snapshot เดิม

## **12.5 price\_formula\_components**

| Field | Type | Required | Description |
| ----- | ----- | ----- | ----- |
| id | UUID | Yes | Component ID |
| formula\_version\_id | UUID | Yes | Formula Version |
| component\_code | VARCHAR(50) | Yes | platform, marketing\_visit, sourcing\_catalog, resale\_markup, freight\_low, freight\_high หรือ Code ที่อนุมัติ |
| component\_name | VARCHAR(255) | Yes | ชื่อแสดงผลภายใน |
| calculation\_type | VARCHAR(30) | Yes | percentage, fixed\_amount\_thb |
| basis | VARCHAR(30) | Yes | factory\_cost\_thb, member\_price |
| value | DECIMAL(18,6) | Yes | ค่าเปอร์เซ็นต์หรือยอด THB |
| include\_in\_member\_price | BOOLEAN | Yes | รวมใน Member Price หรือไม่ |
| sort\_order | INTEGER | Yes | ลำดับแสดงผล |
| is\_override | BOOLEAN | Yes | เป็นค่าที่ Override ระดับบนหรือไม่ |

Core ไม่รองรับ Arbitrary Executable Expression Component ทุกชนิดต้องอยู่ใน Allowlist และใช้ Decimal

## **12.6 price\_calculation\_snapshots**

| Field | Type | Required | Description |
| ----- | ----- | ----- | ----- |
| id | UUID | Yes | Snapshot ID |
| product\_id | UUID | Yes | Product |
| variant\_id | UUID | No | Variant |
| formula\_version\_id | UUID | Yes | Formula ที่ Resolve แล้ว |
| factory\_cost\_source | DECIMAL(18,6) | Yes | ต้นทุนในสกุลต้นทาง |
| source\_currency | CHAR(3) | Yes | สกุลต้นทาง |
| exchange\_rate | DECIMAL(18,6) | Yes | Exchange Snapshot |
| factory\_cost\_thb | DECIMAL(18,2) | Yes | ต้นทุนรวม Option หลังแปลง THB |
| resolved\_components | JSONB | Yes | Component/Scope/Version ที่ใช้ — Confidential |
| member\_price | DECIMAL(18,2) | Yes | ผล Member Price |
| suggested\_resale\_price | DECIMAL(18,2) | Yes | ผลราคาแนะนำขายต่อ |
| freight\_estimate\_low | DECIMAL(18,2) | Yes | ประมาณการ 15% เริ่มต้น |
| freight\_estimate\_high | DECIMAL(18,2) | Yes | ประมาณการ 20% เริ่มต้น |
| calculated\_by | UUID | No | ผู้สั่งคำนวณ; ว่างได้เมื่อระบบสร้าง Snapshot จาก Active Formula |
| calculated\_at | TIMESTAMPTZ | Yes | เวลาคำนวณ |

Template เริ่มต้นที่แก้ได้ให้ทุน 100.00 → Member Price 125.00 → Suggested Resale 156.25
และ Freight Estimate 15.00–20.00 โดย Actual Freight/VAT ไม่รวมในผล Member Price

---

# **13\. Material Sample และ Showroom Visit**

## **13.1 showroom\_locations**

| Field | Type | Required | Visibility |
| ----- | ----- | ----- | ----- |
| id | UUID | Yes | Internal |
| location\_code | VARCHAR(50) | Yes | Internal |
| supplier\_id | UUID | No | Confidential |
| location\_name | VARCHAR(255) | Yes | Confidential จนมี Disclosure Grant |
| member\_display\_label | VARCHAR(255) | Yes | Member-safe เช่น Partner Showroom — Foshan |
| location\_type | VARCHAR(50) | Yes | china\_partner\_showroom, thailand\_club |
| country\_code | CHAR(2) | Yes | Member-visible |
| city | VARCHAR(150) | Yes | Member-visible |
| address\_id | UUID | No | Confidential; ห้าม Serialize ก่อน Disclosure Grant |
| contact\_text | TEXT | No | Confidential |
| is\_active | BOOLEAN | Yes | Member-visible |

---

## **13.2 samples**

| Field | Type | Required |
| ----- | ----- | ----- |
| id | UUID | Yes |
| sample\_code | VARCHAR(50) | Yes |
| supplier\_id | UUID | Yes | Confidential Supplier Reference; ห้ามส่งผ่าน Member API ก่อน Disclosure Grant |
| product\_id | UUID | No | ใช้เฉพาะ built\_in\_display |
| option\_value\_id | UUID | No |
| material\_name | VARCHAR(255) | No |
| showroom\_location\_id | UUID | Yes |
| shelf\_location | VARCHAR(100) | No |
| sample\_type | VARCHAR(50) | Yes |
| status | VARCHAR(50) | Yes |
| image\_file\_id | UUID | No |
| note | TEXT | No |
| created\_at | TIMESTAMPTZ | Yes |
| updated\_at | TIMESTAMPTZ | Yes |

สถานะตัวอย่าง

* available  
* borrowed  
* reserved  
* damaged  
* unavailable

`sample_type` ใน Core มีเพียง:

* `material_swatch` — ผ้า ไม้ หิน หนัง สี โลหะ หรือ Finish  
* `built_in_display` — ชิ้นงาน Built-in ที่จัดแสดงบางรายการ เช่น ตู้เสื้อผ้าหรือชุดครัว

เฟอร์นิเจอร์ทั่วไปไม่ใช่ Sample ใน Core MVP และยังไม่มีระบบยืมคืนเต็มรูปแบบ

## **13.3 showroom\_visit\_requests**

| Field | Type | Required | Description |
| ----- | ----- | ----- | ----- |
| id | UUID | Yes | Visit Request ID |
| member\_profile\_id | UUID | Yes | ผู้ขอ — ไม่ขยายสิทธิ์ตาม Organization |
| showroom\_location\_id | UUID | Yes | Showroom ที่ขอเยี่ยมชม |
| supplier\_id | UUID | Yes | Confidential |
| project\_id | UUID | No | Project ที่เกี่ยวข้อง |
| status | VARCHAR(30) | Yes | submitted, approved, completed, rejected, cancelled |
| requested\_at | TIMESTAMPTZ | Yes | เวลาส่งคำขอ |
| scheduled\_at | TIMESTAMPTZ | No | เวลานัด |
| member\_meeting\_instruction | TEXT | No | ข้อมูลนัดหมายแบบไม่เปิดเผย Supplier Identity; แสดงหลัง Approved |
| approved\_by | UUID | No | Purchasing/GISP Admin |
| completed\_by | UUID | No | ผู้ยืนยันการเยี่ยมชม |
| completed\_at | TIMESTAMPTZ | No | เวลาจบ Visit |
| decision\_reason | TEXT | No | เหตุผล Reject/Cancel |
| internal\_note | TEXT | No | Confidential |
| created\_at | TIMESTAMPTZ | Yes | เวลาสร้าง |
| updated\_at | TIMESTAMPTZ | Yes | เวลาแก้ไข |

State Transition ใช้ Action Endpoint เท่านั้น `completed` ต้องมาจาก `approved` และสร้าง Disclosure Grant
ใน Transaction เดียวกัน

## **13.4 supplier\_disclosure\_grants**

| Field | Type | Required | Description |
| ----- | ----- | ----- | ----- |
| id | UUID | Yes | Grant ID |
| member\_profile\_id | UUID | Yes | ผู้ได้รับสิทธิ์ |
| supplier\_id | UUID | Yes | โรงงานที่เปิดเผย |
| source\_visit\_request\_id | UUID | Yes | Visit Completed ต้นทาง |
| granted\_at | TIMESTAMPTZ | Yes | เวลาเริ่มสิทธิ์ |
| granted\_by | UUID | Yes | ผู้ Complete Visit |
| revoked\_at | TIMESTAMPTZ | No | เวลาเพิกถอน |
| revoked\_by | UUID | No | ต้องเป็น Super Admin |
| revocation\_reason | TEXT | No | Required เมื่อเพิกถอน |

**Unique Constraint**

* `member_profile_id + supplier_id` เมื่อ `revoked_at IS NULL`

Grant ไม่มีวันหมดอายุและไม่ขยายตาม Organization; คงอยู่จนกว่า Super Admin จะเพิกถอนพร้อมเหตุผลและ Audit

ก่อนมี Active Grant Member-safe View/API แสดงเพียงประเทศ เมือง ประเภท Showroom ประเภท/รูป/สถานะ Sample
และ `member_display_label` ห้ามแสดงชื่อโรงงาน Address, Contact หรือ Supplier ID เมื่อ Visit Approved
อาจส่งเฉพาะ `member_meeting_instruction` ที่ Purchasing จัดทำโดยไม่มีข้อมูลเปิดเผยแหล่งสินค้า

---

# **14\. Project**

## **14.1 projects**

| Field | Type | Required | Description |
| ----- | ----- | ----- | ----- |
| id | UUID | Yes | Project ID |
| project\_code | VARCHAR(50) | Yes | เลขโครงการ |
| member\_profile\_id | UUID | Yes | เจ้าของ Project |
| end\_customer\_id | UUID | Yes | ลูกค้าปลายทาง |
| project\_name | VARCHAR(255) | Yes | ชื่อโครงการ |
| project\_type | VARCHAR(50) | No | บ้าน คอนโด โรงแรม |
| site\_address\_id | UUID | Yes | ที่อยู่ส่งหลัก |
| expected\_need\_date | DATE | No | วันที่ต้องการสินค้า |
| site\_contact\_name | VARCHAR(255) | No | ผู้ติดต่อหน้างาน |
| site\_contact\_phone | VARCHAR(50) | No | เบอร์ |
| site\_access\_note | TEXT | No | หมายเหตุ |
| status | VARCHAR(50) | Yes | draft, active, on\_hold, completed |
| created\_by | UUID | Yes | ผู้สร้าง |
| created\_at | TIMESTAMPTZ | Yes | วันที่สร้าง |
| updated\_at | TIMESTAMPTZ | Yes | วันที่แก้ไข |
| archived\_at | TIMESTAMPTZ | No | Archive |

**Business Rule**

* Project ต้องเป็นของ Member เพียงรายเดียว  
* สมาชิกเห็นเฉพาะ Project ของตนเอง  
* Project ที่มี Order แล้วไม่ควรถูกลบ

---

## **14.2 project\_areas**

เก็บห้องหรือพื้นที่

| Field | Type |
| ----- | ----- |
| id | UUID |
| project\_id | UUID |
| area\_code | VARCHAR(50) |
| area\_name | VARCHAR(255) |
| floor\_name | VARCHAR(100) |
| display\_order | INTEGER |
| note | TEXT |
| created\_at | TIMESTAMPTZ |

ตัวอย่าง

* Living Room  
* Master Bedroom  
* Kitchen  
* Lobby

---

## **14.3 project\_items**

รายการสินค้าใน Project

| Field | Type | Required |
| ----- | ----- | ----- |
| id | UUID | Yes |
| project\_id | UUID | Yes |
| project\_area\_id | UUID | No |
| product\_id | UUID | Yes |
| variant\_id | UUID | No |
| quantity | DECIMAL(12,3) | Yes |
| unit | VARCHAR(30) | Yes |
| current\_member\_unit\_price | DECIMAL(18,2) | Yes |
| currency\_code | CHAR(3) | Yes |
| selected\_options\_json | JSONB | No |
| member\_remark | TEXT | No |
| item\_status | VARCHAR(50) | Yes |
| source\_type | VARCHAR(30) | Yes |
| custom\_request\_id | UUID | No |
| ordered\_quantity | DECIMAL(12,3) | Yes |
| created\_at | TIMESTAMPTZ | Yes |
| updated\_at | TIMESTAMPTZ | Yes |

สถานะ

* draft  
* waiting\_client\_approval  
* ready\_to\_order  
* partially\_ordered  
* ordered  
* cancelled

**Business Rule**

* `ordered_quantity` ห้ามเกิน `quantity`  
* Member Price ใน Project เป็นราคาปัจจุบันและอัปเดตได้  
* รายการที่สั่งแล้วต้องป้องกันการสั่งซ้ำ

---

## **14.4 project\_item\_option\_values**

หากไม่ต้องการเก็บ JSONB อย่างเดียว ให้แยก Relation นี้สำหรับค้นหาและตรวจสอบ

| Field | Type |
| ----- | ----- |
| id | UUID |
| project\_item\_id | UUID |
| option\_group\_id | UUID |
| option\_value\_id | UUID |
| option\_code\_snapshot | VARCHAR(50) |
| option\_name\_snapshot | VARCHAR(255) |

แนะนำให้เก็บทั้ง Relation และ JSON Snapshot เพื่อความสะดวก

---

# **15\. Custom Request**

## **15.1 custom\_requests**

| Field | Type | Required |
| ----- | ----- | ----- |
| id | UUID | Yes |
| custom\_request\_number | VARCHAR(50) | Yes |
| project\_id | UUID | Yes |
| project\_area\_id | UUID | No |
| member\_profile\_id | UUID | Yes |
| base\_product\_id | UUID | No |
| request\_type | VARCHAR(50) | Yes |
| item\_name | VARCHAR(255) | Yes |
| description | TEXT | Yes |
| width\_mm | DECIMAL(12,2) | No |
| depth\_mm | DECIMAL(12,2) | No |
| height\_mm | DECIMAL(12,2) | No |
| quantity | DECIMAL(12,3) | Yes |
| requested\_material | TEXT | No |
| requested\_color | TEXT | No |
| requested\_options\_json | JSONB | No |
| member\_note | TEXT | No |
| assigned\_to\_user\_id | UUID | No |
| due\_at | TIMESTAMPTZ | No |
| admin\_note | TEXT | No |
| status | VARCHAR(50) | Yes |
| converted\_at | TIMESTAMPTZ | No |
| converted\_by | UUID | No |
| created\_at | TIMESTAMPTZ | Yes |
| updated\_at | TIMESTAMPTZ | Yes |

สถานะ

* draft  
* submitted  
* under\_review  
* need\_info  
* ready\_for\_quote  
* converted  
* cancelled

สถานะการส่งราคาและการตอบรับของ Member อยู่ใน `custom_quotations` ห้ามบันทึกซ้ำเป็นสถานะของ
`custom_requests`

---

## **15.2 custom\_request\_supplier\_candidates**

| Field | Type |
| ----- | ----- |
| id | UUID |
| custom\_request\_id | UUID |
| supplier\_id | UUID |
| candidate\_status | VARCHAR(30) |
| note | TEXT |
| created\_by | UUID |
| created\_at | TIMESTAMPTZ |

---

## **15.3 custom\_request\_files**

| Field | Type |
| ----- | ----- |
| id | UUID |
| custom\_request\_id | UUID |
| file\_id | UUID |
| file\_role | VARCHAR(50) |
| version\_number | INTEGER |
| uploaded\_by | UUID |
| created\_at | TIMESTAMPTZ |

ตัวอย่าง `file_role`

* reference\_image  
* cad  
* pdf  
* dimension\_drawing  
* material\_reference  
* confirmed\_spec

MVP ยังไม่ทำ Revision Workflow ลึก แต่ต้องเก็บ Version Number

## **15.4 custom\_quotations**

| Field | Type | Required |
| ----- | ----- | ----- |
| id | UUID | Yes |
| custom\_request\_id | UUID | Yes |
| quotation\_number | VARCHAR(50) | Yes |
| version\_number | INTEGER | Yes |
| status | VARCHAR(30) | Yes |
| taxable\_amount | DECIMAL(18,2) | Yes |
| vat\_rate | DECIMAL(5,2) | Yes |
| vat\_amount | DECIMAL(18,2) | Yes |
| grand\_total | DECIMAL(18,2) | Yes |
| currency\_code | CHAR(3) | Yes |
| confirmed\_spec\_json | JSONB | Yes |
| lead\_time\_days | INTEGER | Yes |
| valid\_until | DATE | Yes |
| supersedes\_quotation\_id | UUID | No |
| sent\_at | TIMESTAMPTZ | No |
| accepted\_at | TIMESTAMPTZ | No |
| rejected\_at | TIMESTAMPTZ | No |
| created\_by | UUID | Yes |
| created\_at | TIMESTAMPTZ | Yes |

สถานะใช้ `draft`, `sent`, `accepted`, `rejected`, `expired`, `cancelled`, `superseded`
หนึ่ง Custom Request มี Active Version ได้หนึ่งรายการ และ Accepted Version แก้ไขไม่ได้

---

# **16\. Customer Order**

## **16.1 customer\_orders**

| Field | Type | Required | Description |
| ----- | ----- | ----- | ----- |
| id | UUID | Yes | Order ID |
| order\_number | VARCHAR(50) | Yes | เลข Order |
| project\_id | UUID | Yes | Project |
| member\_profile\_id | UUID | Yes | ผู้ซื้อ |
| delivery\_address\_id | UUID | Yes | Snapshot Address Reference |
| status | VARCHAR(50) | Yes | สถานะ |
| order\_date | TIMESTAMPTZ | Yes | วันที่สร้าง |
| subtotal\_amount | DECIMAL(18,2) | Yes | ยอดสินค้า |
| discount\_amount | DECIMAL(18,2) | Yes | ส่วนลด |
| product\_total\_amount | DECIMAL(18,2) | Yes | ยอดสุทธิสินค้า |
| deposit\_percent | DECIMAL(5,2) | Yes | 50 |
| deposit\_amount | DECIMAL(18,2) | Yes | มัดจำ |
| balance\_percent | DECIMAL(5,2) | Yes | 50 |
| balance\_amount | DECIMAL(18,2) | Yes | ยอดคงเหลือ |
| freight\_total\_amount | DECIMAL(18,2) | Yes | ค่าขนส่ง |
| currency\_code | CHAR(3) | Yes | THB |
| shipping\_preference | VARCHAR(50) | Yes | consolidate\_all |
| member\_note | TEXT | No | หมายเหตุ |
| internal\_note | TEXT | No | หมายเหตุภายใน |
| price\_snapshot\_at | TIMESTAMPTZ | Yes | เวลาล็อกราคา |
| created\_by | UUID | Yes | ผู้สร้าง |
| created\_at | TIMESTAMPTZ | Yes | วันที่สร้าง |
| updated\_at | TIMESTAMPTZ | Yes | วันที่แก้ |
| cancelled\_at | TIMESTAMPTZ | No | วันที่ยกเลิก |
| completed\_at | TIMESTAMPTZ | No | วันที่เสร็จ |

---

## **16.2 customer\_order\_items**

เก็บ Snapshot รายการสินค้า

| Field | Type | Required |
| ----- | ----- | ----- |
| id | UUID | Yes |
| customer\_order\_id | UUID | Yes |
| project\_item\_id | UUID | Yes |
| supplier\_id | UUID | Yes |
| product\_id | UUID | Yes |
| variant\_id | UUID | No |
| product\_code\_snapshot | VARCHAR(50) | Yes |
| factory\_sku\_snapshot | VARCHAR(100) | No |
| product\_name\_snapshot | VARCHAR(255) | Yes |
| product\_image\_snapshot | TEXT | No |
| category\_snapshot | VARCHAR(255) | No |
| width\_mm\_snapshot | DECIMAL(12,2) | No |
| depth\_mm\_snapshot | DECIMAL(12,2) | No |
| height\_mm\_snapshot | DECIMAL(12,2) | No |
| material\_snapshot | TEXT | No |
| selected\_options\_snapshot | JSONB | No |
| member\_remark\_snapshot | TEXT | No |
| quantity | DECIMAL(12,3) | Yes |
| unit | VARCHAR(30) | Yes |
| member\_unit\_price | DECIMAL(18,2) | Yes |
| suggested\_resale\_unit\_price | DECIMAL(18,2) | No |
| freight\_estimate\_low | DECIMAL(18,2) | No |
| freight\_estimate\_high | DECIMAL(18,2) | No |
| member\_line\_total | DECIMAL(18,2) | Yes |
| factory\_unit\_cost | DECIMAL(18,2) | Yes |
| factory\_line\_cost | DECIMAL(18,2) | Yes |
| gross\_margin\_amount | DECIMAL(18,2) | Yes |
| price\_calculation\_snapshot\_id | UUID | Yes |
| warranty\_version\_id | UUID | No |
| warranty\_terms\_snapshot | JSONB | No |
| currency\_code | CHAR(3) | Yes |
| item\_status | VARCHAR(50) | Yes |
| created\_at | TIMESTAMPTZ | Yes |

**Security**

Fields ต่อไปนี้ห้ามอยู่ใน Member Response

* `factory_unit_cost`  
* `factory_line_cost`  
* `gross_margin_amount`  
* Formula/Component/Scope ภายใน `price_calculation_snapshot`  
* `supplier_id` และชื่อโรงงานเมื่อ Member ยังไม่มี Active Disclosure Grant

`suggested_resale_unit_price` และ Freight Estimate เป็นข้อมูลแนะนำ ไม่ใช้รวมยอด Order/Invoice/Payment
ส่วน `warranty_terms_snapshot` ต้องคงเดิมแม้ Warranty Master ถูกแก้ภายหลัง และก่อนปลดล็อกโรงงาน
ให้แสดงชื่อทั่วไป `Partner Warranty` แทน Supplier Identity

---

## **16.3 order\_status\_history**

| Field | Type |
| ----- | ----- |
| id | UUID |
| customer\_order\_id | UUID |
| from\_status | VARCHAR(50) |
| to\_status | VARCHAR(50) |
| changed\_by | UUID |
| change\_note | TEXT |
| created\_at | TIMESTAMPTZ |

---

# **17\. Supplier Order และ Purchase Order**

## **17.1 supplier\_orders**

ระบบสร้างหนึ่ง Supplier Order ต่อหนึ่ง Supplier ภายใน Customer Order

| Field | Type | Required |
| ----- | ----- | ----- |
| id | UUID | Yes |
| supplier\_order\_number | VARCHAR(50) | Yes |
| customer\_order\_id | UUID | Yes |
| supplier\_id | UUID | Yes |
| status | VARCHAR(50) | Yes |
| factory\_currency\_code | CHAR(3) | Yes |
| factory\_subtotal | DECIMAL(18,2) | Yes |
| factory\_deposit\_percent | DECIMAL(5,2) | Yes |
| factory\_deposit\_amount | DECIMAL(18,2) | Yes |
| factory\_balance\_percent | DECIMAL(5,2) | Yes |
| factory\_balance\_amount | DECIMAL(18,2) | Yes |
| estimated\_start\_date | DATE | No |
| estimated\_completion\_date | DATE | No |
| actual\_completion\_date | DATE | No |
| factory\_reference\_number | VARCHAR(100) | No |
| internal\_note | TEXT | No |
| created\_at | TIMESTAMPTZ | Yes |
| updated\_at | TIMESTAMPTZ | Yes |

**Unique Constraint**

* `customer_order_id + supplier_id`

---

## **17.2 supplier\_order\_items**

| Field | Type |
| ----- | ----- |
| id | UUID |
| supplier\_order\_id | UUID |
| customer\_order\_item\_id | UUID |
| quantity | DECIMAL(12,3) |
| factory\_unit\_cost | DECIMAL(18,2) |
| factory\_line\_cost | DECIMAL(18,2) |
| factory\_spec\_snapshot | JSONB |
| production\_status | VARCHAR(50) |
| estimated\_completion\_date | DATE |
| actual\_completion\_date | DATE |
| created\_at | TIMESTAMPTZ |

---

## **17.3 purchase\_orders**

เอกสาร PO ที่ส่งโรงงาน

| Field | Type |
| ----- | ----- |
| id | UUID |
| po\_number | VARCHAR(50) |
| supplier\_order\_id | UUID |
| po\_version | INTEGER |
| po\_date | DATE |
| currency\_code | CHAR(3) |
| po\_amount | DECIMAL(18,2) |
| file\_id | UUID |
| status | VARCHAR(50) |
| issued\_by | UUID |
| issued\_at | TIMESTAMPTZ |
| supplier\_confirmed\_at | TIMESTAMPTZ |
| note | TEXT |

สถานะ

* draft  
* issued  
* supplier\_confirmed  
* revised  
* cancelled

MVP สามารถสร้าง PO เป็น PDF หรือบันทึกไฟล์ที่ทีมทำภายนอกก่อนก็ได้

---

# **18\. Payment ฝั่งสมาชิก**

## **18.1 customer\_payment\_schedules**

สร้างงวดการชำระ

| Field | Type | Required |
| ----- | ----- | ----- |
| id | UUID | Yes |
| customer\_order\_id | UUID | Yes |
| payment\_type | VARCHAR(50) | Yes |
| sequence\_number | INTEGER | Yes |
| percentage | DECIMAL(5,2) | No |
| amount\_due | DECIMAL(18,2) | Yes |
| currency\_code | CHAR(3) | Yes |
| due\_date | DATE | No |
| status | VARCHAR(50) | Yes |
| issued\_at | TIMESTAMPTZ | No |
| paid\_amount | DECIMAL(18,2) | Yes |
| verified\_amount | DECIMAL(18,2) | Yes |
| created\_at | TIMESTAMPTZ | Yes |
| updated\_at | TIMESTAMPTZ | Yes |

`payment_type`

* deposit  
* balance  
* freight

สถานะ

* not\_issued  
* awaiting\_payment  
* submitted  
* partially\_paid  
* paid  
* verified  
* overdue  
* cancelled

---

## **18.2 customer\_payments**

| Field | Type | Required |
| ----- | ----- | ----- |
| id | UUID | Yes |
| payment\_reference | VARCHAR(50) | Yes |
| payment\_schedule\_id | UUID | Yes |
| customer\_order\_id | UUID | Yes |
| member\_profile\_id | UUID | Yes |
| amount | DECIMAL(18,2) | Yes |
| currency\_code | CHAR(3) | Yes |
| transfer\_date | TIMESTAMPTZ | Yes |
| bank\_name | VARCHAR(150) | No |
| source\_account\_name | VARCHAR(255) | No |
| slip\_file\_id | UUID | Yes |
| status | VARCHAR(50) | Yes |
| submitted\_by | UUID | Yes |
| submitted\_at | TIMESTAMPTZ | Yes |
| verified\_by | UUID | No |
| verified\_at | TIMESTAMPTZ | No |
| finance\_note | TEXT | No |
| rejection\_reason | TEXT | No |

สถานะ

* submitted  
* verified  
* rejected  
* duplicate  
* cancelled

---

## **18.3 payment\_verification\_logs**

| Field | Type |
| ----- | ----- |
| id | UUID |
| customer\_payment\_id | UUID |
| action | VARCHAR(50) |
| performed\_by | UUID |
| note | TEXT |
| created\_at | TIMESTAMPTZ |

---

# **19\. เอกสารการเงิน**

## **19.1 financial\_documents**

ใช้กับใบแจ้งมัดจำ ยอดคงเหลือ และค่าขนส่ง

| Field | Type |
| ----- | ----- |
| id | UUID |
| document\_number | VARCHAR(50) |
| customer\_order\_id | UUID |
| payment\_schedule\_id | UUID |
| document\_type | VARCHAR(50) |
| issue\_date | DATE |
| due\_date | DATE |
| subtotal\_amount | DECIMAL(18,2) |
| tax\_amount | DECIMAL(18,2) |
| total\_amount | DECIMAL(18,2) |
| currency\_code | CHAR(3) |
| status | VARCHAR(50) |
| file\_id | UUID |
| created\_by | UUID |
| created\_at | TIMESTAMPTZ |

`document_type`

* deposit\_invoice  
* balance\_invoice  
* freight\_invoice

MVP ยังไม่รวม Tax Invoice และ Receipt

---

# **20\. Payment ฝั่งโรงงาน**

## **20.1 supplier\_payment\_schedules**

| Field | Type |
| ----- | ----- |
| id | UUID |
| supplier\_order\_id | UUID |
| payment\_type | VARCHAR(50) |
| percentage | DECIMAL(5,2) |
| amount\_due | DECIMAL(18,2) |
| currency\_code | CHAR(3) |
| due\_date | DATE |
| status | VARCHAR(50) |
| created\_at | TIMESTAMPTZ |

---

## **20.2 supplier\_payments**

| Field | Type |
| ----- | ----- |
| id | UUID |
| supplier\_payment\_reference | VARCHAR(50) |
| supplier\_payment\_schedule\_id | UUID |
| supplier\_order\_id | UUID |
| amount | DECIMAL(18,2) |
| currency\_code | CHAR(3) |
| exchange\_rate | DECIMAL(18,6) |
| amount\_thb | DECIMAL(18,2) |
| payment\_date | DATE |
| payment\_method | VARCHAR(50) |
| evidence\_file\_id | UUID |
| status | VARCHAR(50) |
| recorded\_by | UUID |
| approved\_by | UUID |
| note | TEXT |
| created\_at | TIMESTAMPTZ |

สมาชิกห้ามเข้าถึงตารางนี้

---

# **21\. Production Tracking**

## **21.1 production\_updates**

| Field | Type |
| ----- | ----- |
| id | UUID |
| supplier\_order\_id | UUID |
| supplier\_order\_item\_id | UUID |
| status | VARCHAR(50) |
| progress\_percent | DECIMAL(5,2) |
| update\_date | TIMESTAMPTZ |
| estimated\_completion\_date | DATE |
| note | TEXT |
| is\_member\_visible | BOOLEAN |
| created\_by | UUID |
| created\_at | TIMESTAMPTZ |

สถานะ

* factory\_confirmed  
* material\_preparation  
* in\_production  
* partially\_completed  
* production\_completed  
* awaiting\_qc  
* rework\_required  
* ready\_for\_dispatch

---

## **21.2 production\_media**

| Field | Type |
| ----- | ----- |
| id | UUID |
| production\_update\_id | UUID |
| file\_id | UUID |
| media\_type | VARCHAR(30) |
| caption | TEXT |
| created\_at | TIMESTAMPTZ |

---

# **22\. QC**

## **22.1 qc\_inspections**

| Field | Type | Required |
| ----- | ----- | ----- |
| id | UUID | Yes |
| qc\_number | VARCHAR(50) | Yes |
| supplier\_order\_id | UUID | Yes |
| inspection\_date | TIMESTAMPTZ | Yes |
| inspector\_user\_id | UUID | Yes |
| qc\_type | VARCHAR(50) | Yes |
| overall\_status | VARCHAR(50) | Yes |
| member\_approval\_required | BOOLEAN | Yes |
| technical\_result | VARCHAR(50) | No |
| summary | TEXT | No |
| rework\_note | TEXT | No |
| member\_visible | BOOLEAN | Yes |
| created\_at | TIMESTAMPTZ | Yes |
| updated\_at | TIMESTAMPTZ | Yes |

`qc_type`

* standard\_product  
* custom\_product  
* pre\_shipment  
* reinspection

สถานะ

* awaiting\_qc  
* in\_progress  
* passed  
* failed  
* rework\_required  
* waiting\_member\_approval  
* member\_approved  
* additional\_review\_requested

---

## **22.2 qc\_inspection\_items**

| Field | Type |
| ----- | ----- |
| id | UUID |
| qc\_inspection\_id | UUID |
| supplier\_order\_item\_id | UUID |
| checklist\_result\_json | JSONB |
| issue\_description | TEXT |
| item\_status | VARCHAR(50) |
| member\_comment | TEXT |
| created\_at | TIMESTAMPTZ |

---

## **22.3 qc\_media**

| Field | Type |
| ----- | ----- |
| id | UUID |
| qc\_inspection\_id | UUID |
| qc\_inspection\_item\_id | UUID |
| file\_id | UUID |
| media\_role | VARCHAR(50) |
| caption | TEXT |
| created\_at | TIMESTAMPTZ |

---

## **22.4 qc\_member\_approvals**

| Field | Type |
| ----- | ----- |
| id | UUID |
| qc\_inspection\_id | UUID |
| member\_profile\_id | UUID |
| decision | VARCHAR(50) |
| approval\_note | TEXT |
| decided\_at | TIMESTAMPTZ |
| created\_at | TIMESTAMPTZ |

`decision`

* approved\_for\_shipping  
* request\_additional\_review

---

# **23\. Warehouse และ Consolidation**

## **23.1 warehouses**

| Field | Type |
| ----- | ----- |
| id | UUID |
| warehouse\_code | VARCHAR(50) |
| warehouse\_name | VARCHAR(255) |
| warehouse\_type | VARCHAR(50) |
| country\_id | UUID |
| address\_id | UUID |
| contact\_name | VARCHAR(255) |
| contact\_phone | VARCHAR(50) |
| is\_active | BOOLEAN |

`warehouse_type`

* china\_consolidation  
* thailand\_import  
* temporary  
* supplier

---

## **23.2 warehouse\_receipts**

| Field | Type |
| ----- | ----- |
| id | UUID |
| receipt\_number | VARCHAR(50) |
| warehouse\_id | UUID |
| supplier\_order\_id | UUID |
| received\_date | TIMESTAMPTZ |
| received\_by | UUID |
| package\_count | INTEGER |
| actual\_weight\_kg | DECIMAL(12,3) |
| actual\_cbm | DECIMAL(12,4) |
| status | VARCHAR(50) |
| discrepancy\_note | TEXT |
| created\_at | TIMESTAMPTZ |

---

## **23.3 warehouse\_receipt\_items**

| Field | Type |
| ----- | ----- |
| id | UUID |
| warehouse\_receipt\_id | UUID |
| supplier\_order\_item\_id | UUID |
| expected\_quantity | DECIMAL(12,3) |
| received\_quantity | DECIMAL(12,3) |
| package\_count | INTEGER |
| condition\_status | VARCHAR(50) |
| note | TEXT |

---

## **23.4 consolidation\_groups**

| Field | Type |
| ----- | ----- |
| id | UUID |
| consolidation\_number | VARCHAR(50) |
| customer\_order\_id | UUID |
| warehouse\_id | UUID |
| status | VARCHAR(50) |
| planned\_ship\_date | DATE |
| actual\_ship\_date | DATE |
| note | TEXT |
| created\_at | TIMESTAMPTZ |

---

## **23.5 consolidation\_items**

| Field | Type |
| ----- | ----- |
| id | UUID |
| consolidation\_group\_id | UUID |
| warehouse\_receipt\_item\_id | UUID |
| quantity | DECIMAL(12,3) |
| created\_at | TIMESTAMPTZ |

---

# **24\. Shipment**

## **24.1 shipments**

| Field | Type | Required |
| ----- | ----- | ----- |
| id | UUID | Yes |
| shipment\_number | VARCHAR(50) | Yes |
| customer\_order\_id | UUID | Yes |
| consolidation\_group\_id | UUID | No |
| shipment\_type | VARCHAR(50) | Yes |
| shipping\_method | VARCHAR(50) | Yes |
| origin\_country\_id | UUID | Yes |
| destination\_country\_id | UUID | Yes |
| origin\_warehouse\_id | UUID | No |
| destination\_warehouse\_id | UUID | No |
| carrier\_name | VARCHAR(255) | No |
| tracking\_number | VARCHAR(255) | No |
| container\_number | VARCHAR(100) | No |
| bill\_of\_lading\_number | VARCHAR(100) | No |
| etd | TIMESTAMPTZ | No |
| eta | TIMESTAMPTZ | No |
| actual\_departure\_at | TIMESTAMPTZ | No |
| actual\_arrival\_at | TIMESTAMPTZ | No |
| status | VARCHAR(50) | Yes |
| delay\_flag | BOOLEAN | Yes |
| delay\_note | TEXT | No |
| created\_at | TIMESTAMPTZ | Yes |
| updated\_at | TIMESTAMPTZ | Yes |

`shipment_type`

* consolidated  
* partial  
* direct

`shipping_method`

* lcl  
* fcl  
* truck  
* air  
* courier

---

## **24.2 shipment\_items**

| Field | Type |
| ----- | ----- |
| id | UUID |
| shipment\_id | UUID |
| customer\_order\_item\_id | UUID |
| supplier\_order\_item\_id | UUID |
| quantity | DECIMAL(12,3) |
| package\_count | INTEGER |
| actual\_weight\_kg | DECIMAL(12,3) |
| actual\_cbm | DECIMAL(12,4) |
| created\_at | TIMESTAMPTZ |

---

## **24.3 shipment\_status\_history**

| Field | Type |
| ----- | ----- |
| id | UUID |
| shipment\_id | UUID |
| status | VARCHAR(50) |
| status\_date | TIMESTAMPTZ |
| location\_text | VARCHAR(255) |
| note | TEXT |
| is\_member\_visible | BOOLEAN |
| updated\_by | UUID |

---

## **24.4 shipment\_documents**

| Field | Type |
| ----- | ----- |
| id | UUID |
| shipment\_id | UUID |
| document\_type | VARCHAR(50) |
| file\_id | UUID |
| is\_member\_visible | BOOLEAN |
| created\_at | TIMESTAMPTZ |

---

# **25\. Logistics Cost และ Freight Invoice**

## **25.1 logistics\_cost\_items**

เก็บต้นทุนและราคาที่เรียกเก็บ

| Field | Type | Required |
| ----- | ----- | ----- |
| id | UUID | Yes |
| customer\_order\_id | UUID | Yes |
| shipment\_id | UUID | No |
| cost\_type | VARCHAR(50) | Yes |
| description | VARCHAR(255) | Yes |
| supplier\_cost\_amount | DECIMAL(18,2) | Yes |
| member\_charge\_amount | DECIMAL(18,2) | Yes |
| currency\_code | CHAR(3) | Yes |
| exchange\_rate | DECIMAL(18,6) | No |
| is\_billable | BOOLEAN | Yes |
| status | VARCHAR(50) | Yes |
| created\_by | UUID | Yes |
| created\_at | TIMESTAMPTZ | Yes |

`cost_type`

* china\_domestic\_transport  
* warehouse  
* inspection  
* consolidation  
* packing  
* international\_freight  
* insurance  
* customs  
* tax  
* thailand\_warehouse  
* thailand\_delivery  
* lifting  
* other

---

# **26\. Delivery**

## **26.1 deliveries**

| Field | Type | Required |
| ----- | ----- | ----- |
| id | UUID | Yes |
| delivery\_number | VARCHAR(50) | Yes |
| customer\_order\_id | UUID | Yes |
| shipment\_id | UUID | No |
| delivery\_address\_id | UUID | Yes |
| scheduled\_date | DATE | Yes |
| scheduled\_time\_from | TIME | No |
| scheduled\_time\_to | TIME | No |
| delivery\_status | VARCHAR(50) | Yes |
| site\_contact\_name | VARCHAR(255) | No |
| site\_contact\_phone | VARCHAR(50) | No |
| driver\_name | VARCHAR(255) | No |
| driver\_phone | VARCHAR(50) | No |
| vehicle\_registration | VARCHAR(50) | No |
| delivered\_at | TIMESTAMPTZ | No |
| recipient\_name | VARCHAR(255) | No |
| recipient\_user\_id | UUID | No |
| recipient\_signature\_file\_id | UUID | No |
| recipient\_confirmation\_at | TIMESTAMPTZ | No |
| condition\_status | VARCHAR(50) | No |
| delivery\_note | TEXT | No |
| created\_at | TIMESTAMPTZ | Yes |
| updated\_at | TIMESTAMPTZ | Yes |

สถานะ

* scheduled  
* confirmed  
* out\_for\_delivery  
* delivered  
* delivered\_with\_issue  
* partially\_delivered  
* failed  
* reschedule\_required

---

## **26.2 delivery\_items**

| Field | Type |
| ----- | ----- |
| id | UUID |
| delivery\_id | UUID |
| customer\_order\_item\_id | UUID |
| shipment\_item\_id | UUID |
| expected\_quantity | DECIMAL(12,3) |
| delivered\_quantity | DECIMAL(12,3) |
| condition\_status | VARCHAR(50) |
| issue\_note | TEXT |

---

## **26.3 delivery\_media**

| Field | Type |
| ----- | ----- |
| id | UUID |
| delivery\_id | UUID |
| file\_id | UUID |
| media\_role | VARCHAR(50) |
| caption | TEXT |
| created\_at | TIMESTAMPTZ |

---

# **27\. Claim และบริการหลังการขาย**

## **27.1 claims**

| Field | Type | Required |
| ----- | ----- | ----- |
| id | UUID | Yes |
| claim\_number | VARCHAR(50) | Yes |
| customer\_order\_id | UUID | Yes |
| delivery\_id | UUID | No |
| member\_profile\_id | UUID | Yes |
| claim\_type | VARCHAR(50) | Yes |
| subject | VARCHAR(255) | Yes |
| description | TEXT | Yes |
| severity | VARCHAR(30) | Yes |
| status | VARCHAR(50) | Yes |
| suggested\_responsibility\_type | VARCHAR(50) | No |
| responsibility\_type | VARCHAR(50) | No |
| responsible\_supplier\_id | UUID | No |
| responsibility\_confirmed\_by | UUID | No |
| responsibility\_confirmed\_at | TIMESTAMPTZ | No |
| assigned\_to | UUID | No |
| submitted\_at | TIMESTAMPTZ | Yes |
| resolved\_at | TIMESTAMPTZ | No |
| closed\_at | TIMESTAMPTZ | No |
| resolution\_summary | TEXT | No |
| rejection\_reason | TEXT | No |
| created\_at | TIMESTAMPTZ | Yes |
| updated\_at | TIMESTAMPTZ | Yes |

Canonical terminal rule:

* `rejected` ต้องมี `rejection_reason`
* `resolved` ต้องมี `resolution_summary` และเป็นสถานะก่อนปิด
* `closed` ต้องมี `resolution_summary` พร้อม Member Confirmation หรือ Admin Review ตามประเภทเคส

Responsibility Type:

* `supplier` — ปัญหาการผลิต วัสดุ หรือ Specification  
* `logistics_insurance` — ความเสียหายระหว่างขนส่ง  
* `installer` — ความเสียหายหรือข้อผิดพลาดจากการติดตั้ง

ระบบเสนอ `suggested_responsibility_type` จาก Issue Type ได้ แต่ `ORDER_ADMIN` ต้องยืนยัน
`responsibility_type` ก่อนดำเนินการ ห้ามตัดสินค่าชดเชยหรือ Warranty อัตโนมัติ และ
`responsible_supplier_id` ต้องถูก Redact หาก Member ยังไม่มี Disclosure Grant

---

## **27.2 claim\_items**

| Field | Type |
| ----- | ----- |
| id | UUID |
| claim\_id | UUID |
| customer\_order\_item\_id | UUID |
| quantity\_affected | DECIMAL(12,3) |
| issue\_type | VARCHAR(50) |
| description | TEXT |
| proposed\_resolution | VARCHAR(50) |
| resolution\_status | VARCHAR(50) |

---

## **27.3 claim\_media**

| Field | Type |
| ----- | ----- |
| id | UUID |
| claim\_id | UUID |
| file\_id | UUID |
| media\_type | VARCHAR(30) |
| caption | TEXT |
| uploaded\_by | UUID |
| created\_at | TIMESTAMPTZ |

---

## **27.4 claim\_updates**

| Field | Type |
| ----- | ----- |
| id | UUID |
| claim\_id | UUID |
| from\_status | VARCHAR(50) |
| to\_status | VARCHAR(50) |
| update\_note | TEXT |
| is\_member\_visible | BOOLEAN |
| updated\_by | UUID |
| created\_at | TIMESTAMPTZ |

---

# **28\. Cancellation**

## **28.1 cancellation\_requests**

| Field | Type |
| ----- | ----- |
| id | UUID |
| cancellation\_number | VARCHAR(50) |
| customer\_order\_id | UUID |
| requested\_by | UUID |
| reason | TEXT |
| status | VARCHAR(50) |
| supplier\_po\_status\_snapshot | JSONB |
| supplier\_payment\_snapshot | JSONB |
| proposed\_refund\_amount | DECIMAL(18,2) |
| deduction\_amount | DECIMAL(18,2) |
| approved\_refund\_amount | DECIMAL(18,2) |
| admin\_decision\_note | TEXT |
| decided\_by | UUID |
| decided\_at | TIMESTAMPTZ |
| created\_at | TIMESTAMPTZ |

สถานะ

* submitted  
* under\_review  
* approved  
* partially\_approved  
* rejected  
* completed

---

# **29\. Notification**

## **29.1 notifications**

| Field | Type |
| ----- | ----- |
| id | UUID |
| user\_id | UUID |
| notification\_type | VARCHAR(50) |
| title | VARCHAR(255) |
| message | TEXT |
| related\_entity\_type | VARCHAR(50) |
| related\_entity\_id | UUID |
| channel | VARCHAR(30) |
| status | VARCHAR(30) |
| read\_at | TIMESTAMPTZ |
| sent\_at | TIMESTAMPTZ |
| created\_at | TIMESTAMPTZ |

Channel

* in\_app  
* email

---

## **29.2 notification\_templates**

| Field | Type |
| ----- | ----- |
| id | UUID |
| template\_code | VARCHAR(100) |
| channel | VARCHAR(30) |
| subject\_template | TEXT |
| body\_template | TEXT |
| is\_active | BOOLEAN |
| created\_at | TIMESTAMPTZ |

---

# **30\. File Management**

## **30.1 files**

เป็นตารางกลางสำหรับไฟล์ทุกประเภท

| Field | Type | Required |
| ----- | ----- | ----- |
| id | UUID | Yes |
| storage\_provider | VARCHAR(50) | Yes |
| storage\_path | TEXT | Yes |
| original\_file\_name | VARCHAR(255) | Yes |
| file\_extension | VARCHAR(20) | No |
| mime\_type | VARCHAR(100) | No |
| file\_size\_bytes | BIGINT | No |
| checksum | VARCHAR(255) | No |
| uploaded\_by | UUID | No |
| access\_level | VARCHAR(30) | Yes |
| created\_at | TIMESTAMPTZ | Yes |
| deleted\_at | TIMESTAMPTZ | No |

`access_level`

* public  
* member  
* internal  
* confidential

**Business Rule**

* ไฟล์ราคาทุนและ Supplier Payment ต้องเป็น `confidential`  
* URL ควรเป็น Signed URL ไม่ใช่ Public URL ถาวร

---

# **31\. Catalog Import (Core MVP)**

Excel/CSV Import ใช้ Template และ Backend Validation ก่อนเขียนข้อมูลที่ผ่านการตรวจลง
`suppliers`, `products`, `product_variants`, `product_prices` และตาราง Catalog ที่เกี่ยวข้อง
พร้อมบันทึก Audit Log และสร้าง Error Report โดยไม่สร้าง AI Draft หรือ PDF Extraction Table

รายละเอียดความสามารถที่นำออกอยู่ใน `docs/post-mvp/POST-MVP BACKLOG.md`

---

# **32\. Audit Log**

## **32.1 audit\_logs**

| Field | Type |
| ----- | ----- |
| id | UUID |
| organization\_id | UUID |
| user\_id | UUID |
| action | VARCHAR(100) |
| entity\_type | VARCHAR(100) |
| entity\_id | UUID |
| old\_values | JSONB |
| new\_values | JSONB |
| reason | TEXT |
| ip\_address | INET |
| user\_agent | TEXT |
| created\_at | TIMESTAMPTZ |

กิจกรรมที่บังคับเก็บ

* Price Changed  
* Order Created  
* Order Status Changed  
* Payment Verified  
* Payment Rejected  
* PO Issued  
* QC Approved  
* Member Approved Custom QC  
* Shipment Changed  
* Order Cancelled  
* Claim Closed  
* Role Changed  
* Cost Viewed ในกรณีต้องการ Security Audit

---

# **33\. Activity Timeline**

## **33.1 entity\_timelines**

ใช้สร้าง Timeline แบบรวมสำหรับ Project, Order, Supplier Order และ Claim

| Field | Type |
| ----- | ----- |
| id | UUID |
| entity\_type | VARCHAR(50) |
| entity\_id | UUID |
| event\_type | VARCHAR(100) |
| title | VARCHAR(255) |
| description | TEXT |
| event\_date | TIMESTAMPTZ |
| created\_by | UUID |
| is\_member\_visible | BOOLEAN |
| metadata\_json | JSONB |

ช่วยลดการ Query หลายตารางเพื่อแสดง Timeline

---

# **34\. ความสัมพันธ์หลัก**

## **34.1 User และ Member**

users 1 ─── 0..1 member\_profiles  
users M ─── M roles  
roles M ─── M permissions

`member_profiles.user_id` ต้อง Unique และ Core ไม่มีความสัมพันธ์ Member Team/Sub-user

## **34.2 Supplier และสินค้า**

countries 1 ─── M suppliers  
suppliers 1 ─── M products  
products 1 ─── M product\_variants  
products M ─── M option\_values  
products M ─── M tags  
suppliers/products 1 ─── M supplier\_warranty\_versions  
price\_formula\_versions 1 ─── M price\_formula\_components  
products 1 ─── M price\_calculation\_snapshots

## **34.3 Material Sample และ Visit Disclosure**

showroom\_locations 1 ─── M samples  
member\_profiles 1 ─── M showroom\_visit\_requests  
showroom\_visit\_requests 1 ─── 0..1 supplier\_disclosure\_grants  
member\_profiles M ─── M suppliers ผ่าน Active Disclosure Grant

## **34.4 Project**

member\_profiles 1 ─── M projects  
end\_customers 1 ─── M projects  
projects 1 ─── M project\_areas  
projects 1 ─── M project\_items  
products 1 ─── M project\_items

## **34.5 Order**

projects 1 ─── M customer\_orders  
customer\_orders 1 ─── M customer\_order\_items  
customer\_orders 1 ─── M supplier\_orders  
supplier\_orders 1 ─── M supplier\_order\_items  
customer\_order\_items 1 ─── 1 supplier\_order\_item

ในทางปฏิบัติ Customer Order Item หนึ่งรายการผูก Supplier หนึ่งราย จึงอยู่ใน Supplier Order หนึ่งรายการ

## **34.6 Payment**

customer\_orders 1 ─── M customer\_payment\_schedules  
customer\_payment\_schedules 1 ─── M customer\_payments

supplier\_orders 1 ─── M supplier\_payment\_schedules  
supplier\_payment\_schedules 1 ─── M supplier\_payments

## **34.7 Production และ QC**

supplier\_orders 1 ─── M production\_updates  
supplier\_orders 1 ─── M qc\_inspections  
qc\_inspections 1 ─── M qc\_inspection\_items

## **34.8 Logistics**

supplier\_orders 1 ─── M warehouse\_receipts  
customer\_orders 1 ─── M shipments  
shipments 1 ─── M shipment\_items  
customer\_orders 1 ─── M deliveries

## **34.9 Claim**

customer\_orders 1 ─── M claims  
claims 1 ─── M claim\_items  
claims 1 ─── M claim\_updates

---

# **35\. Order Status Aggregation**

Customer Order Status ควรคำนวณจากข้อมูลย่อยและสามารถ Override โดย Admin ได้ในบางกรณี

ตัวอย่างกฎ

## **Awaiting Deposit**

* Deposit Schedule ยังไม่ Verified

## **Processing**

* Deposit Verified  
* มี Supplier Order อย่างน้อยหนึ่งรายการ  
* ยังไม่เริ่ม Production ครบทุกโรงงาน

## **In Production**

* Supplier Order ส่วนใหญ่หรือทั้งหมดอยู่ระหว่างผลิต

## **Awaiting Balance Payment**

* มี Supplier Order พร้อมส่งหรือผ่าน QC  
* Balance ยังไม่ Verified

## **Partially Shipped**

* มี Shipment ออกแล้วบางรายการ  
* ยังมีสินค้าไม่ถูกจัดส่ง

## **In Transit**

* Shipment ทั้งหมดที่ต้องส่งออกอยู่ระหว่างขนส่ง

## **Delivered**

* Delivery ครบตาม Order  
* Freight Payment อาจยังไม่ครบ

## **Completed**

* สินค้าส่งมอบครบ  
* Freight Verified  
* ไม่มี Action ค้างที่จำเป็น

แนะนำให้มี Background Service หรือ Trigger ระดับ Application คำนวณสถานะ ไม่ควรใช้ Database Trigger ที่ซับซ้อนใน MVP

---

# **36\. Business Validation Rules**

## **36.1 Product**

* Product Active ต้องมี Supplier  
* Standard Product ที่ Orderable ต้องมี Member Price Active  
* Product ที่ Discontinued ห้ามสร้าง Project Item ใหม่  
* Product เดิมใน Order เก่าต้องยังแสดงได้

## **36.2 Project Item**

* Quantity มากกว่า 0  
* Option Required ต้องถูกเลือกครบ  
* หาก Remark เปลี่ยนสเปกมาตรฐาน ต้องเปลี่ยนเป็น Custom Request  
* Ordered Quantity ห้ามมากกว่า Quantity

## **36.3 Order**

* Order ต้องมี Item อย่างน้อยหนึ่งรายการ  
* Item ต้องมาจาก Project เดียวกัน  
* Member ต้องเป็นเจ้าของ Project  
* Delivery Address ต้องตรงกับ Project Address ใน MVP  
* ราคาต้อง Snapshot ก่อนสร้าง Payment Schedule  
* Supplier Order ต้องถูกสร้างอัตโนมัติตาม Supplier

## **36.4 Payment**

* Finance เท่านั้นที่ Verify ได้  
* Payment Amount ต้องมากกว่า 0  
* Slip File จำเป็น  
* ห้ามเปิด PO ก่อน Deposit Verified  
* ห้ามส่งโรงงานก่อน Factory Deposit ถูกบันทึกตามนโยบาย

## **36.5 QC**

* Custom Product ต้องมี Member Approval  
* Standard Product ไม่ต้องมี Member Approval เว้นแต่ Admin กำหนด  
* Rework Required ต้องมี Note

## **36.6 Shipment**

* Shipment Item ต้องไม่เกิน Quantity ที่ยังไม่ถูกส่ง  
* Partial Shipment ต้องมีประเภท `partial`  
* หาก Partial Shipment ทำให้ค่าใช้จ่ายเพิ่ม ต้องมี Admin Note หรือ Member Acknowledgement

## **36.7 Delivery**

* Delivered ต้องมี Recipient Name  
* Delivered ต้องมี Delivery Proof อย่างน้อยหนึ่งรูปหรือ Confirmation  
* Delivered with Issue ต้องสร้าง Claim ได้ทันที

---

# **37\. สิทธิ์การเข้าถึงข้อมูล**

## **37.1 Member**

เห็น

* Profile ตนเอง  
* Project ตนเอง  
* Product Active  
* Member Price  
* Order ตนเอง  
* Payment ตนเอง  
* QC ที่เปิดให้เห็น  
* Shipment ตนเอง  
* Delivery ตนเอง  
* Claim ตนเอง

ไม่เห็น

* Factory Cost  
* Supplier Payment  
* Margin  
* Internal Note  
* ข้อมูลสมาชิกอื่น  
* รายละเอียดติดต่อโรงงานที่เป็นความลับ

## **37.2 Product Admin**

เห็นและแก้

* Supplier  
* Product  
* Category  
* Option  
* Member Price  
* Catalog

Factory Cost จะเห็นหรือไม่ขึ้นกับ Permission แยก

## **37.3 Finance**

เห็น

* Member Payment  
* Supplier Payment  
* Invoice  
* Cost  
* Margin

ไม่จำเป็นต้องแก้ Product Spec

## **37.4 QC Team**

เห็น

* Supplier Order  
* Spec Snapshot  
* QC  
* Media

ไม่จำเป็นต้องเห็น Margin

## **37.5 Logistics**

เห็น

* Supplier Order  
* Warehouse Receipt  
* Shipment  
* Delivery  
* Logistics Cost ตามสิทธิ์

## **37.6 Super Admin**

เข้าถึงทั้งหมด

---

# **38\. Row-Level Security**

InsForge PostgreSQL ต้องใช้ Row-Level Security ร่วมกับ SQL Grant ทุกตารางธุรกิจ

ตัวอย่างแนวทาง

## **Projects**

Member อ่านได้เมื่อ

projects.member\_profile\_id \= current\_member\_profile\_id

## **Customer Orders**

Member อ่านได้เมื่อ

customer\_orders.member\_profile\_id \= current\_member\_profile\_id

## **Claims**

Member อ่านได้เมื่อ

claims.member\_profile\_id \= current\_member\_profile\_id

## **Factory Identity Disclosure**

Member อ่านชื่อ/ที่อยู่/Contact/Supplier ID ได้เมื่อมี Grant ที่ยังไม่ถูกเพิกถอนเท่านั้น

supplier\_disclosure\_grants.member\_profile\_id \= current\_member\_profile\_id  
AND supplier\_disclosure\_grants.supplier\_id \= requested\_supplier\_id  
AND supplier\_disclosure\_grants.revoked\_at IS NULL

ห้ามใช้ `organization_id` ขยาย Disclosure และ Member-safe View ต้อง Redact ก่อน Serialize

## **Price Formula**

เฉพาะ `SUPER_ADMIN` อ่าน/สร้าง/แก้/Preview/Activate Formula Version และ Component ได้
Member ห้าม SELECT ตาราง Formula/Calculation Snapshot โดยตรง ให้รับเฉพาะ Safe Projection


---

# **39\. Index ที่แนะนำ**

## **users**

* `email`  
* `status`

## **member\_profiles**

* `member_code`  
* `approval_status`  
* `price_tier_id`

## **suppliers**

* `supplier_code`  
* `country_id`  
* `status`

## **products**

* `product_code`  
* `supplier_id`  
* `factory_sku`  
* `category_id`  
* `sales_status`  
* Full-text Index สำหรับชื่อและคำอธิบาย

## **project\_items**

* `project_id`  
* `product_id`  
* `item_status`

## **customer\_orders**

* `order_number`  
* `project_id`  
* `member_profile_id`  
* `status`  
* `created_at`

## **supplier\_orders**

* `supplier_order_number`  
* `customer_order_id`  
* `supplier_id`  
* `status`

## **payments**

* `customer_order_id`  
* `status`  
* `transfer_date`

## **shipments**

* `shipment_number`  
* `customer_order_id`  
* `status`  
* `eta`

## **claims**

* `claim_number`  
* `customer_order_id`  
* `status`

## **price\_formula\_versions**

* `scope_type + supplier_id + product_id + status + effective_from`  
* `formula_code + version_number`

## **showroom\_visit\_requests**

* `member_profile_id + status`  
* `supplier_id + status`  
* `scheduled_at`

## **supplier\_disclosure\_grants**

* Partial Unique `member_profile_id + supplier_id WHERE revoked_at IS NULL`

---

# **40\. Search Strategy**

MVP ควรรองรับการค้นหา Product ด้วย

* Product Code  
* Factory SKU  
* ชื่อไทย  
* ชื่ออังกฤษ  
* ชื่อจีน  
* Category  
* Supplier  
* Collection  
* Tag  
* Material  
* Option Code

สามารถใช้ PostgreSQL Full Text Search ก่อน

ยังไม่จำเป็นต้องใช้ Elasticsearch ใน MVP

---

# **41\. Number Generation**

เลขเอกสารต้องอ่านง่ายและไม่ซ้ำ

Atomic Document Number

* Custom Quotation: `QT-2026-000001`  
* Customer Order: `ORD-2026-000001`  
* Supplier Order: `SO-2026-000001`  
* Purchase Order: `PO-2026-000001`  
* Financial Document: `INV-DEP-2026-000001`, `INV-BAL-2026-000001`, `INV-FRT-2026-000001`  
* Payment: `PAY-2026-000001`  
* Shipment: `SHP-2026-000001`  
* Delivery: `DLV-2026-000001`  
* Claim: `CLM-2026-000001`

Unique Record Reference

* Project: `PRJ-2026-000001`  
* Custom Request: `CRQ-2026-000001`  
* QC Inspection: `QCI-2026-000001`  
* Warehouse Receipt: `WRC-2026-000001`  
* Consolidation: `CNS-2026-000001`

ควรมีตาราง `document_sequences`

## **document\_sequences**

| Field | Type |
| ----- | ----- |
| id | UUID |
| document\_type | VARCHAR(50) |
| year | INTEGER |
| last\_number | BIGINT |
| prefix | VARCHAR(20) |
| updated\_at | TIMESTAMPTZ |

การ Generate ต้องทำแบบ Atomic เพื่อป้องกันเลขซ้ำ

---

# **42\. ตาราง Lookup หรือ Enum**

แนะนำใช้ตาราง Lookup สำหรับสถานะที่ Admin อาจต้องแก้ไขในอนาคต และใช้ Database Enum เฉพาะค่าที่แทบไม่เปลี่ยน

ตาราง Lookup ที่ควรมี

* `order_statuses`  
* `supplier_order_statuses`  
* `payment_statuses`  
* `production_statuses`  
* `qc_statuses`  
* `shipment_statuses`  
* `claim_statuses`  
* `product_statuses`

ข้อดี

* เพิ่ม Label ภาษาไทยได้  
* กำหนดสีแสดงผล  
* กำหนดลำดับ  
* ปิดใช้งานได้  
* รองรับ Workflow Configuration ในอนาคต

---

# **43\. Data Snapshot Strategy**

ข้อมูลต่อไปนี้ต้อง Snapshot ลง Order Item

* Product Code  
* Factory SKU  
* Product Name  
* Product Image  
* Supplier  
* Category  
* ขนาด  
* วัสดุ  
* Option  
* Remark  
* Member Price  
* Factory Cost  
* Currency  
* Lead Time  
* Product Specification File ที่อนุมัติ

เหตุผล

* Product Master เปลี่ยนได้  
* ราคาเปลี่ยนได้  
* รูปเปลี่ยนได้  
* สินค้าหยุดขายได้  
* Option ถูกยกเลิกได้

แต่ Order เดิมต้องคงข้อมูลวันที่สั่งซื้อ

---

# **44\. File Storage Structure**

ตัวอย่าง Folder Structure

organizations/  
  {organization\_id}/  
    suppliers/  
      {supplier\_id}/  
        catalogs/  
        price-lists/  
        certificates/  
    products/  
      {product\_id}/  
        images/  
        documents/  
    projects/  
      {project\_id}/  
        custom-requests/  
    orders/  
      {order\_id}/  
        invoices/  
        payment-slips/  
        qc/  
        shipment/  
        delivery/  
        claims/

Runtime Storage ของ Core MVP ใช้ InsForge Storage

ไม่ควรใช้ Google Drive เป็น Runtime Storage หลักของ Application แต่สามารถใช้เป็นพื้นที่รับไฟล์จากโรงงานก่อนนำเข้าระบบในอนาคต

---

# **45\. Data Retention**

ข้อมูลที่ควรเก็บระยะยาว

* Order  
* Payment  
* Supplier Payment  
* Financial Document  
* QC  
* Shipment  
* Delivery  
* Claim  
* Audit Log

ข้อมูล Draft หรือไฟล์ที่ไม่ใช้สามารถ Archive ตามนโยบาย

ห้ามลบ Order ที่มีธุรกรรมทางการเงิน

---

# **46\. Backup และ Recovery**

MVP ควรมีอย่างน้อย

* Database Backup รายวัน  
* Point-in-Time Recovery หากระบบรองรับ  
* File Storage Versioning หรือ Backup  
* แผน Restore Test  
* จำกัดสิทธิ์การลบ  
* Audit การแก้ข้อมูลการเงิน

---

# **47\. Privacy และ Security**

## **47.1 Password**

* InsForge Auth เป็นผู้ Hash และจัดเก็บ Credential ใน `auth.users`  
* `public.users` และ App Table ห้ามมี Password หรือ Password Hash  
* Account Recovery/Reset Password ใช้ InsForge Auth Flow

## **47.2 Personal Data**

ข้อมูลลูกค้าปลายทางต้องจำกัดเฉพาะสมาชิกเจ้าของ Project และทีมงานที่เกี่ยวข้อง

## **47.3 Confidential Cost Data**

* Factory Cost  
* Supplier Payment  
* Margin  

ต้องใช้ Permission เฉพาะ

## **47.4 File Access**

ใช้ Signed URL แบบมีอายุ

## **47.5 Audit**

การเข้าถึงหรือ Export รายงานต้นทุนควรเก็บ Log

---

# **48\. MVP Database Tables**

ตารางที่ต้องสร้างใน MVP แบ่งเป็น 3 ระดับ

## **48.1 Must Have**

### **Authentication and User**

* organizations  
* users  
* roles  
* user\_roles  
* permissions  
* role\_permissions  
* member\_profiles

### **Supplier and Product**

* countries  
* suppliers  
* supplier\_documents  
* product\_categories  
* collections  
* tags  
* products  
* product\_tags  
* product\_media  
* product\_documents  
* option\_groups  
* option\_values  
* product\_option\_groups  
* product\_option\_values  
* product\_variants  
* price\_tiers  
* product\_prices  
* exchange\_rates

### **Project**

* end\_customers  
* addresses  
* projects  
* project\_areas  
* project\_items  
* project\_item\_option\_values

### **Custom Request**

* custom\_requests  
* custom\_request\_files

### **Order**

* customer\_orders  
* customer\_order\_items  
* order\_status\_history  
* supplier\_orders  
* supplier\_order\_items  
* purchase\_orders

### **Payment**

* customer\_payment\_schedules  
* customer\_payments  
* payment\_verification\_logs  
* financial\_documents  
* supplier\_payment\_schedules  
* supplier\_payments

### **Production and QC**

* production\_updates  
* production\_media  
* qc\_inspections  
* qc\_inspection\_items  
* qc\_media  
* qc\_member\_approvals

### **Logistics**

* warehouses  
* warehouse\_receipts  
* warehouse\_receipt\_items  
* consolidation\_groups  
* consolidation\_items  
* shipments  
* shipment\_items  
* shipment\_status\_history  
* shipment\_documents  
* logistics\_cost\_items

### **Delivery and Claim**

* deliveries  
* delivery\_items  
* delivery\_media  
* claims  
* claim\_items  
* claim\_media  
* claim\_updates  
* cancellation\_requests

### **Platform**

* notifications  
* notification\_templates  
* files  
* audit\_logs  
* entity\_timelines  
* document\_sequences

# **49\. แนวทางลดความซับซ้อนที่ต้องขออนุมัติก่อน**

รายการเดิมในหัวข้อนี้เป็นเพียงแนวคิดเชิงเทคนิคและไม่มีสิทธิ์แก้ Approved Contract หากจะใช้ต้องมี
Decision Log อนุมัติก่อนเสมอ โดย Core MVP ปัจจุบันต้องคง Multi-role ผ่าน `user_roles`, Product Option
แบบ Relation และ Address/Notification/Audit ที่ตรวจสอบย้อนหลังได้ตาม Schema หลัก

## **ทางเลือกที่ลดได้**

* ลด View หรือ Index ที่ยังไม่ถูกใช้ โดยไม่กระทบ Security/Acceptance Criteria  
* รวม Read Model ชั่วคราวใน Service Layer โดยไม่เปลี่ยน Source Table  

## **สิ่งที่ไม่ควรรวม**

ไม่ควรรวมตารางเหล่านี้

* Customer Order กับ Supplier Order  
* Member Payment กับ Supplier Payment  
* Member Price กับ Factory Cost  
* Project Item กับ Order Item  
* Shipment กับ Delivery  
* QC กับ Claim

เพราะเป็นคนละหน้าที่ทางธุรกิจอย่างชัดเจน

---

# **50\. Database Views ที่แนะนำ**

## **50.1 member\_product\_catalog\_view**

แสดงเฉพาะข้อมูลที่ Member เห็น

ไม่รวม Factory Cost

## **50.2 member\_order\_summary\_view**

รวม

* Order  
* Payment Status  
* Production Summary  
* Shipment Status  
* Delivery Status

## **50.3 admin\_order\_operation\_view**

รวม Customer Order และ Supplier Orders

## **50.4 finance\_order\_summary\_view**

รวม

* Member Payment  
* Supplier Payment  
* Product Margin  
* Logistics Margin

## **50.5 executive\_sales\_summary\_view**

Core MVP รวมเฉพาะ Order Count/Value, Payment Verified/Outstanding, Delay, Delivery และ Claim

---

# **51\. API Data Boundary**

## **Member API ห้ามส่ง Field**

* factory\_cost  
* factory\_unit\_cost  
* factory\_line\_cost  
* gross\_margin  
* supplier\_payment  
* internal\_note  
* supplier confidential contact

ควรสร้าง Response Model แยก ไม่ส่ง Database Row ตรง ๆ

---

# **52\. Transaction Boundary**

กิจกรรมต่อไปนี้ต้องใช้ Database Transaction

## **สร้าง Order**

1. ตรวจ Project Items  
2. Snapshot ราคา  
3. สร้าง Customer Order  
4. สร้าง Customer Order Items  
5. แยก Supplier Orders  
6. สร้าง Supplier Order Items  
7. สร้าง Payment Schedule  
8. Update Project Item Status

หากขั้นตอนใดผิด ต้อง Rollback ทั้งหมด

## **Verify Payment**

1. Update Customer Payment  
2. Update Payment Schedule  
3. Update Customer Order Status  
4. Create Timeline  
5. Create Notification

## **Create Shipment**

1. ตรวจ Quantity ที่ยังไม่ส่ง  
2. สร้าง Shipment  
3. สร้าง Shipment Items  
4. Update Supplier Order Status  
5. Update Customer Order Summary

---

# **53\. Concurrency Control**

ต้องป้องกันกรณี

* สมาชิกกดสร้าง Order ซ้ำ  
* Finance ตรวจสลิปเดียวกันสองครั้ง  
* Purchasing เปิด PO ซ้ำ  
* สินค้าเดียวกันถูกจัด Shipment เกินจำนวน  
* เลขเอกสารถูกสร้างซ้ำ

แนวทาง

* Unique Constraint  
* Transaction  
* Row Lock  
* Idempotency Key สำหรับ API สำคัญ

---

# **54\. Error Handling ที่เกี่ยวข้องกับฐานข้อมูล**

## **Product ไม่มีราคา**

ไม่อนุญาตให้สร้าง Standard Order

## **Option ไม่ครบ**

ไม่อนุญาตให้เปลี่ยน Project Item เป็น Ready to Order

## **Supplier ถูกระงับ**

ไม่อนุญาตให้สร้าง Order ใหม่จากสินค้านั้น

## **ราคาหมดอายุ**

ให้ดึงราคา Active ล่าสุด หรือแจ้ง Admin

## **Project Item ถูกสั่งครบแล้ว**

ไม่อนุญาตให้เลือกซ้ำ

## **Payment ผิดยอด**

Finance สามารถ Reject หรือ Verify บางส่วนได้

## **Shipment เกินจำนวน**

Database Validation หรือ Application Validation ต้องป้องกัน

---

# **55\. Data Migration และ Seed Data**

ก่อนเปิดระบบควรเตรียม Seed Data

* ประเทศ  
* สกุลเงิน  
* Role  
* Permission  
* Order Status  
* Payment Status  
* Product Category  
* Option Group  
* Price Tier  
* Document Type  
* Claim Type  
* Logistics Cost Type  
* Notification Template

---

# **56\. Acceptance Criteria ของฐานข้อมูล**

ฐานข้อมูลถือว่าพร้อมสำหรับ MVP เมื่อ

1. สร้างสมาชิกและกำหนด Role ได้  
2. จำกัดสมาชิกให้เห็นเฉพาะข้อมูลของตนเองได้  
3. เพิ่ม Supplier หลายประเทศได้  
4. เพิ่ม Product หลาย Supplier ได้  
5. แยก Factory Cost และ Member Price ได้  
6. กำหนด Product Option ได้  
7. สร้าง Project และ Project Items ได้  
8. สั่งบางส่วนจาก Project ได้  
9. Snapshot ราคาและสเปกเมื่อสร้าง Order ได้  
10. สร้างหนึ่ง Customer Order หลาย Supplier Orders ได้  
11. สร้าง Payment Schedule 50/50 ได้  
12. Verify Slip ก่อนเปิด PO ได้  
13. บันทึก Supplier Payment แยกจาก Member Payment ได้  
14. ติดตาม Production แยกโรงงานได้  
15. สร้าง QC และ Member Approval สำหรับ Custom ได้  
16. รวมสินค้าที่ Warehouse ได้  
17. สร้าง Partial Shipment ได้  
18. บันทึก Delivery Proof ได้  
19. สร้าง Freight Invoice หลัง Delivery ได้  
20. สร้าง Claim ได้  
21. บันทึก Audit Log ได้  
22. Member API ไม่เปิดเผย Factory Cost  
23. Order เดิมไม่เปลี่ยนเมื่อ Product หรือ Price เปลี่ยน  
24. ข้อมูลสำคัญไม่ถูกลบถาวรโดยไม่ตั้งใจ  
25. Account Recovery ใช้ InsForge Auth โดยไม่มี Password/Hash ใน App Table  
26. Suspended Member ดูประวัติเดิมแบบ Read-only แต่สร้าง/แก้ Transaction ไม่ได้  
27. Import Excel/CSV สร้าง Product Draft และเก็บ Error/Source Metadata ได้  
28. Custom Request/Custom Quotation ใช้ State และ Table แยกกัน  
29. Cancellation Request เก็บเหตุผล การตัดสิน และ Audit ได้  
30. Supplier Deposit/Balance และ Approval/History ถูกบันทึกแยกจาก Customer Payment ได้  
31. Freight Invoice หลัง Delivery และ Finance Verification ทำงานได้  
32. Production Role และ Atomic Document/Record Reference ตรง DEC-034/DEC-035  
33. Member Profile ผูกหนึ่ง Login และไม่มี Member Team/Sub-user/Invitation Table/API  
34. Formula Resolve แบบ Global → Supplier → Product และ Override เฉพาะ Component ได้  
35. เฉพาะ Super Admin สร้าง/แก้/Preview/Activate Formula ได้  
36. Template ทุน 100 ให้ Member Price 125, Suggested Resale 156.25 และ Freight Estimate 15–20 ได้  
37. Member-safe API ไม่เปิดเผย Factory Cost, Formula, Margin หรือ Supplier Identity ที่ยังล็อก  
38. Sample Type จำกัด Material Swatch และ Built-in Display และแสดงประเทศ/เมืองแบบ Member-safe ได้  
39. Visit Completed สร้าง Disclosure Grant เฉพาะ Member Profile + Supplier และ Super Admin เพิกถอนได้  
40. Order Item เก็บ Price Calculation และ Warranty Snapshot แบบ Immutable  
41. Claim เสนอ Responsibility ได้ แต่ Order Admin ต้องยืนยัน Supplier/Logistics/Installer ก่อนดำเนินการ

---

# **57\. ลำดับการสร้างฐานข้อมูล**

## **Sprint 1: Core Identity and Catalog**

* organizations  
* users  
* roles  
* permissions  
* member\_profiles  
* suppliers  
* categories  
* products  
* options  
* product\_prices  
* price\_formula\_versions  
* price\_formula\_components  
* price\_calculation\_snapshots  
* supplier\_warranty\_versions  
* showroom\_locations  
* samples  
* files

## **Sprint 2: Project and Custom**

* end\_customers  
* addresses  
* projects  
* project\_areas  
* project\_items  
* showroom\_visit\_requests  
* supplier\_disclosure\_grants  
* custom\_requests

## **Sprint 3: Order and Payment**

* customer\_orders  
* customer\_order\_items  
* supplier\_orders  
* supplier\_order\_items  
* payment\_schedules  
* payments  
* financial\_documents  
* purchase\_orders

## **Sprint 4: Production and QC**

* production\_updates  
* qc\_inspections  
* qc\_items  
* qc\_media  
* approvals

## **Sprint 5: Logistics and Delivery**

* warehouses  
* receipts  
* consolidation  
* shipments  
* delivery  
* logistics\_cost\_items

## **Sprint 6: Claim, Dashboard and Audit**

* claims  
* cancellation\_requests  
* notifications  
* audit\_logs  
* timeline  

---

# **58\. ข้อสรุป**

โครงสร้างฐานข้อมูล GISP ต้องแยกข้อมูลเป็นหน่วยธุรกิจที่ชัดเจน

Member  
→ Project  
→ Project Item  
→ Customer Order  
→ Customer Order Item  
→ Supplier Order  
→ Supplier Order Item  
→ Payment  
→ Production  
→ QC  
→ Warehouse  
→ Shipment  
→ Delivery  
→ Claim

หัวใจสำคัญของฐานข้อมูลคือ

1. Project เป็นศูนย์กลาง  
2. Customer Order รองรับหลาย Supplier  
3. Member Payment แยกจาก Supplier Payment  
4. Member Price แยกจาก Factory Cost  
5. Member เห็น Suggested Resale/Freight Estimate แต่ไม่เห็น Formula/Cost/Margin  
6. Price Formula สืบทอด Global → Supplier → Product และเก็บ Calculation Snapshot  
7. Order Item เก็บ Price/Spec/Warranty Snapshot  
8. Material Sample แยกจาก Built-in Display และ Factory Identity ใช้ Visit Disclosure  
9. Standard และ Custom Product ใช้ Workflow ต่างกัน  
10. QC แยกการอนุมัติทีมงานและสมาชิก  
11. Shipment รองรับ Consolidation และ Partial Shipment  
12. Delivery ต้องมี Proof of Delivery  
13. Claim แยกผู้รับผิดชอบตามสาเหตุ  
14. ทุกกิจกรรมสำคัญตรวจสอบย้อนหลังได้

ฐานข้อมูลฉบับนี้ออกแบบให้ครบกระบวนการ MVP แต่ยังคงใช้โครงสร้างที่สามารถขยายไปยังระบบขนาดใหญ่ขึ้นได้ โดยไม่จำเป็นต้องรื้อฐานข้อมูลหลักในอนาคต
