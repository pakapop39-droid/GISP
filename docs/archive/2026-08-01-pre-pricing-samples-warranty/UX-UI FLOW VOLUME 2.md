# **GLOBAL INTERIOR SUPPLY PLATFORM**

## **GISP – UX/UI FLOW SPECIFICATION**

## **VOLUME 2: ORDER, PAYMENT, PRODUCTION, QC, LOGISTICS, DELIVERY AND CLAIM**

**Document Version:** 2.0  
**Reconciled Date:** 1 สิงหาคม 2569 (2026-08-01)  
**Authority:** UX/UI Reference ภายใต้ `MVP BUSINESS MASTER PLAN.md` และ `DECISION LOG.md`  
**Change Summary:** ปรับ Core Payment/Cancellation/Freight และ Canonical State ตาม DEC-032/DEC-033  
**Document Type:** UX/UI Flow and Screen Specification  
**Project Stage:** MVP  
**Primary Platform:** Responsive Web Application  
**Primary Language:** ภาษาไทย  
**Initial Market:** ประเทศไทย

**Related Documents**

1. GISP – MVP Business Master Plan  
2. GISP – Database Schema Specification  
3. GISP – UX/UI Flow Specification Volume 1  
4. GISP – Codex Development Specification

---

# **0\. RECONCILED UX CONTRACT**

* Member Price เป็นราคาก่อน VAT และเอกสารแสดง Subtotal/VAT/Grand Total
* Deposit และ Balance อย่างละ 50% ของ Grand Total แบ่งโอนได้หลายครั้ง; Freight แยก
* Payment เปลี่ยนเป็น Verified เมื่อ Finance ยืนยันยอดสะสมครบเท่านั้น
* State Transition ทุกชนิดเรียก Action Endpoint ห้ามแก้ Status ตรงจาก UI
* Dispatch Gate ต้องผ่าน QC, Custom Member Approval, Customer Balance Verified และ Supplier Balance Paid
* Assignment, Due Date และ Action Required ใช้เฉพาะ Transaction ที่จำเป็น
* ความสามารถนอก Core แยกไว้ใน `docs/post-mvp/POST-MVP BACKLOG.md`
* Customer Payment/Order ใช้ `VERIFIED` หลัง Finance ตรวจ ห้ามใช้ `PAID` แทนสถานะที่ต้อง Verify
* Claim `REJECTED` ต้องมี Rejection Reason; Claim `CLOSED` ต้องมี Resolution และการยืนยันผล

---

# **1\. วัตถุประสงค์ของเอกสาร**

เอกสารฉบับนี้กำหนด UX/UI และ Workflow ตั้งแต่สมาชิกเลือกสินค้าที่มีสถานะ “พร้อมสั่ง” ภายใน Project ไปจนถึงการสร้างออเดอร์ ชำระเงิน ติดตามการผลิต ตรวจสอบคุณภาพ รวมสินค้า ขนส่ง ส่งมอบ ชำระค่าขนส่ง และแจ้งเคลม

ขอบเขตของ Volume 2 ประกอบด้วย

1. Order Preparation  
2. Customer Order  
3. Supplier Order ภายใน  
4. Deposit Payment  
5. Finance Verification  
6. Purchase Order  
7. Production Tracking  
8. Quality Control  
9. Member Approval สำหรับสินค้า Custom  
10. Balance Payment  
11. Warehouse Receiving  
12. Consolidation  
13. Shipment  
14. Import และ Thailand Logistics  
15. Delivery Scheduling  
16. Proof of Delivery  
17. Freight Invoice และ Payment  
18. Claim และบริการหลังการขาย  
19. Cancellation Request  
20. Member Order Dashboard และ Timeline

Volume 2 ต้องเชื่อมต่อจาก Volume 1 โดยตรง แต่ไม่รวมหน้าจอจัดการ Product, Supplier, Finance Back Office และ Executive Report เชิงลึก ซึ่งจะอยู่ใน Volume 3

---

# **2\. จุดเริ่มต้นและจุดสิ้นสุดของ Volume 2**

## **2.1 จุดเริ่มต้น**

สมาชิกมี

* Project ที่ Active  
* Project Items อย่างน้อยหนึ่งรายการ  
* Item Status เป็น `Ready to Order`  
* Product ยังเปิดขาย  
* ราคาสมาชิก Active  
* Required Options ครบ  
* Quantity มากกว่า 0  
* Supplier ยัง Active  
* Custom Request ได้รับการยืนยันแล้ว หากเป็นสินค้า Custom

## **2.2 จุดสิ้นสุด**

Order ถือว่าจบกระบวนการเมื่อ

* ส่งมอบสินค้าครบ  
* มี Proof of Delivery  
* เรียกเก็บค่าขนส่งแล้ว  
* Finance ยืนยันค่าขนส่งครบ  
* ไม่มี Action สำคัญค้าง  
* Claim ที่เกี่ยวข้องได้รับการดำเนินการตามนโยบาย  
* Order Status เป็น `Completed`

---

# **3\. เป้าหมาย UX ของ Volume 2**

ระบบต้องทำให้สมาชิกเข้าใจกระบวนการที่ซับซ้อนได้โดยไม่ต้องเห็นโครงสร้างหลังบ้านทั้งหมด

เป้าหมายสำคัญคือ

* สมาชิกสร้างออเดอร์จากบางรายการใน Project ได้  
* สมาชิกเข้าใจว่าออเดอร์หนึ่งรายการอาจมาจากหลายโรงงาน  
* สมาชิกไม่ต้องจัดการ Supplier Order เอง  
* สมาชิกเห็นยอดมัดจำและยอดคงเหลืออย่างชัดเจน  
* สมาชิกอัปโหลดสลิปได้ง่าย  
* สมาชิกติดตาม Production และ Shipment ได้ใน Timeline เดียว  
* สมาชิกเห็นสถานะแยกตามกลุ่มสินค้าเมื่อแต่ละโรงงานไม่พร้อมพร้อมกัน  
* สมาชิกดูรูปและรายงาน QC ได้  
* สินค้า Custom ต้องได้รับการอนุมัติก่อนจัดส่ง  
* สมาชิกทราบเมื่อมีค่าใช้จ่ายหรือ Action ที่ต้องทำ  
* การจัดส่งบางส่วนต้องอธิบายผลกระทบชัดเจน  
* การส่งมอบต้องมีหลักฐาน  
* การแจ้งปัญหาต้องเชื่อมกับรายการสินค้าที่ได้รับจริง

---

# **4\. หลักการออกแบบประสบการณ์ Order**

## **4.1 Member เห็น Customer Order เป็นหลัก**

สมาชิกไม่ควรต้องเข้าใจโครงสร้าง PO ภายในทุกโรงงาน

หน้าหลักของสมาชิกแสดง

Customer Order  
├── สินค้ากลุ่มที่ 1  
├── สินค้ากลุ่มที่ 2  
└── สินค้ากลุ่มที่ 3

ระบบสามารถแสดงคำว่า “กลุ่มการผลิต” หรือชื่อโรงงานตามนโยบาย แต่ไม่แสดง

* Factory Cost  
* Supplier Payment  
* Internal Margin  
* Internal PO Note  

## **4.2 Admin เห็น Supplier Order**

หลังบ้านแสดง

Customer Order ORD-2026-000001  
├── Supplier Order SO-2026-000001  
├── Supplier Order SO-2026-000002  
└── Supplier Order SO-2026-000003

## **4.3 Timeline เดียวสำหรับ Member**

สมาชิกควรเห็น Timeline ภาพรวมเดียว เช่น

ยืนยันออเดอร์  
→ ชำระมัดจำ  
→ บริษัทตรวจสอบเงิน  
→ โรงงานยืนยัน  
→ อยู่ระหว่างผลิต  
→ ตรวจสินค้า  
→ ชำระยอดคงเหลือ  
→ รวมสินค้า  
→ ขนส่งเข้าประเทศไทย  
→ นัดส่ง  
→ ส่งมอบ  
→ ชำระค่าขนส่ง

รายละเอียดโรงงานแยกเปิดดูได้เมื่อจำเป็น

## **4.4 Action Required First**

Order Detail ต้องแสดง Action ที่สมาชิกต้องทำไว้ด้านบนเสมอ เช่น

* ชำระมัดจำ  
* อัปโหลดหลักฐาน  
* อนุมัติ QC  
* ชำระยอดคงเหลือ  
* ยืนยันวันส่ง  
* ชำระค่าขนส่ง  
* เพิ่มข้อมูล Claim

---

# **5\. Information Architecture Volume 2**

## **5.1 Member Navigation เพิ่มเติม**

Orders  
├── ออเดอร์ทั้งหมด  
├── รอชำระมัดจำ  
├── กำลังผลิต  
├── รอชำระยอดคงเหลือ  
├── อยู่ระหว่างขนส่ง  
├── รอส่งมอบ  
├── รอชำระค่าขนส่ง  
└── เสร็จสมบูรณ์

Payments  
├── รายการรอชำระ  
├── ประวัติการชำระ  
└── เอกสารการเงิน

QC Approvals  
├── รออนุมัติ  
└── ประวัติ

Deliveries  
├── นัดหมายส่งมอบ  
└── ประวัติส่งมอบ

Claims  
├── เคสทั้งหมด  
├── เปิดเคสใหม่  
└── เคสที่ต้องดำเนินการ

## **5.2 Member Routes**

/member/orders  
/member/orders/create  
/member/orders/\[orderId\]  
/member/orders/\[orderId\]/items  
/member/orders/\[orderId\]/payments  
/member/orders/\[orderId\]/production  
/member/orders/\[orderId\]/qc  
/member/orders/\[orderId\]/shipments  
/member/orders/\[orderId\]/deliveries  
/member/orders/\[orderId\]/documents

/member/payments  
/member/qc-approvals  
/member/deliveries  
/member/claims  
/member/claims/new  
/member/claims/\[claimId\]

## **5.3 Admin Operational Routes ที่เกี่ยวข้อง**

/admin/orders  
/admin/orders/\[orderId\]

/admin/supplier-orders  
/admin/supplier-orders/\[supplierOrderId\]  
/admin/supplier-orders/\[supplierOrderId\]/po  
/admin/supplier-orders/\[supplierOrderId\]/production  
/admin/supplier-orders/\[supplierOrderId\]/qc  
/admin/supplier-orders/\[supplierOrderId\]/payments

/admin/payments/customer  
/admin/payments/customer/\[paymentId\]

