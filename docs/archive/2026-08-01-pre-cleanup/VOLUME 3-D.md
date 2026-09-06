# **GLOBAL INTERIOR SUPPLY PLATFORM**

## **GISP – UX/UI FLOW SPECIFICATION**

## **VOLUME 3 – PART D: SYSTEM ADMINISTRATION**

**Document Version:** 1.2  
**Reconciled Date:** 1 สิงหาคม 2569 (2026-08-01)  
**Authority:** System Administration Reference ภายใต้ `MVP BUSINESS MASTER PLAN.md` และ `DECISION LOG.md`  
**Change Summary:** ล็อก Production Role/Numbering, Payment Default แบบ Read-only และย้าย Generic API/Integration UI ออกจาก Core ตาม DEC-034 ถึง DEC-036  
**Document Type:** Core Administration + Post-MVP Reference Specification  
**Primary Users:** Member Admin และ Super Admin; System/Security Admin เป็น Persona และ Integration Admin เป็น Post-MVP Persona  
**Primary Language:** ภาษาไทย

---

# **0\. RECONCILED SCOPE**

Volume 3-D เป็นเอกสารอ้างอิงแบบผสม:

**Core MVP**

* User, Organization, Multi-role และ Permission
* Member Approval/Suspension
* Company Settings รวม VAT Default
* Document Number แบบ Atomic Sequence
* InsForge Storage แยก Public, Member-private และ Confidential
* Backup/Restore Procedure ขั้นต่ำ
* Audit, Security และ Notification Delivery Log
* Production Role Catalog ตาม DEC-035; `GISP Admin` ใช้เฉพาะ Demo Mapping

**Post-MVP**

* Generic API/Integration Management UI
* Infrastructure Dashboard ขั้นสูง
* Generic Task Center
* Advanced Notification Rule Builder
* Orphan File Automation และ Storage Analytics ขั้นสูง

หัวข้อเดิมที่อยู่ใน Post-MVP เก็บไว้เป็น Reference เท่านั้น ห้ามสร้างใน Core MVP

---

# **1\. วัตถุประสงค์**

Part D กำหนดฟังก์ชันหลังบ้านสำหรับบริหารโครงสร้างระบบ ผู้ใช้งาน สิทธิ์ ค่าตั้งต้น เอกสาร การแจ้งเตือน ไฟล์ การสำรองข้อมูล และประวัติการทำงานของระบบ ส่วน Generic API/Integration Management เป็น Post-MVP

ขอบเขตประกอบด้วย

1. User Management  
2. Role & Permission  
3. Notification Template  
4. Lookup Tables  
5. Exchange Rate  
6. Document Number  
7. Company Settings  
8. Storage  
9. Backup  
10. API Settings (Post-MVP)  
11. Integration (Post-MVP)  
12. System Log

ระบบใน Part D มีหน้าที่สนับสนุนทุกโมดูลของ GISP แต่ไม่ควรเปิดให้ผู้ใช้งานทั่วไปเข้าถึง

---

# **2\. หลักการสำคัญ**

1. ผู้ใช้ทุกคนต้องมี Role และ Permission  
2. Backend ต้องตรวจ Permission ทุกครั้ง  
3. การซ่อนเมนูใน Frontend ไม่ถือเป็นการป้องกันสิทธิ์  
4. Super Admin ควรใช้เฉพาะงานที่จำเป็น  
5. การเปลี่ยนสิทธิ์ต้องมี Audit Log  
6. Lookup ที่ถูกใช้งานแล้วห้ามลบถาวร  
7. Exchange Rate ที่ใช้กับธุรกรรมต้องถูก Snapshot  
8. Document Number ที่ออกแล้วห้ามนำกลับมาใช้ใหม่  
9. API Key และ Secret ห้ามแสดงค่าทั้งหมดหลังบันทึก  
10. Backup และ Restore ต้องจำกัดสิทธิ์สูง  
11. Integration Failure ต้องไม่ทำให้ Core Workflow หยุดทั้งหมด  
12. System Log ต้องไม่เปิดเผย Password, Token หรือ Secret

---

# **3\. User Roles**

ชื่อผู้ดูแลในหัวข้อนี้เป็น Administration Persona/Permission Profile ไม่ใช่ Production Role ใหม่
User Administration ใช้ `MEMBER_ADMIN`, งานระบบที่มีสิทธิ์สูงใช้ `SUPER_ADMIN` และ Integration Admin
เป็น Post-MVP Persona ตาม DEC-035/DEC-036

## **3.1 System Viewer**

สามารถ

* ดูข้อมูลตั้งค่าทั่วไป  
* ดู Log ตามสิทธิ์

การดูสถานะ Integration เป็น Post-MVP

ไม่สามารถแก้ไขระบบ

## **3.2 User Admin**

สามารถ

* สร้างผู้ใช้งานภายใน  
* เปิดหรือระงับบัญชี  
* กำหนด Role ที่ได้รับอนุญาต  
* Reset Access ตาม Workflow

## **3.3 Security Admin**

สามารถ

* จัดการ Role  
* จัดการ Permission  
* ตรวจ Session  
* ตรวจ Security Log  
* บังคับ Logout

