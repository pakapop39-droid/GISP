# GISP — DEMO STORY AND MOCK DATA

**Document Version:** 1.4  
**Status:** MVP Readiness Prototype Implemented — Awaiting UAT Sign-off  
**Prepared:** 1 สิงหาคม 2569 (2026-08-01)  
**Deployed:** 1 สิงหาคม 2569 (2026-08-01)  
**Business Authority:** `MVP BUSINESS MASTER PLAN.md`  
**Decision Authority:** `DECISION LOG.md`  
**Live Demo URL:** `https://gisp-mvp-demo.insforge.site`

ตาม DEC-030 เอกสารและ Demo Version 1.3 นี้เป็น Baseline สำหรับ Human UAT และ Demo Gate ปัจจุบัน
Full Demo Unified State Version 4 เป็น Optional Enhancement และไม่เป็น Gate ใหม่

---

## 1. วัตถุประสงค์

Demo นี้ใช้ให้ทีมงาน GISP และสมาชิกเห็นภาพรวมของ Application
ก่อนพัฒนาและทดลองระบบจริง โดยใช้เรื่องหลักเรื่องเดียวตั้งแต่ Project ถึง Claim

Demo ต้อง:

- กดดำเนินเรื่องตามลำดับได้
- เปลี่ยนบทบาทผู้ชมได้
- ย้อนฉากและรีเซ็ตข้อมูลได้
- แสดงทั้งกรณีปกติและกรณีที่ต้องตัดสินใจ
- ใช้ข้อมูลสมมติทั้งหมด
- ไม่เขียนข้อมูลไปที่ `gisp-mvp-development`
- ไม่มี Commission, Advanced BI, AI Import หรือระบบชำระเงินจริง

ข้อมูลและเอกสารทุกชิ้นต้องมีคำว่า `DEMO`

---

## 2. รูปแบบ Demo

### 2.0 สองโหมดบน URL เดียว

- หน้าเลือกโหมด: `https://gisp-mvp-demo.insforge.site`
- Overview Demo: `https://gisp-mvp-demo.insforge.site/?mode=overview`
- Functional Prototype: `https://gisp-mvp-demo.insforge.site/?mode=prototype`

Overview เป็น Guided Story 10 ขั้นเดิม ส่วน Functional Prototype เป็นพื้นที่ทดลอง
5 Workflow แบบแก้ข้อมูล อนุมัติ ส่งต่องาน และทดสอบ Business Guard ได้จริง
โดยทั้งสองโหมดใช้ข้อมูล Riverstone ชุดเดียวกัน แต่ใช้ Local Storage คนละ Key
และ Reset แยกกัน

### 2.1 กลุ่มผู้ชม

- ทีมงาน GISP
- สมาชิกหรือตัวแทนจำหน่าย

### 2.2 วิธีเข้าใช้

ผู้ชมเข้าได้ทันทีโดยไม่ต้องสมัครบัญชีจริง และใช้ Demo Control Bar
เพื่อสลับบทบาท:

| บทบาท | สิ่งที่ต้องเห็น |
|---|---|
| Member | Catalog, Member Price, Project, Quotation, Order, Payment, QC, Shipment และ Claim |
| GISP Admin | Product/Supplier, RFQ, Quotation, Order และ Supplier Order |
| Finance | Payment Schedule, Transfer Verification และ Supplier Payment |
| QC | Production Timeline, Inspection, Rework และ Reinspection |
| Logistics | Dispatch Gate, Partial Shipment, Tracking และ Delivery |
| Executive | Order, Payment, Delay, Delivery และ Claim Summary แบบอ่านอย่างเดียว |

Role Switcher ใช้เพื่อการนำเสนอเท่านั้น ไม่ถือเป็นระบบ Permission จริง โดย `GISP Admin` รวม
Product Admin, Order Admin และสิทธิ์ที่จำเป็นเฉพาะ Demo ส่วน Production ใช้ Role Catalog ตาม DEC-035

### 2.3 การเก็บสถานะ

- เก็บสถานะ Demo แยกใน Browser
- เปิดคนละ Browser แล้วได้ชุดข้อมูลอิสระ
- ปุ่ม Reset กลับไปฉาก `WELCOME` และบทบาท `MEMBER`
- Demo Action ห้ามเรียก Transaction API ของ Development

### 2.4 Functional Prototype

Functional Prototype เริ่มจาก Member และมี App Shell, Module Navigation,
Role Switcher, Action Required และ Mission Progress ครบ 5 Mission:

1. Catalog และ Project Builder
2. RFQ และ Quotation Version/Snapshot
3. Order และ Partial Payment
4. Production, QC และ Dispatch Gate
5. Partial Shipment, Delivery และ Claim

ทุกการเปลี่ยนสถานะใช้ Pure Reducer และ Guard ใน Browser พร้อม Audit Timeline
จำนวนเงินเก็บเป็น Decimal String และคำนวณ Round Half-up สองตำแหน่ง
ไฟล์ที่ผู้ทดลองเลือกเก็บเฉพาะชื่อ ประเภท และขนาด ไม่อัปโหลดไป Storage

### 2.5 MVP Readiness Modules (Version 3)

Version 3 ต่อเติม Functional Prototype เดิมและไม่สร้าง Demo ใหม่ ประกอบด้วย:

1. Foundation & Permission — สมัคร/บริษัท/อนุมัติ/Multi-role และ Permission Denial แบบจำลอง
2. Product & Supplier Admin — Supplier, Product Draft, Active Member Price, Publish/Discontinue และ Member Preview
3. Role Dashboard & Action Required — งานต้นทาง, Assignment และ Due Date ตามบทบาท
4. Exception & Recovery — Expired/Revision, Duplicate Guard, Price/Product Guard, Payment Resubmit,
   Production Delay, QC Correction, Delivery Evidence และ Claim Rejection Reason
5. UAT & Sign-off — 8 Scenario เก็บผลและหมายเหตุใน Browser พร้อม Print/Save PDF

State ใช้ Schema Version 3 และ key `gisp-demo-prototype-v3` แยกจาก Overview State โดย Version เก่า
จะเริ่มใหม่หนึ่งครั้งเมื่อเปิด Version 3 ส่วน `APPROVED FOR MVP BUILD` เกิดได้เฉพาะเมื่อ UAT ทั้ง 8
Scenario เป็น `ผ่าน` และ GISP Admin กด Sign-off เท่านั้น

---

## 3. Demo Story หลัก

สมาชิก `Atelier Nara Design Co., Ltd.` ดูแลโครงการ
`Riverstone Boutique Hotel Bangkok` ให้ลูกค้า
`Siam Riverstone Hospitality Co., Ltd.`

โครงการประกอบด้วยพื้นที่ Lobby, Guest Rooms และ All-day Dining
มีสินค้ามาตรฐานและสินค้าสั่งผลิตจากโรงงานสมมติสามราย

### Scene 0 — เริ่ม Demo และเลือกบทบาท

- สถานะ: `WELCOME`
- บทบาทเริ่มต้น: Member
- ข้อมูลธุรกรรมยังไม่ถูกสร้าง
- แสดงข้อความชัดเจนว่าเป็นข้อมูลสมมติ

### Scene 1 — Project และ Standard Catalog

- Member สร้าง `PRJ-2026-000001`
- เพิ่ม Standard Product 4 รายการ
- สินค้าทั้งหมดมี Active Member Price
- สถานะรายการเป็น `READY_TO_ORDER`
- ไม่สร้าง RFQ สำหรับสินค้า Standard
- เปิด Product Schedule PDF/Excel ได้

### Scene 2 — Custom RFQ

- Member เพิ่ม Reception Counter และ Upholstered Headboard
- ส่ง `RFQ-2026-000001` พร้อมสเปกและไฟล์อ้างอิงจำลอง
- รายการ Custom อยู่สถานะ `WAITING_QUOTATION`
- ยังสร้าง Order จากสองรายการนี้ไม่ได้

### Scene 3 — Quotation Revision และ Acceptance

- GISP ส่ง `QT-2026-000001` Version 1 ราคา 375,000 บาทก่อน VAT
- Member ขอเปลี่ยนลามิเนตเป็นวีเนียร์ Walnut และเพิ่ม Cable Management
- GISP สร้าง Version 2 ราคา 390,000 บาทก่อน VAT และ Lead Time 60 วัน
- Version 1 เป็น `SUPERSEDED`
- Version 2 เป็น `ACCEPTED`
- ระบบ Snapshot ราคา สเปก VAT และ Lead Time
- Custom Items เปลี่ยนเป็น `READY_TO_ORDER`

### Scene 4 — Order, Deposit และ PO

- Member สร้าง `ORD-2026-000001` จากทั้ง 6 รายการ
- Order แยกเป็น Supplier Order สามรายการ
- Deposit 481,500 บาท แบ่งโอนสองครั้ง
- Finance ยืนยันเฉพาะเมื่อยอดสะสมครบ
- หลัง Deposit Verified จึงเปิด PO ได้