/admin/warehouses/receipts  
/admin/consolidations  
/admin/shipments  
/admin/deliveries  
/admin/claims

รายละเอียด UX ของ Back Office ทั้งหมดจะขยายใน Volume 3 แต่ Volume 2 กำหนดหน้าปฏิบัติงานที่จำเป็นต่อ Workflow

---

# **6\. Screen Inventory Volume 2**

## **Order Preparation และ Customer Order**

1. Ready-to-Order Selection  
2. Order Eligibility Check  
3. Create Order – Item Review  
4. Create Order – Delivery Review  
5. Create Order – Payment Terms  
6. Create Order – Final Confirmation  
7. Order Created Success  
8. Order Listing  
9. Order Detail  
10. Order Items  
11. Order Timeline  
12. Order Documents  
13. Cancellation Request

## **Payment**

14. Deposit Invoice  
15. Upload Deposit Slip  
16. Payment Submitted  
17. Payment Rejected  
18. Payment Verified  
19. Balance Invoice  
20. Upload Balance Slip  
21. Payment History  
22. Freight Invoice  
23. Upload Freight Slip

## **Supplier Order และ PO**

24. Supplier Order List  
25. Supplier Order Detail  
26. PO Preview  
27. Issue PO Confirmation  
28. Factory Confirmation  
29. Supplier Payment Record

## **Production**

30. Production Overview  
31. Production Group Detail  
32. Production Update Form  
33. Production Media Gallery  
34. Delay State

## **QC**

35. QC Overview  
36. QC Inspection Detail  
37. QC Media Gallery  
38. Standard Product QC Result  
39. Custom Product Approval  
40. Request Additional Review  
41. Rework Tracking  
42. Reinspection Result

## **Warehouse และ Logistics**

43. Warehouse Receipt List  
44. Warehouse Receipt Detail  
45. Quantity Discrepancy  
46. Consolidation Planning  
47. Consolidation Detail  
48. Partial Shipment Decision  
49. Shipment Creation  
50. Shipment Detail  
51. Shipment Tracking  
52. Delay Notification  
53. Import Status

## **Delivery**

54. Delivery Scheduling  
55. Delivery Appointment Detail  
56. Delivery Confirmation  
57. Proof of Delivery  
58. Delivered with Issue  
59. Partial Delivery

## **Claim**

60. Claim Listing  
61. Create Claim  
62. Select Claim Items  
63. Upload Evidence  
64. Claim Detail  
65. Claim Timeline  
66. Resolution Confirmation

รวมประมาณ 66 หน้าจอหรือ Screen State หลัก

---

# **7\. Order Creation Entry Points**

สมาชิกสร้าง Order ได้จาก

* Project Overview  
* Project Item Listing  
* Dashboard Action Required  
* Ready-to-Order Item Summary

ปุ่มหลัก

`สร้างออเดอร์`

ปุ่มต้องแสดงจำนวนรายการที่เลือกได้ เช่น

> สร้างออเดอร์จาก 8 รายการ

---

# **8\. Ready-to-Order Selection**

## **Screen ID**

`ORD-001`

## **Route**

`/member/projects/[projectId]/create-order`

## **Purpose**

ให้สมาชิกเลือกเฉพาะ Project Items ที่ต้องการสั่งในครั้งนี้

## **Page Header**

* Project Name  
* Project Code  
* Customer  
* Site Address  
* จำนวนรายการพร้อมสั่ง  
* มูลค่ารวมโดยประมาณ

## **Item Grouping**

แนะนำให้แสดงตาม Area เป็นค่าเริ่มต้น

Living Room  
☐ Sofa A  
☐ Armchair B

Master Bedroom  
☐ Bed C  
☐ Wardrobe D

สามารถสลับ Group By

* Area  
* Category  
* Supplier/Production Group

## **Item Row**

* Checkbox  
* Product Image  
* Product Code  
* Product Name  
* Area  
* Options  
* Available Quantity  
* Quantity to Order  
* Unit Price  
* Line Total  
* Lead Time  
* Validation Status

## **Quantity to Order**

สมาชิกสามารถสั่งน้อยกว่า Remaining Quantity ได้

ตัวอย่าง

* Project Quantity: 10  
* Ordered Previously: 4  
* Remaining: 6  
* Order This Time: 3

## **Sticky Summary**

แสดง

* จำนวนรายการ  
* จำนวนชิ้น  
* มูลค่ารวมสินค้า  
* ปุ่ม `ตรวจสอบออเดอร์`

---

# **9\. Order Eligibility Check**

## **Screen ID**

`ORD-002`

ระบบตรวจสอบก่อนเข้าสู่ขั้นตอน Review

## **Validation**

* Member Active  
* Project Active  
* Item Status เป็น Ready to Order  
* Remaining Quantity มากกว่า 0  
* Product Orderable  
* Supplier Active  
* Member Price Active  
* Required Options ครบ  
* Custom Quote ยัง Valid  
* Quantity ไม่เกิน Remaining  
* ไม่มี Item ถูก Lock โดย Order Creation อื่น

## **Validation Result**

### **ผ่านทั้งหมด**

ไปขั้นตอน Order Review

### **มี Warning**

เช่น Lead Time ต่างกันมาก

สมาชิกดำเนินการต่อได้หลังรับทราบ

### **มี Blocking Error**

รายการที่มีปัญหาถูกแยกไว้

Actions

* แก้ไขรายการ  
* เอารายการออกจากออเดอร์  
* ติดต่อทีมงาน

## **Example Message**

> สินค้า SOFA-001 ไม่สามารถสั่งได้ เนื่องจากตัวเลือกผ้า F003 ถูกระงับ กรุณาเลือกตัวเลือกใหม่

---

# **10\. Create Order Step Flow**

แนะนำเป็น 4 Steps

1 ตรวจรายการ  
→ 2 ตรวจสถานที่ส่ง  
→ 3 ตรวจการชำระ  
→ 4 ยืนยันออเดอร์

Progress Indicator ต้องแสดงบน Desktop และ Mobile

---

# **11\. Step 1: Item Review**

## **Screen ID**

`ORD-003`

## **Purpose**

ให้สมาชิกตรวจสินค้า ราคา และสเปกก่อน Lock

## **Sections**

* Items by Area  
* Product Image  
* Product Code  
* Product Name  
* Dimensions  
* Selected Options  
* Remark  
* Quantity  
* Member Unit Price  
* Line Total  
* Estimated Lead Time

## **Price Notice**

> ราคาจะถูกล็อกเมื่อยืนยันออเดอร์ การเปลี่ยนราคาสินค้าในอนาคตจะไม่กระทบออเดอร์นี้

## **Freight Notice**

> ยอดนี้เป็นราคาสินค้า ยังไม่รวมค่าขนส่ง ค่านำเข้า ภาษี และค่าจัดส่งหน้างาน ซึ่งจะสรุปและเรียกเก็บแยกภายหลัง

## **Edit Rule**

สมาชิกสามารถย้อนกลับไปแก้

* Quantity  
* Area Reference  
* Remark ที่ไม่เปลี่ยนสเปก

หากแก้ Option หรือ Spec ต้องกลับ Project Item และผ่าน Validation ใหม่

---

# **12\. Step 2: Delivery Review**

## **Screen ID**

`ORD-004`

## **Purpose**

ตรวจสอบสถานที่ส่งหลักของ Project

## **Display**

* Customer  
* Project  
* Site Address  
* Google Maps  
* Site Contact  
* Contact Phone  
* Access Note  
* Expected Need Date

## **Business Rule**

Order ใช้ที่อยู่หลักจาก Project

หากสมาชิกต้องการแก้

* กลับไปแก้ Project Address  
* ระบบเตือนว่าการเปลี่ยนจะมีผลกับออเดอร์ใหม่นี้  
* เมื่อยืนยัน Order ระบบ Snapshot Address

## **Delivery Expectation**

สมาชิกเลือกหรือระบุได้

* วันที่ต้องการโดยประมาณ  
* ช่วงเวลาที่หน้างานพร้อมรับ  
* ข้อจำกัด เช่น ลิฟต์ เวลาเข้าพื้นที่ หรือรถใหญ่เข้าไม่ได้

ข้อมูลนี้เป็น Planning Information ไม่ใช่วันรับประกันส่งมอบ

---

# **13\. Step 3: Payment Terms**

## **Screen ID**

`ORD-005`

## **Display**

### **ราคาสินค้า**

* Subtotal  
* Discount หากมี  
* Product Total

### **งวดชำระ**

* มัดจำ 50%  
* ยอดคงเหลือ 50%  
* ค่าขนส่งเรียกเก็บแยกภายหลัง

ตัวอย่าง

มูลค่าสินค้า                 ฿500,000.00  
มัดจำ 50%                    ฿250,000.00  
ยอดคงเหลือ 50%              ฿250,000.00  
ค่าขนส่งและนำเข้า            เรียกเก็บภายหลัง

## **Payment Terms Acknowledgement**

Checkbox

> ข้าพเจ้ารับทราบว่าราคาสินค้ายังไม่รวมค่าขนส่ง ค่านำเข้า ภาษี และค่าจัดส่งหน้างาน

Checkbox

> ข้าพเจ้ารับทราบว่าออเดอร์จะเริ่มดำเนินการหลังฝ่ายการเงินยืนยันเงินมัดจำ

## **Payment Method**

MVP

* Bank Transfer  
* Upload Slip

แสดงบัญชีบริษัทหลัง Order Created หรือใน Deposit Invoice

---

# **14\. Step 4: Final Confirmation**

## **Screen ID**

`ORD-006`

## **Purpose**

ตรวจสอบสรุปทั้งหมดก่อนสร้าง Order

## **Sections**

* Project  
* Customer  
* Delivery Address  
* Items  
* Price  
* Deposit  
* Balance  
* Terms  
* Member Note

## **Confirmation Checkbox**

> ข้าพเจ้ายืนยันรายการสินค้า จำนวน ตัวเลือก ราคา และข้อมูลสถานที่ส่งมอบตามที่แสดง

## **Primary Action**

`ยืนยันและสร้างออเดอร์`

## **Confirmation Dialog**

ข้อความต้องบอกผลกระทบ

> หลังยืนยัน ระบบจะล็อกราคาและสเปกของรายการนี้ และสร้างยอดมัดจำ 50% คุณยังสามารถยกเลิกได้ก่อนฝ่ายการเงินยืนยันเงินมัดจำ

Actions