## **3.4 System Admin**

สามารถ

* จัดการ Lookup  
* Document Number  
* Notification Template  
* Company Settings  
* Storage Configuration

API Settings เป็น Post-MVP

## **3.5 Integration Admin**

สามารถ

* จัดการ Integration  
* API Credential  
* Webhook Configuration  
* ตรวจ Integration Log  
* Retry งานที่ล้มเหลว

## **3.6 Super Admin**

เข้าถึงทั้งหมด แต่การเปลี่ยนแปลงสำคัญต้องมีเหตุผลและ Audit Log

---

# **4\. Information Architecture**

System Administration

Users  
├── User List  
├── User Detail  
├── Access Status  
└── Active Sessions

Roles & Permissions  
├── Role List  
├── Permission Matrix  
└── Role Assignment

Configuration  
├── Notification Templates  
├── Lookup Tables  
├── Exchange Rates  
├── Document Numbers  
└── Company Settings

Infrastructure  
├── Storage  
├── Backup  
├── API Settings (Post-MVP)  
├── Integrations (Post-MVP)  
└── System Logs

---

# **5\. Screen Inventory**

Part D ประกอบด้วยประมาณ 20 หน้าจอหลัก

1. System Administration Dashboard  
2. User Listing  
3. Create Internal User  
4. User Detail  
5. User Access and Session Management  
6. Role Listing  
7. Create/Edit Role  
8. Permission Matrix  
9. Role Assignment Review  
10. Notification Template Listing  
11. Notification Template Editor  
12. Lookup Table Management  
13. Exchange Rate Management  
14. Document Number Management  
15. Company Settings  
16. Storage Management  
17. Backup Management  
18. API Settings (Post-MVP)  
19. Integration Management (Post-MVP)  
20. System Log

---

# **6\. System Administration Dashboard**

## **Screen ID**

`SYS-001`

## **Purpose**

แสดงภาพรวมการตั้งค่าระบบและเหตุการณ์ที่ต้องดำเนินการ

## **Summary Cards**

* Active Internal Users  
* Suspended Users  
* Roles  
* Failed Login Attempts  
* Storage Usage  
* Last Backup  
* Failed Jobs  
* Critical System Logs

## **Action Required**

* User Account Locked  
* Role ไม่มีผู้รับผิดชอบ  
* Exchange Rate หมดอายุ  
* Document Number ใกล้ครบช่วง  
* Notification Template Error  
* Storage ใกล้เต็ม  
* Backup Failed  

## **Quick Actions**

* เพิ่มผู้ใช้งาน  
* สร้าง Role  
* เพิ่ม Exchange Rate  
* แก้ Notification Template  
* เริ่ม Backup

Integration Status/Error, API Credential Alert และคำสั่งตรวจ Integration เป็น Post-MVP และไม่แสดงใน Core Dashboard

---

# **7\. User Listing**

## **Screen ID**

`USR-001`

## **Purpose**

บริหารบัญชีผู้ใช้งานภายในและสมาชิกที่ต้องดูแลโดย Admin

## **User Types**

* Internal User  
* Member  
* Admin  
* Service Account

## **Columns**

* User Code  
* Name  
* Email  
* User Type  
* Organization  
* Roles  
* Account Status  
* Last Login  
* Failed Login Count  
* Created Date  
* Action

## **Filters**

* User Type  
* Role  
* Organization  
* Status  
* Last Login  
* Created Date  
* Has Active Session

## **Actions**

* View  
* Edit  
* Assign Role  
* Suspend  
* Reactivate  
* Force Logout  
* Reset Access  
* View Audit

---

# **8\. Create Internal User**

## **Screen ID**

`USR-002`

## **Fields**

* First Name  
* Last Name  
* Display Name  
* Email  
* Phone  
* Organization  
* Department  
* Position  
* Default Role  
* Additional Roles  
* Account Status  
* Language  
* Time Zone

## **Business Rules**

* Email ต้องไม่ซ้ำ  
* Internal User ต้องมี Role อย่างน้อยหนึ่ง Role  
* ห้ามกำหนด Super Admin โดยผู้ไม่มีสิทธิ์  
* ระบบส่งคำเชิญให้ตั้ง Password  
* Admin ห้ามกำหนด Password ถาวรให้ผู้ใช้  
* ผู้สร้างบัญชีต้องถูกบันทึกใน Audit Log

---

# **9\. User Detail**

## **Screen ID**

`USR-003`

## **Display**

* Profile  
* User Type  
* Organization  
* Roles  
* Direct Permissions หากอนุญาต  
* Account Status  
* Last Login  
* Failed Login Attempts  
* Active Sessions  
* Recent Activity  
* Created By  
* Updated By

## **Actions**

* Edit Profile  
* Assign Role  
* Suspend  
* Unlock Account  
* Force Logout  
* Revoke Session  
* Send Password Reset  
* Disable Access

## **Restrictions**

* ผู้ใช้ห้ามลดสิทธิ์ตนเองหากทำให้ระบบไม่มี Super Admin  
* Super Admin คนสุดท้ายห้ามถูก Suspend  
* การเปลี่ยน Role สำคัญต้องมี Confirmation

