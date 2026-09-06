# GISP — DEMO STORY AND MOCK DATA

**Document Version:** 1.7  
**Deployed Demo Application:** Version 1.3 — Historical Baseline  
**Target Demo Application:** Version 1.4 — Implemented and Deployed  
**Demo Gate Status:** `APPROVED FOR MVP BUILD`  
**Human UAT Approved:** 18 สิงหาคม 2569 (2026-08-18), PASS 8/8  
**Approval Evidence:** `../evidence/2026-08-18-demo-1.4-uat-signoff.pdf`  
**Prepared:** 1 สิงหาคม 2569 (2026-08-01)  
**Version 1.3 Deployed:** 1 สิงหาคม 2569 (2026-08-01)  
**Business Authority:** `MVP BUSINESS MASTER PLAN.md`  
**Decision Authority:** `DECISION LOG.md`  
**Live Demo URL:** `https://gisp-mvp-demo.insforge.site`

ตาม DEC-042 และ DEC-043 Demo Version 1.3 เป็น Baseline เชิงประวัติ ส่วน Version 1.4 เป็น Target Demo Gate
ที่แยก Member Application และ GISP Back Office คนละลิงก์ แต่ใช้ Shared Browser State Schema 4 ชุดเดียวกัน
Sign-off ของ Version 1.3 ไม่เพียงพอสำหรับ `APPROVED FOR MVP BUILD`

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

### 2.0 Versioned URL และสอง Portal

- Demo Home: `https://gisp-mvp-demo.insforge.site/v1-4`
- Member Application: `https://gisp-mvp-demo.insforge.site/v1-4/member`
- GISP Back Office: `https://gisp-mvp-demo.insforge.site/v1-4/admin`
- Guided Overview: `https://gisp-mvp-demo.insforge.site/v1-4/overview`
- Historical Baseline: `https://gisp-mvp-demo.insforge.site/v1-3`

Member Application และ GISP Back Office ใช้ Riverstone Shared State ชุดเดียวกันผ่าน Local Storage
`gisp-demo-prototype-v14` เมื่อฝั่งหนึ่งดำเนินงาน อีกฝั่งเห็นผลหลัง Refresh หรือ Storage Event โดยไม่ใช้
Role Switcher ข้าม Portal ส่วน Version 1.3 และ Overview เดิมยังใช้ State แยกและไม่ถูกเขียนทับ

### 2.1 กลุ่มผู้ชม

- ทีมงาน GISP
- สมาชิกหรือตัวแทนจำหน่าย

### 2.2 วิธีเข้าใช้

ผู้ชมเข้าได้ทันทีโดยไม่ต้องสมัครบัญชีจริง Member Portal ไม่มี Role Switcher ส่วน Back Office
มี Persona Switcher สำหรับทีม GISP ภายในเท่านั้น:

| บทบาท | สิ่งที่ต้องเห็น |
|---|---|
| Member | Catalog, Member Price, Suggested Resale, Material Sample/Visit, Project, Order และ Claim |
| GISP Admin | Super Admin Formula Demo, Product/Supplier, Visit, RFQ, Order และ Supplier Order |
| Finance | Payment Schedule, Transfer Verification และ Supplier Payment |
| QC | Production Timeline, Inspection, Rework และ Reinspection |
| Logistics | Dispatch Gate, Partial Shipment, Tracking และ Delivery |
| Executive | Order, Payment, Delay, Delivery และ Claim Summary แบบอ่านอย่างเดียว |

Back Office Role Switcher ใช้เพื่อการนำเสนอเท่านั้น ไม่ถือเป็นระบบ Permission จริง โดย `GISP Admin` รวม
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

### 2.5 Deployed MVP Readiness Modules — Demo 1.3 / State Version 3

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

ข้อความข้างต้นอธิบาย Version 1.3 เท่านั้น หลัง DEC-042 ปุ่ม Sign-off เดิมไม่สามารถอนุมัติ MVP Build
ผู้ดูแลต้องใช้ UAT ชุดใหม่และ Human Sign-off ภายใน Demo 1.4

### 2.6 Deployed Modules — Demo Application 1.4

Version 1.4 เพิ่มบน Browser-local Demo เดิมแล้วโดยไม่เรียก Transaction API:

1. Price Structure Builder — Super Admin สร้าง Formula Global/Supplier/Product, Override Component,
   Preview และ Activate พร้อมตัวอย่างทุน 100 → Member 125 → Suggested Resale 156.25
2. Member-safe Pricing — Member เห็น Member Price, Suggested Resale และ Freight Estimate 15–20
   แต่ไม่เห็น Factory Cost, Formula, Component หรือ Margin
3. Material Sample/Visit — แสดง Material Swatch ไทย/จีน, Built-in Display บางรายการ,
   Request → Approve → Complete และ Redact/Unlock Factory Identity เฉพาะ Member
4. Warranty/Claim Responsibility — แสดง Partner Warranty Snapshot และยืนยัน Supplier,
   Logistics/Insurance หรือ Installer ตามสาเหตุ
5. Account Contract — หนึ่ง Member Login ไม่มี Team/Sub-user/Invitation และ Audit เป็นบัญชีเดียว

Implementation ใช้ Browser-local State Schema 4 และ Storage Key ใหม่ ไม่เขียนทับ State Version 3
พร้อมแยก App Shell/URL ตาม DEC-043 การ Deploy ไม่ได้ทำให้ผ่าน Demo Gate โดยอัตโนมัติ

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
- Member เห็น Suggested Resale และ Freight Estimate เป็นข้อมูลแนะนำ ไม่รวมยอด Order
- Product Card แสดง Material Sample Badge โดยไม่เปิดเผยชื่อโรงงาน
- สถานะรายการเป็น `READY_TO_ORDER`
- ไม่สร้าง RFQ สำหรับสินค้า Standard
- เปิด Product Schedule PDF/Excel ได้

### Target Scene 1A — Price Structure Builder (Demo 1.4)

- GISP Admin สลับ Persona เป็น Super Admin และเปิด `PRICE-004`
- Formula Global ใช้ Platform 5%, Marketing/Training/Visit 10%, Sourcing/Catalog 10%, Resale 25%
- Preview ทุน 100.00 ได้ Member Price 125.00, Suggested Resale 156.25, Freight 15.00–20.00
- ทดลอง Supplier Override และ Product Override เฉพาะ Component โดยค่าอื่นยังสืบทอด
- Member Preview ตัดทุน สูตร Component และ Margin ทั้งหมด

### Target Scene 1B — Material Sample และ Factory Visit (Demo 1.4)

- ก่อน Visit Member เห็น `Partner Showroom — Foshan` แต่ไม่เห็นชื่อ/ที่อยู่/Contact/Supplier ID
- Member ส่ง Visit `SUBMITTED`; GISP Admin เปลี่ยนเป็น `APPROVED` และ `COMPLETED`
- หลัง Completed เฉพาะ Member Profile นี้เห็นชื่อ `Foshan Demo Seating Works`
- Member Fixture อีกรายยังเห็นข้อมูล Redacted และ Super Admin ทดลอง Revoke ได้

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
- ระบบแนะนำ Responsibility เป็น `LOGISTICS_INSURANCE` จากความเสียหายระหว่างขนส่ง
- Order Admin ยืนยัน Responsibility และใช้ Partner Warranty Snapshot ประกอบโดยไม่อนุมัติอัตโนมัติ
- Freight 96,300 บาทถูกออกเป็นงวดแยกและยังรอชำระ

### Scene 9 — Resolution และ Executive Summary

- GISP ประสานโรงงานผลิต Lounge Chair ทดแทน โดยต้นทุนความรับผิดชอบเป็น Logistics/Insurance ตามผลตรวจ
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

ก่อน Visit Completed ชื่อ Supplier ทั้งสามรายการข้างต้นใช้ได้เฉพาะ Internal Fixture
Member Fixture ต้องได้รับเพียง Partner Source Label/เมือง และไม่มี Supplier ID

### 4.2.1 Formula Fixture สำหรับ Demo 1.4

| รายการ | Basis | ค่า | ผลจากทุน 100.00 |
|---|---|---:|---:|
| Platform Cost | Factory Cost THB | 5% | 5.00 |
| Marketing/Training/Factory Visit | Factory Cost THB | 10% | 10.00 |
| Product Sourcing/Catalog Operations | Factory Cost THB | 10% | 10.00 |
| **Member Price** | ทุน + สาม Component | — | **125.00** |
| Suggested Resale Markup | Member Price | 25% | 31.25 |
| **Suggested Resale Price** | Member Price + Markup | — | **156.25** |
| Freight Estimate | Factory Cost THB | 15–20% | **15.00–20.00** |

