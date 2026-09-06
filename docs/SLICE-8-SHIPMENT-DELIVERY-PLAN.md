# Slice 8 — Shipment และ Delivery

สถานะเอกสาร: `SLICE_8_ACCEPTED — DONE ON DEVELOPMENT`  
เป้าหมาย Environment: InsForge Development หลังผ่าน Backend Branch UAT  
ข้อจำกัด: ห้าม Merge, Deploy หรือเปลี่ยนค่าใด ๆ บน Production จนกว่าจะมีคำอนุมัติแยก

## สถานะการพัฒนา ณ 30 สิงหาคม 2026

- Git Branch: `slice-8-shipment-delivery`
- InsForge Backend Branch: `slice-8-shipment-delivery` (`FULL`, เก็บไว้เป็นหลักฐาน UAT)
- Schema Migration: ผ่าน
- Warehouse/Consolidation/Shipment/Tracking API และหน้าจอ Admin/Member: พร้อม UAT
- Appointment/Reschedule/POD/Freight Invoice/Payment Verification API และหน้าจอ: พร้อม UAT
- Slice 8 Integration Test: ผ่าน 12 assertions รวม Member Partial Visibility และ Duplicate/Backward Tracking Guard
- Regression: ESLint ผ่าน, TypeScript ผ่าน, Unit Test 103/103 ผ่าน, Next.js Build ผ่าน
- Browser E2E: ผ่านครบ Receipt → Partial acknowledgement → Tracking → Reschedule → POD → Freight Invoice → Payment Verification → Order Completed
- Human UAT Fixture: `ORD-S8-HUAT-1788091968175`
- Human UAT และ Owner Sign-off: ผ่านเมื่อ 30 สิงหาคม 2569
- Backup ก่อน Merge: `slice8-pre-merge-20260830` (`39b3eb20-3d09-4293-a2c2-8e0df30a199f`, completed)
- Merge Resolution: เก็บ Scheduled Jobs/Secrets ของ Development และ Apply Migration Slice 8 ที่ตรวจแล้ว 4 ไฟล์; Post-resolution Schema Diff = 0
- Development Integration: ผ่าน 12/12 assertions; Order `ORD-S8-1788098232591` จบที่ `COMPLETED`
- Development Deployment: `6eb0f96f-1655-4e77-9c7a-efddf5154c0e` สถานะ `READY`
- Post-merge Smoke: Health, Admin/Member Login, Order API/Page ผ่าน HTTP 200; Member ไม่เห็น Supplier Cost/Internal Note
- ขั้นถัดไปเพื่อปิด Slice 8: ไม่มี (`0 ขั้นตอน`)
- Production: ไม่ได้แตะต้อง

## 1. เป้าหมายและ Definition of Done

Slice 8 ต้องครอบคลุมเส้นทางตั้งแต่สินค้าผ่าน Dispatch Gate จนส่งมอบครบและ Finance
ตรวจรับค่าขนส่งจริง โดยมีประวัติย้อนหลังและไม่เปิดเผยต้นทุนภายในแก่ Member

Slice ปิดได้เมื่อ:

1. Warehouse Receipt เชื่อม Supplier Order และเปรียบเทียบ Expected/Received ได้
2. เฉพาะจำนวนที่รับและตรวจแล้วเท่านั้นที่นำเข้า Consolidation ได้
3. Shipment Quantity ไม่เกินจำนวนที่ผ่าน Dispatch Gate, พร้อมที่คลัง และยังไม่เคยถูกส่ง
4. Partial Shipment มีเหตุผล และถ้า Member ต้องรับค่าใช้จ่ายเพิ่มต้องมีการรับทราบก่อน Dispatch
5. Tracking/Import Timeline เป็นประวัติแบบเพิ่มรายการใหม่ ไม่แก้ทับเหตุการณ์เดิม
6. นัดส่ง ยืนยันนัด และขอเลื่อนนัดมีผู้กระทำ เวลา เหตุผล และผลการพิจารณาครบ
7. Delivery ทุกครั้งมีผู้รับ เวลา จำนวนจริง และหลักฐานอย่างน้อยหนึ่งรายการ
8. Partial Delivery คง Remaining Quantity; Delivered with Issue ระบุ Item/Quantity และเปิด Claim ต่อได้
9. Actual Freight แยก Internal Cost ออกจาก Member Charge และ Member ไม่เห็นต้นทุนภายใน
10. Freight Invoice ออกหลังสรุปยอดจริง, ใช้ Payment Slip/Finance Verification เดิม และยอดค้างเป็นศูนย์เมื่อชำระครบ
11. Order เป็น `COMPLETED` เมื่อส่งครบทุกจำนวนและ Freight Payment เป็น `VERIFIED`
12. Automated Test, Preview, Human UAT และ Owner Sign-off ผ่านก่อน Merge เข้า Development