---

# **10\. User Access and Session Management**

## **Screen ID**

`USR-004`

## **Purpose**

ตรวจและยกเลิก Session ที่กำลังใช้งาน

## **Session Information**

* Device  
* Browser  
* IP Address  
* Login Date  
* Last Activity  
* Session Status  
* Expiry

## **Actions**

* Revoke Session  
* Force Logout All Sessions  
* Lock Account  
* Unlock Account

## **Security Rules**

* Session Token ห้ามแสดง  
* การ Force Logout ต้องสร้าง Audit Log  
* Failed Login เกินเกณฑ์สามารถ Lock Account ได้  
* Service Account ใช้กฎ Session แยกจากผู้ใช้ทั่วไป

---

# **11\. Role Listing**

## **Screen ID**

`ROLE-001`

## **Columns**

* Role Code  
* Role Name  
* Role Type  
* Number of Users  
* Number of Permissions  
* System Role  
* Status  
* Updated Date

## **Role Types**

* Member Role  
* Operational Role  
* Finance Role  
* Administrative Role  
* System Role

Production System Role ที่ Seed ใน Core MVP:

`MEMBER`, `MEMBER_ADMIN`, `PRODUCT_ADMIN`, `ORDER_ADMIN`, `PURCHASING`, `FINANCE`, `QC`,
`LOGISTICS`, `EXECUTIVE_VIEWER`, `SUPER_ADMIN`

`GISP Admin` ไม่อยู่ใน Production Role Catalog และใช้เป็นชื่อรวม Role ใน Demo เท่านั้น

## **Actions**

* View  
* Edit  
* Duplicate  
* Deactivate  
* View Assigned Users

## **Rules**

* System Role ที่จำเป็นห้ามลบ  
* Role ที่มีผู้ใช้งานห้ามลบถาวร  
* ใช้ Deactivate แทน  
* การ Duplicate Role ต้องไม่ Copy User Assignment

---

# **12\. Create/Edit Role**

## **Screen ID**

`ROLE-002`

## **Fields**

* Role Code  
* Role Name  
* Description  
* Role Type  
* Status  
* Permissions  
* Data Scope

## **Data Scope**

* Own Data  
* Organization Data  
* Assigned Data  
* All Data

## **Business Rules**

* Role Code ไม่ซ้ำ  
* Role ต้องมี Permission อย่างน้อยหนึ่งรายการ  
* Role ที่เข้าถึง Cost ต้องมี Cost Permission ชัดเจน  
* Role ที่ Verify Payment ต้องมี Finance Permission  
* Role ที่แก้ Role อื่นต้องมี Security Admin Permission  
* การแก้ System Role ต้องมี Super Admin

---

# **13\. Permission Matrix**

## **Screen ID**

`ROLE-003`

## **Purpose**

กำหนดสิทธิ์ตาม Module และ Action

## **Permission Groups**

* Member  
* Supplier  
* Catalog  
* Project  
* Order  
* Customer Payment  
* Supplier Payment  
* Production  
* QC  
* Warehouse  
* Shipment  
* Delivery  
* Claim  
* Reports  
* System Administration

## **Standard Actions**

* View  
* Create  
* Update  
* Approve  
* Reject  
* Export  
* Delete Draft  
* Suspend  
* Override  
* View Cost  
* View Personal Data

## **Display**

Matrix

| Module | View | Create | Update | Approve | Export | Override |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: |

## **Rules**

* Permission เปลี่ยนต้องบันทึก Old และ New Value  
* Critical Permission ต้องมี Confirmation  
* Direct Permission ควรหลีกเลี่ยงใน MVP  
* ให้ใช้ Role-based Permission เป็นหลัก

---

# **14\. Role Assignment Review**

## **Screen ID**

`ROLE-004`

## **Purpose**

ตรวจผู้ใช้งานที่ถือสิทธิ์สำคัญ

## **Critical Roles**

* Super Admin  
* Security Admin  
* Finance Manager  
* Product Publisher  
* Payment Verifier  
* Supplier Payment Approver  
* Integration Admin

## **Display**

* User  
* Role  
* Assigned By  
* Assigned Date  
* Last Used  
* Status

## **Actions**

* Remove Role  
* Replace Role  
* Export Review  
* Add Review Note

## **Business Rule**

ระบบควรป้องกันไม่ให้ลบผู้ใช้คนสุดท้ายของ Role ที่จำเป็น

---

# **15\. Notification Template Listing**

## **Screen ID**

`NOTI-001`

## **Notification Channels**

* In-app  
* Email  
* LINE หรือ External Channel ในอนาคต

## **Columns**

* Template Code  
* Template Name  
* Event  
* Channel  
* Language  
* Active  
* Last Updated  
* Updated By

## **Events ตัวอย่าง**

* Member Approved  
* Payment Submitted  
* Payment Verified  
* Payment Rejected  
* Production Delayed  
* QC Approval Required  
* Shipment Departed  
* Delivery Scheduled  
* Claim Updated

## **Actions**

* View  
* Edit  
* Duplicate  
* Activate  
* Deactivate  
* Send Test

