# **GLOBAL INTERIOR SUPPLY PLATFORM**

## **GISP DEVELOPMENT MASTER BLUEPRINT**

### **เอกสารควบคุมการพัฒนา MVP ฉบับสุดท้ายสำหรับส่งให้ Codex**

**Document Version:** 1.3  
**Reconciled Date:** 1 สิงหาคม 2569 (2026-08-01)  
**Authority:** Development Control Document ซึ่งอยู่ใต้ `MVP BUSINESS MASTER PLAN.md` และ `DECISION LOG.md`  
**Change Summary:** ปรับ Demo Gate, Core Scope, Canonical State, Document Number และ Production Role ตาม DEC-030 ถึง DEC-036  
 **Status:** Reconciled Development Control Document (ไม่ใช่ Business Source of Truth)  
 **Primary Purpose:** ใช้เป็นเอกสารนำทางและควบคุมการพัฒนา GISP  
 **Development Approach:** Modular Monolith  
 **Primary Platform:** Responsive Web Application  
 **Primary Language:** ภาษาไทย  
 **Initial Market:** ประเทศไทย  
 **Initial Supplier Country:** ประเทศจีน

---

# **1\. สถานะของเอกสารฉบับนี้**

เอกสารนี้เป็น **เอกสารควบคุมโครงการฉบับสุดท้ายก่อนเริ่มพัฒนา MVP**

มีหน้าที่

* รวบรวมสิ่งที่ได้ข้อสรุปแล้ว  
* ระบุเอกสารต้นทางของแต่ละเรื่อง  
* กำหนดขอบเขต MVP  
* กำหนดลำดับการพัฒนา  
* ป้องกันการเพิ่มฟังก์ชันโดยไม่จำเป็น  
* ช่วยให้ Codex อ่านเอกสารตามลำดับที่ถูกต้อง  
* ใช้เป็นเกณฑ์ตรวจรับระบบ

เอกสารนี้ไม่แทนที่รายละเอียดในเอกสารเดิม แต่เป็น **Master Index และ Development Control Document**

หลังจากอนุมัติเอกสารนี้แล้ว

ห้ามเพิ่ม Volume, Module, Feature หรือ Workflow ใหม่ใน MVP เว้นแต่เป็นการแก้ข้อผิดพลาดที่ทำให้ Workflow หลักไม่สามารถทำงานได้

---

# **2\. ชื่อและเป้าหมายของระบบ**

ชื่อระบบอย่างเป็นทางการ

**Global Interior Supply Platform — GISP**

GISP เป็นแพลตฟอร์มสำหรับเชื่อมกระบวนการจัดหาและสั่งซื้อสินค้าตกแต่งภายในจากโรงงานและซัพพลายเออร์ประเทศจีนเข้าสู่ประเทศไทย

กลุ่มผู้ใช้งานหลักใน MVP

* สมาชิกที่ผ่านการอนุมัติ  
* นักออกแบบ  
* ผู้รับเหมาตกแต่ง  
* เจ้าของโชว์รูม  
* ตัวแทนจำหน่าย  
* ผู้ประกอบการ  
* ทีม Product และ Catalog  
* ทีมจัดซื้อ  
* ทีมการเงิน  
* ทีมตรวจสินค้า  
* ทีมโลจิสติกส์  
* ผู้ดูแลระบบ

โรงงานและ Supplier **ไม่มีบัญชีเข้าใช้งานใน MVP**

ทีม GISP เป็นผู้ติดต่อและอัปเดตข้อมูลแทนโรงงานทั้งหมด

---

# **3\. Business Model หลัก**

โครงสร้างธุรกิจ

Factory / Supplier  
        ↓  
   GISP Company  
        ↓  
Member / Dealer  
        ↓  
  End Customer

GISP ไม่ใช่ Public Marketplace ใน MVP

บริษัท GISP เป็นผู้ควบคุม

* Product Catalog  
* Factory Cost  
* Member Price  
* การรับออเดอร์  
* การชำระเงิน  
* การออก Purchase Order  
* การติดตามการผลิต  
* QC  
* การรวมสินค้า  
* การขนส่ง  
* การส่งมอบ  
* การเคลม

สมาชิกเห็นเฉพาะ

* ข้อมูลสินค้าที่อนุญาต  
* Member Price  
* สถานะของ Project และ Order  
* เอกสารที่อนุญาต  
* QC ที่เกี่ยวข้อง  
* Shipment และ Delivery  
* Claim ของตนเอง

สมาชิกห้ามเห็น

* Factory Cost  
* Margin ภายใน  
* Supplier Payment  
* Internal Purchase Note  
* ข้อมูลลับของโรงงาน  
* ข้อมูลสมาชิกหรือ Project ของผู้อื่น

---

# **4\. Workflow หลักของระบบ**

สมัครสมาชิก  
→ Admin อนุมัติ  
→ สร้างลูกค้าปลายทาง  
→ สร้าง Project  
→ เลือกสินค้า  
→ เลือก Variant และ Option  
→ เพิ่มสินค้าแยกตามห้อง  
→ จัดรายการเป็น Ready to Order  
→ สร้าง Customer Order  
→ ระบบแยก Supplier Orders  
→ ชำระเงินมัดจำ  
→ Finance ยืนยัน  
→ ออก Purchase Order  
→ โรงงานยืนยัน  
→ ผลิตสินค้า  
→ QC  
→ สมาชิกอนุมัติสินค้า Custom  
→ ชำระยอดคงเหลือ  
→ รับสินค้าเข้าโกดังจีน  
→ รวมสินค้า  
→ ขนส่งเข้าประเทศไทย  
→ ผ่านพิธีการนำเข้า  
→ นัดส่ง  
→ ส่งมอบ  
→ เรียกเก็บค่าขนส่ง  
→ ปิดออเดอร์  
→ เคลมหากมีปัญหา  
---

# **5\. เอกสารต้นทางของโครงการ**

รายการต่อไปนี้อธิบายหน้าที่ของเอกสารแต่ละฉบับ ไม่ใช่ลำดับ Source of Truth
ลำดับอำนาจที่ใช้ตัดสินข้อขัดแย้งอยู่ในหัวข้อ 6 เท่านั้น

## **Development Control: GISP Development Master Blueprint**

