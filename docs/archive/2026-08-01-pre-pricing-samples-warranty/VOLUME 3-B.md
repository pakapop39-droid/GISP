# **GLOBAL INTERIOR SUPPLY PLATFORM**

## **GISP – UX/UI FLOW SPECIFICATION**

## **VOLUME 3 – PART B: OPERATIONS CENTER**

**Document Version: 2.0**  
**Reconciled Date:** 1 สิงหาคม 2569 (2026-08-01)  
**Authority:** Operations Reference ภายใต้ `MVP BUSINESS MASTER PLAN.md` และ `DECISION LOG.md`  
**Document Type: MVP Feature Specification**  
**Primary Users: Order Admin, Purchasing, Production Coordinator, QC Team, Warehouse Team, Logistics Team, Delivery Team, Claim Team และ Operations Manager**  
**Primary Language: ภาษาไทย**

---

# **0\. RECONCILED OPERATIONS CONTRACT**

* Core MVP ทำ Order/Payment → Production/QC → Shipment/Delivery → Claim แบบ Vertical Slice
* Deposit Verified ครบจึงออก PO ได้
* Dispatch Gate ต้องผ่าน QC, Custom Member Approval, Customer Balance Verified และ Supplier Balance Paid
* Partial Order, Partial Payment และ Partial Shipment ต้องไม่ทำให้ Quantity/Yield เกินต้นทาง
* Assignment, Due Date และ Action Required ต้องผูก Transaction

---

# **1\. วัตถุประสงค์**

**Part B กำหนดฟังก์ชันศูนย์กลางการปฏิบัติงานหลังบ้านของ GISP ตั้งแต่รับออเดอร์ แยกคำสั่งซื้อโรงงาน ติดตามการผลิต ตรวจสินค้า รับสินค้าเข้าโกดัง รวมสินค้า ขนส่ง ส่งมอบ จัดการเคลม มอบหมายงาน และตรวจสอบประวัติการดำเนินงาน**

**ขอบเขตประกอบด้วย**

1. **Order Dashboard**  
2. **Supplier Order Dashboard**  
3. **Finance Dashboard สำหรับงานปฏิบัติการ**  
4. **Production Dashboard**  
5. **QC Dashboard**  
6. **Warehouse Dashboard**  
7. **Shipment Dashboard**  
8. **Delivery Dashboard**  
9. **Claim Dashboard**  
10. **Transaction Assignment, Due Date และ Action Required**  
11. **Activity Timeline**

**Operations Center เป็นศูนย์ควบคุมงานของทีม GISP ไม่ใช่หน้าจอสำหรับสมาชิก**

---

# **2\. หลักการสำคัญ**

1. **Customer Order และ Supplier Order ต้องแยกออกจากกัน**  
2. **Customer Order หนึ่งรายการสามารถมีหลาย Supplier Orders**  
3. **สมาชิกติดตาม Customer Order เป็นหลัก**  
4. **ทีมงานหลังบ้านติดตามงานถึงระดับ Supplier Order และ Order Item**  
5. **ทุกงานต้องมีสถานะ ผู้รับผิดชอบ วันที่เป้าหมาย และประวัติ**  
6. **การเปลี่ยนสถานะสำคัญต้องผ่าน Backend Validation**  
7. **งานล่าช้าต้องถูกแสดงเป็น Action Required**  
8. **Dashboard ต้องเชื่อมไปยังรายการงานจริง**  
9. **ข้อมูลต้นทุนและข้อมูลภายในห้ามแสดงต่อสมาชิก**  
10. **Operations Center ไม่แทนระบบบัญชีหรือ ERP เต็มรูปแบบ**  
11. **โรงงานไม่มีบัญชีเข้าใช้งานใน MVP**  
12. **ทีม GISP เป็นผู้บันทึกข้อมูลที่ได้รับจากโรงงานและผู้ให้บริการ**

---

# **3\. User Roles**

ชื่อ Role ย่อยในหัวข้อนี้เป็น Operations Persona/Permission Profile ไม่ใช่ Production Role ใหม่
ให้ Map Order/Production/Claim ไป `ORDER_ADMIN`, Purchasing ไป `PURCHASING`, QC ไป `QC`,
Warehouse/Shipment/Delivery ไป `LOGISTICS` และงาน Override ไป `SUPER_ADMIN` ตาม DEC-035

## **3.1 Operations Viewer**

**สามารถ**

* **ดู Dashboard**  
* **ดู Order**  
* **ดูสถานะ Production, QC, Shipment และ Delivery**  
* **ดู Timeline ตามสิทธิ์**

**ไม่สามารถเปลี่ยนสถานะ**

## **3.2 Order Admin**

**สามารถ**

* **ตรวจ Customer Order**  
* **แก้ข้อมูลปฏิบัติการที่อนุญาต**  
* **มอบหมายผู้รับผิดชอบ**  
* **Hold หรือ Cancel ตาม Workflow**  
* **ตรวจความพร้อมก่อนเปิด PO**

## **3.3 Purchasing Coordinator**

**สามารถ**

* **จัดการ Supplier Order**  
* **ออก Purchase Order**  
* **บันทึก Factory Confirmation**  
* **ประสาน Production**  
* **บันทึกข้อมูลโรงงาน**

## **3.4 Production Coordinator**

**สามารถ**

* **อัปเดตสถานะการผลิต**  
* **กำหนดวันที่คาดการณ์**  
* **อัปโหลดรูปและวิดีโอ**  
* **แจ้ง Delay**  
* **ส่งงานเข้า QC**

## **3.5 QC Team**

**สามารถ**

* **สร้าง Inspection**  
* **บันทึก Checklist**  
* **อัปโหลดหลักฐาน**  
* **ระบุ Pass หรือ Rework**  
* **บันทึก Reinspection**

## **3.6 Warehouse Team**

**สามารถ**

* **รับสินค้าเข้าโกดัง**  
* **บันทึกจำนวน Package**  
* **น้ำหนัก**  
* **CBM**  
* **Discrepancy**  
* **สภาพสินค้า**  
* **เตรียม Consolidation**

## **3.7 Logistics Team**

**สามารถ**

* **สร้าง Consolidation**  
* **สร้าง Shipment**  
* **อัปเดต ETD/ETA**  
* **อัปเดต Import Status**  
* **จัดการ Partial Shipment**

## **3.8 Delivery Team**

**สามารถ**

* **สร้าง Delivery Appointment**  
* **ยืนยันวันส่ง**  
* **อัปเดตสถานะ**  
* **บันทึก Proof of Delivery**  
* **บันทึกปัญหาหน้างาน**

