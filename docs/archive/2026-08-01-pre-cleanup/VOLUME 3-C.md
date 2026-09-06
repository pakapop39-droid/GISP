# **GLOBAL INTERIOR SUPPLY PLATFORM**

## **GISP – UX/UI FLOW SPECIFICATION**

## **VOLUME 3 – PART C: FINANCE & EXECUTIVE**

**Document Version:** 1.2  
**Reconciled Date:** 1 สิงหาคม 2569 (2026-08-01)  
**Authority:** Finance Reference ภายใต้ `MVP BUSINESS MASTER PLAN.md` และ `DECISION LOG.md`  
**Change Summary:** Core MVP คงเฉพาะ Payment Verification, Supplier Payment, Audit และรายงานคงที่ที่จำเป็น; Commission, Advanced BI และ Report/Export Center เต็มรูปแบบเป็น Post-MVP  
**Document Type:** Core Finance + Post-MVP Reference Specification  
**Primary Users:** Finance, Accounting, Management และ Super Admin  
**Primary Language:** ภาษาไทย

---

# **0\. RECONCILED SCOPE**

Volume 3-C เป็นเอกสารอ้างอิงแบบผสม:

**Core MVP**

* Customer Payment Verification และ Partial Payment
* Customer Outstanding ที่จำเป็นต่อ Payment Gate
* Supplier Payment ที่จำเป็นต่อ Dispatch Gate
* Finance Permission และ Append-only Audit
* Executive Summary แบบอ่านอย่างเดียว
* Fixed Report: Order, Payment, Delay, Delivery และ Claim

**Post-MVP**

* Commission ทุกประเภท
* Advanced Margin/Profitability BI
* KPI/Executive BI ขั้นสูง
* Reports Center และ Export Center เต็มรูปแบบ
* Custom Report Builder, Scheduled Report และ Data Warehouse

หัวข้อหรือ Screen/API เดิมในส่วน Post-MVP เก็บไว้เพื่ออ้างอิงเท่านั้น ห้ามนำไปสร้างใน Core MVP

---

# **1\. วัตถุประสงค์**

Part C กำหนดฟังก์ชันหลังบ้านสำหรับควบคุมการเงิน ตรวจสอบรายรับและรายจ่าย วิเคราะห์กำไร ติดตามยอดขาย ดู KPI และส่งออกรายงานของ GISP

ขอบเขตประกอบด้วย

1. Payment Verification  
2. Supplier Payment  
3. Finance Audit Log  
4. Executive Summary แบบอ่านอย่างเดียว  
5. Fixed Reports ขั้นพื้นฐาน

ระบบการเงินใน MVP เป็นระบบบันทึกและควบคุมธุรกรรมภายใน GISP ไม่ใช่ระบบบัญชีเต็มรูปแบบ และยังไม่เชื่อมต่อธนาคารหรือโปรแกรมบัญชีอัตโนมัติ

---

# **2\. หลักการสำคัญ**

1. Customer Payment และ Supplier Payment ต้องแยกออกจากกัน  
2. การอัปโหลดสลิปไม่เท่ากับการยืนยันรับเงิน  
3. Finance เท่านั้นที่ยืนยันหรือปฏิเสธ Payment ได้  
4. Factory Cost, Margin และ Supplier Payment เป็นข้อมูลภายใน  
5. ทุกการยืนยัน แก้ไข หรือยกเลิกธุรกรรมต้องมี Audit Log  
6. Order ต้องใช้ข้อมูลราคาและอัตราแลกเปลี่ยนแบบ Snapshot  
7. รายงานต้องอ้างอิงข้อมูลธุรกรรมจริง ไม่คำนวณจาก Product Master ปัจจุบัน  
8. การ Export ต้องถูกจำกัดตาม Role และ Permission  
9. MVP ไม่อนุญาตให้แก้ยอดเงินที่ Verified แล้วโดยตรง  
10. การแก้ธุรกรรมที่ยืนยันแล้วต้องใช้ Adjustment หรือ Reversal พร้อมเหตุผล

---

# **3\. User Roles**

Finance Viewer/Officer/Manager เป็น Permission Level ภายใน `FINANCE` ไม่ใช่ System Role แยก
ส่วน Executive ใช้ `EXECUTIVE_VIEWER` และ Super Admin ใช้ `SUPER_ADMIN` ตาม DEC-035

## **3.1 Finance Viewer**

สามารถ

* ดูยอดรับและยอดจ่าย  
* ดู Invoice  
* ดูรายงาน  
* ดู Dashboard ตามสิทธิ์

ไม่สามารถ Verify หรือแก้ธุรกรรม

## **3.2 Finance Officer**

สามารถ

* ตรวจสอบ Customer Payment  
* Verify หรือ Reject Payment  
* บันทึก Supplier Payment  
* ออกเอกสารการเงิน  
* บันทึกค่าขนส่ง  
* Export รายงานตามสิทธิ์