---

# **16\. Notification Template Editor**

## **Screen ID**

`NOTI-002`

## **Fields**

* Template Code  
* Template Name  
* Trigger Event  
* Channel  
* Language  
* Subject  
* Message Body  
* Variables  
* Active  
* Internal Note

## **Template Variables**

ตัวอย่าง

{{member\_name}}  
{{order\_number}}  
{{project\_name}}  
{{amount\_due}}  
{{payment\_type}}  
{{shipment\_eta}}  
{{claim\_number}}

## **Rules**

* ตัวแปรต้องมาจากรายการที่ระบบรองรับ  
* ห้ามใช้ Variable ที่ไม่มีข้อมูลใน Event  
* ระบบต้อง Preview Template ได้  
* Template ที่ Active และถูกใช้งานห้ามลบถาวร  
* การแก้ Template ไม่เปลี่ยนข้อความที่ส่งไปแล้ว

---

# **17\. Lookup Table Management**

## **Screen ID**

`CFG-001`

## **Purpose**

จัดการค่ามาตรฐานที่ใช้ใน Dropdown และ Business Configuration

## **Lookup Groups**

* Countries  
* Currencies  
* Provinces  
* Project Types  
* Supplier Types  
* Product Types  
* Document Types  
* Payment Methods  
* Claim Types  
* Shipping Methods  
* Units  
* Languages  
* Departments  
* Rejection Reasons

## **Fields**

* Lookup Code  
* Name Thai  
* Name English  
* Group  
* Display Order  
* Active  
* System Value  
* Note

## **Business Rules**

* Code ที่ถูกใช้งานแล้วห้ามเปลี่ยนโดยไม่มี Migration  
* Lookup ที่มี Transaction ห้ามลบ  
* ใช้ Deactivate  
* System Value แก้ได้เฉพาะ Super Admin  
* การเพิ่ม Lookup ห้ามทำให้เกิด Workflow ใหม่โดยอัตโนมัติ

---

# **18\. Exchange Rate Management**

## **Screen ID**

`CFG-002`

## **Purpose**

บันทึกอัตราแลกเปลี่ยนที่ GISP ใช้คำนวณราคาและธุรกรรม

## **Supported Currency ใน MVP**

* THB  
* CNY

Database รองรับ Currency อื่นในอนาคต

## **Fields**

* From Currency  
* To Currency  
* Rate  
* Rate Type  
* Effective Date  
* Effective Time  
* Source  
* Created By  
* Approved By  
* Status

## **Rate Types**

* Reference Rate  
* Purchasing Rate  
* Selling/Member Pricing Rate  
* Transaction Rate

## **Business Rules**

* Rate ต้องมากกว่า 0  
* ช่วง Effective ห้ามซ้อนกันใน Rate Type เดียวกัน  
* Transaction ต้อง Snapshot Rate  
* การเปลี่ยน Rate ไม่แก้ Order หรือ Payment เดิม  
* Rate ที่ใช้แล้วห้ามลบ  
* การแก้ Rate ที่ Active ต้องสร้าง Version ใหม่  
* Product Pricing สามารถใช้อัตราที่กำหนดสำหรับ Pricing โดยเฉพาะ

---

# **19\. Document Number Management**

## **Screen ID**

`CFG-003`

## **Purpose**

กำหนดรูปแบบเลขเอกสารของแต่ละ Module

## **Document Types**

Atomic Document Number

* Custom Quotation (`QT`)  
* Customer Order (`ORD`)  
* Supplier Order (`SO`)  
* Purchase Order (`PO`)  
* Invoice (`INV`) แยก Deposit/Balance/Freight subtype  
* Payment (`PAY`)  
* Shipment (`SHP`)  
* Delivery (`DLV`)  
* Claim (`CLM`)

Unique Record Reference

* Project (`PRJ`)  
* Custom Request (`CRQ`)  
* QC Inspection (`QCI`)  
* Warehouse Receipt (`WRC`)  
* Consolidation (`CNS`)

## **Configuration**

* Prefix  
* Year Format  
* Month Format  
* Running Length  
* Reset Rule  
* Current Number  
* Sample Preview  
* Active

## **Example**

ORD-2026-000001  
SO-2026-000001  
PO-2026-000001  
INV-DEP-2026-000001  
SHP-2026-000001

## **Business Rules**

* เลขที่ออกแล้วห้ามใช้ซ้ำ  
* การยกเลิกเอกสารไม่คืนเลข  
* Running Number ต้องสร้างใน Transaction  
* ระบบต้องป้องกันเลขซ้ำจาก Concurrent Request  
* การเปลี่ยนรูปแบบมีผลเฉพาะเอกสารใหม่  
* Current Number ห้ามแก้โดยผู้ไม่มี Super Admin Permission

---

# **20\. Company Settings**

## **Screen ID**

`CFG-004`

## **Purpose**

จัดการข้อมูลบริษัทที่ใช้ในระบบและเอกสาร

## **Sections**

### **Company Identity**

* Company Name Thai  
* Company Name English  
* Tax ID  
* Logo  
* Address  
* Phone  
* Email  
* Website

### **Financial Information**