## **3.9 Claim Team**

**สามารถ**

* **ตรวจ Claim**  
* **ขอข้อมูลเพิ่ม**  
* **ประสาน Supplier**  
* **เสนอ Resolution**  
* **ปิดเคส**

## **3.10 Operations Manager**

**สามารถ**

* **ดู Dashboard ทั้งหมด**  
* **มอบหมายงาน**  
* **ปรับลำดับความสำคัญ**  
* **อนุมัติ Operational Override ตามสิทธิ์**  
* **ตรวจงานล่าช้าและความเสี่ยง**

---

# **4\. Information Architecture**

**Operations Center**

**Overview**

**├── Operations Dashboard**


**├── Delayed Work**

**└── Activity Timeline**

**Orders**

**├── Customer Orders**

**├── Orders Requiring Action**

**├── Orders On Hold**

**└── Cancel Requests**

**Supplier Orders**

**├── Pending PO**

**├── Factory Confirmation**

**├── In Production**

**├── Waiting QC**

**└── Ready for Warehouse**

**Finance Operations**

**├── Deposit Status**

**├── Balance Status**

**├── Supplier Payment Status**

**└── Freight Status**

**Production**

**├── Production Overview**

**├── Delayed Production**

**└── Production Updates**

**QC**

**├── Waiting Inspection**

**├── Rework Required**

**├── Waiting Member Approval**

**└── Passed**

**Warehouse**

**├── Expected Receipts**

**├── Received**

**├── Discrepancies**

**└── Ready for Consolidation**

**Shipment**

**├── Consolidation**

**├── Planned Shipments**

**├── In Transit**

**├── Import**

**└── Delayed Shipments**

**Delivery**

**├── Ready to Schedule**

**├── Scheduled**

**├── Out for Delivery**

**├── Delivered**

**└── Delivery Issues**

**Claims**

**├── New Claims**

**├── Waiting Information**

**├── In Progress**

**├── Resolution Proposed**

**└── Closed**

---

# **5\. Screen Inventory**

**Part B ประกอบด้วยประมาณ 19 หน้าจอหลัก**

1. **Operations Center Dashboard**  
2. **Order Dashboard**  
3. **Order Operations Detail**  
4. **Supplier Order Dashboard**  
5. **Supplier Order Operations Detail**  
6. **Finance Operations Dashboard**  
7. **Production Dashboard**  
8. **Production Work Detail**  
9. **QC Dashboard**  
10. **QC Work Detail**  
11. **Warehouse Dashboard**  
12. **Warehouse Receipt Work Detail**  
13. **Shipment Dashboard**  
14. **Shipment Operations Detail**  
15. **Delivery Dashboard**  
16. **Delivery Operations Detail**  
17. **Claim Dashboard**  
18. **Claim Operations Detail**  
19. **Activity Timeline**

---

# **6\. Operations Center Dashboard**

## **Screen ID**

**`OPS-001`**

## **Purpose**

**แสดงภาพรวมการปฏิบัติงานทั้งหมดและสิ่งที่ต้องดำเนินการเร่งด่วน**

## **Summary Cards**

* **Active Customer Orders**  
* **Supplier Orders Pending PO**  
* **Production Delayed**  
* **QC Waiting**  
* **QC Rework**  
* **Warehouse Receipts Expected**  
* **Shipments in Transit**  
* **Deliveries Due**  
* **Open Claims**  

## **Action Required**

**เรียงตามความสำคัญ**

1. **Customer Deposit Verified แต่ยังไม่ออก PO**  
2. **Supplier Order เกินกำหนด Factory Confirmation**  
3. **Production Delay**  
4. **QC Rework ค้าง**  
5. **Custom QC รอ Member Approval**  
6. **Balance Verified แต่ยังไม่จัดส่ง**  
7. **สินค้าถึงโกดังแต่ยังไม่ตรวจรับ**  
8. **Shipment ETA เปลี่ยน**  
9. **Delivery นัดหมายใกล้ถึงกำหนด**  
10. **Claim รอข้อมูลหรือเกิน SLA**

## **Filters**

* **Date Range**  
* **Assigned Team**  
* **Responsible User**  
* **Supplier**  
* **Order Status**  
* **Priority**  
* **Delayed Only**

## **Quick Actions**

* **เปิด Customer Order**  
* **ออก PO**  
* **อัปเดต Production**  
* **สร้าง QC**  
* **รับสินค้าเข้าโกดัง**  
* **สร้าง Shipment**  
* **นัด Delivery**  
* **เปิด Claim**

---

# **7\. Order Dashboard**

## **Screen ID**

**`OPS-ORD-001`**

## **Purpose**

**ติดตาม Customer Orders ทั้งหมดในมุมมองของทีมปฏิบัติการ**

## **Status Groups**

* **Pending Deposit**  
* **Deposit Submitted**  
* **Deposit Verified**  
* **Processing**  
* **In Production**  
* **QC**  
* **Balance Due**  
* **Balance Verified**  
* **Logistics**  
* **Delivery**  
* **Freight Due**  
* **Completed**  
* **On Hold**  
* **Cancellation Requested**

## **Columns**

* **Customer Order Number**  
* **Member**  
* **Project**  
* **Order Date**  
* **Product Total**  
* **Supplier Order Count**  
* **Payment Status**  
* **Production Summary**  
* **QC Summary**  
* **Shipment Summary**  
* **Delivery Summary**  
* **Current Status**  
* **Responsible Owner**  
* **Next Action**  
* **Due Date**  
* **Delay Flag**

## **Filters**

* **Status**  
* **Member**  
* **Project**  
* **Supplier**  
* **Payment Status**  
* **Production Status**  
* **Assigned Owner**  
* **Due Date**  
* **Delay**  
* **Action Required**

## **Actions**

* **Open Order**  
* **Assign Owner**  
* **Put On Hold**  
* **Resume**  
* **View Timeline**  
* **View Documents**

---

# **8\. Order Operations Detail**

## **Screen ID**

**`OPS-ORD-002`**

## **Header**

* **Customer Order Number**  
* **Project**  
* **Member**  
* **Current Status**  
* **Priority**  
* **Responsible Owner**  
* **Created Date**  
* **Next Due Date**

## **Summary**

* **Product Total**  
* **Deposit Status**  
* **Balance Status**  
* **Freight Status**  
* **Supplier Order Count**  
* **Production Progress**  
* **QC Progress**  
* **Shipment Progress**  
* **Delivered Quantity**