## **3.3 Finance Manager**

สามารถ

* อนุมัติ Adjustment  
* อนุมัติ Supplier Payment  
* ดู Cash Position  
* ดู Fixed Report และ Finance Audit Log ตามสิทธิ์

การดู Margin, Commission และการปิดรอบรายงานแบบเต็มเป็น Post-MVP

## **3.4 Executive**

สามารถ

* ดู Executive Dashboard  
* ดูยอด Order, Cash Collection, Outstanding และสถานะการดำเนินงานแบบสรุป  
* ดู Fixed Report ที่กำหนดไว้ล่วงหน้าตามสิทธิ์

Margin, Advanced KPI และ Custom Export เป็น Post-MVP

ไม่จำเป็นต้องแก้ธุรกรรม

## **3.5 Super Admin**

เข้าถึงทั้งหมด แต่การ Override ต้องระบุเหตุผลและถูกบันทึกใน Audit Log

---

# **4\. Information Architecture**

Finance Dashboard

Customer Payments  
├── Waiting Verification  
├── Verified  
├── Rejected  
├── Outstanding  
└── Payment History

Supplier Payments  
├── Payment Due  
├── Payment Requests  
├── Paid  
└── Supplier Payment History

Commission (Post-MVP)  
├── Commission Summary  
├── Commission Detail  
└── Payment Status

Analysis  
├── Margin Analysis (Post-MVP)  
├── Sales Dashboard (Post-MVP)  
├── Executive Dashboard  
└── KPI (Post-MVP)

Reports  
├── Fixed Core Reports  
├── Sales Report (Post-MVP)  
├── Collection Report  
├── Supplier Payment Report  
├── Margin Report (Post-MVP)  
├── Order Profitability (Post-MVP)  
├── Outstanding Report  
└── Export History (Post-MVP)

Audit  
└── Finance Audit Log

---

# **5\. Screen Inventory**

Part C ประกอบด้วยประมาณ 20 หน้าจอหลัก

1. Finance Dashboard  
2. Customer Payment Verification Queue  
3. Customer Payment Verification Detail  
4. Rejected Payment Review  
5. Customer Outstanding Summary  
6. Supplier Payment Due List  
7. Create Supplier Payment  
8. Supplier Payment Approval  
9. Supplier Payment History  
10. Commission Summary (Post-MVP)  
11. Commission Detail (Post-MVP)  
12. Margin Analysis (Post-MVP)  
13. Order Profitability Detail (Post-MVP)  
14. Sales Dashboard (Post-MVP)  
15. Executive Dashboard  
16. KPI Dashboard (Post-MVP)  
17. Reports Center (Core เฉพาะ Fixed Report; แบบเต็มเป็น Post-MVP)  
18. Report Detail (Core เฉพาะ Fixed Report)  
19. Export Center (Post-MVP)  
20. Finance Audit Log

---

# **6\. Finance Dashboard**

## **Screen ID**

`FIN-001`

## **Purpose**

แสดงภาพรวมรายการเงินที่ Finance ต้องดำเนินการ

## **Summary Cards**

* Customer Payments รอตรวจ  
* ยอดรับวันนี้  
* ยอดรับเดือนนี้  
* Customer Outstanding  
* Supplier Payments ถึงกำหนด  
* Supplier Payments ค้างจ่าย  
* Freight Payments รอตรวจ  
* Payment Rejected ที่รอส่งใหม่

## **Action Required**

แสดงรายการที่ต้องดำเนินการก่อน เช่น

* สลิปรอตรวจ  
* Payment เกินกำหนด  
* Supplier Deposit ถึงกำหนด  
* Supplier Balance ถึงกำหนด  
* Freight Invoice ยังไม่ชำระ  
* ธุรกรรมยอดไม่ตรง  
* Payment Adjustment รออนุมัติ

## **Filters**

* Date Range  
* Payment Type  
* Currency  
* Status  
* Responsible Finance Officer

---

# **7\. Customer Payment Verification Queue**

## **Screen ID**

`FIN-002`

## **Purpose**

รวมหลักฐานการชำระเงินจากสมาชิกที่รอ Finance ตรวจสอบ

## **Payment Types**

* Customer Deposit  
* Customer Balance  
* Freight Payment  
* Adjustment Payment

## **Columns**

* Payment Reference  
* Order Number  
* Member  
* Project  
* Payment Type  
* Amount Due  
* Amount Submitted  
* Transfer Date  
* Submitted Date  
* Slip  
* Status  
* Waiting Time  
* Action

## **Filters**

* Payment Type  
* Amount Difference  
* Bank  
* Submitted Date  
* Order  
* Member  
* Waiting Time

## **Actions**

* Open Verification  
* Assign Officer  
* Mark for Review  
* Export Queue

---

# **8\. Customer Payment Verification Detail**

## **Screen ID**