## 2. Workflow ที่ยืนยันใช้

```text
Dispatch Gate ผ่าน
  -> รับสินค้าที่โกดังจีน (Warehouse Receipt)
  -> ตรวจ Expected เทียบ Received และบันทึกปัญหา/หลักฐาน
  -> Release เฉพาะจำนวนที่พร้อม
  -> วางแผน Consolidation (ค่าเริ่มต้น Consolidate All)
  -> Confirm Consolidation หรือเสนอ Partial/Direct Shipment
  -> ถ้ามีค่าใช้จ่ายเพิ่มและเรียกเก็บ Member: รอ Member Acknowledgement
  -> สร้าง Shipment และตรวจ Quantity Guard ซ้ำ
  -> Dispatch
  -> Tracking: Departed -> In Transit -> Thailand -> Customs -> Thailand Warehouse
  -> พร้อมนัดส่ง
  -> Logistics เสนอนัด -> Member ยืนยัน หรือขอเลื่อน -> Logistics ยืนยันวันใหม่
  -> Out for Delivery
  -> Delivered / Partially Delivered / Delivered with Issue / Failed
  -> สรุป Actual Logistics Cost
  -> Finance ออก Freight Invoice
  -> Member อัปโหลดสลิป
  -> Finance Verify
  -> ส่งครบ + Freight Verified -> Order COMPLETED
```

## 3. UX และ Business Rules

### 3.1 Warehouse Receipt

หน้าจอ Admin ต้องแสดง Warehouse, Supplier Order, วันที่รับ, จำนวน Package, น้ำหนักจริง,
CBM จริง, จำนวนราย Item, สภาพสินค้า, ส่วนต่าง, Note และ Evidence

สถานะที่ใช้:

- `EXPECTED`
- `PARTIALLY_RECEIVED`
- `RECEIVED_COMPLETE`
- `DISCREPANCY`
- `DAMAGED`
- `READY_FOR_CONSOLIDATION`

กติกา:

- Receipt Number ใช้ `WRC-YYYY-NNNNNN`
- Receipt หนึ่งรายการผูก Supplier Order เดียว แต่ Supplier Order รับของได้หลายครั้ง
- Received Quantity ต้องมากกว่า 0 และยอดรับสะสมห้ามเกิน Expected Quantity
- ถ้าจำนวนไม่ตรงหรือสภาพไม่ดี ต้องมี Note และ Evidence อย่างน้อยหนึ่งไฟล์
- Logistics ต้องกด Release ราย Item; การรับของไม่เท่ากับพร้อม Consolidation โดยอัตโนมัติ
- Released Quantity ห้ามเกิน Received Quantity ที่ไม่ถูก Block และยังไม่ถูกนำไป Consolidate
- Member เห็นเพียงสถานะย่อและจำนวนที่เกี่ยวข้องกับ Order ตนเอง ไม่เห็นรายละเอียด Package ภายใน

### 3.2 Consolidation

ค่าเริ่มต้นคือ `CONSOLIDATE_ALL` ตาม Customer Order เดียวกันและ Warehouse เดียวกัน

สถานะที่ใช้:

- `DRAFT`
- `CONFIRMED`
- `SHIPMENT_CREATED`
- `CANCELLED`

กติกา:

- Consolidation Number ใช้ `CNS-YYYY-NNNNNN`
- Item ต้องมาจาก Warehouse เดียวกัน, Customer Order เดียวกัน และอยู่ในสถานะ Released
- Quantity ห้ามเกิน Warehouse-ready Remaining Quantity
- ก่อน Confirm เพิ่ม/ลด Item ได้; หลัง Confirm ห้ามแก้ Item โดยตรง
- หากต้องเปลี่ยนหลัง Confirm ให้ Cancel พร้อมเหตุผล แล้วสร้าง Revision/Consolidation ใหม่
- Confirm แล้วจึงสร้าง Shipment แบบ `CONSOLIDATED` ได้

### 3.3 Partial และ Direct Shipment

Shipment Type:

- `CONSOLIDATED`
- `PARTIAL`
- `DIRECT`

Shipping Method:

- `LCL`
- `FCL`
- `TRUCK`
- `AIR`
- `COURIER`

กติกา:

- `PARTIAL` ต้องมีเหตุผล, ผลกระทบต่อเที่ยวที่เหลือ และผู้อนุมัติภายใน
- ถ้ามี Additional Member Charge มากกว่า 0 ต้องมี Member Acknowledgement ก่อน Dispatch
- หาก GISP รับภาระค่าใช้จ่ายเพิ่มเอง ให้แจ้ง Member ได้แต่ไม่ต้องรออนุมัติ
- `DIRECT` ต้องระบุเหตุผลและสิทธิ์ Direct Ship; ไม่ข้าม Dispatch Gate
- Quantity Guard ใช้ค่าต่ำสุดของ:
  - จำนวน Order Item ที่ยังไม่ถูกส่ง
  - จำนวนที่ผ่าน Dispatch Gate
  - จำนวน Warehouse-ready ที่ยังไม่ถูกใช้ หรือจำนวน Direct-ready ที่อนุมัติแล้ว
- ตรวจ Gate ทั้งตอนสร้าง Shipment และก่อน Dispatch เพื่อป้องกันสถานะเปลี่ยนระหว่างทาง
- ETD ต้องไม่หลัง ETA และ Shipment ที่ Dispatch แล้วห้ามเปลี่ยน Item/Quantity

### 3.4 Tracking และ Import Status

Tracking Event เป็น Append-only และมี Date, Location, Note, Evidence, Delay Flag,
Member Visibility และผู้บันทึก

ลำดับหลัก:

- `FACTORY_PICKUP_SCHEDULED`
- `PICKED_UP_FROM_FACTORY`
- `ARRIVED_CHINA_WAREHOUSE`
- `CONSOLIDATED`
- `BOOKED`
- `EXPORT_CUSTOMS`
- `DEPARTED_CHINA`
- `IN_TRANSIT`
- `ARRIVED_THAILAND`
- `IMPORT_CUSTOMS`
- `THAILAND_WAREHOUSE`
- `READY_FOR_DELIVERY`

กติกา:

- สถานะหลักห้ามถอยหลัง; Delay Event แทรกได้โดยไม่เปลี่ยนลำดับหลัก
- ETA ใหม่ที่ช้ากว่า ETA เดิมต้องมี Delay Reason และเก็บ Original ETA
- แจ้ง Member เมื่อเปลี่ยน Milestone หรือ ETA เปลี่ยนอย่างมีนัยสำคัญ ไม่แจ้งซ้ำจากการขยับเล็กน้อย
- Member เห็น Timeline แบบย่อ; Customs Entry, ภาษี, Broker และเอกสารภายในเป็น Internal-only

### 3.5 Delivery Appointment และ Reschedule

สถานะนัดส่ง:

- `PROPOSED`
- `MEMBER_CONFIRMED`
- `RESCHEDULE_REQUESTED`
- `UNDER_REVIEW`
- `CONFIRMED`
- `OUT_FOR_DELIVERY`
- `ARRIVED`
- `DELIVERED`
- `PARTIALLY_DELIVERED`
- `DELIVERED_WITH_ISSUE`
- `FAILED`
- `RESCHEDULE_REQUIRED`

กติกา:

- สร้างนัดได้เมื่อ Shipment ถึงคลังไทยและเป็น `READY_FOR_DELIVERY`
- นัดใช้ Delivery Address Snapshot จาก Order; การแก้ Project Address ภายหลังไม่เปลี่ยนนัดเดิม
- Member ยืนยันนัด, ขอเลื่อน, แก้ผู้ติดต่อ และเพิ่ม Site Note ได้
- คำขอเลื่อนต้องมี Preferred Dates และ Reason; ระบบไม่ยืนยันวันใหม่เอง
- Logistics ต้อง Accept/Reject คำขอ พร้อม Note; ทุก Revision เก็บเวลาและผู้กระทำ
- การเปลี่ยน Address ต้องให้ Admin ตรวจผลกระทบและค่าใช้จ่ายก่อน

### 3.6 Proof of Delivery

ขั้นต่ำสำหรับผลส่งมอบทุกแบบที่มีของถึงผู้รับ:

- Delivered At
- Recipient Name
- Item Quantities
- Evidence อย่างน้อยหนึ่งรูป หรือ Signature/Confirmation

กติกาเพิ่มเติม:

- Proof เก็บได้หลายไฟล์ และต้องบันทึกทั้ง Storage `url` และ `key` ผ่าน File Metadata เดิม
- Delivery Quantity สะสมห้ามเกิน Shipment Item Quantity และ Order Item Remaining Quantity
- `PARTIALLY_DELIVERED` ต้องมี Remaining Quantity, Reason และ Next Delivery Plan
- `DELIVERED_WITH_ISSUE` ต้องระบุ Item, Quantity, Issue Type, Description และ Evidence
- Delivery with Issue ถือว่า Quantity ถูกส่งแล้ว แต่ข้อมูลปัญหาต้องส่งต่อไปสร้าง Claim ได้
- `FAILED`/`RESCHEDULE_REQUIRED` ต้องมี Reason และห้ามนับ Delivered Quantity