## **Tabs**

1. **Overview**  
2. **Items**  
3. **Supplier Orders**  
4. **Payments**  
5. **Production**  
6. **QC**  
7. **Warehouse**  
8. **Shipments**  
9. **Deliveries**  
10. **Claims**  
11. **Timeline**

## **Operational Actions**

* **Assign User**  
* **Add Internal Note**  
* **Change Priority**  
* **Put On Hold**  
* **Resume**  
* **Review Cancellation Request**  
* **Open Related Record**

## **Business Rules**

* **Operational Note ไม่แสดงต่อ Member เว้นแต่ตั้งเป็น Member-visible**  
* **Order Status ต้องสะท้อนสถานะรวมของ Entity ที่เกี่ยวข้อง**  
* **การ Override ต้องมีเหตุผล**  
* **Order ที่ Completed แก้ Workflow หลักไม่ได้**

---

# **9\. Supplier Order Dashboard**

## **Screen ID**

**`OPS-SO-001`**

## **Purpose**

**ติดตามคำสั่งซื้อแยกตามโรงงาน**

## **Status Groups**

* **Pending PO**  
* **PO Issued**  
* **Factory Confirmation Pending**  
* **Factory Confirmed**  
* **Material Preparation**  
* **In Production**  
* **Partially Completed**  
* **Waiting QC**  
* **Rework**  
* **QC Passed**  
* **Ready for Dispatch**  
* **Delivered to Warehouse**  
* **Completed**  
* **On Hold**

## **Columns**

* **Supplier Order Number**  
* **Customer Order**  
* **Project**  
* **Supplier**  
* **PO Number**  
* **Item Count**  
* **Factory Currency**  
* **Supplier Deposit Status**  
* **Supplier Balance Status**  
* **Production Status**  
* **QC Status**  
* **Estimated Completion**  
* **Warehouse Status**  
* **Responsible Buyer**  
* **Delay**

## **Filters**

* **Supplier**  
* **Buyer**  
* **Status**  
* **Payment Status**  
* **Production Status**  
* **QC Status**  
* **Estimated Completion**  
* **Delayed Only**

---

# **10\. Supplier Order Operations Detail**

## **Screen ID**

**`OPS-SO-002`**

## **Header**

* **Supplier Order Number**  
* **Supplier**  
* **Customer Order**  
* **PO Number**  
* **Status**  
* **Assigned Buyer**  
* **Estimated Completion**

## **Sections**

* **Items**  
* **Factory Specifications**  
* **Purchase Order**  
* **Supplier Payment Status**  
* **Factory Confirmation**  
* **Production Updates**  
* **QC**  
* **Warehouse Receipt**  
* **Documents**  
* **Internal Timeline**

## **Actions**

* **Issue PO**  
* **Record Factory Confirmation**  
* **Update Estimated Completion**  
* **Add Production Update**  
* **Create QC Inspection**  
* **Mark Ready for Dispatch**  
* **Create Warehouse Expected Receipt**  
* **Put On Hold**  

## **Restrictions**

* **ห้ามออก PO ก่อน Customer Deposit Verified**  
* **ห้าม Mark Ready for Dispatch ก่อน QC ผ่าน**  
* **Custom Product ต้องผ่าน Member Approval**  
* **Supplier Payment Detail แสดงตาม Permission**

---

# **11\. Finance Operations Dashboard**

## **Screen ID**

**`OPS-FIN-001`**

## **Purpose**

**แสดงสถานะการเงินที่ส่งผลต่อการดำเนินงาน โดยไม่แทน Finance Dashboard ใน Part C**

## **Summary Cards**

* **Orders Waiting Deposit Verification**  
* **Orders Ready for PO**  
* **Supplier Deposits Due**  
* **Orders Waiting Balance**  
* **Balance Verified Ready to Ship**  
* **Supplier Balances Due**  
* **Freight Payments Outstanding**  
* **Orders Blocked by Payment**

## **Operational Views**

### **Customer Collection Status**

* **Deposit Pending**  
* **Deposit Submitted**  
* **Deposit Verified**  
* **Balance Pending**  
* **Balance Verified**  
* **Freight Pending**

### **Supplier Payment Status**

* **Supplier Deposit Pending**  
* **Supplier Deposit Paid**  
* **Supplier Balance Pending**  
* **Supplier Balance Paid**

## **Actions**

* **Open Finance Record**  
* **Notify Finance**  
* **View Blocking Reason**

## **Business Rule**

**Operations Team เห็นสถานะการเงิน แต่การ Verify หรือ Approve ยังคงอยู่ใน Part C ตาม Permission**

---

# **12\. Production Dashboard**

## **Screen ID**

**`OPS-PROD-001`**

## **Purpose**

**ควบคุม Supplier Orders ที่อยู่ระหว่างการผลิต**

## **Summary Cards**

* **Not Started**  
* **Material Preparation**  
* **In Production**  
* **Partially Completed**  
* **Completed**  
* **Delayed**  
* **On Hold**  
* **Waiting QC**

## **Columns**

* **Supplier Order**  
* **Supplier**  
* **Customer Order**  
* **Item Count**  
* **Production Status**  
* **Progress %**  
* **Start Date**  
* **Original Completion**  
* **Current Estimate**  
* **Days Remaining/Delayed**  
* **Latest Update**  
* **Responsible Coordinator**

## **Filters**

* **Supplier**  
* **Coordinator**  
* **Production Status**  
* **Completion Date**  
* **Delayed Only**  
* **Missing Update**  
* **Customer Order**

## **Alerts**

* **ไม่มี Update เกินจำนวนวันที่กำหนด**  
* **Estimated Completion ผ่านแล้ว**  
* **Progress ไม่สัมพันธ์กับวันที่**  
* **Production Complete แต่ยังไม่ส่ง QC**  
* **Rework กระทบ Completion Date**

---

# **13\. Production Work Detail**

## **Screen ID**

**`OPS-PROD-002`**

## **Display**

* **Supplier Order**  
* **Related Items**  
* **Current Status**  
* **Progress**  
* **Start Date**  
* **Original Estimate**  
* **Updated Estimate**  
* **Delay Reason**  
* **Production Updates**  
* **Photos/Videos**  
* **Responsible User**  
* **Member-visible Updates**

## **Actions**

* **Change Production Status**  
* **Update Progress**  
* **Add Estimate**  
* **Add Production Note**  
* **Upload Media**  
* **Mark Delay**  
* **Put On Hold**  
* **Resume**  
* **Submit to QC**  