### Scene 5 — Production, Delay และ QC

- โรงงานสินค้า Standard เริ่มผลิตตามปกติ
- Zhongshan Demo Living ล่าช้า 5 วัน
- Reception Counter ไม่ผ่าน QC เพราะเฉดสีวีเนียร์ไม่ตรง Approved Sample
- QC บันทึก Fail → Rework Required → Reinspection Passed
- สินค้า Custom ยังไม่ผ่าน Dispatch Gate เพราะ:
  - Member ยังไม่อนุมัติ
  - Customer Balance ยังไม่ Verified
  - Supplier Balance ยังไม่ Paid

### Scene 6 — Custom Approval และ Balance

- Member อนุมัติสีและสเปก Custom
- Balance 481,500 บาท แบ่งโอนสองครั้ง
- Finance ยืนยันยอดสะสมครบ
- Supplier Balance ทั้งสามโรงงานถูกบันทึกเป็น Paid
- Dispatch Gate ผ่านครบทั้ง 6 Project Items

### Scene 7 — Partial Shipment

- Logistics เสนอส่ง Standard ก่อนเพราะกำหนดเปิดโรงแรม
- Member รับทราบการส่งบางส่วน
- สร้าง:
  - `SHP-2026-000001` สำหรับ Standard Items
  - `SHP-2026-000002` สำหรับ Custom Items
- Order เป็น `PARTIALLY_SHIPPED`

### Scene 8 — Delivery with Issue และ Claim

- Shipment ทั้งสองส่งถึงโครงการ
- Custom Shipment ส่งมอบครบ
- Standard Shipment พบ Lounge Chair เสียหายหนึ่งตัว
- Delivery เป็น `DELIVERED_WITH_ISSUE`
- Member เปิด `CLM-2026-000001` พร้อมหลักฐานจำลอง
- Freight 96,300 บาทถูกออกเป็นงวดแยกและยังรอชำระ

### Scene 9 — Resolution และ Executive Summary

- โรงงานผลิต Lounge Chair ทดแทนหนึ่งตัว
- Member ยืนยันว่าได้รับสินค้าทดแทน
- Claim เป็น `CLOSED`
- Freight Verified
- Project และ Order เป็น `COMPLETED`
- Executive เห็น Summary ที่คำนวณจากข้อมูลชุดเดียวกัน

---

## 4. ข้อมูลจำลอง

### 4.1 บริษัทและผู้ใช้งาน

| รหัส | ชื่อ | ประเภท |
|---|---|---|
| GISP | Global Interior Supply Platform | ผู้บริหารระบบ |
| MEM-0001 | Atelier Nara Design Co., Ltd. | Member |
| CUS-0001 | Siam Riverstone Hospitality Co., Ltd. | End Customer |

ผู้ใช้จำลอง:

- นารา วัฒนศิลป์ — Member
- กิตติพงษ์ จัดซื้อ — GISP Admin
- พิมพ์ชนก การเงิน — Finance
- ธนกฤต ตรวจสินค้า — QC
- ศิรินทร์ โลจิสติกส์ — Logistics
- GISP Executive — Executive Viewer

ทุกชื่อเป็นชื่อสมมติ

### 4.2 Supplier

| Supplier | เมือง | รายการ |
|---|---|---|
| Foshan Demo Seating Works | Foshan | Lounge Chair, Dining Chair |
| Zhongshan Demo Living | Zhongshan | Side Table, Pendant Light |
| Guangzhou Demo Bespoke | Guangzhou | Reception Counter, Headboard |

Supplier Contact, Internal Note, Factory Cost และ Supplier Payment
เป็นข้อมูลภายใน ห้ามแสดงใน Member View

### 4.3 Product และราคา

| SKU | รายการ | ประเภท | จำนวน | ราคาต่อหน่วย | ยอดก่อน VAT |
|---|---|---:|---:|---:|---:|
| CHR-LNG-001 | Lounge Chair | Standard | 8 | 18,500 | 148,000 |
| TBL-SID-002 | Side Table | Standard | 12 | 6,200 | 74,400 |
| CHR-DIN-014 | Dining Chair | Standard | 24 | 7,900 | 189,600 |
| LGT-PEN-009 | Pendant Light | Standard | 10 | 9,800 | 98,000 |
| CUS-REC-001 | Reception Counter | Custom | 1 | 165,000 | 165,000 |
| CUS-HDB-010 | Upholstered Headboard | Custom | 10 | 22,500 | 225,000 |