`FIN-003`

## **Information**

### **Payment Schedule**

* Invoice Number  
* Order Number  
* Payment Type  
* Amount Due  
* Paid Previously  
* Outstanding  
* Due Date

### **Submitted Evidence**

* Amount Submitted  
* Transfer Date  
* Transfer Time  
* Source Account Name  
* Source Bank  
* Slip Preview  
* Member Note

### **Order Information**

* Member  
* Project  
* Product Total  
* Payment History  
* Current Order Status

## **Actions**

* Verify Full Payment  
* Verify Partial Payment  
* Reject  
* Request Additional Evidence  
* Mark as Duplicate  
* Flag for Finance Manager

## **Business Rules**

* Verify Amount ต้องไม่เกิน Amount Submitted  
* Partial Payment ต้องเหลือ Outstanding  
* Duplicate Slip ห้าม Verify ซ้ำ  
* Finance ต้องบันทึก Verified Date  
* Finance ต้องบันทึก Verified By  
* Order Status เปลี่ยนหลัง Verification ตาม State Machine  
* Deposit Verified จึงเปิดให้ดำเนินการ PO  
* Balance Verified จึงเปิดให้ดำเนินการจัดส่งตาม Workflow

---

# **9\. Payment Rejection**

## **Screen ID**

`FIN-004`

## **Rejection Reasons**

* ไม่พบยอดเงินเข้า  
* ยอดเงินไม่ตรง  
* ภาพหลักฐานไม่ชัด  
* หลักฐานซ้ำ  
* วันที่หรือบัญชีไม่ตรง  
* เอกสารไม่ใช่หลักฐานการโอน  
* อื่น ๆ

Finance ต้องระบุ

* Rejection Reason  
* Member-visible Note  
* Internal Note  
* Rejected By  
* Rejected Date

หลัง Reject

* Payment Status เป็น `REJECTED`  
* Payment Schedule ยังเป็น Outstanding  
* สมาชิกได้รับ Notification  
* สมาชิกอัปโหลดหลักฐานใหม่ได้  
* หลักฐานเดิมต้องไม่ถูกลบ

---

# **10\. Customer Outstanding Summary**

## **Screen ID**

`FIN-005`

## **Purpose**

ติดตามยอดลูกค้าที่ยังไม่ได้รับชำระ

## **Grouping**

* By Member  
* By Order  
* By Project  
* By Payment Type  
* By Due Date

## **Columns**

* Member  
* Order  
* Payment Type  
* Invoice  
* Amount Due  
* Amount Paid  
* Outstanding  
* Due Date  
* Days Overdue  
* Order Status  
* Responsible Officer

## **Aging Groups**

* Not Due  
* 1–7 Days  
* 8–30 Days  
* 31–60 Days  
* มากกว่า 60 วัน

## **Actions**

* View Invoice  
* View Order  
* Send Reminder  
* Add Internal Note  
* Export Outstanding Report

---

# **11\. Supplier Payment Due List**

## **Screen ID**

`FIN-006`

## **Purpose**

ติดตามยอดที่ GISP ต้องชำระให้ Supplier

## **Payment Types**

* Supplier Deposit  
* Supplier Balance  
* Additional Factory Charge  
* Refund หรือ Adjustment

## **Columns**

* Supplier  
* Supplier Order  
* PO Number  
* Payment Type  
* Currency  
* Amount Due  
* THB Equivalent  
* Due Date  
* Customer Deposit Status  
* Production/QC Status  
* Approval Status  
* Payment Status

## **Important Rules**

* Supplier Deposit ต้องเชื่อมกับ PO  
* Supplier Balance ต้องเชื่อมกับเงื่อนไข Production/QC  
* Customer Deposit Status ต้องมองเห็นเพื่อควบคุม Cash Flow  
* Supplier Payment ไม่แสดงต่อ Member

---

# **12\. Create Supplier Payment**

## **Screen ID**

`FIN-007`

## **Fields**

* Supplier  
* Supplier Order  
* PO Number  
* Payment Type  
* Amount  
* Currency  
* Exchange Rate  
* THB Equivalent  
* Payment Date  
* Payment Method  
* Beneficiary Account  
* Transaction Reference  
* Payment Evidence  
* Internal Note

## **Validation**

* Amount ต้องมากกว่า 0  
* Currency จำเป็น  
* Exchange Rate จำเป็นเมื่อไม่ใช่ THB  
* จำนวนเงินต้องไม่เกิน Outstanding เว้นแต่เป็น Adjustment  
* Supplier Order ต้องตรงกับ Supplier  
* Payment Evidence จำเป็นก่อน Mark Paid  
* ผู้สร้างและผู้อนุมัติควรเป็นคนละคนเมื่อยอดเกินเกณฑ์ที่บริษัทกำหนด

---

# **13\. Supplier Payment Approval**

## **Screen ID**

`FIN-008`