## **Validation**

* **Progress ต้องอยู่ระหว่าง 0–100**  
* **Completed ต้องมี Completion Date**  
* **Delayed ต้องมี Reason และ Updated Estimate**  
* **Submit to QC ได้เมื่อ Production พร้อมตรวจ**  
* **Member-visible Content ต้องไม่เปิดเผยต้นทุนหรือข้อมูลลับ**

---

# **14\. QC Dashboard**

## **Screen ID**

**`OPS-QC-001`**

## **Purpose**

**ควบคุมงานตรวจสินค้าและงานแก้ไข**

## **Summary Cards**

* **Waiting Inspection**  
* **Inspection Today**  
* **In Progress**  
* **Passed**  
* **Rework Required**  
* **Waiting Reinspection**  
* **Waiting Member Approval**  
* **Overdue QC**

## **Columns**

* **QC Number**  
* **Supplier Order**  
* **Supplier**  
* **Customer Order**  
* **Item Count**  
* **QC Type**  
* **Inspection Date**  
* **Result**  
* **Rework Status**  
* **Member Approval Status**  
* **Inspector**  
* **Due Date**  
* **Action Required**

## **Filters**

* **Result**  
* **Supplier**  
* **Inspector**  
* **QC Type**  
* **Inspection Date**  
* **Rework**  
* **Member Approval**  
* **Overdue**

---

# **15\. QC Work Detail**

## **Screen ID**

**`OPS-QC-002`**

## **Sections**

* **Inspection Summary**  
* **Supplier Order**  
* **Order Items**  
* **Checklist**  
* **Measurements**  
* **Quantity Check**  
* **Defects**  
* **Photos/Videos**  
* **Rework Instruction**  
* **Reinspection**  
* **Member Approval**  
* **QC Report**  
* **Timeline**

## **Actions**

* **Start Inspection**  
* **Save Checklist**  
* **Record Issue**  
* **Upload Evidence**  
* **Pass**  
* **Request Rework**  
* **Schedule Reinspection**  
* **Submit Custom QC to Member**  
* **Finalize Report**

## **Business Rules**

* **QC Result ต้องมี Inspector และ Inspection Date**  
* **Rework ต้องมี Issue และ Corrective Action**  
* **Reinspection ต้องเชื่อม Inspection เดิม**  
* **Standard Product ผ่านได้โดยทีม GISP**  
* **Custom Product ต้องรอ Member Approval**  
* **QC Evidence ที่ Member เห็นต้องผ่าน Visibility Control**

---

# **16\. Warehouse Dashboard**

## **Screen ID**

**`OPS-WH-001`**

## **Purpose**

**ควบคุมสินค้าที่คาดว่าจะเข้าและได้รับเข้าโกดังจีน**

## **Summary Cards**

* **Expected Today**  
* **Expected This Week**  
* **Partially Received**  
* **Received Complete**  
* **Discrepancy**  
* **Damaged**  
* **Ready for Consolidation**  
* **Waiting Measurement**

## **Columns**

* **Expected Receipt Number**  
* **Supplier Order**  
* **Supplier**  
* **Customer Order**  
* **Expected Date**  
* **Received Date**  
* **Expected Packages**  
* **Received Packages**  
* **Expected Quantity**  
* **Received Quantity**  
* **Actual Weight**  
* **Actual CBM**  
* **Condition**  
* **Status**  
* **Warehouse Staff**

## **Filters**

* **Warehouse**  
* **Status**  
* **Supplier**  
* **Expected Date**  
* **Received Date**  
* **Discrepancy**  
* **Ready for Consolidation**

---

# **17\. Warehouse Receipt Work Detail**

## **Screen ID**

**`OPS-WH-002`**

## **Display**

* **Receipt Number**  
* **Warehouse**  
* **Supplier Order**  
* **Expected Items**  
* **Received Items**  
* **Package Count**  
* **Weight**  
* **CBM**  
* **Condition**  
* **Packing Labels**  
* **Photos**  
* **Discrepancy**  
* **Related QC**  
* **Consolidation Eligibility**

## **Actions**

* **Start Receiving**  
* **Record Quantity**  
* **Record Package**  
* **Record Weight/CBM**  
* **Upload Photos**  
* **Mark Complete**  
* **Mark Partial**  
* **Report Discrepancy**  
* **Report Damage**  
* **Release for Consolidation**  

## **Business Rules**

* **Received Quantity ห้ามเป็นค่าติดลบ**  
* **Received Quantity เกิน Expected ต้อง Flag**  
* **Discrepancy ต้องมีเหตุผล**  
* **Damage ต้องมี Evidence**  
* **Release for Consolidation ได้เฉพาะ Quantity ที่ได้รับและตรวจแล้ว**  
* **Partial Receipt ต้องเก็บ Remaining Quantity**

---

# **18\. Shipment Dashboard**

## **Screen ID**

**`OPS-SHP-001`**

## **Purpose**

**ควบคุม Consolidation, Shipment และ Import Status**

## **Summary Cards**

* **Waiting Consolidation**  
* **Consolidating**  
* **Ready to Ship**  
* **Departing This Week**  
* **In Transit**  
* **Arrived Thailand**  
* **Customs Clearance**  
* **Delayed**  
* **Ready for Delivery**

## **Columns**

* **Shipment Number**  
* **Customer Order**  
* **Shipment Type**  
* **Shipping Method**  
* **Origin Warehouse**  
* **Package Count**  
* **Weight**  
* **CBM**  
* **ETD**  
* **ETA**  
* **Current Status**  
* **Carrier**  
* **Tracking/Container**  
* **Responsible Logistics**  
* **Delay**

## **Filters**

* **Shipment Status**  
* **Shipping Method**  
* **Carrier**  
* **ETD**  
* **ETA**  
* **Customer Order**  
* **Logistics Owner**  
* **Delay**

---

# **19\. Shipment Operations Detail**

## **Screen ID**

**`OPS-SHP-002`**

## **Sections**

* **Shipment Summary**  
* **Included Supplier Orders**  
* **Included Order Items**  
* **Consolidation**  
* **Packages**  
* **Weight and CBM**  
* **Carrier**  
* **Container/Tracking**  
* **ETD/ETA**  
* **Tracking Events**  
* **Import Status**  
* **Documents**  
* **Delay**  
* **Delivery Readiness**  
* **Timeline**

## **Actions**