เอกสารฉบับนี้

ใช้กำหนด

* ขอบเขต  
* ลำดับความสำคัญ  
* เอกสารอ้างอิง  
* สิ่งที่ห้ามเพิ่ม  
* วิธีพัฒนา  
* เกณฑ์ตรวจรับ

หากเอกสารรายละเอียดมี Feature เกิน Approved Core MVP ให้ใช้ Business Master Plan,
Decision Log และ MVP Implementation Plan ตามลำดับ ห้ามใช้ Blueprint Override เอกสารอำนาจสูงกว่า

---

## **ลำดับที่ 2: GISP MVP Business Master Plan**

ใช้กำหนด

* เป้าหมายธุรกิจ  
* กลุ่มผู้ใช้งาน  
* Business Model  
* Customer Journey  
* รายได้  
* KPI  
* ขอบเขต MVP

---

## **ลำดับที่ 3: GISP Database Schema Specification**

ใช้กำหนด

* Table  
* Relationship  
* Primary Key  
* Foreign Key  
* Data Ownership  
* Multi-company Readiness  
* Multi-currency Readiness  
* Audit Structure

Codex ห้ามสร้าง Table ซ้ำที่มีหน้าที่เหมือนกันโดยไม่จำเป็น

---

## **ลำดับที่ 4: GISP UX/UI Flow Specification Volume 1**

ครอบคลุม

* Foundation  
* Authentication  
* Account Recovery และ Session Management  
* Member  
* Catalog ฝั่งสมาชิก  
* End Customer  
* Project  
* Project Area  
* Project Item  
* Product Schedule  
* Custom Request

---

## **ลำดับที่ 5: GISP UX/UI Flow Specification Volume 2**

ครอบคลุม

* Customer Order  
* Payment  
* Supplier Order  
* Purchase Order  
* Production  
* QC  
* Warehouse  
* Consolidation  
* Shipment  
* Delivery  
* Freight  
* Claim  
* Cancellation

---

## **ลำดับที่ 6: GISP UX/UI Flow Specification Volume 3 Part A**

ครอบคลุม

* Supplier Management  
* Category  
* Collection  
* Product  
* Variant  
* Option  
* Media  
* Documents  
* Factory Cost  
* Member Price  
* Price Version  
* Product Publish  
* Product Import  
* Catalog QA

รายละเอียดระดับหน้าจอหรือฟังก์ชันที่เกินความจำเป็นสำหรับ MVP ให้จัดเป็นภายหลัง

---

## **ลำดับที่ 7: GISP UX/UI Flow Specification Volume 3 Part B**

ครอบคลุมศูนย์ปฏิบัติการหลังบ้าน เช่น

* Customer Order Control  
* Supplier Order Control  
* Production Control  
* QC Control  
* Warehouse  
* Consolidation  
* Shipment  
* Delivery  
* Claim  
* Task Assignment  
* Internal Timeline

ให้พัฒนาเฉพาะส่วนที่จำเป็นต่อ Workflow ใน Volume 2

---

## **ลำดับที่ 8: GISP Codex Development Specification**

ใช้กำหนด

* Technology Stack  
* Project Structure  
* Module Structure  
* Coding Standard  
* Authentication  
* Authorization  
* API Pattern  
* Error Handling  
* Testing  
* Deployment  
* Definition of Done

---

# **6\. Source of Truth**

เมื่อข้อมูลซ้ำหรือไม่ตรงกัน ให้ใช้ลำดับตัดสินดังนี้

1. `MVP BUSINESS MASTER PLAN.md` โดยเฉพาะ Approved Decisions
2. `DECISION LOG.md`
3. `MVP IMPLEMENTATION PLAN.md`
4. `CODEX DEVELOPMENT.md` และ Blueprint ฉบับนี้
5. `DATABASE SCHEMA.md`
6. UX/UI Volume 1, Volume 2 และ Volume 3-A ถึง 3-D

Blueprint ฉบับนี้เป็น Development Control Document ไม่ใช่ Business Source of Truth มีหน้าที่ควบคุมลำดับงานและ Definition of Done เท่านั้น

## **ความขัดแย้ง**

Codex ห้ามเดาเอง

ให้สร้างรายการ

DECISION\_REQUIRED

พร้อมระบุ

* เอกสารที่ขัดกัน  
* ประเด็นที่ขัดกัน  
* ผลกระทบ  
* ทางเลือกที่ง่ายที่สุดสำหรับ MVP

---

# **7\. ขอบเขต MVP ขั้นสุดท้าย**

ระบบ MVP แบ่งเป็น 8 Module หลักเท่านั้น

---

## **Module 1: Authentication and Member**

ต้องมี

* สมัครสมาชิก  
* Login  
* Forgot Password  
* Pending Approval  
* Admin Approve/Reject  
* Member Profile  
* Member Status  
* Role และ Permission ขั้นพื้นฐาน

ระดับสมาชิกใน MVP ใช้เท่าที่จำเป็น

* Pending  
* Active Member  
* Suspended  
* Admin

ระดับ Student, Dealer, Professional หรือ Partner สามารถเก็บเป็น Member Type แต่ไม่ต้องสร้าง Workflow พิเศษทั้งหมดใน MVP

---

## **Module 2: Supplier and Product Catalog**

ต้องมี

* Supplier  
* Category  
* Collection  
* Product Master  
* Product Variant  
* Product Option  
* Product Media  
* Product Documents  
* Factory Cost  
* Member Price  
* Product Status  
* Product Publish  
* Excel/CSV Import ขั้นพื้นฐาน

AI PDF Catalog Import ให้ถือเป็น

**Should Have หลัง Core MVP ทำงานแล้ว**

ห้ามให้ AI Import ทำให้การเปิดระบบล่าช้า

Catalog MVP สามารถเริ่มจากการ Import Excel/CSV และกรอกข้อมูลด้วย Admin

---

## **Module 3: Customer, Project and Custom Quotation**

ต้องมี

* End Customer  
* Project  
* Project Address  
* Project Area/Room  
* Project Item  
* Quantity  
* Variant  
* Option  
* Remark  
* Item Status  
* Product Schedule PDF/Excel  
* Custom Request พร้อม Assignment/Due Date/Supplier Candidate  
* Custom Quotation แบบ Version  
* Accept/Reject และ Accepted Snapshot