* Bank Name  
* Account Name  
* Account Number  
* Default Currency  
* Default Customer Deposit % — Read-only 50% ใน MVP  
* Default Customer Balance % — Read-only 50% ใน MVP  
* Default Supplier Deposit % — Read-only 50% ใน MVP  
* Default Supplier Balance % — Read-only 50% ใน MVP

### **Document Information**

* Invoice Footer  
* Payment Instruction  
* Terms and Conditions  
* Signature  
* Company Stamp

### **Operational Defaults**

* Default China Warehouse  
* Default Thailand Warehouse  
* Default Time Zone  
* Default Language  
* Default Claim Period ถ้ามี

## **Fixed MVP Rule**

Payment Percentage ต้องเป็น

* Customer Deposit 50%  
* Customer Balance 50%  
* Supplier Deposit 50%  
* Supplier Balance 50%

การตั้งค่าอื่นต้องไม่เปลี่ยนกฎนี้ใน MVP

---

# **21\. Storage Management**

## **Screen ID**

`INFRA-001`

## **Purpose**

ดูและควบคุมไฟล์ใน InsForge Storage

## **Storage Categories**

* Product Media  
* Product Documents  
* Member Documents  
* Project Files  
* Payment Evidence  
* Production Media  
* QC Media  
* Shipment Documents  
* Delivery Proof  
* Claim Evidence  
* Export Files  
* System Backup Metadata

## **Display**

* Bucket  
* File Count  
* Storage Used  
* Maximum Size  
* File Type  
* Public/Private  
* Last Upload  
* Orphan File Count

## **Actions**

* View Bucket  
* Search File  
* Download ตามสิทธิ์  
* Archive File  
* Delete Orphan File  
* Run Orphan Check

## **Business Rules**

* Financial และ Personal Files ต้องเป็น Private  
* Public URL ห้ามใช้กับ Confidential File  
* File Metadata ต้องเชื่อม Entity  
* Transaction File ที่ถูกใช้งานแล้วห้ามลบโดยตรง  
* การลบต้องตรวจ Reference  
* Export File สามารถกำหนด Expiry ได้

---

# **22\. Backup Management**

## **Screen ID**

`INFRA-002`

## **Purpose**

ติดตามและเริ่มกระบวนการสำรองข้อมูล

## **Backup Types**

* Database Backup  
* Configuration Export  
* Storage Inventory  
* Pre-deployment Backup

## **Display**

* Backup Number  
* Backup Type  
* Started Date  
* Completed Date  
* Status  
* Size  
* Initiated By  
* Retention Date  
* Verification Status

## **Actions**

* Start Backup  
* View Status  
* Verify Backup  
* Download Configuration Export  
* View Failure Reason  
* Request Restore

## **Restore Rule**

MVP ไม่ควรให้ Restore ทันทีจากปุ่มเดียว

ต้องใช้

Request Restore  
→ Super Admin Review  
→ Backup Validation  
→ Maintenance Mode  
→ Restore  
→ Verification

## **Business Rules**

* Restore ต้องมีเหตุผล  
* Restore ต้องสร้าง Audit Log  
* ต้อง Backup ก่อน Restore  
* Restore Production ต้องจำกัดสิทธิ์สูงสุด  
* Backup Failure ต้องแจ้งเตือน System Admin

---

# **23\. API Settings (Post-MVP Reference)**

## **Screen ID**

`API-001`

## **Purpose**

จัดการ Credential และค่าตั้งต้นสำหรับ API ภายในและภายนอก

## **API Types**

* Internal API  
* Service Account  
* External Integration API  
* Webhook Credential

## **Fields**

* API Name  
* Environment  
* Client/Key Name  
* Secret  
* Allowed Scope  
* Allowed IP ถ้ามี  
* Expiry Date  
* Status  
* Created By  
* Last Used

## **Security Rules**

* Secret แสดงเต็มได้เฉพาะตอนสร้าง  
* หลังบันทึกแสดง Masked Value  
* Secret ต้องเข้ารหัส  
* ห้ามบันทึก Secret ใน System Log  
* Key ต้อง Rotate ได้  
* Key ที่ถูก Revoke ใช้งานไม่ได้ทันที  
* API Scope ใช้หลัก Least Privilege

---

# **24\. Integration Management (Post-MVP Reference)**

## **Screen ID**

`INT-001`

## **Purpose**

จัดการระบบภายนอกที่เชื่อมกับ GISP

## **Integration Types ใน MVP**

* Email Provider  
* Notification Provider  
* File/Storage Service ตาม Stack  
* Future Accounting Connector แบบปิดใช้งาน  
* Future Logistics Connector แบบปิดใช้งาน

## **Integration Record**

* Integration Name  
* Type  
* Environment  
* Status  
* Configuration  
* Credential Reference  
* Last Successful Run  
* Last Error  
* Retry Policy  
* Responsible Owner

## **Actions**

* Configure  
* Test Connection  
* Activate  
* Deactivate  
* Retry  
* View Logs

## **Business Rules**