* กลับไปตรวจสอบ  
* ยืนยันออเดอร์

---

# **15\. Order Creation Transaction UX**

เมื่อกดยืนยัน

แสดง Processing State

กำลังตรวจสอบรายการ  
กำลังล็อกราคาและสเปก  
กำลังแยกรายการตามโรงงาน  
กำลังสร้างใบแจ้งมัดจำ

ห้ามให้สมาชิกกดซ้ำ

หากสำเร็จไป Order Success

หากล้มเหลว

* Rollback ทั้งหมด  
* แสดง Error ที่เข้าใจได้  
* คงรายการที่เลือกไว้  
* มีปุ่มลองใหม่

---

# **16\. Order Created Success**

## **Screen ID**

`ORD-007`

## **Message**

> สร้างออเดอร์เรียบร้อยแล้ว กรุณาชำระเงินมัดจำเพื่อเริ่มดำเนินการ

## **Display**

* Order Number  
* Project  
* Product Total  
* Deposit Due  
* Due Date ถ้ามี  
* Payment Status  
* Bank Account  
* QR หรือข้อมูลโอน หากมีแบบ Static  
* Deposit Invoice Download

## **Actions**

Primary

`อัปโหลดหลักฐานการชำระ`

Secondary

* ดาวน์โหลดใบแจ้งมัดจำ  
* ดูรายละเอียดออเดอร์  
* กลับ Project

---

# **17\. Order Listing**

## **Screen ID**

`ORD-008`

## **Route**

`/member/orders`

## **Purpose**

แสดงออเดอร์ทั้งหมดของสมาชิก

## **Filters**

* Order Status  
* Project  
* Payment Status  
* Production Status  
* Shipment Status  
* Date  
* Action Required

## **Order Card**

* Order Number  
* Project Name  
* Customer  
* Order Date  
* Product Total  
* Current Status  
* Payment Status  
* Production Summary  
* Shipment Summary  
* Action Required  
* Last Updated

## **Status Tabs**

* ทั้งหมด  
* รอชำระ  
* กำลังผลิต  
* รออนุมัติ  
* ระหว่างขนส่ง  
* รอส่งมอบ  
* เสร็จสมบูรณ์

## **Mobile**

ใช้ Card ที่แสดง Action สำคัญด้านบน

---

# **18\. Order Detail**

## **Screen ID**

`ORD-009`

## **Route**

`/member/orders/[orderId]`

## **Page Header**

* Order Number  
* Project  
* Status  
* Created Date  
* Member Note  
* Download Order Summary

## **Top Action Required Card**

ตัวอย่าง

> ต้องดำเนินการ: ชำระเงินมัดจำ ฿250,000.00

หรือ

> ต้องดำเนินการ: อนุมัติผลตรวจสินค้า Custom จำนวน 2 รายการ

## **Summary Cards**

* Product Total  
* Paid  
* Outstanding  
* Items  
* Production Progress  
* Shipment ETA

## **Tabs**

1. ภาพรวม  
2. รายการสินค้า  
3. การชำระเงิน  
4. การผลิต  
5. QC  
6. การขนส่ง  
7. การส่งมอบ  
8. เอกสาร  
9. Timeline

## **Overview Sections**

* Order Progress  
* Payment Summary  
* Production Groups  
* Shipment Summary  
* Delivery Address  
* Contact  
* Recent Updates

---

# **19\. Order Progress Stepper**

Stepper หลัก

ยืนยันออเดอร์  
→ มัดจำ  
→ ผลิต  
→ QC  
→ ยอดคงเหลือ  
→ ขนส่ง  
→ ส่งมอบ  
→ ค่าขนส่ง  
→ เสร็จสมบูรณ์

ต้องรองรับ

* Completed  
* Current  
* Upcoming  
* Delayed  
* Issue  
* Not Applicable

หากหลาย Supplier มีสถานะต่างกัน Stepper หลักแสดงสถานะภาพรวม และมีข้อความ

> สินค้าบางกลุ่มยังอยู่ระหว่างผลิต

---

# **20\. Order Items**

## **Screen ID**

`ORD-010`

แสดง Snapshot ไม่ใช่ข้อมูล Product ปัจจุบัน

## **Item Information**

* Product Image Snapshot  
* Product Code Snapshot  
* Product Name Snapshot  
* Area  
* Dimensions  
* Material  
* Options  
* Remark  
* Quantity  
* Unit Price  
* Line Total  
* Current Operational Status  
* Shipped Quantity  
* Delivered Quantity  
* Claim Status

## **Important Label**

> ข้อมูลสินค้า ณ วันที่ยืนยันออเดอร์

## **Member Restrictions**

หลังสร้าง Order สมาชิกแก้ไม่ได้

หากพบข้อผิดพลาด ต้องใช้

* ติดต่อทีมงาน  
* Cancellation Request  
* Claim หลังส่งมอบ

---

# **21\. Order Timeline**

## **Screen ID**

`ORD-011`

Timeline Events ที่สมาชิกเห็น

* Order Created  
* Deposit Invoice Issued  
* Payment Submitted  
* Deposit Verified  
* PO Processing  
* Factory Confirmed  
* Production Started  
* Production Update  
* QC Started  
* QC Passed  
* Member Approval Requested  
* Balance Invoice Issued  
* Balance Verified  
* Arrived China Warehouse  
* Consolidated  
* Departed China  
* Arrived Thailand  
* Delivery Scheduled  
* Delivered  
* Freight Invoice Issued  
* Completed

แต่ละ Event แสดง

* Date/Time  
* Title  
* Description  
* Related File  
* Status  
* Action หากมี

ไม่แสดง Internal Action ที่เป็นความลับ

---

# **22\. Order Documents**

## **Screen ID**

`ORD-012`

Document Categories

* Order Summary  
* Deposit Invoice  
* Balance Invoice  
* Freight Invoice  
* Payment Evidence  
* QC Report  
* Packing List  
* Shipment Document ที่เปิดเผยได้  
* Delivery Proof  
* Claim Document

Document Card

* Document Name  
* Document Number  
* Issue Date  
* Status  
* Download  
* View

ห้ามแสดง

* Supplier PO  
* Factory Invoice  
* Factory Payment  
* Internal Cost Sheet

---

# **23\. Deposit Invoice**

## **Screen ID**

`PAY-001`

แสดง

* Invoice Number  
* Order Number  
* Project  
* Member/Company  
* Issue Date  
* Due Date  
* Product Total  
* Deposit Percentage  
* Deposit Amount  
* Bank Details  
* Payment Instructions  
* Download PDF

Actions

* อัปโหลดสลิป  
* ดาวน์โหลด  
* ติดต่อฝ่ายการเงิน

---

# **24\. Upload Payment Slip**

## **Screen ID**

`PAY-002`

ใช้ร่วมกับ Deposit, Balance และ Freight โดยเปลี่ยนประเภท

## **Fields**

* Payment Type  
* Amount Due  
* Amount Transferred  
* Transfer Date  
* Transfer Time  
* Bank  
* Source Account Name  
* Slip Upload  
* Note

## **Upload Area**

รองรับ

* JPG  
* PNG  
* PDF

แสดง

* Preview  
* Upload Progress  
* Replace  
* Remove

## **Validation**

* Amount มากกว่า 0  
* Transfer Date จำเป็น  
* Slip จำเป็น  
* File Type ถูกต้อง  
* File Size ไม่เกินกำหนด

## **Underpayment**

หาก Amount ต่ำกว่ายอด

แสดง Warning

> ยอดที่ระบุต่ำกว่ายอดที่ต้องชำระ ฝ่ายการเงินอาจยืนยันเป็นการชำระบางส่วน

## **Overpayment**

แสดง Warning และให้ดำเนินการต่อได้ตามนโยบาย

---

# **25\. Payment Submitted**

## **Screen ID**

`PAY-003`

Message

> ส่งหลักฐานการชำระแล้ว อยู่ระหว่างฝ่ายการเงินตรวจสอบ

แสดง

* Payment Reference  
* Submitted Amount  
* Submitted Date  
* Slip  
* Status `รอตรวจสอบ`

Member ยังไม่ควรเห็นว่า Order เริ่มผลิตแล้วจน Finance Verify

---

# **26\. Payment Rejected**

## **Screen ID**

`PAY-004`

แสดง

* Rejection Reason ที่เปิดเผยได้  
* Amount Submitted  
* Slip  
* Finance Note  
* ปุ่มส่งหลักฐานใหม่  
* ช่องทางติดต่อ

เหตุผลตัวอย่าง

* ยอดไม่ตรง  
* ภาพไม่ชัด  
* ไม่พบรายการเงินเข้า  
* หลักฐานซ้ำ  
* ข้อมูลวันที่ไม่ตรง

ไม่ควรลบหลักฐานเดิม ต้องเก็บ History

---

# **27\. Payment Verified**

## **Screen ID**

`PAY-005`

แสดง Success State

> ฝ่ายการเงินยืนยันเงินมัดจำแล้ว ออเดอร์กำลังเข้าสู่ขั้นตอนประสานโรงงาน

พร้อม

* Verified Amount  
* Verified Date  
* Payment Reference  
* Updated Order Status

---

# **28\. Payment History**

## **Screen ID**

`PAY-006`

## **Route**

`/member/orders/[orderId]/payments`

แสดง Schedule

มัดจำ 50%        ยืนยันแล้ว  
ยอดคงเหลือ 50%   ยังไม่ออกใบแจ้ง  
ค่าขนส่ง          ยังไม่สรุป

แต่ละ Schedule เปิดดู

* Invoice  
* Amount Due  
* Paid  
* Verified  
* Outstanding  
* Due Date  
* Payment History

---

# **29\. Supplier Order List – Admin**

## **Screen ID**

`SO-001`

## **Route**

`/admin/supplier-orders`

แสดง

* Supplier Order Number  
* Customer Order  
* Project  
* Supplier  
* Item Count  
* Factory Amount  
* Factory Deposit Status  
* Production Status  
* QC Status  
* Estimated Completion  
* Delay Flag  
* Assigned Staff

Filters

* Supplier  
* Status  
* Payment Status  
* Production Status  
* QC Status  
* Due Date  
* Assigned Staff

ข้อมูลนี้ไม่แสดงใน Member UI

---

# **30\. Supplier Order Detail – Admin**

## **Screen ID**

`SO-002`

## **Header**

* Supplier Order Number  
* Customer Order  
* Supplier  
* Factory Reference  
* Status  
* Assigned Owner