* **Confirm Consolidation**  
* **Add/Remove Items ก่อน Lock**  
* **Create Shipment**  
* **Update Tracking**  
* **Update ETD/ETA**  
* **Record Departure**  
* **Record Arrival Thailand**  
* **Update Customs Status**  
* **Mark Cleared**  
* **Mark Thailand Warehouse**  
* **Mark Ready for Delivery**  
* **Record Delay**  

## **Business Rules**

* **Shipment Quantity ห้ามเกิน Warehouse-ready Quantity**  
* **Confirmed Shipment แก้ Item โดยตรงไม่ได้**  
* **Partial Shipment ต้องมี Reason**  
* **ETA Change ต้องเก็บค่าเดิมและค่าใหม่**  
* **Customs Status ต้องมีวันที่**  
* **Shipment ของ MVP รวมสินค้าภายใน Customer Order เดียวกัน**

---

# **20\. Delivery Dashboard**

## **Screen ID**

**`OPS-DLV-001`**

## **Purpose**

**ควบคุมการนัดหมายและส่งมอบในประเทศไทย**

## **Summary Cards**

* **Ready to Schedule**  
* **Waiting Member Confirmation**  
* **Scheduled Today**  
* **Scheduled This Week**  
* **Out for Delivery**  
* **Delivered**  
* **Partial Delivery**  
* **Delivery Issues**  
* **Failed Delivery**

## **Columns**

* **Delivery Number**  
* **Customer Order**  
* **Project**  
* **Member**  
* **Delivery Address**  
* **Appointment Date**  
* **Time Window**  
* **Shipment**  
* **Item Count**  
* **Delivery Status**  
* **Member Confirmation**  
* **Driver/Team**  
* **Proof Status**  
* **Issue Flag**

## **Filters**

* **Delivery Status**  
* **Appointment Date**  
* **Member**  
* **Province**  
* **Delivery Team**  
* **Confirmation**  
* **Issue**  
* **Shipment**

---

# **21\. Delivery Operations Detail**

## **Screen ID**

**`OPS-DLV-002`**

## **Sections**

* **Delivery Summary**  
* **Address Snapshot**  
* **Site Contact**  
* **Appointment**  
* **Items**  
* **Quantities**  
* **Shipment Reference**  
* **Access Notes**  
* **Delivery Team**  
* **Proof of Delivery**  
* **Receiver**  
* **Delivery Issues**  
* **Related Claim**  
* **Timeline**

## **Actions**

* **Propose Appointment**  
* **Confirm Appointment**  
* **Reschedule**  
* **Assign Delivery Team**  
* **Mark Out for Delivery**  
* **Mark Arrived**  
* **Record Delivered Quantity**  
* **Upload Proof**  
* **Record Recipient**  
* **Mark Partial Delivery**  
* **Mark Delivered with Issue**  
* **Mark Failed**  
* **Create Claim**

## **Business Rules**

* **Delivered ต้องมีผู้รับ วันที่ และหลักฐาน**  
* **Partial Delivery ต้องมี Remaining Quantity**  
* **Delivery Issue ต้องระบุ Item และหลักฐาน**  
* **Failed Delivery ต้องมี Reason**  
* **Address Change หลัง Order ต้องผ่าน Review**  
* **Delivery Complete เมื่อ Item Quantity ถูกส่งครบ**

---

# **22\. Claim Dashboard**

## **Screen ID**

**`OPS-CLM-001`**

## **Purpose**

**ควบคุมปัญหาหลังส่งมอบและการแก้ไข**

## **Summary Cards**

* **New Claims**  
* **Waiting Review**  
* **Waiting Information**  
* **Coordinating Supplier**  
* **Repair Approved**  
* **Replacement Approved**  
* **Resolution Proposed**  
* **Overdue Claims**  
* **Closed Claims**

## **Columns**

* **Claim Number**  
* **Member**  
* **Order**  
* **Delivery**  
* **Product/Item**  
* **Claim Type**  
* **Severity**  
* **Submitted Date**  
* **Current Status**  
* **Assigned Owner**  
* **Supplier**  
* **Target Resolution Date**  
* **Overdue**

## **Filters**

* **Status**  
* **Claim Type**  
* **Severity**  
* **Supplier**  
* **Product Category**  
* **Assigned Owner**  
* **Submitted Date**  
* **Overdue**  
* **Resolution Type**

---

# **23\. Claim Operations Detail**

## **Screen ID**

**`OPS-CLM-002`**

## **Sections**

* **Claim Summary**  
* **Member**  
* **Order**  
* **Delivery**  
* **Affected Items**  
* **Quantity**  
* **Issue Description**  
* **Evidence**  
* **Delivery Proof**  
* **QC History**  
* **Supplier Order**  
* **Internal Investigation**  
* **Supplier Coordination**  
* **Proposed Resolution**  
* **Cost**  
* **Member Response**  
* **Timeline**

## **Actions**

* **Assign Owner**  
* **Start Review**  
* **Request Information**  
* **Record Investigation**  
* **Contact Supplier**  
* **Add Supplier Response**  
* **Propose Resolution**  
* **Approve Repair**  
* **Approve Replacement**  
* **Record Compensation**  
* **Mark Resolved**  
* **Close Claim**  
* **Reject Claim ตาม Permission**

## **Business Rules**

* **Claim ต้องเชื่อม Delivered Order Item**  
* **Quantity ที่เคลมห้ามเกิน Delivered Quantity**  
* **การ Reject ต้องมีเหตุผล**  
* **Resolution ต้องมีประเภทและรายละเอียด**  
* **Claim `REJECTED` ต้องมี Rejection Reason**  
* **Claim `CLOSED` ต้องมี Resolution และ Member Confirmation/Admin Review ตามประเภทเคส**  
* **Claim ที่ปิดแล้วเปิดใหม่ต้องใช้ Reopen Action พร้อมเหตุผล**  
* **Claim Cost แสดงเฉพาะผู้มี Permission**

---

# **24\. Activity Timeline**

## **Screen ID**

**`ACT-001`**

## **Purpose**

**รวมประวัติการดำเนินงานจากทุก Module**

## **Timeline Events**

* **Order Created**  
* **Payment Verified**  
* **Supplier Order Created**  
* **PO Issued**  
* **Factory Confirmed**  
* **Production Updated**  
* **Delay Recorded**  
* **QC Created**  
* **QC Passed**  
* **Rework Requested**  
* **Member Approved Custom QC**  
* **Warehouse Received**  
* **Consolidation Confirmed**  
* **Shipment Departed**  
* **Arrived Thailand**  
* **Customs Cleared**  
* **Delivery Scheduled**  
* **Delivered**  
* **Claim Created**  
* **Claim Resolved**  