## **Purpose**

ให้ Finance Manager ตรวจสอบก่อนยืนยันการจ่ายเงิน

## **Display**

* Supplier  
* PO  
* Supplier Order  
* Factory Cost  
* Previous Payments  
* Outstanding  
* Proposed Payment  
* Currency  
* Exchange Rate  
* Related Customer Order  
* Customer Collection Status  
* Production/QC Status  
* Evidence  
* Requested By

## **Actions**

* Approve  
* Reject  
* Return for Correction

## **Approval Result**

เมื่อ Approve และจ่ายแล้ว

* Payment Status เป็น `PAID`  
* Supplier Outstanding ลดลง  
* บันทึก Exchange Rate Snapshot  
* สร้าง Audit Log  
* อัปเดต Supplier Order Timeline

---

# **14\. Supplier Payment History**

## **Screen ID**

`FIN-009`

## **Columns**

* Payment Number  
* Supplier  
* Supplier Order  
* PO  
* Payment Type  
* Amount  
* Currency  
* Exchange Rate  
* THB Equivalent  
* Payment Date  
* Approved By  
* Status

## **Filters**

* Supplier  
* Currency  
* Payment Type  
* Date Range  
* Status  
* Supplier Order

## **Actions**

* View  
* Download Evidence  
* Export  
* Create Adjustment ตาม Permission

---

# **15\. Commission Summary (Post-MVP Reference)**

## **Screen ID**

`COM-001`

## **Purpose**

สรุปค่าคอมมิชชันที่เกิดจากสมาชิก ผู้แนะนำ หรือ Partner

## **MVP Scope**

Commission ทุกประเภทเป็น Post-MVP ห้ามสร้าง Table, API, UI หรือ Workflow ใน Core MVP

## **Summary**

* Commission Accrued  
* Commission Approved  
* Commission Payable  
* Commission Paid  
* Commission On Hold

## **Columns**

* Beneficiary  
* Member/Partner Type  
* Related Order  
* Commission Basis  
* Rate  
* Commission Amount  
* Status  
* Eligible Date  
* Paid Date

## **Commission Status**

* Pending  
* Accrued  
* Approved  
* On Hold  
* Payable  
* Paid  
* Cancelled

---

# **16\. Commission Detail (Post-MVP Reference)**

## **Screen ID**

`COM-002`

## **Display**

* Beneficiary  
* Related Member  
* Related Order  
* Related Project  
* Product Revenue  
* Eligible Revenue  
* Commission Rate  
* Commission Amount  
* Adjustments  
* Net Commission  
* Payment Condition  
* Status  
* Approval History

## **Business Rules**

* Commission ต้องอ้างอิง Order หรือ Transaction ที่ชัดเจน  
* Order ที่ Cancelled ไม่สร้าง Commission  
* Refund หรือ Adjustment ต้องปรับ Commission  
* Commission Payable เมื่อเงื่อนไขรับเงินจริงครบ  
* Commission Rate ต้อง Snapshot เมื่อสร้างรายการ  
* Commission ที่ Paid แล้วห้ามแก้โดยตรง

---

# **17\. Margin Analysis (Post-MVP Reference)**

## **Screen ID**

`MARGIN-001`

## **Purpose**

วิเคราะห์กำไรขั้นต้นจาก Order, Supplier, Product และ Project

## **Filters**

* Date Range  
* Supplier  
* Member  
* Project  
* Order  
* Product Category  
* Currency  
* Order Status

## **Metrics**

* Product Revenue  
* Factory Cost  
* China Cost  
* International Freight  
* Import Cost  
* Thailand Delivery Cost  
* Platform Cost ที่บันทึก  
* Commission  
* Gross Profit  
* Gross Margin %

## **Calculation Principle**

ระบบใช้ข้อมูล Snapshot และต้นทุนที่บันทึกในธุรกรรมจริง

Gross Profit  
\= Revenue  
\- Factory Cost  
\- Direct Logistics Cost  
\- Commission  
\- Direct Order Cost

ค่าใช้จ่ายสำนักงานและต้นทุนทางอ้อมไม่รวมใน Order Gross Margin ของ MVP

## **Views**

* By Order  
* By Project  
* By Member  
* By Supplier  
* By Category

---

# **18\. Order Profitability Detail (Post-MVP Reference)**

## **Screen ID**

`MARGIN-002`

## **Display**

### **Revenue**

* Product Revenue  
* Freight Revenue  
* Service Charge  
* Other Revenue  
* Discount  
* Net Revenue

### **Cost**

* Factory Cost  
* Supplier Option Cost  
* China Transport  
* Warehouse  
* QC  
* Consolidation  
* International Freight  
* Import  
* Thailand Delivery  
* Commission  
* Other Direct Cost

### **Result**

* Gross Profit  
* Gross Margin %  
* Unrecorded Cost Warning  
* Estimated Cost  
* Actual Cost