## **Tabs**

1. Items  
2. PO  
3. Supplier Payments  
4. Production  
5. QC  
6. Warehouse  
7. Documents  
8. Internal Timeline

## **Summary**

* Factory Subtotal  
* Deposit 50%  
* Balance 50%  
* Factory Currency  
* Estimated Completion  
* Actual Completion  
* Member-visible Status

---

# **31\. Purchase Order Preview**

## **Screen ID**

`SO-003`

แสดง

* PO Number  
* Supplier  
* Supplier Order  
* Item Snapshot  
* Factory Specification  
* Quantity  
* Factory Unit Cost  
* Factory Total  
* Payment Terms  
* Delivery to China Warehouse  
* Notes  
* Attachments

Actions

* Save Draft  
* Download Draft  
* Issue PO

## **Issue PO Rule**

ปุ่มเปิดได้เมื่อ

* Customer Deposit Verified  
* Supplier Order Status Pending PO  
* Item Spec ครบ  
* Factory Cost ครบ  
* Currency ครบ  
* Supplier Active

---

# **32\. Issue PO Confirmation**

## **Screen ID**

`SO-004`

Dialog ต้องแสดง

* PO Number  
* Supplier  
* Amount  
* Item Count  
* Payment Terms  
* Version

ข้อความ

> การออก PO จะล็อกข้อมูลคำสั่งซื้อเวอร์ชันนี้และเปลี่ยน Supplier Order เป็น “ส่ง PO แล้ว”

Actions

* กลับไปแก้  
* ยืนยันออก PO

หลังออก

* Create Audit Log  
* Store PDF  
* Update Status  
* Create Timeline  
* Enable Factory Deposit Record

---

# **33\. Factory Confirmation**

## **Screen ID**

`SO-005`

ทีมงานบันทึก

* Factory Confirmed Date  
* Factory Reference Number  
* Confirmed Lead Time  
* Estimated Completion Date  
* Factory Note  
* Confirmation File

Actions

* Confirm  
* Request Revision  
* Put on Hold

Member เห็นเพียง

> โรงงานยืนยันออเดอร์แล้ว  
> คาดว่าจะผลิตเสร็จประมาณวันที่...

---

# **34\. Supplier Payment Record**

## **Screen ID**

`SO-006`

Finance/Admin บันทึก

* Payment Type  
* Amount  
* Currency  
* Exchange Rate  
* THB Equivalent  
* Payment Date  
* Evidence  
* Bank/Method  
* Note  
* Approver

ข้อมูลนี้เป็น Confidential

Member ไม่เห็น

---

# **35\. Production Overview – Member**

## **Screen ID**

`PROD-001`

## **Route**

`/member/orders/[orderId]/production`

แสดงกลุ่มการผลิต

กลุ่ม A – อยู่ระหว่างผลิต 60%  
กลุ่ม B – ผลิตเสร็จ รอ QC  
กลุ่ม C – เตรียมวัตถุดิบ

หากนโยบายเปิดเผยชื่อ Supplier สามารถแสดงชื่อได้ แต่ต้องไม่แสดงข้อมูลต้นทุนหรือติดต่อโดยตรง

## **Production Group Card**

* Group/Supplier  
* Item Count  
* Status  
* Progress  
* Estimated Completion  
* Latest Update  
* Delay Status  
* View Detail

---

# **36\. Production Group Detail**

## **Screen ID**

`PROD-002`

แสดง

* Items  
* Production Status  
* Progress Percentage  
* Estimated Completion  
* Actual Updates  
* Photos/Videos  
* Delay Note  
* Timeline

## **Media Gallery**

แยกตามวันที่

* Material Preparation  
* In Production  
* Partial Completion  
* Production Completed

Member เห็นเฉพาะ Media ที่ตั้ง `member_visible`

---

# **37\. Production Update Form – Admin**

## **Screen ID**

`PROD-003`

Fields

* Supplier Order  
* Item หรือ All Items  
* Status  
* Progress Percentage  
* Update Date  
* Estimated Completion  
* Note  
* Member-visible Toggle  
* Upload Photos/Videos  
* Delay Flag

## **Validation**

* Progress 0–100  
* Rework Required ต้องมี Note  
* Production Completed ควรมีรูปหลักฐานตามนโยบาย  
* Actual Completion Date ต้องไม่ก่อน Start Date

---

# **38\. Delay State**

## **Screen ID**

`PROD-004`

เมื่อ Estimated Completion ผ่านแล้วหรือ Admin Flag Delay

Member เห็น Banner

> การผลิตสินค้าบางรายการล่าช้ากว่ากำหนดเดิม

แสดง

* Affected Group  
* Original Estimate  
* Updated Estimate  
* Reason ที่เปิดเผยได้  
* Impact ต่อ Shipment  
* Latest Update

หลีกเลี่ยงการแสดงคำสัญญาวันส่งที่ยังไม่ยืนยัน

---

# **39\. QC Overview**

## **Screen ID**

`QC-001`

## **Route**

`/member/orders/[orderId]/qc`

แสดง QC แยกตาม Production Group หรือ Inspection

สถานะ

* รอตรวจ  
* กำลังตรวจ  
* ต้องแก้ไข  
* ตรวจผ่าน  
* รอสมาชิกอนุมัติ  
* สมาชิกอนุมัติแล้ว

QC Card

* QC Number  
* Group  
* Inspection Date  
* Item Count  
* Overall Result  
* Member Action  
* View Report

---

# **40\. QC Inspection Detail**

## **Screen ID**

`QC-002`

## **Sections**

* Inspection Summary  
* Inspector  
* Date  
* Product Items  
* Checklist  
* Issues  
* Rework  
* Photos/Videos  
* Approval Status  
* Download QC Report

## **Checklist Categories ตัวอย่าง**

* Model/SKU  
* Quantity  
* Dimensions  
* Color/Material  
* Surface Condition  
* Function  
* Hardware  
* Packaging  
* Custom Specification

Checklist ที่แท้จริงกำหนดโดย Admin ตาม Category

---

# **41\. Standard Product QC Result**

## **Screen ID**

`QC-003`

สำหรับ Standard Product

Member เห็น

* QC Passed / Rework Required  
* Summary  
* Evidence  
* Reinspection หากมี

Member ไม่ต้องกด Approve

หากมีปัญหาร้ายแรง สมาชิกสามารถกด

`สอบถามทีมงาน`

แต่ไม่ควรสร้าง Claim ก่อนส่งมอบ เว้นแต่นโยบายกำหนด

---

# **42\. Custom Product Approval**

## **Screen ID**

`QC-004`

สำหรับ Custom Product

แสดง Action Required เด่นชัด

> กรุณาตรวจสอบและอนุมัติสินค้าสั่งผลิตก่อนจัดส่ง

## **Display**

* Confirmed Specification  
* Approved Drawing/File  
* Product Photos  
* Video  
* Dimensions  
* Material  
* Color  
* QC Checklist  
* Issues และ Corrections  
* Team Recommendation

## **Actions**

Primary

`อนุมัติให้จัดส่ง`

Secondary

`ขอให้ตรวจสอบเพิ่มเติม`

Member ไม่มีปุ่ม Reject แบบกว้างโดยไม่ระบุเหตุผล

---

# **43\. Approve for Shipping Confirmation**

Dialog

> เมื่ออนุมัติแล้ว บริษัทจะดำเนินการขั้นตอนชำระยอดคงเหลือและเตรียมจัดส่ง กรุณาตรวจสอบรูป วิดีโอ และสเปกให้ครบถ้วน

Checkbox

> ข้าพเจ้าได้ตรวจสอบข้อมูลและอนุมัติให้ดำเนินการจัดส่งตามสเปกที่ยืนยัน

หลัง Approve

* Record User  
* Record Date  
* Lock Decision  
* Create Audit  
* Update QC Status  
* Enable Balance Invoice ตาม Workflow

---

# **44\. Request Additional Review**

## **Screen ID**

`QC-005`

Fields

* Select Issue Category  
* Description  
* Mark on Image ใน Future  
* Upload Reference  
* Expected Clarification

Issue Category

* สีหรือวัสดุ  
* ขนาด  
* รูปแบบ  
* อุปกรณ์  
* งานผิว  
* จำนวน  
* อื่น ๆ

หลัง Submit

* QC Status `Additional Review Requested`  
* Team Notification  
* Member เห็น Timeline  
* Shipment Blocked

---

# **45\. Rework Tracking**

## **Screen ID**

`QC-006`

แสดง

* Original Issue  
* Required Correction  
* Rework Status  
* Updated Estimate  
* New Evidence  
* Reinspection Date  
* Result

Timeline

พบปัญหา  
→ โรงงานรับทราบ  
→ อยู่ระหว่างแก้ไข  
→ แก้ไขเสร็จ  
→ ตรวจซ้ำ  
→ ผ่าน

---

# **46\. Balance Invoice**

## **Screen ID**

`PAY-007`

เกิดเมื่อ

* Production Completed  
* QC Passed  
* Custom Product Approved หากต้องใช้  
* Admin/Finance Issue Invoice

แสดง

* Product Total  
* Deposit Verified  
* Balance Due  
* Due Date  
* Payment Instruction

Primary

`อัปโหลดหลักฐานยอดคงเหลือ`

Order หรือ Supplier Group ยังไม่ส่งออกจน Balance Verified ตาม Business Rule

---

# **47\. Warehouse Receipt – Admin**

## **Screen ID**

`WH-001`

เมื่อสินค้าถึงโกดังจีน

ทีมงานบันทึก

* Warehouse  
* Supplier Order  
* Receipt Number  
* Received Date  
* Package Count  
* Actual Weight  
* Actual CBM  
* Item Quantities  
* Condition  
* Discrepancy  
* Photos  
* Packing Labels

## **Status**

* Expected  
* Partially Received  
* Received Complete  
* Discrepancy  
* Damaged  
* Ready for Consolidation

---

# **48\. Warehouse Receipt Detail**

## **Screen ID**

`WH-002`

แสดง Expected เทียบ Received

| Item | Expected | Received | Difference | Condition |
| :---: | :---: | :---: | :---: | :---: |

หากต่าง

* Required Note  
* Evidence  
* Assign Follow-up  
* Block Consolidation บางรายการ

Member เห็นสถานะย่อ เช่น

> สินค้ากลุ่ม A ถึงโกดังจีนแล้ว

ไม่จำเป็นต้องเห็นข้อมูลภายในทุก Package

---