Project หนึ่งรายการ

* มี End Customer หนึ่งราย  
* มี Main Delivery Address หนึ่งแห่ง  
* มีหลายห้อง  
* มีหลาย Project Items  
* สามารถทยอยเปิด Order ได้หลายครั้ง

---

## **Module 4: Customer Order and Supplier Order**

ต้องมี

* เลือกเฉพาะรายการ Ready to Order  
* สั่งบางส่วนของ Quantity ได้  
* สร้าง Customer Order  
* Snapshot ราคาและสเปก  
* แยก Supplier Order อัตโนมัติ  
* Order Detail  
* Order Status  
* Order Timeline  
* Order Documents  
* Cancellation Request

Customer Order หนึ่งรายการสามารถมีหลาย Supplier Orders

สมาชิกติดตาม Customer Order เป็นหลัก

---

## **Module 5: Payment and Purchase Order**

ต้องมี

### **Customer Payment**

* Deposit 50%  
* Balance 50%  
* Freight Payment แยก  
* Invoice  
* Upload Slip  
* Verify/Reject  
* Payment History

### **Supplier Payment**

* Factory Deposit 50%  
* Factory Balance 50%  
* บันทึกโดย Admin/Finance  
* ไม่แสดงต่อสมาชิก

### **Purchase Order**

* สร้าง PO จาก Supplier Order  
* ออก PO หลัง Customer Deposit Verified  
* เก็บ PDF  
* บันทึก Factory Confirmation

---

## **Module 6: Production and QC**

ต้องมี

* Production Status  
* Estimated Completion Date  
* Production Update  
* รูปภาพและวิดีโอ  
* Delay Note  
* QC Inspection  
* QC Checklist  
* QC Result  
* Rework  
* Reinspection

สินค้า Standard

* ทีม GISP ตรวจและอัปเดตผล

สินค้า Custom

* สมาชิกต้องอนุมัติ QC ก่อนดำเนินการจัดส่ง

---

## **Module 7: Logistics and Delivery**

ต้องมี

* China Warehouse Receipt  
* Received Quantity  
* Actual Weight  
* Actual CBM  
* Consolidation  
* Shipment  
* Partial Shipment  
* Tracking  
* ETD  
* ETA  
* Import Status  
* Thailand Warehouse  
* Delivery Appointment  
* Proof of Delivery  
* Partial Delivery  
* Delivered with Issue  
* Freight Invoice

ระบบไม่จำเป็นต้องเชื่อม Logistics API ใน MVP

ทีมงานสามารถกรอกสถานะด้วยตนเองได้

---

## **Module 8: Claim and Basic Dashboard**

ต้องมี

### **Claim**

* เลือก Order Item  
* ประเภทปัญหา  
* จำนวนที่ได้รับผลกระทบ  
* รูปภาพและวิดีโอ  
* Claim Status  
* Resolution  
* Timeline  
* Member Confirmation

### **Dashboard**

Member Dashboard

* Project  
* Order  
* Payment Due  
* Production  
* QC Approval  
* Shipment  
* Delivery  
* Claim

Admin Dashboard

* Pending Members  
* Orders  
* Payments Waiting Verification  
* Production Delays  
* QC Issues  
* Shipments  
* Deliveries  
* Claims

ไม่ต้องทำ Executive BI เต็มรูปแบบใน MVP

---

# **8\. ฟังก์ชันที่ไม่อยู่ใน Core MVP**

รายการต่อไปนี้ห้ามนำมาทำก่อน Core Workflow ทำงานครบ

* Factory Portal  
* Public Marketplace  
* Customer Portal  
* Payment Gateway  
* Automatic Bank Reconciliation  
* Accounting API  
* Logistics API  
* Live Ship Tracking  
* AI Product Recommendation  
* AI QC  
* Full AI PDF Import  
* Product Comparison ขั้นสูง  
* Favorite ขั้นสูง  
* Commission ทุกประเภท  
* Dealer Credit  
* Credit Limit  
* Multi-company Team Management  
* Multi-country Selling  
* Dynamic Pricing  
* Full Warehouse Management  
* Route Optimization  
* Installation Team Application  
* Native Mobile Application  
* Chat ภายในระบบ  
* Workflow Builder  
* BI Dashboard ขั้นสูง  
* White-label Platform  
* Supplier Self-service  
* Automation ที่ไม่จำเป็นต่อการเปิดออเดอร์แรก

ห้ามสร้าง Database Table, API, UI หรือ Workflow ของรายการเหล่านี้ใน Core MVP เว้นแต่เพิ่มผ่าน Decision Log ฉบับใหม่ที่ได้รับอนุมัติ

---

# **9\. กฎธุรกิจหลักที่ห้ามเปลี่ยน**

## **Member**

1. Pending Member ไม่เห็น Member Price  
2. Suspended Member สร้าง Project หรือ Order ใหม่ไม่ได้  
3. Member เห็นเฉพาะข้อมูลของตนเอง

## **Product**

4. Product ใหม่เริ่มเป็น Draft  
5. Product ต้องมี Supplier  
6. Product ต้องมี Active Member Price ก่อน Order  
7. Factory Cost ห้ามส่งผ่าน Member API  
8. Product ที่มีประวัติ Order ห้ามลบ  
9. Product, Variant และ Option ต้องแยกกัน  
10. สินค้าที่ Import ต้องผ่าน Admin Review

## **Project**

11. Project หนึ่งรายการมี End Customer หนึ่งราย  
12. Project หนึ่งรายการมี Main Delivery Address หนึ่งแห่งใน MVP  
13. Project สามารถมีหลาย Order  
14. สมาชิกไม่จำเป็นต้องสั่งทั้ง Project พร้อมกัน  
15. Project Item ต้องเลือก Option จำเป็นครบก่อน Ready to Order

## **Order**

16. Order สร้างจาก Project Items ที่ Ready to Order  
17. Order Quantity ห้ามเกิน Remaining Quantity  
18. Order ต้อง Snapshot ราคาและสเปก  
19. Customer Order แยกเป็น Supplier Orders ตาม Supplier  
20. Order เดิมไม่เปลี่ยนเมื่อ Product Master หรือราคาถูกแก้ภายหลัง