## **Important Rules**

* Estimated Cost และ Actual Cost ต้องแยกกัน  
* Order ที่ยังไม่ครบต้นทุนต้องแสดง `Margin Provisional`  
* Order ที่ต้นทุนครบแล้วแสดง `Margin Final`  
* Factory Cost และ Margin แสดงเฉพาะผู้มี Permission

---

# **19\. Sales Dashboard (Post-MVP Reference)**

## **Screen ID**

`SALE-001`

## **Purpose**

แสดงยอดขายและการรับเงินของธุรกิจ

## **KPI Cards**

* Order Value  
* Net Sales  
* Deposit Collected  
* Balance Collected  
* Freight Collected  
* Total Collected  
* Outstanding  
* Number of Orders  
* Average Order Value

## **Analysis**

* Sales by Month  
* Sales by Member  
* Sales by Project Type  
* Sales by Supplier  
* Sales by Category  
* Sales by Order Status

## **Filters**

* Date Range  
* Member  
* Supplier  
* Category  
* Project Type  
* Order Status

## **Recognition Rule**

Dashboard ต้องแยกอย่างน้อย

* Order Value  
* Invoiced  
* Collected

เพื่อไม่ให้ยอดออเดอร์ถูกตีความเป็นเงินรับแล้วทั้งหมด

---

# **20\. Executive Dashboard (Core เฉพาะ Basic Read-only Summary)**

## **Screen ID**

`EXEC-001`

## **Purpose**

ให้ผู้บริหารเห็นยอด Order, เงินสดคงค้าง และสถานะการดำเนินงานขั้นพื้นฐานในหน้าเดียว โดยเป็น Read-only

## **Financial Metrics**

* Total Order Value  
* Total Collected  
* Customer Outstanding  
* Supplier Payable  
* Freight Outstanding

## **Operational Metrics**

* Active Orders  
* Orders in Production  
* Production Delayed  
* QC Issues  
* Goods in Transit  
* Deliveries Due  
* Open Claims

## **Business Metrics**

* Active Members  
* Members with Orders  
* Active Suppliers  
* Active Products

## **Period Comparison**

Post-MVP สำหรับ Advanced BI; Core MVP ไม่ต้องแสดงการเปรียบเทียบช่วงเวลาแบบคำนวณอัตโนมัติ

เมื่อพัฒนาใน Post-MVP ให้แสดง

* Current Period  
* Previous Period  
* Difference  
* Percentage Change

Executive Dashboard เป็น Summary และต้องเชื่อมไปยังรายงานรายละเอียดได้

---

# **21\. KPI Dashboard (Post-MVP Reference)**

## **Screen ID**

`KPI-001`

## **KPI Categories**

### **Sales**

* Order Value  
* Collected Revenue  
* Average Order Value  
* Orders per Member  
* Repeat Order Rate

### **Collection**

* Deposit Collection Time  
* Balance Collection Time  
* Outstanding Amount  
* Overdue Rate  
* Payment Rejection Rate

### **Purchasing**

* PO Issuance Time  
* Supplier Deposit Lead Time  
* Supplier Payment On-time Rate

### **Margin**

* Gross Margin %  
* Gross Profit per Order  
* Orders Below Margin Threshold  
* Cost Variance

### **Operations**

* Production On-time Rate  
* QC Pass Rate  
* Rework Rate  
* Shipment On-time Rate  
* Delivery Completion Rate

### **Claims**

* Claim Rate  
* Claim Resolution Time  
* Claims by Supplier  
* Claims by Product Category

## **KPI Structure**

KPI แต่ละตัวต้องมี

* KPI Name  
* Definition  
* Formula  
* Current Value  
* Target  
* Status  
* Period  
* Data Source

---

# **22\. Reports Center (Post-MVP Reference — Core ใช้ Fixed Report เท่านั้น)**

## **Screen ID**

`RPT-001`

## **Purpose**

เป็นหน้ารวมรายงานมาตรฐาน

## **MVP Reports**

1. Sales Report  
2. Customer Collection Report  
3. Customer Outstanding Report  
4. Supplier Payment Report  
5. Supplier Outstanding Report  
6. Order Margin Report  
7. Project Profitability Report  
8. Member Sales Report  
9. Supplier Performance Report  
10. Product Sales Report  
11. Freight Revenue and Cost Report  
12. Commission Report  
13. Payment Rejection Report  
14. Claim Cost Report  
15. Audit Report

## **Report Card**

* Report Name  
* Description  
* Last Generated  
* Available Formats  
* Required Permission  
* Run Report

---

# **23\. Report Detail**

## **Screen ID**

`RPT-002`

## **Standard Components**

* Date Range  
* Filters  
* Grouping  
* Sorting  
* Summary Metrics  
* Detail Table  
* Export Button

## **General Filters**

* Member  
* Supplier  
* Project  
* Order  
* Category  
* Payment Status  
* Currency  
* Responsible Staff