# **49\. Consolidation Planning**

## **Screen ID**

`LOG-001`

## **Purpose**

รวมสินค้าจากหลาย Supplier Order เพื่อจัดส่งร่วมกัน

## **Display**

* Customer Order  
* Ready Items  
* Waiting Items  
* Warehouse  
* Actual CBM  
* Actual Weight  
* Estimated Shipping Method  
* Expected Consolidation Date

## **Default**

`Consolidate All`

แสดงสถานะ

* พร้อมรวม  
* รอโรงงาน  
* มีปัญหา  
* ถูกเลือกส่งบางส่วน

---

# **50\. Consolidation Detail**

## **Screen ID**

`LOG-002`

แสดง

* Items Included  
* Supplier Groups  
* Package Count  
* Weight  
* CBM  
* Packing Status  
* Planned Ship Date  
* Missing Items  
* Notes  
* Documents

Actions

* Add Item  
* Remove Item ก่อน Confirm  
* Confirm Consolidation  
* Create Shipment

หลัง Confirm ไม่ควรแก้ Item โดยตรง ต้อง Revision หรือ Cancel ก่อน

---

# **51\. Partial Shipment Decision**

## **Screen ID**

`LOG-003`

ใช้เมื่อ

* Supplier บางรายล่าช้า  
* หน้างานต้องการสินค้าบางส่วน  
* พื้นที่โกดังจำกัด  
* สินค้าบางประเภทต้องส่งเร่งด่วน

## **Admin Decision Form**

* Reason  
* Items to Ship  
* Items to Wait  
* Additional Estimated Cost  
* Member Acknowledgement Required?  
* Impact on Remaining Shipment  
* Internal Approval

## **Member Acknowledgement**

หากมีค่าใช้จ่ายเพิ่ม แสดง

> การจัดส่งบางส่วนอาจทำให้ค่าขนส่งรวมเพิ่มขึ้นจากการส่งพร้อมกันทั้งหมด

Actions

* รับทราบและดำเนินการ  
* ขอข้อมูลเพิ่มเติม  
* รอส่งพร้อมกัน

หากบริษัทเป็นผู้รับภาระค่าใช้จ่ายเอง ไม่จำเป็นต้องให้ Member Approve แต่ควรแจ้ง

---

# **52\. Shipment Creation – Admin**

## **Screen ID**

`SHP-001`

Fields

* Shipment Type  
* Shipping Method  
* Origin Warehouse  
* Destination  
* Items  
* Quantity  
* Package Count  
* Weight  
* CBM  
* Carrier  
* Tracking  
* Container Number  
* BL Number  
* ETD  
* ETA  
* Documents  
* Member-visible Note

## **Shipment Types**

* Consolidated  
* Partial  
* Direct

## **Shipping Methods**

* LCL  
* FCL  
* Truck  
* Air  
* Courier

## **Validation**

* Quantity ไม่เกิน Remaining  
* Item อยู่ Warehouse หรือมีสิทธิ์ Direct Ship  
* ETD ไม่หลัง ETA  
* Partial Shipment ต้องมี Reason  
* Container Number ตามรูปแบบเมื่อมี

---

# **53\. Shipment Detail – Member**

## **Screen ID**

`SHP-002`

## **Route**

`/member/orders/[orderId]/shipments/[shipmentId]`

แสดง

* Shipment Number  
* Shipping Method  
* Included Items  
* Origin  
* Destination  
* ETD  
* ETA  
* Current Status  
* Tracking  
* Delay  
* Documents ที่เปิดเผยได้  
* Timeline

ไม่จำเป็นต้องแสดงรายละเอียดศุลกากรภายในทุกขั้นตอน

---

# **54\. Shipment Tracking**

## **Screen ID**

`SHP-003`

Stepper

รับจากโรงงาน  
→ ถึงโกดังจีน  
→ รวมสินค้า  
→ ออกจากจีน  
→ ระหว่างขนส่ง  
→ ถึงประเทศไทย  
→ ผ่านศุลกากร  
→ เข้าคลังไทย  
→ พร้อมนัดส่ง

สถานะที่ยังไม่มีข้อมูลแสดงเป็น Upcoming

แต่ละ Event

* Date  
* Location  
* Note  
* Evidence/Document  
* Delay Flag

---

# **55\. Shipment Delay**

## **Screen ID**

`SHP-004`

แสดง Banner

> การขนส่งล่าช้ากว่ากำหนดเดิม

ข้อมูล

* Original ETA  
* Updated ETA  
* Reason  
* Current Location  
* Affected Delivery Plan  
* Last Updated

สมาชิกไม่ควรได้รับ Notification ซ้ำทุกครั้งที่ ETA ขยับเล็กน้อย ควรมีเกณฑ์ Meaningful Change

---

# **56\. Import Status**

## **Screen ID**

`SHP-005`

Member View ใช้สถานะง่าย

* ถึงประเทศไทย  
* อยู่ระหว่างพิธีการนำเข้า  
* ผ่านพิธีการแล้ว  
* เข้าคลังประเทศไทย  
* พร้อมนัดส่ง

Admin View อาจมี

* Port/Border  
* Customs Entry  
* Tax/Charge  
* Broker  
* Document Status  
* Hold Reason

ข้อมูลหลังบ้านเชิงลึกอยู่ Volume 3

---

# **57\. Delivery Scheduling**

## **Screen ID**

`DLV-001`

เมื่อสินค้าพร้อมส่งจากคลังไทย

สมาชิกได้รับ Action Required

> กรุณาตรวจสอบวันและข้อมูลนัดส่ง

## **Display**

* Delivery Address Snapshot  
* Site Contact  
* Items/Shipments  
* Proposed Date  
* Proposed Time Window  
* Vehicle Requirement  
* Access Note  
* Installation Included หรือไม่

## **Actions**

* ยืนยันนัดหมาย  
* ขอเปลี่ยนวัน  
* แก้ผู้ติดต่อ  
* เพิ่มหมายเหตุหน้างาน

Address Snapshot ไม่เปลี่ยนอัตโนมัติจาก Project หลัง Order

หากต้องเปลี่ยน Address ต้องให้ Admin ตรวจผลกระทบและค่าใช้จ่าย

---

# **58\. Request Reschedule**

Fields

* Preferred Dates  
* Unavailable Dates  
* Reason  
* Updated Contact  
* Note

ระบบไม่ควรยืนยันวันใหม่ทันทีจน Logistics Confirm

Status

* Reschedule Requested  
* Under Review  
* Rescheduled

---

# **59\. Delivery Appointment Detail**

## **Screen ID**

`DLV-002`

แสดง

* Delivery Number  
* Date  
* Time Window  
* Address  
* Contact  
* Driver/Vehicle เมื่อเปิดเผยได้  
* Item List  
* Preparation Checklist  
* Current Status

Preparation Checklist ตัวอย่าง

* หน้างานพร้อมรับ  
* มีพื้นที่วางสินค้า  
* มีผู้รับสินค้า  
* ตรวจสอบข้อจำกัดลิฟต์  
* แจ้งนิติบุคคลแล้ว  
* เตรียมอุปกรณ์ยกถ้าจำเป็น

---

# **60\. Delivery Status**

Scheduled  
→ Confirmed  
→ Out for Delivery  
→ Arrived  
→ Delivered

สถานะพิเศษ

* Partially Delivered  
* Delivered with Issue  
* Failed  
* Reschedule Required

Member ได้ Notification เมื่อ

* นัดหมายยืนยัน  
* รถออกส่ง  
* ส่งมอบเสร็จ  
* ส่งไม่สำเร็จ

---

# **61\. Proof of Delivery**

## **Screen ID**

`DLV-003`

ทีมงานบันทึก

* Delivered Date/Time  
* Recipient Name  
* Recipient Phone  
* Delivered Items  
* Quantity  
* Condition  
* Photos  
* Signature  
* Issue Note

## **Minimum Requirement**

Delivered ต้องมี

* Recipient Name  
* Delivered Time  
* Item Quantities  
* Proof อย่างน้อยหนึ่งรูปหรือ Signature/Confirmation

## **Member Confirmation**

สมาชิกหรือผู้รับสามารถ

* ยืนยันรับครบ  
* รับพร้อมแจ้งปัญหา  
* รับบางส่วน

---

# **62\. Delivered with Issue**

## **Screen ID**

`DLV-004`

เมื่อพบปัญหา

ให้บันทึกทันที

* Affected Item  
* Quantity  
* Issue Type  
* Description  
* Photo/Video  
* Packaging Condition  
* Damage Seen Before Unpacking?  
* Receiver Note

Action

`สร้าง Claim จากข้อมูลนี้`

ระบบ Pre-fill Claim เพื่อลดการกรอกซ้ำ

---

# **63\. Partial Delivery**

## **Screen ID**

`DLV-005`

แสดง

* Expected Quantity  
* Delivered Quantity  
* Remaining Quantity  
* Reason  
* Next Delivery Plan  
* Related Shipment

Order ยังไม่เป็น Delivered Complete จนสินค้าครบ

---

# **64\. Logistics Cost Summary – Admin**

## **Screen ID**

`FRT-001`

ทีมงานสรุป

* China Domestic Transport  
* Warehouse  
* Inspection  
* Consolidation  
* Packing  
* International Freight  
* Insurance  
* Customs  
* Tax  
* Thailand Warehouse  
* Thailand Delivery  
* Lifting  
* Other

แต่ละรายการมี

* Internal Cost  
* Member Charge  
* Currency  
* Exchange Rate  
* Billable  
* Evidence  
* Note

Member เห็นเฉพาะ Member Charge และคำอธิบายที่อนุญาต

---

# **65\. Freight Invoice**

## **Screen ID**

`FRT-002`

ตามกฎ MVP ออกหลังส่งมอบหรือเมื่อบริษัทสรุปยอดจริงได้

แสดง

* Freight Invoice Number  
* Order  
* Delivery  
* Cost Categories  
* Member Charge  
* Total  
* Due Date  
* Bank Details  
* Payment Status

## **Member-Friendly Categories**

ไม่จำเป็นต้องเปิดต้นทุนละเอียดทุกบรรทัด แต่ควรโปร่งใสพอ เช่น

* ขนส่งและรวมสินค้าในจีน  
* ขนส่งระหว่างประเทศ  
* ค่าใช้จ่ายนำเข้า  
* จัดส่งในประเทศไทย  
* ค่าใช้จ่ายเพิ่มเติม

---