* Integration ที่ไม่จำเป็นต่อ Core Workflow ต้องไม่ Block ระบบ  
* การปิด Integration ต้องแสดงผลกระทบ  
* Credential ต้องอ้างอิง API Settings  
* ห้ามแสดง Secret  
* Test Connection ต้องไม่สร้างธุรกรรมจริง  
* Integration Error ต้องมี Retry หรือ Manual Recovery

---

# **25\. System Log**

## **Screen ID**

`LOG-001`

## **Purpose**

ตรวจเหตุการณ์ระบบ งานเบื้องหลัง และข้อผิดพลาด

## **Log Types**

* Application  
* Authentication  
* Authorization  
* API  
* Background Job  
* Notification  
* File Upload  
* Import  
* Integration  
* Security  
* System Configuration

## **Log Levels**

* Info  
* Warning  
* Error  
* Critical

## **Fields**

* Timestamp  
* Log Level  
* Module  
* Event Code  
* Message  
* User/Service  
* Entity Reference  
* Request ID  
* Environment  
* Status

## **Filters**

* Date Range  
* Level  
* Module  
* Event Code  
* User  
* Entity  
* Request ID

## **Business Rules**

* Password, Token และ Secret ห้ามอยู่ใน Log  
* Personal Data ต้อง Mask ตามความเหมาะสม  
* Log ห้ามแก้จาก UI  
* Critical Log ต้องแจ้ง System Admin  
* Log ต้องมี Retention Policy  
* System Log และ Business Audit Log ต้องแยกหน้าที่กัน

---

# **26\. User Status**

INVITED  
→ ACTIVE  
→ SUSPENDED  
→ ACTIVE

สถานะเพิ่มเติม

* LOCKED  
* DISABLED  
* REJECTED  
* ARCHIVED

## **Rules**

* LOCKED เกิดจาก Security Rule หรือ Admin Action  
* SUSPENDED ใช้หยุดการใช้งานชั่วคราว  
* DISABLED ใช้ยุติสิทธิ์  
* ARCHIVED ใช้กับบัญชีที่ไม่ใช้งานและไม่มี Active Access  
* ห้าม Hard Delete User ที่มีประวัติธุรกรรม

---

# **27\. Integration Status**

DRAFT  
→ CONFIGURED  
→ TESTED  
→ ACTIVE

สถานะพิเศษ

* ERROR  
* SUSPENDED  
* DISABLED

## **Rules**

* ACTIVE ต้องผ่าน Test Connection  
* ERROR สามารถ Retry  
* DISABLED ห้ามส่งหรือรับข้อมูล  
* การเปลี่ยน Status ต้องมี Audit Log

---

# **28\. Backup Status**

QUEUED  
→ RUNNING  
→ VERIFYING  
→ COMPLETED

สถานะพิเศษ

* FAILED  
* CANCELLED  
* EXPIRED

---

# **29\. Core Business Rules**

## **User Management**

1. User ต้องมี Unique Email  
2. Internal User ต้องมี Role อย่างน้อยหนึ่ง Role  
3. Super Admin คนสุดท้ายห้ามถูกระงับ  
4. User ที่มี Transaction History ห้าม Hard Delete  
5. การ Suspend User ต้องยกเลิก Session ตามนโยบาย  
6. การเปลี่ยน Role ต้องสร้าง Audit Log  
7. Password ต้องจัดการผ่านระบบ Authentication เท่านั้น  
8. Admin ห้ามเห็น Password

## **Role & Permission**

9. Backend ต้องตรวจ Permission  
10. Role ที่มีผู้ใช้งานห้ามลบ  
11. Critical Permission ต้องมี Confirmation  
12. Cost Permission ต้องแยกจาก General Finance View  
13. Override Permission ต้องจำกัดสูงสุด  
14. System Role สำคัญต้องมีผู้ถือสิทธิ์อย่างน้อยหนึ่งราย

## **Configuration**

15. Lookup ที่ใช้งานแล้วห้ามลบ  
16. Lookup Code ที่ใช้ใน Logic ห้ามเปลี่ยนโดยตรง  
17. Document Number ห้ามซ้ำ  
18. Running Number ห้ามย้อนกลับ  
19. Exchange Rate ต้องมี Effective Date  
20. Transaction ต้อง Snapshot Exchange Rate  
21. Company Setting ใหม่ไม่เปลี่ยนเอกสารเดิม

## **Notifications**

22. Template ต้องผูก Event  
23. Variable ต้องผ่าน Validation  
24. การแก้ Template ไม่เปลี่ยน Notification เดิม  
25. Notification Failure ต้องถูก Log

## **Storage and Backup**

26. Confidential Files ต้อง Private  
27. File ที่ถูกใช้งานแล้วห้ามลบโดยไม่ตรวจ Reference  
28. Backup ต้องมี Status และ Verification  
29. Restore ต้องผ่าน Approval  
30. Backup Failure ต้องแจ้งเตือน

## **API and Integration**

31. Secret ห้ามแสดงหลังสร้าง  
32. Secret ห้ามอยู่ใน Log  
33. API Key ต้อง Revoke ได้  
34. Integration ต้อง Test ก่อน Activate  
35. Integration Failure ต้องไม่ทำลาย Transaction หลัก  
36. Retry ต้องไม่สร้างข้อมูลซ้ำ  
37. External Event ต้องมี Idempotency เมื่อจำเป็น