## **Payment**

21. Customer Deposit เท่ากับ 50%  
22. Customer Balance เท่ากับ 50%  
23. Freight เรียกเก็บแยก  
24. ห้ามออก PO ก่อน Customer Deposit Verified  
25. การอัปโหลดสลิปไม่เท่ากับการยืนยันเงิน  
26. Finance เท่านั้นที่ Verify หรือ Reject Payment ได้

## **Supplier Order**

27. Supplier Deposit เท่ากับ 50%  
28. Supplier Balance เท่ากับ 50%  
29. Supplier Payment เป็นข้อมูลภายใน  
30. Factory ไม่มี Login ใน MVP

## **Production และ QC**

31. ทุก Production Update ต้องมีวันที่และผู้บันทึก  
32. QC ต้องเชื่อมกับ Supplier Order หรือ Order Item  
33. Custom Product ต้อง Member Approve ก่อน Shipping  
34. Rework ต้องมีเหตุผลและตรวจซ้ำ

## **Logistics**

35. Shipment Quantity ห้ามเกินสินค้าที่พร้อมส่ง  
36. รองรับ Partial Shipment  
37. Shipment หนึ่งรายการรวมสินค้าหลาย Supplier Orders ของ Customer Order เดียวกันได้  
38. MVP ไม่รวมการรวมสินค้าหลาย Customer Orders ใน Shipment เดียว  
39. Delivery ต้องมี Proof of Delivery  
40. Order ยังไม่ Completed หากส่งไม่ครบหรือมี Payment ค้าง

## **Claim**

41. Claim ต้องเชื่อมกับ Delivered Order Item  
42. Claim ต้องมีประเภทปัญหาและหลักฐาน  
43. Claim ห้ามเปลี่ยนประวัติ Delivery เดิม  
44. Claim `REJECTED` ต้องมี Rejection Reason; Claim `CLOSED` ต้องมี Resolution และการยืนยันผล

## **Audit**

45. การเปลี่ยนสถานะสำคัญต้องมี Audit Log  
46. การเปลี่ยนราคา การอนุมัติ และการยกเลิกต้องเก็บผู้ดำเนินการ  
47. ห้าม Hard Delete ข้อมูลธุรกรรมหลัก

---

# **10\. State Machine ที่ต้องมี**

Codex ต้องกำหนด Enum และ Transition Guard สำหรับ Entity ต่อไปนี้

## **Member**

PENDING  
→ ACTIVE  
→ SUSPENDED  
→ ACTIVE

PENDING  
→ REJECTED

## **Product**

DRAFT  
→ WAITING\_REVIEW  
→ ACTIVE  
→ SUSPENDED  
→ ACTIVE

ACTIVE  
→ DISCONTINUED  
→ ARCHIVED

## **Project**

DRAFT  
→ ACTIVE  
→ COMPLETED  
→ ARCHIVED

DRAFT / ACTIVE  
→ CANCELLED

## **Project Item**

DRAFT  
→ WAITING\_CLIENT\_APPROVAL  
→ READY\_TO\_ORDER  
→ PARTIALLY\_ORDERED  
→ ORDERED

DRAFT / WAITING\_CLIENT\_APPROVAL / READY\_TO\_ORDER  
→ CANCELLED

## **Custom Request**

DRAFT  
→ SUBMITTED  
→ UNDER\_REVIEW  
→ READY\_FOR\_QUOTE  
→ CONVERTED

UNDER\_REVIEW  
→ NEED\_INFO  
→ SUBMITTED

DRAFT / SUBMITTED / UNDER\_REVIEW / NEED\_INFO / READY\_FOR\_QUOTE  
→ CANCELLED

`QUOTED`, `MEMBER_CONFIRMED` และสถานะตอบรับราคาอยู่ใน Custom Quotation แยกต่างหาก

## **Custom Quotation**

DRAFT  
→ SENT  
→ ACCEPTED / REJECTED / EXPIRED / CANCELLED

การสร้าง Revision ใหม่ทำให้ Version เดิมเป็น `SUPERSEDED`

## **Customer Order**

PENDING\_DEPOSIT  
→ DEPOSIT\_SUBMITTED  
→ DEPOSIT\_VERIFIED  
→ PROCESSING  
→ IN\_PRODUCTION  
→ QC  
→ BALANCE\_DUE  
→ BALANCE\_VERIFIED  
→ LOGISTICS  
→ DELIVERY  
→ FREIGHT\_DUE  
→ COMPLETED

สถานะพิเศษ

* ON\_HOLD  
* CANCELLATION\_REQUESTED  
* CANCELLED

## **Customer Payment**

PENDING  
→ SUBMITTED  
→ VERIFIED

SUBMITTED  
→ REJECTED  
→ SUBMITTED

## **Supplier Order**

PENDING\_PO  
→ PO\_ISSUED  
→ FACTORY\_CONFIRMED  
→ IN\_PRODUCTION  
→ AWAITING\_QC  
→ QC\_PASSED  
→ READY\_FOR\_DISPATCH  
→ DELIVERED\_TO\_WAREHOUSE  
→ COMPLETED

## **Production**

NOT\_STARTED  
→ MATERIAL\_PREPARATION  
→ IN\_PRODUCTION  
→ PARTIALLY\_COMPLETED  
→ COMPLETED  
→ AWAITING\_QC

สถานะพิเศษ

* DELAYED  
* ON\_HOLD  
* REWORK

## **QC**

PENDING  
→ IN\_PROGRESS  
→ PASSED

หรือ

IN\_PROGRESS  
→ REWORK\_REQUIRED  
→ REINSPECTION  
→ PASSED

สินค้า Custom

PASSED  
→ AWAITING\_MEMBER\_APPROVAL  
→ MEMBER\_APPROVED

## **Shipment**

PLANNING  
→ CONSOLIDATING  
→ READY\_TO\_SHIP  
→ DEPARTED\_CHINA  
→ IN\_TRANSIT  
→ ARRIVED\_THAILAND  
→ CUSTOMS\_CLEARANCE  
→ CLEARED  
→ THAILAND\_WAREHOUSE  
→ READY\_FOR\_DELIVERY  
→ COMPLETED