# **66\. Upload Freight Payment**

ใช้ Flow เดียวกับ Payment Slip

เมื่อ Finance Verify

* Freight Schedule เป็น Verified  
* Outstanding เป็น 0  
* หาก Delivery ครบและไม่มี Action ค้าง Order เป็น Completed

---

# **67\. Order Completion**

## **Screen ID**

`ORD-013`

แสดง

> ออเดอร์นี้เสร็จสมบูรณ์แล้ว

Summary

* Order Date  
* Completion Date  
* Product Total  
* Freight Total  
* Payments  
* Delivered Items  
* Documents  
* Claims  
* Reorder ใน Future

Actions

* ดาวน์โหลดเอกสารทั้งหมด  
* ดู Project  
* แจ้งปัญหา หากยังอยู่ใน Claim Period  
* สั่งซื้อซ้ำใน Future

---

# **68\. Cancellation Request**

## **Screen ID**

`CAN-001`

## **Entry**

Order Detail \> More Actions \> ขอ取消ออเดอร์

ควรใช้ภาษาไทยว่า `ขอยกเลิกออเดอร์`

## **Rules**

### **ก่อน Deposit Verified**

สมาชิกสามารถยกเลิกได้โดยตรงหลัง Confirmation

### **หลัง Deposit Verified**

ต้องสร้าง Cancellation Request

## **Fields**

* Reason  
* Description  
* Supporting File  
* Contact Preference  
* Acknowledgement

ข้อความ

> หลังบริษัทเปิด PO หรือชำระเงินให้โรงงานแล้ว อาจมีค่าใช้จ่ายที่ไม่สามารถคืนได้ การส่งคำขอไม่ได้หมายความว่าจะได้รับเงินคืนเต็มจำนวน

---

# **69\. Cancellation Request Detail**

## **Screen ID**

`CAN-002`

สถานะ

* Submitted  
* Under Review  
* Additional Information Required  
* Approved  
* Partially Approved  
* Rejected  
* Refund Processing  
* Completed

แสดง

* Requested Date  
* Reason  
* Current Order Progress  
* Proposed Refund  
* Deduction  
* Decision Note  
* Timeline

ข้อมูลต้นทุนภายในไม่แสดง แต่ต้องอธิบาย Deduction เป็นภาษาที่เข้าใจได้

---

# **70\. Claim Listing**

## **Screen ID**

`CLM-001`

## **Route**

`/member/claims`

Filters

* Status  
* Project  
* Order  
* Claim Type  
* Date  
* Action Required

Claim Card

* Claim Number  
* Subject  
* Order  
* Item  
* Status  
* Assigned Team  
* Latest Update  
* Action Required

---

# **71\. Create Claim**

## **Screen ID**

`CLM-002`

## **Route**

`/member/claims/new`

## **Entry Points**

* Order Detail  
* Delivery Detail  
* Delivered with Issue  
* Claim Menu

## **Step Flow**

1 เลือกออเดอร์และสินค้า  
→ 2 ระบุปัญหา  
→ 3 แนบหลักฐาน  
→ 4 ตรวจสอบและส่ง

---

# **72\. Claim Step 1: Select Items**

แสดงเฉพาะ

* Orders ของ Member  
* Delivered Items  
* Items ที่อยู่ใน Claim Period ตามนโยบาย

เลือกได้หลาย Item หากปัญหาเดียวกัน

ข้อมูล

* Product  
* Delivered Quantity  
* Previous Claim  
* Delivery Date

---

# **73\. Claim Step 2: Issue Detail**

Claim Types

* สินค้าไม่ครบ  
* ผิดรุ่น  
* ผิดสี  
* ผิดขนาด  
* ชำรุด  
* แตกหัก  
* งานผลิตไม่ได้มาตรฐาน  
* ความเสียหายจากขนส่ง  
* ปัญหาการติดตั้ง  
* อื่น ๆ

Fields

* Subject  
* Description  
* Quantity Affected  
* Severity  
* When Discovered  
* Packaging Condition  
* Temporary Action Taken

---

# **74\. Claim Step 3: Evidence**

รองรับ

* Photos  
* Videos  
* Delivery Note  
* Measurement Photo  
* Packaging Photo  
* Other Document

แนะนำ Upload Checklist

* ภาพรวมสินค้า  
* ภาพจุดเสียหายใกล้  
* ภาพรหัสหรือ Label  
* ภาพบรรจุภัณฑ์  
* วิดีโอการทำงาน หากเป็นปัญหาฟังก์ชัน

---

# **75\. Claim Review and Submit**

## **Screen ID**

`CLM-003`

แสดง

* Order  
* Items  
* Issue  
* Quantity  
* Evidence  
* Contact

Acknowledgement

> ข้าพเจ้ายืนยันว่าข้อมูลและหลักฐานที่ส่งเป็นข้อมูลของสินค้าที่ได้รับจากออเดอร์นี้

Primary

`ส่งคำขอเคลม`

---

# **76\. Claim Detail**

## **Screen ID**

`CLM-004`

## **Sections**

* Claim Summary  
* Status  
* Items  
* Evidence  
* Team Response  
* Requested Information  
* Proposed Resolution  
* Timeline  
* Resolution Confirmation

## **Status**

* Submitted  
* Under Review  
* Waiting Information  
* Coordinating Supplier  
* Repair Approved  
* Replacement Approved  
* Compensation Proposed  
* In Progress  
* Resolved  
* Closed  
* Rejected

`Rejected` และ `Closed` เป็นคนละ Terminal State: Reject ต้องบันทึกเหตุผล ส่วน Close ต้องผ่าน
`Resolved` พร้อมหลักฐานและ Member Confirmation/Admin Review ตามประเภทเคส

---

# **77\. Claim Action Required**

ตัวอย่าง

* เพิ่มรูปภาพ  
* ระบุขนาด  
* ยืนยันวันเข้าซ่อม  
* ตอบรับข้อเสนอชดเชย  
* ยืนยันว่าแก้ไขแล้ว

Action ต้องอยู่บน Claim Detail ด้านบน

---

# **78\. Claim Resolution**

Resolution Types

* Repair  
* Replacement  
* Spare Part  
* Rework  
* Compensation  
* Credit  
* No Action  
* Rejected

Member เห็น

* Proposed Resolution  
* Expected Date  
* Conditions  
* Next Step

หากต้องยืนยัน

Actions

* ยอมรับ  
* ขอข้อมูลเพิ่มเติม

---

# **79\. Resolution Confirmation**

## **Screen ID**

`CLM-005`

เมื่อดำเนินการแล้ว

Member เลือก

* ปัญหาได้รับการแก้ไขแล้ว  
* ยังมีปัญหา  
* ต้องการให้ทีมงานติดต่อกลับ

ไม่ควรปิด Claim อัตโนมัติทันทีโดยไม่มีหลักฐานหรือ Admin Review ตามประเภทเคส

---

# **80\. Member Dashboard Extensions**

Volume 2 เพิ่ม Dashboard KPI

* ออเดอร์รอชำระมัดจำ  
* ออเดอร์กำลังผลิต  
* QC รออนุมัติ  
* ยอดคงเหลือรอชำระ  
* Shipment ระหว่างขนส่ง  
* นัดส่งที่กำลังจะมาถึง  
* ค่าขนส่งค้างชำระ  
* Claim ที่เปิดอยู่

## **Action Required Priority**

เรียงลำดับแนะนำ

1. Payment Overdue  
2. QC Approval Required  
3. Delivery Confirmation  
4. Additional Claim Information  
5. Payment Due Soon  
6. General Update

---

# **81\. Status Translation for Member**

สถานะภายในที่ซับซ้อนควรแปลเป็นภาษาง่าย

| Internal Status | Member Label |
| ----- | ----- |
| PENDING\_PO | กำลังประสานโรงงาน |
| PO\_ISSUED | ส่งคำสั่งซื้อให้โรงงานแล้ว |
| FACTORY\_CONFIRMED | โรงงานยืนยันแล้ว |
| MATERIAL\_PREPARATION | เตรียมวัตถุดิบ |
| IN\_PRODUCTION | อยู่ระหว่างผลิต |
| PARTIALLY\_COMPLETED | ผลิตเสร็จบางส่วน |
| AWAITING\_QC | รอตรวจสินค้า |
| REWORK\_REQUIRED | อยู่ระหว่างแก้ไข |
| QC\_PASSED | ตรวจผ่าน |
| AWAITING\_MEMBER\_APPROVAL | รอคุณอนุมัติ |
| READY\_FOR\_DISPATCH | พร้อมออกจากโรงงาน |
| DELIVERED\_TO\_CHINA\_WAREHOUSE | ถึงโกดังจีน |
| CONSOLIDATED | รวมสินค้าแล้ว |
| SHIPPED | ออกจากจีนแล้ว |

---

# **82\. Notification Triggers Volume 2**

## **Order**

* Order Created  
* Order Cancelled  
* Cancellation Decision

## **Payment**

* Deposit Invoice Issued  
* Payment Submitted  
* Payment Verified  
* Payment Rejected  
* Balance Invoice Issued  
* Freight Invoice Issued  
* Payment Overdue

## **Production**

* Factory Confirmed  
* Production Started  
* Production Delayed  
* Production Completed

## **QC**

* QC Report Available  
* Rework Required  
* Member Approval Required  
* Reinspection Completed

## **Shipment**

* Arrived China Warehouse  
* Shipment Departed  
* ETA Changed Meaningfully  
* Arrived Thailand  
* Customs Cleared  
* Ready for Delivery

## **Delivery**

* Delivery Proposed  
* Delivery Confirmed  
* Out for Delivery  
* Delivered  
* Delivery Issue

## **Claim**

* Claim Received  
* Additional Information Required  
* Resolution Proposed  
* Claim Updated  
* Claim Closed

---

# **83\. Notification Design**

Notification ควรมี

* Title  
* Short Message  
* Entity Reference  
* Date  
* Primary Action  
* Secondary Action ถ้ามี

ตัวอย่าง

> **กรุณาอนุมัติผลตรวจสินค้า**  
> สินค้า Custom ในออเดอร์ ORD-2026-000001 ผ่านการตรวจและรอการยืนยันจากคุณ  
> `ตรวจสอบและอนุมัติ`

---

# **84\. Confirmation Dialogs Volume 2**

Action ที่ต้อง Confirm