สูตรเป็น Template ที่ Super Admin แก้ได้และใช้ทดสอบ Global → Supplier → Product Inheritance
ไม่ใช้เปลี่ยนยอด Riverstone Order เดิม และ Actual Freight/VAT แยกจาก Formula Fixture

### 4.2.2 Material Sample, Visit และ Disclosure Fixture

| Sample | Type | Member-safe Location | Internal Supplier | Status |
|---|---|---|---|---|
| W301 Walnut Veneer | material_swatch | Partner Showroom — Guangzhou / ชมรมประเทศไทย | Guangzhou Demo Bespoke | Available |
| F001 Sand Fabric | material_swatch | Partner Showroom — Foshan / ชมรมประเทศไทย | Foshan Demo Seating Works | Available |
| S102 Grey Stone | material_swatch | Partner Showroom — Zhongshan | Zhongshan Demo Living | Available |
| BI-KITCHEN-01 | built_in_display | Partner Showroom — Guangzhou | Guangzhou Demo Bespoke | Available |

Visit `VISIT-DEMO-001` เริ่ม `SUBMITTED → APPROVED → COMPLETED` และสร้าง Grant
เฉพาะ Atelier Nara Member Profile + Foshan Supplier ส่วน Member Fixture อื่นไม่มี Grant

### 4.2.3 Warranty Fixture

Warranty Version ของ Lounge Chair ถูก Snapshot ลง Order Item โดย Member เห็นชื่อ `Partner Warranty`
ก่อน Disclosure ปัญหาการผลิต/สเปกแนะนำ Supplier, ความเสียหายขนส่งแนะนำ Logistics/Insurance
และปัญหาติดตั้งแนะนำ Installer; Order Admin ต้องยืนยันทุกครั้ง

### 4.3 Product และราคา

| SKU | รายการ | ประเภท | จำนวน | Member Price/หน่วย | Suggested Resale/หน่วย | ยอด Order ก่อน VAT |
|---|---|---:|---:|---:|---:|---:|
| CHR-LNG-001 | Lounge Chair | Standard | 8 | 18,500 | 23,125 | 148,000 |
| TBL-SID-002 | Side Table | Standard | 12 | 6,200 | 7,750 | 74,400 |
| CHR-DIN-014 | Dining Chair | Standard | 24 | 7,900 | 9,875 | 189,600 |
| LGT-PEN-009 | Pendant Light | Standard | 10 | 9,800 | 12,250 | 98,000 |
| CUS-REC-001 | Reception Counter | Custom | 1 | 165,000 | 206,250 | 165,000 |
| CUS-HDB-010 | Upholstered Headboard | Custom | 10 | 22,500 | 28,125 | 225,000 |

Standard Subtotal = 510,000 บาท  
Custom Subtotal = 390,000 บาท  
Order Subtotal = 900,000 บาท

Suggested Resale เป็นข้อมูลแนะนำ ไม่รวม Order Subtotal, VAT, Deposit, Balance หรือ Payment

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
- Member-safe serialization ไม่มี Factory Cost, Formula/Component, Margin, Supplier Payment, Internal Note
  หรือ Factory Identity ที่ยังไม่มี Disclosure Grant
- Reset ให้ผลเหมือนเปิด Demo ใหม่ทุกครั้ง
- Test ทั้งหมดผ่านก่อนนำ Fixture ไปสร้าง UI
- Query Parameter `mode=overview` และ `mode=prototype` เปิดโหมดได้ถูกต้อง
- Refresh แล้ว Prototype State ยังคงอยู่ และ Reset ไม่กระทบ Overview
- Payment Reject/Resubmit, Overpayment, QC Rework, Partial Shipment และ Claim ทำงานได้
- Dynamic Document Preview เปลี่ยนตาม State ล่าสุดและ Print/Save PDF ได้
- หน้าจอ 390px, 768px และ 1440px ไม่มี Horizontal Overflow

### 7.1 UAT 8 หมวดสำหรับ Target Demo 1.4