## **Timeline Fields**

* **Event Date/Time**  
* **Event Type**  
* **Module**  
* **Entity Number**  
* **User**  
* **Description**  
* **Previous Status**  
* **New Status**  
* **Visibility**  
* **Attachments**  

## **Visibility**

* **Internal Only**  
* **Member Visible**  
* **Restricted by Role**

## **Business Rules**

* **Timeline Event สำคัญสร้างจาก Backend**  
* **Timeline ห้ามแก้ข้อความหลักที่สร้างโดยระบบ**  
* **Manual Note ต้องระบุผู้เขียน**  
* **Member-visible Note ต้องผ่าน Permission**  
* **Timeline ไม่แทน Audit Log**

---

# **25\. Priority Model**

**ระดับความสำคัญ**

* **Low**  
* **Normal**  
* **High**  
* **Critical**

## **Critical ตัวอย่าง**

* **Payment Verified แต่ยังไม่ออก PO เกินกำหนด**  
* **Production Delay กระทบวันส่ง**  
* **QC พบปัญหาร้ายแรง**  
* **สินค้าสูญหายหรือเสียหาย**  
* **Shipment Hold**  
* **Customs Issue**  
* **Delivery Failed**  
* **Claim Severity สูง**

**Priority ต้องไม่เปลี่ยน State Machine แต่ใช้จัดลำดับงานและ Notification**

---

# **26\. Delay Management**

**Entity ที่รองรับ Delay**

* **Supplier Order**  
* **Production**  
* **QC**  
* **Warehouse Receipt**  
* **Shipment**  
* **Delivery**  
* **Claim**  

## **Delay Information**

* **Original Due Date**  
* **Current Due Date**  
* **Delay Start Date**  
* **Delay Reason**  
* **Responsible Party**  
* **Impact**  
* **Recovery Plan**  
* **Member-visible Message**  
* **Internal Note**

## **Business Rules**

* **เปลี่ยนวันที่โดยไม่เก็บ Original Date ไม่ได้**  
* **Delay ต้องมีเหตุผล**  
* **Significant Delay ต้องสร้าง Notification**  
* **Delay Closed เมื่อมี New Confirmed Date หรือ Entity เสร็จแล้ว**

---

# **27\. Status Summary Rules**

## **Customer Order Summary**

**ต้องคำนวณจาก**

* **Payment**  
* **Supplier Orders**  
* **Production**  
* **QC**  
* **Shipment**  
* **Delivery**  
* **Freight**

## **Production Summary**

**ตัวอย่าง**

* **3 Supplier Orders**  
* **1 Completed**  
* **1 In Production**  
* **1 Delayed**

## **QC Summary**

**ตัวอย่าง**

* **2 Passed**  
* **1 Rework**  
* **1 Waiting Member Approval**

## **Logistics Summary**

**ตัวอย่าง**

* **Shipment 1 In Transit**  
* **Shipment 2 Planning**

**ระบบต้องไม่ลดข้อมูลหลายสถานะให้เหลือคำที่ทำให้เข้าใจผิด**

---

# **28\. Core Business Rules**

## **Customer Order**

1. **Customer Order ต้องเชื่อม Project**  
2. **Customer Order ต้องมี Supplier Order อย่างน้อยหนึ่งรายการหลังแยก Order**  
3. **Order Status รวมต้องคำนวณจาก Entity ที่เกี่ยวข้อง**  
4. **Order On Hold ต้องมีเหตุผล**  
5. **Completed Order แก้ Workflow หลักไม่ได้**

## **Supplier Order**

6. **Supplier Order ต้องมี Supplier เดียว**  
7. **Supplier Order ต้องเชื่อม Customer Order**  
8. **PO ออกได้หลัง Deposit Verified**  
9. **Factory Confirmation ต้องมีวันที่**  
10. **Estimated Completion ต้องถูกเก็บเป็น Version เมื่อเปลี่ยน**  
11. **Ready for Dispatch ต้องผ่าน QC**

## **Production**

12. **Production Update ต้องมีวันที่และผู้บันทึก**  
13. **Production Completed ต้องมี Actual Completion Date**  
14. **Delay ต้องมีเหตุผลและวันที่ใหม่**  
15. **Production Media ต้องเชื่อม Update หรือ Supplier Order**

## **QC**

16. **QC ต้องเชื่อม Supplier Order หรือ Item**  
17. **QC Pass ต้องมี Checklist หรือผลตรวจ**  
18. **Rework ต้องมี Issue และ Corrective Action**  
19. **Reinspection ต้องเชื่อม QC เดิม**  
20. **Custom Product ต้อง Member Approve ก่อน Shipping**

## **Warehouse**

21. **Warehouse Receipt ต้องเชื่อม Supplier Order**  
22. **Received Quantity ต้องเก็บต่อ Item**  
23. **Discrepancy ต้องมี Evidence หรือ Note**  
24. **Quantity ที่ยังไม่รับเข้าไม่สามารถนำไป Shipment ได้**  
25. **Weight และ CBM จริงต้องแยกจากค่าประมาณสินค้า**

## **Shipment**

26. **Shipment ต้องมี Item และ Quantity**  
27. **Shipment Quantity ห้ามเกิน Warehouse-ready Quantity**  
28. **Partial Shipment ต้องมี Reason**  
29. **ETD และ ETA เปลี่ยนต้องเก็บประวัติ**  
30. **MVP ไม่รวมหลาย Customer Orders ใน Shipment เดียว**

## **Delivery**

31. **Delivery ต้องเชื่อม Shipment หรือ Order Item**  
32. **Delivered ต้องมี Proof**  
33. **Partial Delivery ต้องคง Remaining Quantity**  
34. **Delivered with Issue ต้องระบุ Item**  
35. **Delivery Failed ต้องมี Reason**

## **Claim**

36. **Claim ต้องเชื่อม Delivered Item**  
37. **Claim Quantity ห้ามเกิน Delivered Quantity**  
38. **Resolution ต้องมีประเภท**  
39. **Claim `REJECTED` ต้องมี Rejection Reason; Claim `CLOSED` ต้องมี Resolution และการยืนยันผล**  
40. **Claim Cost เป็นข้อมูลภายใน**

## **28.1 Timeline**

44. **Timeline Event สำคัญต้องสร้างจาก Backend**  
45. **Internal Timeline และ Member Timeline ต้องแยก Visibility**

---