* Create Order  
* Upload Payment  
* Approve Custom QC  
* Request Additional Review  
* Acknowledge Partial Shipment Cost  
* Confirm Delivery Appointment  
* Confirm Received Complete  
* Submit Claim  
* Accept Claim Resolution  
* Request Cancellation

Dialog ต้องอธิบายผลกระทบ

---

# **85\. Loading และ Processing States**

## **Create Order**

แสดงหลายขั้นตอนเพื่อเพิ่มความมั่นใจ

## **Upload Slip**

แสดง Upload Progress และ Processing

## **Document Generation**

แสดง Generating State

## **QC Gallery**

ใช้ Skeleton และ Lazy Load

## **Shipment Tracking**

แสดง Last Updated

## **Claim Upload**

เก็บ Draft หาก Upload บางไฟล์ล้มเหลว

---

# **86\. Empty States**

## **No Orders**

> ยังไม่มีออเดอร์ เลือกรายการที่พร้อมสั่งจาก Project เพื่อสร้างออเดอร์แรก

## **No Payment Due**

> ขณะนี้ไม่มีรายการที่ต้องชำระ

## **No QC Approval**

> ไม่มีผลตรวจสินค้าที่รอการอนุมัติ

## **No Shipment**

> ออเดอร์ยังไม่เข้าสู่ขั้นตอนขนส่ง

## **No Claim**

> ยังไม่มีคำขอเคลม

---

# **87\. Error States สำคัญ**

## **Order**

* Item ถูกสั่งโดย Session อื่น  
* Price เปลี่ยนระหว่าง Review  
* Product ถูกระงับ  
* Supplier ถูกระงับ  
* Order Creation Timeout

## **Payment**

* Slip Upload Failed  
* Duplicate Slip  
* Payment Already Verified  
* Schedule Cancelled  
* Amount Invalid

## **QC**

* Inspection Superseded by New Version  
* Approval Already Submitted  
* File Access Expired

## **Shipment**

* Tracking Unavailable  
* ETA Not Confirmed  
* Shipment Quantity Conflict

## **Delivery**

* Appointment Changed  
* Delivery Already Confirmed  
* Address Change Requires Review

## **Claim**

* Claim Period Expired  
* Item Not Delivered  
* Duplicate Claim  
* Required Evidence Missing

---

# **88\. Permission Matrix Volume 2**

| Function | Active Member | Suspended Member | Order Admin | Finance | QC Team | Logistics | Super Admin |
| ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- |
| สร้าง Order | Yes | No | View | No | No | No | Yes |
| ดู Order ตนเอง | Yes | Read-only | All | Relevant | Relevant | Relevant | All |
| Upload Slip | Yes | Existing only | View | Review | No | No | All |
| Verify Payment | No | No | No | Yes | No | No | Yes |
| Issue PO | No | No | Yes | View | No | No | Yes |
| Record Production | No | No | Yes | No | Yes ตามสิทธิ์ | No | Yes |
| Create QC | No | No | View | No | Yes | No | Yes |
| Approve Custom QC | Yes | Existing ตามนโยบาย | View | No | No | No | Override |
| Create Shipment | No | No | View | No | No | Yes | Yes |
| Confirm Delivery | Receiver/Member | Existing | View | No | No | Yes | Yes |
| Create Claim | Yes | Existing ตามนโยบาย | Manage | No | Support | Support | Yes |
| View Factory Cost | No | No | ตาม Permission | Yes | No | ตาม Permission | Yes |

---

# **89\. API Mapping Volume 2**

## **Orders**

POST /api/orders  
GET  /api/orders  
GET  /api/orders/:id  
GET  /api/orders/:id/items  
GET  /api/orders/:id/timeline  
GET  /api/orders/:id/documents  
POST /api/orders/:id/cancellation-request

## **Payments**

GET  /api/orders/:id/payment-schedules  
POST /api/payment-schedules/:id/upload-slip  
GET  /api/payments/:id  
GET  /api/payments

GET  /api/admin/customer-payments  
POST /api/admin/customer-payments/:id/verify  
POST /api/admin/customer-payments/:id/reject

## **Supplier Orders**

GET   /api/admin/supplier-orders  
GET   /api/admin/supplier-orders/:id  
POST  /api/admin/supplier-orders/:id/issue-po  
POST  /api/admin/supplier-orders/:id/factory-confirm  
POST  /api/admin/supplier-orders/:id/transition  
POST  /api/admin/supplier-orders/:id/payments

`transition` ต้องใช้ Action ที่กำหนดไว้ล่วงหน้าและผ่าน Permission/Business Guard ห้าม Frontend ส่งค่า Status ปลายทางโดยตรง

## **Production**

GET  /api/orders/:id/production  
POST /api/admin/supplier-orders/:id/production-updates  
PATCH /api/admin/production-updates/:id

## **QC**

GET  /api/orders/:id/qc  
GET  /api/qc-inspections/:id  
POST /api/admin/supplier-orders/:id/qc-inspections  
PATCH /api/admin/qc-inspections/:id  
POST /api/admin/qc-inspections/:id/pass  
POST /api/admin/qc-inspections/:id/request-rework  
POST /api/qc-inspections/:id/member-approval  
POST /api/qc-inspections/:id/additional-review

## **Warehouse**

GET  /api/admin/warehouse-receipts  
POST /api/admin/warehouse-receipts  
GET  /api/admin/warehouse-receipts/:id

## **Consolidation**

GET  /api/admin/consolidations  
POST /api/admin/consolidations  
GET  /api/admin/consolidations/:id  
POST /api/admin/consolidations/:id/items  
POST /api/admin/consolidations/:id/confirm

## **Shipment**

GET   /api/orders/:id/shipments  
GET   /api/shipments/:id  
GET   /api/admin/shipments  
POST  /api/admin/shipments  
PATCH /api/admin/shipments/:id  
POST  /api/admin/shipments/:id/status

## **Delivery**

GET   /api/orders/:id/deliveries  
GET   /api/deliveries/:id  
POST  /api/admin/deliveries  
PATCH /api/admin/deliveries/:id  
POST  /api/admin/deliveries/:id/confirm  
POST  /api/deliveries/:id/member-confirmation

## **Claims**

GET   /api/claims  
POST  /api/claims  
GET   /api/claims/:id  
POST  /api/claims/:id/evidence  
POST  /api/claims/:id/member-response

GET   /api/admin/claims  
PATCH /api/admin/claims/:id  
POST  /api/admin/claims/:id/status  
POST  /api/admin/claims/:id/resolution  
POST  /api/admin/claims/:id/close

---

# **90\. Analytics Events Volume 2**

## **Order Funnel**

* Ready Items Selected  
* Order Review Started  
* Order Created  
* Deposit Invoice Viewed  
* Deposit Slip Submitted  
* Deposit Verified  
* Order Cancel Requested

## **Production**

* Production Page Viewed  
* Production Media Viewed  
* Delay Notice Opened

## **QC**

* QC Report Viewed  
* Custom Approval Started  
* Custom QC Approved  
* Additional Review Requested

## **Payment**

* Balance Invoice Viewed  
* Balance Slip Submitted  
* Freight Invoice Viewed  
* Freight Payment Verified

## **Logistics**

* Shipment Tracking Viewed  
* Delivery Appointment Confirmed  
* Delivery Reschedule Requested

## **Claim**

* Claim Started  
* Claim Submitted  
* Evidence Added  
* Resolution Accepted  
* Claim Closed

---

# **91\. UX Metrics Volume 2**

* Ready-to-Order to Order Conversion  
* Order Creation Completion Rate  
* Time from Order Creation to Deposit Submission  
* Payment Rejection Rate  
* Finance Verification Time  
* Time from Deposit Verified to PO Issued  
* Production Delay Rate  
* QC Pass Rate  
* Custom QC Approval Time  
* Balance Payment Time  
* Consolidation Waiting Time  
* Shipment On-time Rate  
* Delivery Confirmation Rate  
* Freight Collection Time  
* Claim Rate  
* Claim Evidence Completion Rate  
* Claim Resolution Time  
* Order Completion Time

---

# **92\. Mobile-Specific Rules**

## **Order Creation**

* Sticky Summary ด้านล่าง  
* Step Form แสดงทีละส่วน  
* Item Options เปิด Full-screen Detail  
* จำนวนเงินแสดงชัดเจน

## **Payment**

* ใช้กล้องถ่ายสลิปได้  
* Preview ก่อน Submit  
* Amount Input ใช้ Numeric Keyboard

## **Production/QC**

* Gallery Swipe  
* Video Full Screen  
* Sticky Approve Button สำหรับ Custom QC

## **Shipment**

* Tracking เป็น Vertical Timeline  
* ETA อยู่ด้านบน  

## **Delivery**

* Tap to Call Site Contact  
* Open Google Maps  
* Upload Camera Photos

## **Claim**

* Camera-first Upload  
* Save Draft  
* Progress Indicator

---

# **93\. Accessibility Requirements**

* Order Stepper อ่านได้ด้วย Screen Reader  
* จำนวนเงินมี Label ชัดเจน  
* Status ไม่ใช้สีอย่างเดียว  
* Payment Error เชื่อมกับ Field  
* QC Gallery มี Caption  
* Video มีคำอธิบายหรือ Transcript เมื่อจำเป็น  
* Action Required ใช้ Heading  
* Confirmation Dialog Focus ถูกต้อง  
* Timeline มีลำดับที่ชัดเจน  
* Upload Area ใช้ Keyboard ได้

---

# **94\. UX Copy Guidelines Volume 2**

ควรใช้ภาษา

* เข้าใจง่าย  
* ไม่กล่าวโทษโรงงานหรือสมาชิก  
* ไม่สร้างความมั่นใจเกินข้อมูลจริง  
* แยก “วันที่คาดการณ์” กับ “วันที่ยืนยันแล้ว”

ตัวอย่างที่ดี

> คาดว่าสินค้าจะผลิตเสร็จวันที่ 15 กันยายน 2026 ข้อมูลนี้อาจเปลี่ยนแปลงตามการผลิตจริง

แทน

> สินค้าจะเสร็จวันที่ 15 กันยายนแน่นอน

ตัวอย่างที่ดี

> ฝ่ายการเงินยังไม่สามารถยืนยันรายการนี้ได้ เนื่องจากภาพหลักฐานไม่ชัด กรุณาอัปโหลดใหม่

แทน

> สลิปผิด

---

# **95\. Wireflow หลัก Volume 2**

## **95.1 Standard Order Flow**