## **Delivery**

PROPOSED  
→ CONFIRMED  
→ OUT\_FOR\_DELIVERY  
→ DELIVERED

สถานะพิเศษ

* PARTIALLY\_DELIVERED  
* DELIVERED\_WITH\_ISSUE  
* FAILED  
* RESCHEDULE\_REQUIRED

## **Claim**

SUBMITTED  
→ UNDER\_REVIEW  
→ COORDINATING  
→ RESOLUTION\_PROPOSED  
→ IN\_PROGRESS  
→ RESOLVED  
→ CLOSED

สถานะพิเศษ

* WAITING\_INFORMATION  
* REJECTED

Codex ห้ามให้ Frontend เปลี่ยนสถานะโดยตรงโดยไม่มี Backend Validation

---

# **11\. Database Development Rules**

1. ใช้ PostgreSQL  
2. ใช้ UUID เป็น Primary Key  
3. ทุกตารางธุรกรรมต้องมี `created_at` และ `updated_at`  
4. ตารางสำคัญควรมี `created_by` และ `updated_by`  
5. ใช้ Foreign Key จริง  
6. ใช้ Soft Delete หรือ Status แทน Hard Delete สำหรับข้อมูลสำคัญ  
7. เก็บ Snapshot ใน Order Items และ Supplier Order Items  
8. แยก Factory Cost และ Member Price  
9. แยก Customer Payment และ Supplier Payment  
10. รองรับหลาย Currency ตั้งแต่ Database  
11. ใช้ THB เป็นสกุลเงินหลักสำหรับ Member ใน MVP  
12. รองรับ CNY สำหรับ Factory Cost  
13. Exchange Rate ที่ใช้กับธุรกรรมต้องถูก Snapshot  
14. File เก็บใน Storage และ Database เก็บ Metadata  
15. ใช้ Audit Log กับเหตุการณ์สำคัญ  
16. ใช้ Row-Level Security หรือ Authorization Filter ป้องกันข้อมูลข้าม Member  
17. ไม่สร้างตารางใหม่หาก Table เดิมรองรับได้  
18. Migration ทุกชุดต้องย้อนกลับหรือแก้ไขได้อย่างปลอดภัย  
19. Seed Data ต้องมี Role, Permission, Status และ Lookup ที่จำเป็น  
20. ห้ามใช้ข้อมูลจริงของลูกค้าใน Seed หรือ Test  
21. Atomic Document Number ใช้ `QT`, `ORD`, `SO`, `PO`, `INV`, `PAY`, `SHP`, `DLV`, `CLM`  
22. `PRJ`, `CRQ`, `QCI`, `WRC`, `CNS` เป็น Unique Record Reference และห้ามใช้เลขซ้ำ

---

# **12\. Technology Stack**

ใช้ Stack ตาม Codex Development Specification

## **Frontend**

* Next.js  
* TypeScript  
* Responsive Web  
* Server Components และ Client Components ตามความเหมาะสม

## **Backend**

* Next.js Route Handlers, Server Actions และ Service Layer  
* InsForge PostgreSQL  
* InsForge Email + Password Auth ผ่าน SSR helpers  
* InsForge Storage พร้อม RLS และ Signed URL  
* InsForge Email สำหรับ Transactional Notification  
* InsForge Migration และ Backup

Frontend Deploy ผ่าน InsForge Frontend Deployments โดย Browser ใช้เฉพาะ Public URL/Anon Key และ API Key ต้องเป็น Server-only การตั้งค่า Domain, Environment และ Deployment Status ให้บริหารผ่าน InsForge

## **Architecture**

**Modular Monolith**

ห้ามแยก Microservices ใน MVP

Module ควรแยกตาม Domain

auth  
members  
suppliers  
catalog  
customers  
projects  
orders  
payments  
supplier-orders  
production  
qc  
warehouse  
shipments  
deliveries  
claims  
documents  
notifications  
audit  
---

# **13\. API Development Rules**

1. API ใช้ Resource-based Routes  
2. Validation ต้องอยู่ Backend  
3. Permission ต้องตรวจ Backend  
4. Response ใช้รูปแบบมาตรฐาน  
5. Error Code ต้องอ่านและตรวจสอบได้  
6. Endpoint ที่สร้างธุรกรรมต้องรองรับ Idempotency เมื่อจำเป็น  
7. Create Order ต้องใช้ Database Transaction  
8. Payment Verification ต้องใช้ Transaction  
9. Shipment และ Delivery Quantity Update ต้องใช้ Transaction  
10. Member API ห้าม Select Factory Cost  
11. List API ต้องรองรับ Pagination  
12. List API หลักต้องรองรับ Search และ Filter  
13. File Upload ต้องตรวจ File Type และ Size  
14. State Transition ใช้ Action Endpoint ไม่ใช้การ Patch สถานะอย่างอิสระ  
15. API ต้องไม่เชื่อถือข้อมูลราคาจาก Frontend  
16. Order Total ต้องคำนวณใหม่ที่ Backend  
17. Permission Error ใช้รหัสที่ชัดเจน  
18. Validation Error ต้องระบุ Field  
19. Audit ถูกสร้างจาก Backend  
20. API Contract ขั้นสุดท้ายให้สร้างจาก Database และ Rules ใน Blueprint นี้ โดยไม่เพิ่ม Feature ใหม่

---

# **14\. Permission ขั้นต่ำสำหรับ MVP**

Production Role Catalog ใช้ `MEMBER`, `MEMBER_ADMIN`, `PRODUCT_ADMIN`, `ORDER_ADMIN`,
`PURCHASING`, `FINANCE`, `QC`, `LOGISTICS`, `EXECUTIVE_VIEWER`, `SUPER_ADMIN` เท่านั้น
ใน Baseline นี้ ส่วน `GISP Admin` เป็นชื่อรวม Role เพื่อใช้ใน Demo ไม่ใช่ Role จริงของ Production

## **Member**

* ดูและแก้ข้อมูลตนเอง  
* จัดการลูกค้าของตนเอง  
* จัดการ Project ของตนเอง  
* ดู Catalog และ Member Price  
* สร้าง Order ของตนเอง  
* อัปโหลด Payment Slip  
* ดู Production, QC, Shipment และ Delivery ของตนเอง  
* อนุมัติ Custom QC ของตนเอง  
* สร้าง Claim ของตนเอง