# **29\. Permission Matrix**

| Function | Order Admin | Purchasing | Production | QC | Warehouse | Logistics | Delivery | Claim | Ops Manager |
| ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- |
| **ดู Customer Order** | **Yes** | **Yes** | **Yes** | **Yes** | **Yes** | **Yes** | **Yes** | **Yes** | **Yes** |
| **แก้ Order Operation** | **Yes** | **Limited** | **No** | **No** | **No** | **No** | **No** | **No** | **Yes** |
| **ออก PO** | **Limited** | **Yes** | **No** | **No** | **No** | **No** | **No** | **No** | **Yes** |
| **Update Production** | **View** | **Yes** | **Yes** | **View** | **No** | **No** | **No** | **No** | **Yes** |
| **สร้าง QC** | **View** | **Limited** | **Submit** | **Yes** | **No** | **No** | **No** | **No** | **Yes** |
| **Pass/Rework QC** | **No** | **No** | **No** | **Yes** | **No** | **No** | **No** | **No** | **Yes** |
| **Receive Warehouse** | **View** | **View** | **No** | **View** | **Yes** | **Limited** | **No** | **No** | **Yes** |
| **Create Shipment** | **View** | **View** | **No** | **No** | **View** | **Yes** | **No** | **No** | **Yes** |
| **Update Import** | **View** | **No** | **No** | **No** | **No** | **Yes** | **No** | **No** | **Yes** |
| **Create Delivery** | **View** | **No** | **No** | **No** | **View** | **Yes** | **Yes** | **No** | **Yes** |
| **Proof of Delivery** | **View** | **No** | **No** | **No** | **No** | **Limited** | **Yes** | **View** | **Yes** |
| **Manage Claim** | **View** | **View** | **View** | **View** | **View** | **View** | **View** | **Yes** | **Yes** |
| **Override Status** | **No** | **No** | **No** | **No** | **No** | **No** | **No** | **No** | **Limited** |
| **View Cost** | **ตามสิทธิ์** | **Yes** | **No** | **No** | **No** | **ตามสิทธิ์** | **No** | **ตามสิทธิ์** | **Yes** |

---

# **30\. API Scope**

## **Operations Overview**

**GET /api/admin/operations/dashboard**

**GET /api/admin/operations/action-required**

**GET /api/admin/operations/delays**

## **Orders**

**GET   /api/admin/orders**

**GET   /api/admin/orders/:id**

**POST  /api/admin/orders/:id/assign**

**POST  /api/admin/orders/:id/hold**

**POST  /api/admin/orders/:id/resume**

**POST  /api/admin/orders/:id/priority**

**GET   /api/admin/orders/:id/timeline**

## **Supplier Orders**

**GET   /api/admin/supplier-orders**

**GET   /api/admin/supplier-orders/:id**

**POST  /api/admin/supplier-orders/:id/assign**

**POST  /api/admin/supplier-orders/:id/factory-confirm**

**POST  /api/admin/supplier-orders/:id/hold**

**POST  /api/admin/supplier-orders/:id/resume**

## **Production**

**GET   /api/admin/production**

**GET   /api/admin/production/:supplierOrderId**

**POST  /api/admin/supplier-orders/:id/production-updates**

**PATCH /api/admin/production-updates/:id**

**POST  /api/admin/supplier-orders/:id/mark-delay**

**POST  /api/admin/supplier-orders/:id/submit-qc**

## **QC**

**GET   /api/admin/qc**

**GET   /api/admin/qc/:id**

**POST  /api/admin/qc**

**PATCH /api/admin/qc/:id**

**POST  /api/admin/qc/:id/pass**

**POST  /api/admin/qc/:id/rework**

**POST  /api/admin/qc/:id/reinspect**

**POST  /api/admin/qc/:id/request-member-approval**

## **Warehouse**

**GET   /api/admin/warehouse/receipts**

**POST  /api/admin/warehouse/receipts**

**GET   /api/admin/warehouse/receipts/:id**

**PATCH /api/admin/warehouse/receipts/:id**

**POST  /api/admin/warehouse/receipts/:id/complete**

**POST  /api/admin/warehouse/receipts/:id/report-discrepancy**

**POST  /api/admin/warehouse/receipts/:id/release**

## **Shipments**

**GET   /api/admin/shipments**

**POST  /api/admin/shipments**

**GET   /api/admin/shipments/:id**

**PATCH /api/admin/shipments/:id**

**POST  /api/admin/shipments/:id/status**

**POST  /api/admin/shipments/:id/delay**

**POST  /api/admin/shipments/:id/tracking-events**

## **Deliveries**

**GET   /api/admin/deliveries**

**POST  /api/admin/deliveries**

**GET   /api/admin/deliveries/:id**

**PATCH /api/admin/deliveries/:id**

**POST  /api/admin/deliveries/:id/status**

**POST  /api/admin/deliveries/:id/proof**

**POST  /api/admin/deliveries/:id/issue**

## **Claims**

**GET   /api/admin/claims**

**GET   /api/admin/claims/:id**

**PATCH /api/admin/claims/:id**

**POST  /api/admin/claims/:id/assign**

**POST  /api/admin/claims/:id/request-information**

**POST  /api/admin/claims/:id/resolution**

**POST  /api/admin/claims/:id/resolve**

**POST  /api/admin/claims/:id/close**

## **30.1 Activity Timeline**

**GET /api/admin/activity**

**GET /api/admin/entities/:type/:id/activity**

# **31\. Basic Operations KPI**

## **Order**

* **Active Orders**  
* **Orders Requiring Action**  
* **Order Cycle Time**  
* **Orders On Hold**  
* **Cancellation Requests**

## **Purchasing**

* **Time from Deposit Verified to PO**  
* **Factory Confirmation Time**  
* **Supplier Orders Delayed**  
* **PO Accuracy**

## **Production**

* **Production On-time Rate**  
* **Average Production Lead Time**  
* **Delayed Production**  
* **Update Compliance**  
* **Rework Impact**

## **QC**

* **First-pass QC Rate**  
* **Rework Rate**  
* **Average QC Time**  
* **Reinspection Rate**  
* **Member Approval Time**

## **Warehouse**

* **On-time Receipt Rate**  
* **Receipt Discrepancy Rate**  
* **Damage Rate**  
* **Average Time to Release for Consolidation**

## **Shipment**

* **Consolidation Waiting Time**  
* **Shipment On-time Departure**  
* **ETA Accuracy**  
* **Customs Clearance Time**  
* **Partial Shipment Rate**