Project Items Ready to Order  
→ Select Items  
→ Validate  
→ Review Items  
→ Review Address  
→ Review Payment Terms  
→ Confirm Order  
→ Deposit Invoice  
→ Upload Slip  
→ Finance Verify  
→ PO  
→ Production  
→ Team QC  
→ Balance Invoice  
→ Upload Balance Slip  
→ Warehouse  
→ Consolidation  
→ Shipment  
→ Delivery  
→ Freight Invoice  
→ Freight Payment  
→ Completed

## **95.2 Custom Product Flow**

Custom Project Item  
→ Order  
→ Deposit  
→ Production  
→ Team QC  
→ Member Approval  
→ Balance Payment  
→ Shipment  
→ Delivery  
→ Freight  
→ Completed

## **95.3 Multi-Supplier Flow**

One Customer Order  
→ Supplier Order A  
→ Supplier Order B  
→ Supplier Order C  
→ Different Production Timelines  
→ Warehouse Receipts  
→ Consolidate All  
→ One Shipment

## **95.4 Partial Shipment Flow**

Supplier A Ready  
Supplier B Delayed  
→ Admin Proposes Partial Shipment  
→ Cost Impact Review  
→ Member Acknowledgement if Required  
→ Shipment 1  
→ Remaining Items Wait  
→ Shipment 2  
→ Partial Deliveries  
→ Order Completed When All Delivered

## **95.5 Delivery Issue Flow**

Delivery  
→ Received with Issue  
→ Capture Evidence  
→ Create Claim  
→ Admin Review  
→ Supplier/Repair Coordination  
→ Resolution  
→ Member Confirmation  
→ Close Claim

---

# **96\. MVP Must Have**

## **Order**

* Select Ready Items  
* Partial Quantity Ordering  
* Order Validation  
* Order Snapshot  
* Multi-Supplier Split  
* Order Detail  
* Timeline  
* Documents  
* Cancellation Request

## **Payment**

* Deposit 50%  
* Balance 50%  
* Freight  
* Invoice  
* Upload Slip  
* Finance Verification  
* Rejection and Resubmission  
* Payment History

## **Supplier Operation**

* Supplier Order  
* PO  
* Factory Confirmation  
* Supplier Payment Record

## **Production**

* Status  
* Progress  
* ETA  
* Photos/Videos  
* Delay Flag

## **QC**

* Inspection  
* Checklist  
* Media  
* Rework  
* Standard QC View  
* Custom Member Approval

## **Logistics**

* Warehouse Receipt  
* Consolidation  
* Partial Shipment  
* Shipment  
* Tracking  
* ETA  
* Import Status

## **Delivery**

* Scheduling  
* Reschedule Request  
* Proof of Delivery  
* Partial Delivery  
* Delivered with Issue

## **Freight**

* Actual Cost Entry  
* Member Charge  
* Freight Invoice  
* Payment Verification

## **Claim**

* Create Claim  
* Select Items  
* Evidence  
* Status  
* Resolution  
* Timeline

---

# **97\. Acceptance Criteria Volume 2**

Volume 2 ถือว่าสมบูรณ์เมื่อ

1. Member เลือก Ready Project Items ได้  
2. Member สั่งบางส่วนของ Quantity ได้  
3. ระบบตรวจ Option, Price และ Supplier ก่อนสร้าง Order  
4. ระบบ Snapshot ราคาและสเปกได้  
5. Customer Order หนึ่งรายการแยกหลาย Supplier Orders ได้  
6. Order Creation เป็น Transaction และไม่สร้างข้อมูลค้างเมื่อผิดพลาด  
7. ระบบสร้าง Deposit Schedule 50% ได้  
8. Member ดาวน์โหลด Deposit Invoice ได้  
9. Member อัปโหลดสลิปได้  
10. Finance Verify หรือ Reject ได้  
11. ห้ามเปิด PO ก่อน Deposit Verified  
12. Purchasing สร้างและออก PO ได้  
13. Admin บันทึก Factory Confirmation ได้  
14. Admin บันทึก Supplier Payment แยกได้  
15. Member เห็น Production Overview ได้  
16. Admin อัปเดต Production พร้อมรูปและวิดีโอได้  
17. ระบบแสดง Delay ได้  
18. QC Team สร้าง Inspection ได้  
19. Standard Product แสดง QC Report โดยไม่ต้อง Member Approve  
20. Custom Product ต้อง Member Approve ก่อน Shipping  
21. Member ขอ Additional Review ได้  
22. ระบบติดตาม Rework และ Reinspection ได้  
23. Finance ออก Balance Invoice ได้  
24. Member อัปโหลด Balance Slip ได้  
25. Warehouse บันทึกรับสินค้าและ Discrepancy ได้  
26. ระบบรวมสินค้าหลาย Supplier Orders ได้  
27. ระบบรองรับ Partial Shipment ได้  
28. Shipment Quantity ไม่เกิน Remaining Quantity  
29. Member เห็น Shipment Timeline และ ETA ได้  
30. ระบบแสดง Import Status ได้  
31. Logistics สร้าง Delivery Appointment ได้  
32. Member ยืนยันหรือขอเปลี่ยนนัดได้  
33. Delivery ต้องมี Proof และ Receiver  
34. ระบบรองรับ Partial Delivery ได้  
35. Delivered with Issue สร้าง Claim ต่อได้  
36. Admin บันทึก Logistics Cost และ Member Charge แยกได้  
37. Finance ออก Freight Invoice ได้  
38. Member ชำระ Freight และ Finance Verify ได้  
39. Order เป็น Completed เมื่อส่งครบและชำระครบ  
40. Member สร้าง Claim พร้อมหลักฐานได้  
41. Admin อัปเดต Claim และ Resolution ได้  
42. Member ยืนยันผล Resolution ได้  
43. Cancellation หลัง Deposit Verified ต้องผ่าน Request  
44. Member ไม่เห็น Factory Cost, Supplier Payment หรือ Margin  
45. Member เห็นเฉพาะ Order และ Claim ของตนเอง  
46. Suspended Member ไม่สร้าง Order ใหม่  
47. ทุก Action สำคัญมี Timeline และ Audit Log  
48. Mobile Order, Payment, QC และ Delivery ใช้งานได้  
49. ทุกหน้ามี Loading, Empty และ Error State  
50. Notification เชื่อมไปยัง Action ที่ถูกต้อง

---

# **98\. Handoff ให้ทีม UI Design**

ทีม UI ต้องสร้าง Prototype อย่างน้อย

1. Ready-to-Order Selection  
2. Create Order Steps  
3. Order Success  
4. Order Listing  
5. Order Detail  
6. Payment Slip Upload  
7. Production Overview  
8. QC Report  
9. Custom QC Approval  
10. Shipment Tracking  
11. Delivery Appointment  
12. Proof of Delivery  
13. Freight Invoice  
14. Create Claim  
15. Claim Detail

ต้องออกแบบ

* Desktop  
* Tablet  
* Mobile  
* Action Required States  
* Delayed States  
* Payment Rejected  
* QC Rework  
* Partial Shipment  
* Delivered with Issue  
* Claim Resolution

---

# **99\. Handoff ให้ Codex**

แนะนำแบ่งเป็น Sprint

## **Sprint F: Order Foundation**

* Ready-to-Order Selection  
* Validation  
* Customer Order  
* Order Snapshot  
* Supplier Order Splitting  
* Order Detail  
* Timeline

## **Sprint G: Customer and Supplier Payment**

* Deposit Schedule  
* Deposit Invoice  
* Slip Upload  
* Finance Verification  
* PO  
* Supplier Payment

## **Sprint H: Production and QC**

* Production Updates  
* Media  
* QC Inspection  
* Rework  
* Custom Member Approval  
* Balance Payment

## **Sprint I: Warehouse and Shipment**

* Warehouse Receipt  
* Consolidation  
* Partial Shipment  
* Shipment  
* Tracking  
* Import Status

## **Sprint J: Delivery, Freight and Claim**

* Delivery Scheduling  
* Proof of Delivery  
* Logistics Cost  
* Freight Invoice  
* Claim  
* Cancellation  
* Completion

Codex ห้าม

* เปลี่ยน Payment Terms 50/50  
* รวม Customer Payment กับ Supplier Payment  
* แสดง Factory Cost ให้ Member  
* ข้าม Member Approval สำหรับ Custom Product  
* สร้าง Shipment เกิน Remaining Quantity  
* Mark Delivered โดยไม่มี Proof  
* Mark Completed ก่อน Freight Verified

---

# **100\. ข้อสรุป**

GISP UX/UI Volume 2 เปลี่ยนรายการสินค้าที่พร้อมสั่งให้กลายเป็นออเดอร์ที่ติดตามได้ตลอดกระบวนการ

เส้นทางหลักคือ

พร้อมสั่ง  
→ สร้างออเดอร์  
→ ชำระมัดจำ  
→ เปิด PO  
→ ผลิต  
→ QC  
→ ชำระยอดคงเหลือ  
→ รับเข้าโกดังจีน  
→ รวมสินค้า  
→ ขนส่ง  
→ ส่งมอบ  
→ ชำระค่าขนส่ง  
→ เคลมถ้ามี  
→ เสร็จสมบูรณ์

หัวใจของ UX Volume 2 คือ

1. สมาชิกเห็นภาพรวมออเดอร์เดียว แม้มีหลายโรงงาน  
2. ระบบแสดงสิ่งที่สมาชิกต้องทำก่อนข้อมูลอื่น  
3. ราคาสินค้า ค่าขนส่ง และต้นทุนโรงงานต้องแยกกัน  
4. การเงินทุกงวดต้องตรวจสอบย้อนหลังได้  
5. Timeline ต้องอธิบายกระบวนการที่ซับซ้อนให้เข้าใจง่าย  
6. Production และ QC ต้องมีหลักฐาน  
7. สินค้า Custom ต้องได้รับการอนุมัติก่อนจัดส่ง  
8. ระบบต้องรองรับการรวมสินค้าและส่งบางส่วน  
9. Delivery ต้องมีหลักฐานรับสินค้า  
10. Claim ต้องเชื่อมกับ Order Item และ Delivery จริง  
11. Member ต้องไม่เห็นข้อมูลต้นทุนและการจ่ายโรงงาน  
12. ทุกการเปลี่ยนสถานะสำคัญต้องมีผู้รับผิดชอบและประวัติ

เอกสารลำดับถัดไปคือ **GISP UX/UI Flow Specification Volume 3: Admin, Product Management, Finance, Operations, Reports and System Settings**