## **Member Admin**

* อนุมัติและระงับสมาชิก  
* ดูข้อมูลสมาชิกตามสิทธิ์

## **Product Admin**

* Supplier  
* Category  
* Product  
* Variant  
* Option  
* Media  
* Documents  
* Member Price  
* Publish

## **Purchasing**

* Supplier  
* Factory Cost  
* Purchase Order  
* Supplier Confirmation  
* Production Coordination

## **Finance**

* Verify Customer Payment  
* Reject Payment  
* Record Supplier Payment  
* Issue Invoice  
* Record Freight Charge

## **QC Team**

* Create Inspection  
* Update Checklist  
* Upload Evidence  
* Pass/Rework/Reinspect

## **Logistics**

* Warehouse Receipt  
* Consolidation  
* Shipment  
* Delivery  
* Proof of Delivery

## **Super Admin**

* เข้าถึงทุก Module  
* Override ต้องระบุเหตุผล  
* ห้ามใช้ Super Admin สำหรับงานประจำโดยไม่จำเป็น

## **Executive Viewer**

* ดู Executive Summary และ Fixed Reports ขั้นพื้นฐานแบบ Read-only  
* ไม่เห็น Confidential File และไม่แก้ Transaction

---

# **15\. ลำดับการพัฒนา MVP**

## **Phase 0: Project Foundation**

เป้าหมาย

สร้างโครงระบบที่พร้อมต่อยอด

งาน

* Repository  
* Environment  
* Database Connection  
* Authentication  
* Account Recovery และ Session Management  
* Application Shell  
* Role และ Permission  
* Storage  
* Audit Foundation  
* Company Settings/Document Number ขั้นต่ำ  
* Backup และ Security/Notification Log ขั้นต่ำ  
* Error Handling  
* Seed Data  
* CI/CD

ผลลัพธ์

ผู้ใช้ Login ได้ และระบบรู้ว่าใครมี Role ใด

---

## **Phase 1: Member, Supplier and Catalog**

งาน

* Member Registration  
* Member Approval/Suspension  
* Supplier  
* Category  
* Product  
* Variant  
* Option  
* Media  
* Member Price  
* Product Publish  
* Member Catalog  
* Excel/CSV Import ขั้นพื้นฐาน

ผลลัพธ์

Admin เพิ่มสินค้าและสมาชิกเห็นสินค้าที่ Publish พร้อม Member Price ได้

---

## **Phase 2: Customer, Project and Custom Quotation**

งาน

* End Customer  
* Project  
* Address  
* Area  
* Project Item  
* Add Product to Project  
* Item Status  
* Product Schedule  
* Custom Request  
* Custom Quotation Version/Accept/Reject

ผลลัพธ์

สมาชิกสร้าง Project และจัดรายการสินค้าพร้อมสั่งได้

---

## **Phase 3: Order and Customer Payment**

งาน

* Ready-to-Order Selection  
* Order Validation  
* Customer Order  
* Snapshot  
* Supplier Order Split  
* Cancellation Request  
* Deposit Invoice  
* Slip Upload  
* Finance Verification

ผลลัพธ์

สมาชิกสร้างออเดอร์และชำระมัดจำได้

---

## **Phase 4: Purchase Order and Production**

งาน

* Supplier Order  
* Purchase Order  
* Supplier Deposit Record  
* Factory Confirmation  
* Production Status  
* Production Media  
* Delay Tracking

ผลลัพธ์

ทีมงานเปิด PO และติดตามการผลิตได้

---

## **Phase 5: QC and Balance**

งาน

* QC Inspection  
* Checklist  
* Rework  
* Reinspection  
* Custom QC Approval  
* Balance Invoice  
* Balance Payment Verification  
* Supplier Balance Payment/Approval

ผลลัพธ์

สินค้าได้รับการตรวจและพร้อมออกจากโรงงาน

---

## **Phase 6: Warehouse and Logistics**

งาน

* China Warehouse Receipt  
* Package/Quantity  
* Weight/CBM  
* Consolidation  
* Shipment  
* Partial Shipment  
* ETD/ETA  
* Import Status

ผลลัพธ์

ทีมงานติดตามสินค้าจากโรงงานถึงประเทศไทยได้

---

## **Phase 7: Delivery, Freight and Claim**

งาน

* Delivery Appointment  
* Proof of Delivery  
* Partial Delivery  
* Delivered with Issue  
* Freight Invoice  
* Freight Payment  
* Claim  
* Resolution  
* Order Completion

ผลลัพธ์

Workflow ตั้งแต่เลือกสินค้าถึงส่งมอบและเคลมทำงานครบวงจร

---

## **Phase 8: Stabilization**

งาน

* Permission Audit  
* Security Test  
* Data Validation  
* End-to-end Test  
* Mobile Test  
* Performance  
* Backup  
* Logging  
* Bug Fix  
* User Acceptance Test  
* Production Deployment

ไม่มี Feature ใหม่ใน Phase นี้

---

# **16\. Development Priority**

ในทุก Phase ให้ใช้ลำดับ

Must Have  
→ Test  
→ Fix  
→ User Acceptance  
→ Phase ถัดไป

ห้ามทำ Should Have หาก Must Have ใน Phase เดียวกันยังไม่ผ่าน

ห้ามทำ Future Feature ก่อน End-to-end Workflow สำเร็จ

---

# **17\. End-to-End Scenario สำหรับตรวจระบบ**

Codex ต้องสร้าง Test Scenario อย่างน้อยหนึ่ง Workflow ที่ทำงานครบดังนี้

## **Scenario**