### 3.7 Actual Logistics Cost และ Freight Invoice

Cost Category:

- `CHINA_DOMESTIC_TRANSPORT`
- `WAREHOUSE`
- `INSPECTION`
- `CONSOLIDATION`
- `PACKING`
- `INTERNATIONAL_FREIGHT`
- `INSURANCE`
- `CUSTOMS`
- `TAX`
- `THAILAND_WAREHOUSE`
- `THAILAND_DELIVERY`
- `LIFTING`
- `OTHER`

แต่ละรายการเก็บ Supplier/Internal Cost, Member Charge, Currency, Exchange Rate, Billable,
Evidence และ Internal/Member-visible Note แยกกัน

กติกา:

- `LOGISTICS` บันทึกข้อมูลปฏิบัติการและหลักฐาน; `FINANCE` ยืนยันยอดเรียกเก็บและออก Invoice
- Member เห็นเฉพาะ Member Charge และคำอธิบายที่เปิดเผยได้
- Supplier Cost, Exchange Margin, Internal Note และ Confidential Evidence ห้ามออกผ่าน Member API
- Cost Item ที่ถูกใส่ใน Invoice แล้วแก้ทับไม่ได้; ต้องสร้าง Adjustment ใหม่พร้อมเหตุผล
- MVP ใช้ Freight Invoice หนึ่งใบต่อ Order และเลข `INV-FRT-YYYY-NNNNNN`
- ออก Invoice ได้เมื่อ Actual Cost ถูก Finalize และมี Delivery แล้ว; ก่อนปิด Order ต้องส่งครบทุกจำนวน
- ตอนออก Invoice ให้ Snapshot รายการและยอดลง Freight Invoice Item แล้วสร้าง `payment_schedules.FREIGHT`
- ใช้ Payment Transfer, Slip, Partial/Overpayment Guard และ Finance Verification จาก Slice 6
- Verified Amount ครบ Due Amount -> Freight Schedule `VERIFIED`, Outstanding = 0
- Order เปลี่ยนเป็น `COMPLETED` ผ่านฟังก์ชันกลางเท่านั้น เมื่อ:
  - จำนวน Order Item ทุกตัวถูกส่งครบ
  - ไม่มี Delivery ที่รอ Reschedule/Partial Remaining
  - มี Freight Invoice และ Freight Schedule เป็น `VERIFIED`
  - Order ไม่อยู่ในสถานะยกเลิก
- Claim เป็น Workflow แยก: Delivery with Issue นับจำนวนว่าส่งแล้วและไม่บังคับให้ Slice 8 รอ Slice 9

## 4. Data Model ที่จะเพิ่ม/ปรับ

ตารางใหม่:

- `warehouses`
- `warehouse_receipts`
- `warehouse_receipt_items`
- `warehouse_receipt_files`
- `consolidation_groups`
- `consolidation_items`
- `consolidation_events`
- `partial_shipment_decisions`
- `partial_shipment_responses`
- `shipment_status_history`
- `shipment_documents`
- `delivery_appointment_events`
- `delivery_reschedule_requests`
- `delivery_evidence`
- `logistics_cost_items`
- `logistics_cost_evidence`
- `freight_invoices`
- `freight_invoice_items`

ตารางเดิมที่ต้องขยาย:

- `shipments`: Order, Consolidation, Type, Method, Warehouses, Package/Weight/CBM,
  Carrier/Container/BL, ETD/ETA/Actual Times, Delay และ Current Milestone
- `shipment_items`: Supplier Order Item, Warehouse Receipt Item และปริมาณจริง
- `deliveries`: Address Snapshot, Time Window, Contact, Driver/Vehicle, Appointment Status และ Result
- `delivery_items`: Shipment Item, Expected/Delivered/Remaining, Condition และ Issue Detail
- `payment_schedules`: ใช้ชนิด `FREIGHT` เดิม ไม่สร้าง Payment Flow ซ้ำ

ตาราง Timeline, Evidence, Invoice Item และ Cost Adjustment ต้องเป็น Append-only สำหรับ Runtime Role

## 5. API และหน้าจอที่จะพัฒนา

Admin/Logistics:

- Warehouse Receipt list/detail/create/release
- Consolidation planning/detail/confirm/cancel
- Partial Shipment decision และ Member acknowledgement status
- Shipment create/detail/dispatch/tracking/import status
- Delivery schedule/detail/reschedule decision/status/proof
- Actual Logistics Cost summary