## **Report Rules**

* ข้อมูลต้องตรงกับ Permission ของผู้ใช้  
* รายงานต้นทุนต้องไม่แสดงต่อผู้ไม่มี Cost Permission  
* Report ต้องแสดงวันและเวลาที่ Generate  
* Report ต้องแสดง Filter ที่ใช้  
* Financial Report ต้องระบุ Currency  
* Multi-currency Report ต้องแสดง Original Currency และ THB Equivalent ตามความเหมาะสม

---

# **24\. Export Center (Post-MVP Reference)**

## **Screen ID**

`EXP-001`

## **Supported Formats**

* Excel  
* CSV  
* PDF สำหรับรายงานสรุป

## **Export Functions**

* Export Current View  
* Export Full Report  
* Export Selected Rows  
* Schedule Export ไม่รวมใน MVP

## **Export History**

แสดง

* Export Number  
* Report Type  
* Requested By  
* Requested Date  
* Filters  
* File Format  
* Status  
* Download Expiry  
* Download

## **Export Security**

* Export ต้องตรวจ Permission ที่ Backend  
* Export Factory Cost ต้องมี Cost Permission  
* Export Personal Data ต้องจำกัดสิทธิ์  
* ทุก Export การเงินต้องมี Audit Log  
* Download Link ต้องมีอายุ  
* ไฟล์ต้องไม่เปิดผ่าน Public URL

---

# **25\. Finance Audit Log**

## **Screen ID**

`AUD-FIN-001`

## **Purpose**

ตรวจสอบการเปลี่ยนแปลงข้อมูลการเงินย้อนหลัง

## **Events ที่ต้องบันทึก**

* Customer Payment Submitted  
* Customer Payment Verified  
* Customer Payment Rejected  
* Partial Payment Verified  
* Invoice Issued  
* Invoice Cancelled  
* Supplier Payment Created  
* Supplier Payment Approved  
* Supplier Payment Rejected  
* Supplier Payment Marked Paid  
* Commission Created  
* Commission Approved  
* Commission Paid  
* Cost Added  
* Cost Adjusted  
* Margin Recalculated  
* Export Requested  
* Financial Data Override

## **Audit Fields**

* Date and Time  
* User  
* Role  
* Action  
* Entity Type  
* Entity Number  
* Old Value  
* New Value  
* Reason  
* Related Order  
* IP หรือ Session Reference ตามระบบ

## **Rules**

* Audit Log ห้ามแก้ไข  
* Audit Log ห้ามลบจาก UI  
* ข้อมูลลับใน Audit ต้องใช้ Permission เดียวกับข้อมูลต้นทาง  
* Super Admin Override ต้องมีเหตุผล  
* Audit สามารถ Export ได้ตาม Permission

---

# **26\. Financial Status**

## **Customer Payment**

PENDING  
→ SUBMITTED  
→ VERIFIED

กรณีไม่ผ่าน

SUBMITTED  
→ REJECTED  
→ SUBMITTED

กรณีจ่ายไม่ครบ

SUBMITTED  
→ PARTIALLY\_VERIFIED  
→ SUBMITTED  
→ VERIFIED

## **Supplier Payment**

DRAFT  
→ PENDING\_APPROVAL  
→ APPROVED  
→ PAID

กรณีไม่ผ่าน

PENDING\_APPROVAL  
→ REJECTED  
→ DRAFT

สถานะพิเศษ

* CANCELLED  
* REVERSED

## **Commission (Post-MVP Reference)**

PENDING  
→ ACCRUED  
→ APPROVED  
→ PAYABLE  
→ PAID

สถานะพิเศษ

* ON\_HOLD  
* CANCELLED  
* ADJUSTED

---

# **27\. Core Business Rules**

## **Customer Payment**

1. Payment ต้องเชื่อมกับ Payment Schedule  
2. Payment Schedule ต้องเชื่อมกับ Order  
3. Slip หนึ่งรายการห้ามใช้ Verify ซ้ำ  
4. Verify ต้องบันทึกผู้ตรวจและเวลา  
5. Partial Payment ต้องคงยอด Outstanding  
6. Payment ที่ Verified แล้วห้ามแก้โดยตรง  
7. การแก้ต้องใช้ Adjustment หรือ Reversal  
8. การ Reject ต้องระบุเหตุผล  
9. การชำระเกินต้อง Flag ให้ Finance ตรวจ  
10. Deposit, Balance และ Freight ต้องแยก Schedule

## **Supplier Payment**

11. Supplier Payment ต้องเชื่อม Supplier Order หรือ PO  
12. Supplier Deposit และ Balance ต้องแยกกัน  
13. Currency และ Exchange Rate ต้องถูก Snapshot  
14. Payment Evidence ต้องถูกจัดเก็บ  
15. Payment ที่ Paid แล้วห้ามลบ  
16. Supplier Payment ห้ามแสดงต่อ Member  
17. การจ่ายเกิน Outstanding ต้องมี Finance Manager Approval