## **Logs**

38. System Log ห้ามแก้  
39. Audit Log และ System Log ต้องแยกกัน  
40. Critical Security Event ต้องบันทึกผู้ใช้และ Session  
41. Log ต้องมี Request ID เพื่อ Trace  
42. Personal Data ต้องไม่ถูกบันทึกเกินความจำเป็น

---

# **30\. Permission Matrix**

| Function | User Admin | Security Admin | System Admin | Integration Admin | Super Admin |
| ----- | ----- | ----- | ----- | ----- | ----- |
| ดูผู้ใช้ | Yes | Yes | Yes | Limited | Yes |
| สร้าง Internal User | Yes | Yes | No | No | Yes |
| Suspend User | Yes | Yes | No | No | Yes |
| จัดการ Role | Limited | Yes | No | No | Yes |
| จัดการ Permission | No | Yes | No | No | Yes |
| จัดการ Notification | No | View | Yes | Limited | Yes |
| จัดการ Lookup | No | No | Yes | No | Yes |
| จัดการ Exchange Rate | No | View | Yes | No | Yes |
| จัดการ Document Number | No | No | Yes | No | Yes |
| จัดการ Company Settings | No | View | Yes | No | Yes |
| ดู Storage | No | View | Yes | Limited | Yes |
| ลบ Orphan File | No | No | Yes | No | Yes |
| เริ่ม Backup | No | View | Yes | No | Yes |
| Request Restore | No | No | Limited | No | Yes |
| จัดการ API Key | No | View | Limited | Yes | Yes |
| จัดการ Integration | No | View | Limited | Yes | Yes |
| ดู System Log | Limited | Yes | Yes | Yes | Yes |
| Override | No | Limited | Limited | Limited | Yes |

---

# **31\. API Scope**

## **Users**

GET  /api/admin/users  
POST /api/admin/users  
GET  /api/admin/users/:id  
PATCH /api/admin/users/:id  
POST /api/admin/users/:id/suspend  
POST /api/admin/users/:id/reactivate  
POST /api/admin/users/:id/unlock  
POST /api/admin/users/:id/force-logout  
POST /api/admin/users/:id/send-reset

## **Roles and Permissions**

GET  /api/admin/roles  
POST /api/admin/roles  
GET  /api/admin/roles/:id  
PATCH /api/admin/roles/:id  
POST /api/admin/roles/:id/deactivate  
GET  /api/admin/permissions  
GET  /api/admin/roles/:id/permissions  
PUT  /api/admin/roles/:id/permissions  
POST /api/admin/users/:id/roles  
DELETE /api/admin/users/:id/roles/:roleId

## **Notification Templates**

GET  /api/admin/notification-templates  
POST /api/admin/notification-templates  
GET  /api/admin/notification-templates/:id  
PATCH /api/admin/notification-templates/:id  
POST /api/admin/notification-templates/:id/test  
POST /api/admin/notification-templates/:id/activate  
POST /api/admin/notification-templates/:id/deactivate

## **Configuration**

GET  /api/admin/lookups  
POST /api/admin/lookups  
PATCH /api/admin/lookups/:id  
POST /api/admin/lookups/:id/deactivate

GET  /api/admin/exchange-rates  
POST /api/admin/exchange-rates  
POST /api/admin/exchange-rates/:id/activate

GET  /api/admin/document-number-settings  
PATCH /api/admin/document-number-settings/:id

GET  /api/admin/company-settings  
PATCH /api/admin/company-settings

## **Storage and Backup**

GET  /api/admin/storage/summary  
GET  /api/admin/storage/files  
POST /api/admin/storage/orphan-scan  
DELETE /api/admin/storage/orphan-files/:id

GET  /api/admin/backups  
POST /api/admin/backups  
GET  /api/admin/backups/:id  
POST /api/admin/backups/:id/verify  
POST /api/admin/backups/:id/request-restore

## **API and Integration**

GET  /api/admin/api-credentials  
POST /api/admin/api-credentials  
POST /api/admin/api-credentials/:id/rotate  
POST /api/admin/api-credentials/:id/revoke

GET  /api/admin/integrations  
POST /api/admin/integrations  
GET  /api/admin/integrations/:id  
PATCH /api/admin/integrations/:id  
POST /api/admin/integrations/:id/test  
POST /api/admin/integrations/:id/activate  
POST /api/admin/integrations/:id/deactivate  
POST /api/admin/integrations/:id/retry

## **Logs**

GET /api/admin/system-logs  
GET /api/admin/system-logs/:id  
GET /api/admin/security-logs  
GET /api/admin/integration-logs

---

# **32\. MVP Must Have**

* System Administration Dashboard  
* User Listing  
* Create Internal User  
* User Status  
* Force Logout  
* Role Management  
* Permission Matrix  
* Role Assignment  
* Notification Template  
* Lookup Tables  
* Exchange Rate  
* Document Number  
* Company Settings  
* Storage Summary  
* Private File Rules  
* Backup Status  
* Manual Backup  
* System Log  
* Security Log  
* Audit Log สำหรับการตั้งค่าระบบ