Standard Subtotal = 510,000 บาท  
Custom Subtotal = 390,000 บาท  
Order Subtotal = 900,000 บาท

### 4.4 Factory Cost ภายใน

| Supplier Order | Factory Cost |
|---|---:|
| PO-2026-000001 — Seating | 198,400 |
| PO-2026-000002 — Living | 100,600 |
| PO-2026-000003 — Bespoke | 220,000 |
| **รวม** | **519,000** |

Factory Cost นี้ใช้เฉพาะ Admin/Executive Demo และห้ามอยู่ใน Member Fixture

### 4.5 VAT และ Payment

คำนวณแบบ Decimal และ Round Half-up สองตำแหน่ง:

| รายการ | จำนวนเงิน |
|---|---:|
| Order Subtotal | 900,000.00 |
| VAT 7% | 63,000.00 |
| Grand Total | 963,000.00 |
| Deposit 50% | 481,500.00 |
| Balance | 481,500.00 |

Deposit Transfers:

- PAY-2026-000001 = 300,000.00 บาท
- PAY-2026-000002 = 181,500.00 บาท

Balance Transfers:

- PAY-2026-000003 = 200,000.00 บาท
- PAY-2026-000004 = 281,500.00 บาท

Freight แยกจากสินค้า:

- Subtotal = 90,000.00 บาท
- VAT 7% = 6,300.00 บาท
- Grand Total = 96,300.00 บาท
- PAY-2026-000005 = 96,300.00 บาท

### 4.6 Executive Summary

| KPI | ค่า |
|---|---:|
| Gross Sales ก่อน VAT | 900,000.00 |
| Factory Cost | 519,000.00 |
| Gross Product Margin | 381,000.00 |
| Gross Product Margin % | 42.33% |
| Freight Revenue ก่อน VAT | 90,000.00 |
| Payment Verified รวม VAT/Freight | 1,059,300.00 |
| Production Delay | 1 Supplier Order |
| Delivery | 2 Shipments |
| Claim | 1 Submitted → Resolved → Closed พร้อม Resolution/Confirmation |

ไม่รวม Commission หรือ Advanced BI

---

## 5. เอกสาร Demo

ไฟล์จริงจะถูกสร้างในขั้นพัฒนาหน้าจอ/เอกสาร โดยใช้ Metadata ชุดนี้:

| เลขเอกสาร | เอกสาร | เริ่มแสดง |
|---|---|---|
| PS-PRJ-2026-000001 | Product Schedule PDF/XLSX | Scene 1 |
| QT-2026-000001-V1 | Custom Quotation V1 | Scene 3 |
| QT-2026-000001-V2 | Custom Quotation V2 Accepted | Scene 3 |
| ORD-2026-000001 | Customer Order | Scene 4 |
| INV-DEP-2026-000001 | ใบแจ้งมัดจำ | Scene 4 |
| QCI-2026-000001 | QC/Reinspection Report | Scene 5 |
| INV-BAL-2026-000001 | ใบแจ้งยอดคงเหลือ | Scene 6 |
| PL-SHP-2026-000001 | Packing List | Scene 7 |
| POD-DLV-2026-000001 | Delivery Proof with Issue | Scene 8 |
| CLM-2026-000001 | Claim Resolution | Scene 9 |

เอกสารสมาชิกห้ามมี Factory Cost, Margin, Supplier Payment หรือ Internal Note
เลข `PS-*`, `PL-*` และ `POD-*` เป็นรหัสไฟล์ที่อ้าง Record ต้นทาง ไม่ใช่ Atomic Document Sequence ใหม่

---

## 6. Data Contract

Source Code อยู่ใน `src/demo`:

- `types.ts` — Role, Scene และชนิดข้อมูลทุก Entity
- `fixtures.ts` — Master Data และ Transaction Templates
- `story.ts` — สร้าง Snapshot แต่ละ Scene, Next, Previous, Role Switch และ Reset
- `selectors.ts` — Dashboard, Executive Summary, Dispatch Gate และ Member-safe View
- `story.test.ts` — ตรวจ Business Rule และความสอดคล้องของข้อมูล
- `prototype-types.ts` — Versioned State และ Action Contract ของ Functional Prototype
- `prototype-fixtures.ts` — Riverstone Starting State แยกจาก Overview
- `prototype-reducer.ts` — Pure Reducer และ Action Guard
- `prototype-selectors.ts` — Payment, Mission, Dispatch Gate และ Member-safe Selector
- `prototype-reducer.test.ts` — Unit/Integration Test ของ 5 Mission