## **Commission (Post-MVP Reference)**

18. Commission ต้องมีผู้รับสิทธิ์  
19. Commission ต้องอ้างอิง Order หรือ Revenue Source  
20. Rate ต้อง Snapshot  
21. Cancelled Order ไม่สร้าง Commission Payable  
22. Refund หรือ Adjustment ต้องกระทบ Commission  
23. Paid Commission ห้ามแก้โดยตรง

## **Margin (Post-MVP Advanced Reference)**

24. Margin ต้องคำนวณจาก Snapshot และต้นทุนธุรกรรม  
25. Estimated และ Actual Cost ต้องแยก  
26. Margin ที่ต้นทุนไม่ครบต้องแสดงเป็น Provisional  
27. Discount ต้องลด Revenue  
28. Commission จะถือเป็น Direct Cost ตามกฎที่อนุมัติใน Post-MVP  
29. Freight Revenue และ Freight Cost ต้องแยก  
30. Margin Report ต้องระบุช่วงวันที่และ Currency

## **Reports and Audit**

31. Report ต้องตรวจ Permission  
32. Export ต้องสร้าง Audit Log  
33. Report ที่มีข้อมูลต้นทุนต้องจำกัดสิทธิ์  
34. Audit Log ห้ามแก้ไข  
35. รายงานต้องใช้ข้อมูล ณ เวลาที่สร้าง ไม่แก้ Transaction ย้อนหลัง

---

# **28\. Permission Matrix**

| Function | Finance Viewer | Finance Officer | Finance Manager | Executive | Super Admin |
| ----- | ----- | ----- | ----- | ----- | ----- |
| ดู Customer Payment | Yes | Yes | Yes | Summary | Yes |
| Verify Payment | No | Yes | Yes | No | Yes |
| Reject Payment | No | Yes | Yes | No | Yes |
| บันทึก Supplier Payment | No | Yes | Yes | No | Yes |
| อนุมัติ Supplier Payment | No | Limited | Yes | No | Yes |
| ดู Factory Cost | ตามสิทธิ์ | Yes | Yes | Summary | Yes |
| ดู Margin (Post-MVP) | No/จำกัด | Limited | Yes | Yes | Yes |
| จัดการ Commission (Post-MVP) | No | Limited | Yes | View | Yes |
| ดู Sales Dashboard (Post-MVP) | Yes | Yes | Yes | Yes | Yes |
| ดู Executive Dashboard | No | No | Yes | Yes | Yes |
| Export Cost Report (Post-MVP Full Export) | No | Limited | Yes | Yes | Yes |
| ดู Audit Log | Limited | Limited | Yes | Summary | Yes |
| Override Transaction | No | No | Limited | No | Yes |

---

# **29\. API Scope**

## **Customer Payments**

GET  /api/admin/customer-payments  
GET  /api/admin/customer-payments/:id  
POST /api/admin/customer-payments/:id/verify  
POST /api/admin/customer-payments/:id/reject  
POST /api/admin/customer-payments/:id/request-evidence  
POST /api/admin/customer-payments/:id/reverse

## **Supplier Payments**

GET  /api/admin/supplier-payments  
POST /api/admin/supplier-payments  
GET  /api/admin/supplier-payments/:id  
POST /api/admin/supplier-payments/:id/submit  
POST /api/admin/supplier-payments/:id/approve  
POST /api/admin/supplier-payments/:id/reject  
POST /api/admin/supplier-payments/:id/mark-paid

## **Commission (Post-MVP API Reference)**

GET  /api/admin/commissions  
GET  /api/admin/commissions/:id  
POST /api/admin/commissions/:id/approve  
POST /api/admin/commissions/:id/hold  
POST /api/admin/commissions/:id/mark-paid

## **Basic Dashboard (Core)**

GET /api/admin/finance/dashboard  
GET /api/admin/executive/dashboard  

## **Advanced Sales/Margin/KPI (Post-MVP API Reference)**

GET /api/admin/sales/dashboard  
GET /api/admin/kpis  
GET /api/admin/margins  
GET /api/admin/orders/:id/profitability

## **Fixed Reports and Finance Audit (Core)**

GET  /api/admin/reports?type=order|payment|delay|delivery|claim  
GET  /api/admin/finance-audit

## **Custom Reports and Export Center (Post-MVP API Reference)**

POST /api/admin/reports/run  
POST /api/admin/reports/export  
GET  /api/admin/exports  
GET  /api/admin/exports/:id/download

---

# **30\. KPI สำหรับ Finance และ Executive**

## **Finance KPI**

* Payment Verification Time  
* Payment Rejection Rate  
* Deposit Collection Time  
* Balance Collection Time  
* Freight Collection Time  
* Customer Outstanding  
* Supplier Payable  
* Overdue Amount  
* Supplier Payment On-time Rate  
* Cash Collection Ratio