Admin/Finance:

- Finalize Actual Cost
- Issue Freight Invoice
- Freight Payment queue และ Verify/Reject โดยใช้ Payment Flow เดิม

Member:

- Order logistics summary และ Shipment detail/timeline
- Partial Shipment acknowledgement
- Delivery appointment confirm/reschedule
- Delivery proof/result
- Freight Invoice detail และ Upload Payment Slip

ข้อมูล Member ต้องผ่าน Projection/API ที่เลือกคอลัมน์ชัดเจน ห้ามใช้ `select('*')`

## 6. Permission Contract

- `LOGISTICS`: Warehouse Receipt, Consolidation, Shipment, Tracking, Appointment และ Delivery
- `FINANCE`: Actual Cost review, Member Charge, Freight Invoice และ Payment Verification
- `MEMBER`: อ่านข้อมูลของ Organization ตน, ตอบ Partial Cost, ยืนยัน/เลื่อนนัด, ดู Proof/Invoice และส่ง Slip
- `SUPER_ADMIN`: สิทธิ์ทั้งหมด
- `EXECUTIVE`: อ่าน Summary เท่านั้น

ทุกตารางใช้ RLS + SQL Grant คู่กัน; Helper ที่อ่านตาราง RLS ใช้ `SECURITY DEFINER`,
กำหนด `search_path` และมี Index บน Organization/Order/Shipment/Status/Foreign Key ที่ใช้ใน Policy

## 7. Automated Test และ UAT Gate

Automated Integration ต้องครอบคลุมอย่างน้อย:

1. รับของบางส่วนและรับครบ
2. Block Discrepancy/Damaged ก่อน Release
3. ห้าม Received/Released/Consolidated/Shipment Quantity เกินต้นทาง
4. ห้ามรวมข้าม Order หรือ Warehouse
5. Confirmed Consolidation แก้ Item ไม่ได้
6. Partial Shipment ไม่มีเหตุผลต้องไม่ผ่าน
7. Additional Member Charge ต้องรอ Acknowledgement
8. Dispatch Gate ถูกตรวจซ้ำก่อน Dispatch
9. Tracking ห้ามย้อนสถานะและ Delay ต้องมีเหตุผล
10. Member ไม่เห็น Customs/Internal Cost/Confidential Evidence
11. Reschedule ไม่ยืนยันอัตโนมัติ
12. Delivery ไม่มี Recipient หรือ Evidence ต้องไม่ผ่าน
13. Partial Delivery คำนวณ Remaining ถูกต้อง
14. Delivered with Issue สร้าง Claim Prefill ได้
15. Freight Invoice Snapshot เปลี่ยนตาม Cost Item ภายหลังไม่ได้
16. Freight Partial Payment/Overpayment/Reject/Verify ทำงานตาม Slice 6
17. ส่งยังไม่ครบหรือ Freight ยังไม่ Verified ต้องห้าม `COMPLETED`
18. ส่งครบและ Freight Verified จึงเป็น `COMPLETED`

Human UAT ใช้บทบาท Logistics, Finance และ Member ในเส้นทางเดียวกัน ตั้งแต่ Receipt ถึง Completion
และ Owner Sign-off ต้องเกิดก่อน Backup/Merge เข้า Development

## 8. Branch และ Release Gate

- Git branch: `slice-8-shipment-delivery`
- Backend branch: `slice-8-shipment-delivery` แบบ `full` — เก็บไว้เป็นหลักฐาน UAT จนกว่าจะมีคำสั่งลบแยก
- Owner อนุมัติให้ลบ Backend Branch `slice-6-orders-payments` เมื่อ 30 สิงหาคม 2569
  หลังยืนยันว่า Merge แล้ว เพื่อปลดโควตาและสร้าง Branch นี้
- `.insforge/project.json` ชี้ Development หลังปิดงาน; `.env.local` ยังเก็บค่า Branch สำหรับหลักฐาน/การตรวจย้อนหลัง
- Merge dry-run พบเฉพาะ Runtime Metadata Conflict ใน `schedules.jobs` และ `system.secrets`; จึงเก็บค่าของ Development และ Apply Migration Slice 8 ทั้ง 4 ไฟล์โดยตรงหลัง Backup
- หลัง UAT/Sign-off: Backup Development -> Review Dry-run SQL -> Resolve Conflict -> Apply Migration -> Deploy Development -> Smoke test ผ่านครบแล้ว
- Production ไม่อยู่ใน Slice 8 release นี้