---

# **33\. ไม่อยู่ใน MVP**

* Single Sign-On  
* Social Login  
* SCIM Provisioning  
* Advanced Identity Provider  
* Hardware Security Key  
* Dynamic Workflow Builder  
* Multi-company Configuration เต็มรูปแบบ  
* Multi-tenant Custom Settings  
* Automatic Currency API  
* Automatic Backup Restore  
* Disaster Recovery หลาย Region  
* API Marketplace  
* Developer Portal  
* Public API Subscription  
* Advanced Webhook Designer  
* Centralized Log Data Warehouse  
* SIEM Integration  
* Full Storage Lifecycle Automation  
* Custom Notification Builder แบบ Drag-and-drop  
* Scheduled Integration Builder  
* No-code Automation

---

# **34\. Acceptance Criteria**

Part D ถือว่าสมบูรณ์เมื่อ

1. Admin ดูรายชื่อผู้ใช้ได้  
2. Admin สร้าง Internal User ได้  
3. Email ผู้ใช้ไม่ซ้ำ  
4. ผู้ใช้ได้รับคำเชิญให้ตั้ง Password ได้  
5. Admin Suspend และ Reactivate User ได้  
6. Admin Force Logout User ได้  
7. Super Admin คนสุดท้ายไม่ถูก Suspend ได้  
8. User ที่มี Transaction History ไม่ถูก Hard Delete  
9. Admin สร้างและแก้ Role ได้  
10. Role ที่มีผู้ใช้ไม่ถูกลบถาวร  
11. Permission Matrix กำหนดสิทธิ์ตาม Module และ Action ได้  
12. Backend ตรวจ Permission ได้  
13. Critical Permission Change มี Confirmation และ Audit  
14. Notification Template ผูก Event ได้  
15. Notification Template ใช้ Variable ที่รองรับได้  
16. Admin Preview และ Test Template ได้  
17. Lookup Table เพิ่ม แก้ และ Deactivate ได้  
18. Lookup ที่ถูกใช้งานแล้วไม่ถูกลบ  
19. Exchange Rate มี Version และ Effective Date ได้  
20. Exchange Rate เดิมที่ใช้กับ Transaction ไม่เปลี่ยน  
21. Document Number สร้างเลขไม่ซ้ำใน Concurrent Request ได้  
22. เอกสารที่ยกเลิกไม่คืนเลข  
23. Company Settings ใช้กับเอกสารใหม่ได้  
24. Payment Default ใน MVP คงเป็น 50/50  
25. Storage Summary แสดงการใช้พื้นที่ได้  
26. Confidential File เป็น Private ได้  
27. ระบบตรวจ Orphan File ได้  
28. File ที่มี Reference ไม่ถูกลบโดยตรง  
29. Admin เริ่ม Backup และดู Status ได้  
30. Backup Failure แจ้งเตือนได้  
31. Restore ต้องผ่าน Request และ Approval  

เกณฑ์ข้อ 32–38 ต่อไปนี้เป็น Post-MVP Acceptance Reference สำหรับ Generic API/Integration UI:

32. API Secret แสดงเต็มเฉพาะตอนสร้าง  
33. API Secret ไม่ปรากฏใน Log  
34. API Key Rotate และ Revoke ได้  
35. Integration Test Connection ได้  
36. Integration Activate หลัง Test สำเร็จได้  
37. Integration Error ถูกบันทึกและ Retry ได้  
38. Retry ไม่สร้างข้อมูลซ้ำ  
39. System Log Filter ตาม Level และ Module ได้  
40. System Log แก้ไขหรือลบผ่าน UI ไม่ได้  
41. Password, Token และ Secret ไม่อยู่ใน Log  
42. การเปลี่ยน User, Role, Permission และ Configuration มี Audit Log  
43. หน้าสำคัญใช้งานบน Tablet ได้  
44. ทุกหน้าหลักมี Loading, Empty และ Error State ขั้นพื้นฐาน  
45. ผู้ไม่มี Permission ไม่สามารถเรียก API โดยตรงได้

---

# **35\. Codex Development Scope**

แบ่งเป็น 4 Workstreams

## **Workstream D1: User and Access**

* User Management  
* User Status  
* Session Management  
* Role  
* Permission Matrix  
* Role Assignment

## **Workstream D2: System Configuration**

* Notification Template  
* Lookup Tables  
* Exchange Rate  
* Document Number  
* Company Settings

## **Workstream D3: Infrastructure Control (Core เฉพาะ Storage และ Backup ขั้นต่ำ)**

* Storage  
* Orphan File Check  
* Backup  
* Restore Request  
* System Health Summary

## **Workstream D4: Logs (Core) และ Integration (Post-MVP Reference)**

* System Log  
* Security Log  
* Notification Delivery/Retry Log

Post-MVP Reference:

* API Credentials UI  
* Integration Configuration/Test Connection  
* Generic Integration Log UI

Codex ต้องพัฒนาเฉพาะ Core MVP ใน Reconciled Scope ส่วน Integration และ Infrastructure UI ขั้นสูงเป็น Post-MVP