1. Admin สร้าง Supplier A และ Supplier B  
2. Admin สร้าง Product A จาก Supplier A  
3. Admin สร้าง Product B จาก Supplier B  
4. Admin กำหนด Factory Cost และ Member Price  
5. Admin Publish สินค้า  
6. ผู้ใช้สมัครสมาชิก  
7. Admin อนุมัติสมาชิก  
8. สมาชิกสร้าง End Customer  
9. สมาชิกสร้าง Project  
10. สมาชิกสร้าง Living Room และ Bedroom  
11. สมาชิกเพิ่ม Product A และ Product B  
12. สมาชิกเลือก Variant และ Option  
13. สมาชิกเปลี่ยนรายการเป็น Ready to Order  
14. สมาชิกเลือกสั่ง Product A ก่อน  
15. ระบบสร้าง Customer Order และ Supplier Order A  
16. ระบบสร้าง Deposit 50%  
17. สมาชิกอัปโหลดสลิป  
18. Finance Verify  
19. Purchasing ออก PO  
20. Admin อัปเดต Production  
21. QC ตรวจผ่าน  
22. Finance ออก Balance  
23. สมาชิกชำระ Balance  
24. Finance Verify  
25. Warehouse รับสินค้า  
26. Logistics สร้าง Shipment  
27. Shipment ถึงประเทศไทย  
28. Logistics นัด Delivery  
29. ส่งมอบพร้อม Proof  
30. Finance ออก Freight Invoice  
31. สมาชิกชำระ Freight  
32. Order Completed  
33. สมาชิกกลับ Project และสั่ง Product B ภายหลัง  
34. ระบบต้องสร้าง Order ใหม่โดยไม่กระทบ Order แรก

Scenario นี้ต้องผ่านก่อนประกาศว่า MVP พร้อมใช้งาน

---

# **18\. Acceptance Criteria ระดับโครงการ**

MVP ถือว่าพร้อมเมื่อ

* สมาชิกสมัครและได้รับอนุมัติได้  
* Admin เพิ่มและ Publish สินค้าได้  
* Member Price แสดงถูกต้อง  
* Factory Cost ไม่รั่วไหล  
* สมาชิกสร้าง Project ได้  
* สมาชิกเพิ่มสินค้าแยกตามห้องได้  
* สมาชิกทยอยสั่งได้  
* Customer Order แยก Supplier Order ได้  
* Deposit 50% ทำงานได้  
* Finance ตรวจ Payment ได้  
* PO ออกหลัง Deposit Verified เท่านั้น  
* Production อัปเดตได้  
* QC และ Rework ทำงานได้  
* Custom QC Approval ทำงานได้  
* Balance 50% ทำงานได้  
* Warehouse Receipt ทำงานได้  
* Consolidation และ Partial Shipment ทำงานได้  
* Shipment Tracking ทำงานได้  
* Delivery มี Proof  
* Freight Invoice ทำงานได้  
* Claim เชื่อมกับ Delivered Item ได้  
* ทุก Transaction สำคัญมี Timeline  
* ทุกสถานะสำคัญมี Audit  
* Permission ป้องกันข้อมูลข้ามสมาชิก  
* Mobile ใช้งาน Workflow สำคัญได้  
* End-to-end Scenario ผ่าน  
* ไม่มี Critical Security Issue  
* ไม่มี Critical Data Integrity Issue

---

# **19\. Definition of Done**

Feature ถือว่าเสร็จเมื่อ

1. Code ทำงานตาม Business Rule  
2. Database Migration ถูกต้อง  
3. Permission ถูกต้อง  
4. Validation อยู่ Backend  
5. Error Message ใช้งานได้  
6. Loading และ Empty State ขั้นพื้นฐานมี  
7. Audit ถูกสร้างเมื่อจำเป็น  
8. Unit Test หรือ Integration Test สำหรับ Rule สำคัญผ่าน  
9. Responsive Screen ใช้งานได้  
10. ไม่มี Factory Cost รั่วสู่ Member  
11. ผ่าน Code Review  
12. ผ่าน UAT  
13. เอกสาร API อัปเดต  
14. ไม่มี Feature เพิ่มนอก Blueprint

---

# **20\. หลักการทำงานของ Codex**

Codex ต้อง

* พัฒนาทีละ Phase  
* ใช้ Existing Documents เป็นข้อมูลต้นทาง  
* ใช้ Database Migration  
* เขียน Code แบบ Modular  
* ใช้ TypeScript Strict  
* Validate Backend  
* สร้าง Permission Guard  
* สร้าง Audit Log  
* ทำ Transaction สำหรับข้อมูลสำคัญ  
* สรุปสิ่งที่ทำในแต่ละ Phase  
* รายงานสิ่งที่ยังไม่ผ่าน  
* ไม่สร้าง Feature ที่ไม่ได้สั่ง  
* ไม่เปลี่ยน Business Rule โดยพลการ  
* ไม่ย้ายไป Phase ต่อไปก่อน Core Test ผ่าน

Codex ห้าม

* ออกแบบ Business Model ใหม่  
* เพิ่ม Marketplace  
* เพิ่ม Factory Portal  
* เพิ่ม Payment Gateway  
* เพิ่ม AI Workflow โดยไม่ได้รับคำสั่ง  
* เปลี่ยน Payment 50/50  
* รวม Customer Payment กับ Supplier Payment  
* เปิดเผย Factory Cost  
* เปลี่ยน Product Snapshot ใน Order เดิม  
* Hard Delete ข้อมูลธุรกรรม  
* ใช้สถานะนอก State Machine โดยไม่จำเป็น  
* สร้างหน้าจอเพียงเพื่อความสวยงามแต่ไม่เกี่ยวกับ Workflow  
* สร้าง Microservices  
* เปลี่ยน Technology Stack  
* เพิ่ม Table ซ้ำ  
* ทำ Should Have ก่อน Must Have

---

# **21\. รูปแบบคำสั่งเริ่มต้นสำหรับ Codex**

คุณกำลังพัฒนา Global Interior Supply Platform — GISP

ให้ใช้ `MVP BUSINESS MASTER PLAN.md` เป็นขอบเขตสูงสุด ตามด้วย `DECISION LOG.md` และใช้ GISP Development Master Blueprint เป็นเอกสารควบคุมการลงมือพัฒนา

ข้อกำหนดสำคัญ:

1\. พัฒนาเฉพาะ MVP ที่ระบุใน Blueprint  
2\. ห้ามเพิ่ม Feature, Module, Workflow หรือ Technology ใหม่  
3\. ใช้ Modular Monolith  
4\. ใช้ Next.js และ TypeScript โดย Deploy Frontend และบริหาร Backend ผ่าน InsForge  
5\. ใช้ Database Schema เดิมเป็นฐาน  
6\. Factory ไม่มี Login ใน MVP  
7\. Member ห้ามเห็น Factory Cost  
8\. Customer Order ต้องแยก Supplier Orders ตาม Supplier  
9\. Customer Payment ใช้ Deposit 50%, Balance 50% ของยอดรวมหลัง VAT แบ่งโอนได้หลายครั้ง และ Freight แยก  
10\. ห้ามออก PO ก่อน Deposit Verified  
11\. Dispatch ต้องผ่าน QC, Custom Member Approval, Customer Balance Verified และ Supplier Balance Paid  
12\. ทุกสถานะต้องผ่าน Backend State Transition Validation  
13\. ทุก Transaction สำคัญต้องมี Audit Log  
14\. ห้าม Hard Delete ข้อมูลธุรกรรม  
15\. ทำงานทีละ Workflow Vertical Slice ตาม `MVP IMPLEMENTATION PLAN.md`  
16\. ก่อนเริ่มแต่ละ Phase ให้สรุป Tables, APIs, Screens และ Tests ที่จะทำ  
17\. เมื่อพบข้อมูลขัดกัน ห้ามเดา ให้สร้าง DECISION\_REQUIRED  
18\. Phase ถือว่าเสร็จเมื่อผ่าน Definition of Done  
19\. ห้ามเริ่ม Should Have หรือ Future Feature  
20\. เป้าหมายคือทำ End-to-end Scenario ให้ผ่านครบวงจร

ให้เริ่มจาก Slice 1: Login, บริษัท, ผู้ใช้ และสิทธิ์ และทำแต่ละ Slice ให้ผ่าน Definition of Done ก่อนเริ่ม Slice ถัดไป  
---

# **22\. เอกสารที่ต้องเก็บใน Repository**

แนะนำโครงสร้าง

/docs  
  /00-master  
    GISP-Development-Master-Blueprint.md

  /01-business  
    GISP-MVP-Business-Master-Plan.md

  /02-database  
    GISP-Database-Schema-Specification.md

  /03-ux  
    GISP-UX-Volume-1.md  
    GISP-UX-Volume-2.md  
    GISP-UX-Volume-3-Part-A.md  
    GISP-UX-Volume-3-Part-B.md

  /04-development  
    GISP-Codex-Development-Specification.md

  /05-api  
    API-Contract.md

  /06-decisions  
    Decision-Log.md

  /07-testing  
    MVP-Acceptance-Test.md

เอกสาร API Contract และ Test สามารถสร้างระหว่างการพัฒนาแต่ละ Phase ได้ โดยต้องไม่เพิ่มขอบเขตใหม่

---

# **23\. Decision Log**

ทุกการเปลี่ยนแปลงหลังจากนี้ต้องบันทึก

* Decision Number  
* Date  
* Requested By  
* Topic  
* Current Rule  
* Proposed Change  
* Reason  
* Impact  
* Approved/Rejected  
* Documents Affected

การพูดคุยหรือการแก้ Code โดยไม่มี Decision Log ไม่ถือว่าเป็นการเปลี่ยน Requirement

---

# **24\. Change Control**

หลังอนุมัติ Blueprint นี้ การเปลี่ยนแปลงแบ่งเป็น

## **Bug Fix**

แก้ระบบให้ตรงเอกสารเดิม

สามารถทำได้

## **Clarification**

อธิบาย Rule ที่มีอยู่โดยไม่เพิ่ม Scope

สามารถทำได้และบันทึก Decision Log

## **Scope Change**

เพิ่ม Feature, User Role, Workflow, Integration หรือ Module

ไม่อนุญาตใน MVP

ให้นำไปเก็บใน Post-MVP Backlog เท่านั้น

---

# **25\. MVP Completion Gate**

ก่อนเปิดใช้งานจริง ต้องผ่าน Gate ต่อไปนี้

## **Gate 1: Catalog Ready**

* Supplier พร้อม  
* Product พร้อม  
* Member Price พร้อม  
* Catalog Search ใช้งานได้

## **Gate 2: Project Ready**

* สร้าง Customer  
* สร้าง Project  
* เพิ่มสินค้า  
* Product Schedule  
* Ready to Order

## **Gate 3: Commercial Ready**

* Order  
* Deposit  
* Finance Verification  
* PO

## **Gate 4: Operations Ready**

* Production  
* QC  
* Balance  
* Warehouse  
* Shipment

## **Gate 5: Delivery Ready**

* Delivery  
* Proof  
* Freight  
* Claim

## **Gate 6: Production Readiness**

* Security  
* Backup  
* Logging  
* UAT  
* Training  
* Seed/Initial Data  
* Deployment

ต้องผ่านทุก Gate ก่อนประกาศ MVP Complete

---

# **26\. ข้อสรุปสุดท้าย**

เอกสารและข้อกำหนดที่มีอยู่ในปัจจุบัน **เพียงพอสำหรับเริ่มพัฒนา GISP MVP แล้ว**

ไม่จำเป็นต้องสร้าง

* UX Volume ใหม่  
* Business Document ใหม่  
* Module ใหม่  
* Specification ใหม่ก่อน Coding

งานต่อจากนี้คือ

จัดเก็บเอกสารใน Repository  
→ ส่ง Blueprint และเอกสารอ้างอิงให้ Codex  
→ เริ่ม Phase 0  
→ พัฒนาทีละ Phase  
→ ทดสอบทีละ Phase  
→ ทำ End-to-end Scenario  
→ UAT  
→ เปิดใช้งาน MVP

ขอบเขต MVP สิ้นสุดที่

สมาชิกสามารถค้นหาสินค้า สร้าง Project ทยอยเปิด Order ชำระเงิน ติดตามการผลิต ตรวจสินค้า ติดตามการขนส่ง รับสินค้า ชำระค่าขนส่ง และแจ้งเคลมได้ในระบบเดียว โดยทีม GISP สามารถบริหาร Supplier, Product, Order, Payment และ Operations ได้จากหลังบ้าน

**หลังจากเอกสารฉบับนี้ ห้ามเพิ่มรายละเอียดหรือขยายขอบเขต MVP เพิ่มเติม ให้เข้าสู่ขั้นตอนพัฒนาและทดสอบระบบทันที**