## **Sales KPI (Post-MVP Advanced Reference)**

* Order Value  
* Collected Revenue  
* Number of Orders  
* Average Order Value  
* Revenue per Member  
* Revenue per Supplier  
* Repeat Order Rate

## **Margin KPI (Post-MVP Reference)**

* Gross Profit  
* Gross Margin %  
* Margin per Order  
* Margin by Supplier  
* Margin by Category  
* Cost Variance  
* Orders Below Margin Threshold

## **Executive KPI**

Core แสดงเฉพาะ:

* Order Count/Value ขั้นพื้นฐาน  
* Payment Verified และ Outstanding  
* Production/Shipment Delay  
* Delivery On-time/Issue  
* Open Claim และ Claim Rate

---

# **31\. MVP Must Have**

* Finance Dashboard  
* Customer Payment Verification  
* Full และ Partial Verification  
* Payment Rejection  
* Customer Outstanding  
* Supplier Payment  
* Supplier Payment Approval  
* Supplier Payment History  
* Customer Payment Verification และยอดสะสม  
* Supplier Payment สำหรับ Dispatch Gate  
* Executive Summary แบบอ่านอย่างเดียว  
* Fixed Reports: Order, Payment, Delay, Delivery และ Claim  
* Finance Audit Log  
* Role และ Permission

---

# **32\. ไม่อยู่ใน MVP**

* เชื่อม Bank API  
* Automatic Bank Reconciliation  
* Payment Gateway  
* ระบบบัญชีแยกประเภทเต็มรูปแบบ  
* Journal Entry  
* General Ledger  
* Tax Submission  
* e-Tax Invoice  
* Automated Commission Payout  
* Wallet  
* Credit Limit  
* Customer Credit Terms  
* Cash Flow Forecast ขั้นสูง  
* Budgeting  
* Financial Consolidation หลายบริษัท  
* AI Financial Forecast  
* Custom Report Builder  
* Scheduled Email Report  
* Real-time BI Data Warehouse

---

# **33\. Acceptance Criteria**

Core MVP ของ Part C ถือว่าสมบูรณ์เมื่อ

1. Finance เห็น Payment รอตรวจได้  
2. Finance เปิดดู Payment Schedule และสลิปได้  
3. Finance Verify Full Payment ได้  
4. Finance Verify Partial Payment ได้  
5. Finance Reject พร้อมเหตุผลได้  
6. Payment ที่ Verified แล้วแก้โดยตรงไม่ได้  
7. Customer Outstanding คำนวณได้  
8. Supplier Payment เชื่อม Supplier Order และ PO ได้  
9. Supplier Payment เก็บ Currency และ Exchange Rate ได้  
10. Supplier Payment ผ่าน Approval ได้  
11. Supplier Payment ที่ Paid แล้วลบไม่ได้  
12. Member ไม่เห็น Supplier Payment  
13. Executive Summary แสดงเฉพาะ Order, Payment, Delay, Delivery และ Claim แบบ Read-only ได้  
14. Fixed Report ทั้งห้าประเภทใช้ Filter เวลาและตรวจ Permission ได้  
15. การ Verify, Reject, Approve และ Paid มี Audit Log  
16. Audit Log แก้ไขหรือลบผ่าน UI ไม่ได้  
17. Dashboard เชื่อมไปยังข้อมูลรายละเอียดที่ได้รับอนุญาตได้  
18. Member API ไม่ได้รับ Cost หรือ Margin  
19. ทุกหน้าหลักมี Loading, Empty และ Error State ขั้นพื้นฐาน  
20. ฟังก์ชันสำคัญใช้งานบน Tablet ได้

Acceptance Criteria เดิมเรื่อง Commission, Margin/Profitability, Advanced Sales/KPI และ Full Export
เป็น Post-MVP Reference และไม่ใช้ตัดสิน Core MVP

---

# **34\. Codex Development Scope**

แนะนำแบ่งเป็น 4 งานหลัก

## **Workstream C1: Customer Finance**

* Finance Dashboard  
* Customer Payment Queue  
* Verification  
* Rejection  
* Partial Payment  
* Outstanding

## **Workstream C2: Supplier Finance**

* Supplier Payment  
* Approval  
* Payment History

## **Workstream C3: Basic Executive Summary**

* Executive Read-only Summary  
* Order, Payment, Delay, Delivery และ Claim Summary

## **Workstream C4: Fixed Reports and Audit**

* Fixed Report: Order, Payment, Delay, Delivery และ Claim  
* Finance Audit Log

Codex ต้องพัฒนาเฉพาะ Core MVP ใน Reconciled Scope ส่วน Commission, Margin/Profitability,
Advanced BI, Custom Report และ Full Export Center เป็น Post-MVP Reference