## **Delivery**

* **On-time Delivery Rate**  
* **First-attempt Delivery Rate**  
* **Partial Delivery Rate**  
* **Delivery Issue Rate**  
* **Proof Completion Rate**

## **Claim**

* **Claim Rate**  
* **Average Review Time**  
* **Resolution Time**  
* **Claims by Supplier**  
* **Claims by Category**

# **32\. MVP Must Have**

* **Operations Center Dashboard**  
* **Action Required**  
* **Delayed Work**  
* **Order Dashboard**  
* **Order Operations Detail**  
* **Supplier Order Dashboard**  
* **Supplier Order Detail**  
* **Finance Status สำหรับ Operations**  
* **Production Dashboard**  
* **Production Updates**  
* **QC Dashboard**  
* **QC Inspection**  
* **Rework และ Reinspection**  
* **Warehouse Dashboard**  
* **Warehouse Receipt**  
* **Discrepancy**  
* **Shipment Dashboard**  
* **Shipment Tracking**  
* **Import Status**  
* **Delivery Dashboard**  
* **Proof of Delivery**  
* **Delivery Issue**  
* **Claim Dashboard**  
* **Claim Processing**  
* **Transaction Assignment, Due Date และ Action Required**  
* **Activity Timeline**  
* **Role และ Permission**  
* **Audit สำหรับ Status Change**

---

# **33\. ขอบเขตที่นำออกจาก Core MVP**

รายการอนาคตถูกแยกไว้ที่ `docs/post-mvp/POST-MVP BACKLOG.md` และไม่มีผลต่อ Acceptance ของ Part B

---

# **34\. Acceptance Criteria**

**Part B ถือว่าสมบูรณ์เมื่อ**

1. **Operations Dashboard แสดงงานสำคัญได้**  
2. **Dashboard เชื่อมไป Record ที่เกี่ยวข้องได้**  
3. **Customer Order แสดงสถานะรวมได้**  
4. **Order Detail เชื่อม Supplier Orders ได้**  
5. **ทีมงานมอบหมายเจ้าของ Order ได้**  
6. **Order Hold และ Resume ตาม Permission ได้**  
7. **Supplier Order Dashboard แยกตามโรงงานได้**  
8. **Supplier Order แสดง PO, Production, QC และ Warehouse ได้**  
9. **ห้ามออก PO ก่อน Deposit Verified**  
10. **Finance Operations แสดง Blocking Payment ได้**  
11. **Production Dashboard แสดงงานล่าช้าได้**  
12. **Production Update เก็บ Progress วันที่ และผู้บันทึกได้**  
13. **Production Delay เก็บ Original และ Updated Date ได้**  
14. **Production ส่งเข้า QC ได้**  
15. **QC Dashboard แสดง Waiting, Rework และ Approval ได้**  
16. **QC Checklist และ Evidence ถูกบันทึกได้**  
17. **Rework เชื่อมกับ Inspection เดิมได้**  
18. **Custom QC รอ Member Approval ได้**  
19. **Warehouse Dashboard แสดง Expected และ Received ได้**  
20. **Warehouse Receipt บันทึก Quantity, Package, Weight และ CBM ได้**  
21. **Discrepancy และ Damage มีหลักฐานได้**  
22. **สินค้าที่ไม่ได้รับเข้าไม่ถูกนำไป Shipment**  
23. **Shipment Dashboard แสดง Consolidation และ Transit ได้**  
24. **Shipment Quantity ไม่เกิน Warehouse-ready Quantity**  
25. **Partial Shipment มี Reason ได้**  
26. **ETD/ETA เปลี่ยนแล้วเก็บประวัติได้**  
27. **Import Status อัปเดตได้**  
28. **Delivery Dashboard แสดงนัดหมายและสถานะได้**  
29. **Delivery บันทึก Proof และ Receiver ได้**  
30. **Partial Delivery เก็บ Remaining Quantity ได้**  
31. **Delivered with Issue เชื่อม Claim ได้**  
32. **Claim Dashboard แสดง Action Required ได้**  
33. **Claim เชื่อม Delivered Item ได้**  
34. **Claim Resolution และ Timeline ถูกบันทึกได้**  
35. **Assignment/Due Date ถูกเก็บบน Business Record ที่เกี่ยวข้องได้**  
36. **Transaction ที่เกิน Due Date แสดงเป็น Action Required ได้**  
37. **Activity Timeline รวม Event สำคัญได้**  
38. **Internal และ Member-visible Timeline แยกกันได้**  
39. **ผู้ไม่มี Permission เปลี่ยนสถานะผ่าน API ไม่ได้**  
40. **ทุก Status Change สำคัญมี Audit Log**  
41. **หน้าหลักใช้งานบน Tablet ได้**  
42. **ทุกหน้าหลักมี Loading, Empty และ Error State ขั้นพื้นฐาน**  
43. **Operations Manager ดูงานข้ามทีมได้**  
44. **Cost และ Supplier Payment ไม่แสดงต่อผู้ไม่มีสิทธิ์**  
45. **Workflow จาก Deposit Verified ถึง Delivery เชื่อมต่อกันได้ครบ**

---

# **35\. Codex Development Scope**

**แบ่งเป็น 4 Workstreams**

## **Workstream B1: Order Control**

* **Operations Dashboard**  
* **Order Dashboard**  
* **Order Detail**  
* **Supplier Order Dashboard**  
* **Supplier Order Detail**  
* **Finance Blocking Status**

## **Workstream B2: Production and QC**

* **Production Dashboard**  
* **Production Update**  
* **Delay**  
* **QC Dashboard**  
* **Inspection**  
* **Rework**  
* **Reinspection**  
* **Member Approval Status**

## **Workstream B3: Warehouse, Shipment and Delivery**

* **Warehouse Dashboard**  
* **Warehouse Receipt**  
* **Discrepancy**  
* **Consolidation**  
* **Shipment Dashboard**  
* **Tracking**  
* **Import**  
* **Delivery Dashboard**  
* **Proof of Delivery**

## **Workstream B4: Claim, Transaction Assignment and Timeline**

* **Claim Dashboard**  
* **Claim Detail**  
* **Resolution**  
* **Assignment และ Due Date บน Claim/Transaction**  
* **Action Required ตาม Role**  
* **Overdue Transaction**  
* **Activity Timeline**

**Codex ต้องพัฒนาเฉพาะรายการใน Part B นี้ และห้ามเพิ่มระบบ Operations หรือ Automation ที่อยู่นอก MVP**