หลักการ:

- ทุก Scene สร้างใหม่จาก Fixture หลักและใช้ Transition ตามลำดับ
- ไม่มีการใช้ข้อมูลจาก Scene ก่อนหน้าที่ถูกแก้โดยผู้ชมคนอื่น
- Dashboard และ Summary ต้องคำนวณจาก Dataset ไม่ใช้ตัวเลข Hardcode
- Member View ต้องผ่าน Selector ที่ตัดข้อมูลภายในออก
- เอกสารจะปรากฏตาม `availableFromScene`

---

## 7. Acceptance Criteria

- Standard Items เป็น `READY_TO_ORDER` โดยไม่ผ่าน RFQ
- Custom Items ต้องมี Accepted Quotation ก่อน `READY_TO_ORDER`
- Quotation V1 เป็น `SUPERSEDED` และ V2 เป็น `ACCEPTED`
- Order Subtotal, VAT, Grand Total, Deposit, Balance และ Freight ตรงกัน
- Partial Payment Verified เมื่อยอดสะสมครบเท่านั้น
- Dispatch Gate ถูกปิดใน Scene 5 และผ่านครบทุก Item ใน Scene 6
- Scene 7 มี Shipment สองเที่ยว
- Scene 8 มี Delivery with Issue และ Claim
- Scene 9 ปิด Claim, Freight, Order และ Project
- Member-safe serialization ไม่มี Factory Cost, Supplier Payment หรือ Internal Note
- Reset ให้ผลเหมือนเปิด Demo ใหม่ทุกครั้ง
- Test ทั้งหมดผ่านก่อนนำ Fixture ไปสร้าง UI
- Query Parameter `mode=overview` และ `mode=prototype` เปิดโหมดได้ถูกต้อง
- Refresh แล้ว Prototype State ยังคงอยู่ และ Reset ไม่กระทบ Overview
- Payment Reject/Resubmit, Overpayment, QC Rework, Partial Shipment และ Claim ทำงานได้
- Dynamic Document Preview เปลี่ยนตาม State ล่าสุดและ Print/Save PDF ได้
- หน้าจอ 390px, 768px และ 1440px ไม่มี Horizontal Overflow

---

## 8. สถานะการส่งมอบ Version 1.3

ดำเนินการครบแล้ว:

1. สร้าง InsForge Project `gisp-mvp-demo` แยกจาก Development
2. เปิด URL `https://gisp-mvp-demo.insforge.site`
3. สร้าง Demo Control Bar, Guided Story 10 ขั้น และ Role Switcher 6 บทบาท
4. เชื่อมหน้าจอกับ Fixture/Scene Engine และ Browser-local state
5. สร้าง PDF 10 ฉบับและ Excel 1 ฉบับที่มีคำว่า `DEMO`
6. ทดสอบ Desktop/Mobile, Reset, Role Visibility, Document Download และ API Isolation
7. เพิ่มหน้าเลือก Overview/Functional Prototype บน URL เดิม
8. เพิ่ม Functional Prototype 5 Workflow พร้อม Role Handoff และ Browser-local Audit
9. เพิ่มภาพสินค้าและหลักฐาน Demo, Dynamic Document Preview และ Print Layout
10. เพิ่ม Foundation/Permission, Product/Supplier Admin, Role Dashboard, Exception/Recovery และ UAT & Sign-off ตามขอบเขต 1–8
11. ใช้ Prototype State Version 3 และ Local Storage `gisp-demo-prototype-v3`; State Version เก่าจะเริ่มใหม่หนึ่งครั้งโดยไม่กระทบ Overview
12. ผ่าน Lint, Type Check, 30 Automated Tests, Production Build, Responsive Test และ Online Smoke Test

Deployment `d597bbd7-2df9-4d1e-af47-dcb7fc22f892` อยู่สถานะ `READY` และ
Online Smoke Test ยืนยันว่า URL เดิม, ทั้งสอง Mode, เอกสาร Baseline และ API
Isolation ทำงานถูกต้อง

ขั้นถัดไปคือให้ผู้เกี่ยวข้องทดลอง UAT ทั้ง 8 Scenario ใน Version 1.3 และบันทึกข้อแก้ไข
Workflow/UX ก่อนนำข้อสรุปที่อนุมัติแล้วไปทำ Vertical Slice ของ Application จริง
โดยยังห้าม Deploy โค้ด Demo ทับ `gisp-mvp-development`