1. Foundation/Permission — หนึ่ง Member Login ไม่มี Team/Sub-user และ Formula ใช้ Super Admin Persona เท่านั้น  
2. Product/Supplier — Formula Inheritance/Override และ Preview 100 → 125 → 156.25/Freight 15–20 ถูกต้อง  
3. Standard Order — Suggested Resale/Freight Estimate แสดงเป็นข้อมูลแนะนำและไม่รวม Order  
4. Custom RFQ/Quotation — Price/Spec/Warranty Snapshot ไม่เปลี่ยนย้อนหลัง  
5. Payment/PO — 50/50, VAT และ Actual Freight แยกเหมือนเดิม  
6. Production/QC — Material Sample/Approved Sample เชื่อม Item โดยไม่เปิดเผยโรงงานก่อนสิทธิ์  
7. Shipment/Delivery — Visit Request/Complete เปิดชื่อเฉพาะ Member และ Revoke กลับเป็น Redacted ได้  
8. Claim/Dashboard — Warranty Snapshot และ Responsibility Supplier/Logistics-Insurance/Installer ถูกยืนยันด้วย Order Admin

ทั้ง 8 หมวดต้อง `PASS` และ GISP Admin Sign-off บน Demo 1.4 เท่านั้นจึงเป็น `APPROVED FOR MVP BUILD`

เกณฑ์บังคับที่ต้องครอบคลุมข้ามทั้ง 8 หมวดเดิม:

- **Product/Supplier:** Super Admin ปรับสูตร Global และ Override ระดับ Supplier/Product พร้อม Preview ทุน 100 → Member 125 → Suggested Resale 156.25
- **Member-safe Pricing:** Member เห็น Member Price, Suggested Resale และ Freight Estimate แต่ไม่เห็น Factory Cost, Formula/Component หรือ Margin
- **Sample:** แสดง `material_swatch` ที่ไทย/จีน และ `built_in_display` เฉพาะรายการ; ห้ามใช้เฟอร์นิเจอร์ทั่วไปเป็น Sample
- **Factory Privacy:** ก่อน Visit `COMPLETED` ทุก UI/API/Export/URL ต้องไม่มีชื่อโรงงาน ที่อยู่ Contact หรือ Supplier ID
- **Visit:** `SUBMITTED → APPROVED → COMPLETED` สร้าง Grant เฉพาะ Member Profile + Supplier; Member อื่นยังถูก Redact และ Super Admin Revoke พร้อม Audit ได้
- **Warranty:** Order Item เก็บ Partner Warranty Snapshot และ Claim แยก Supplier, Logistics/Insurance หรือ Installer โดย Order Admin ยืนยัน
- **Account:** ไม่มี Member Team/Sub-user/Team Invitation และ Action จากบัญชีที่ใช้ร่วมกัน Audit เป็น Member Account เดียว
- **Regression:** Payment 50/50, VAT, Actual Freight แยก, Snapshot เดิม, Commission เป็น Post-MVP และ Production Role เดิมไม่เสีย

---

## 8. สถานะ Deployed Baseline Version 1.3

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

รายการข้างต้นเป็นหลักฐานเฉพาะ Version 1.3 และไม่รวม Target Requirements ของ Version 1.4

## 9. สถานะ Target Demo Application 1.4

Version 1.4 พัฒนาและ Deploy แล้วเมื่อ 1 สิงหาคม 2569 ด้วย Deployment
`9e7b2660-5979-4057-83c2-666d73a95156` สถานะ `READY` การตรวจออนไลน์ยืนยัน Member Portal,
Back Office, Guided Overview, Historical Version 1.3, Document Download และ Transaction API 404

Local Quality Gate ผ่าน Type Check, Lint, Automated Tests 36 กรณี, Production Build และ Responsive
390/768/1440 โดยไม่พบจอล้น Online Production Console ไม่พบ Error/Warning ใหม่

Human UAT ผ่านครบ 8/8 หมวด, `NEEDS FIX` 0, `NOT TESTED` 0 และ GISP Admin กด Human Sign-off
บน Demo 1.4 แล้วเมื่อ 18 สิงหาคม 2569 สถานะจึงเป็น `APPROVED FOR MVP BUILD`
หลักฐานอยู่ที่ `docs/evidence/2026-08-18-demo-1.4-uat-signoff.pdf`
