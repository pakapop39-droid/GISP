# CR-TH-001 — Domestic Partner Fulfillment

**ชื่อไทย:** แนวทางขายสินค้าไทยแบบไม่มีสต๊อกและ Supplier ส่งตรง  
**สถานะเอกสาร:** `FUTURE DEVELOPMENT PROPOSAL — NOT APPROVED FOR BUILD`  
**วันที่จัดทำ:** 30 สิงหาคม 2569 (2026-08-30)  
**ระบบเป้าหมาย:** GISP เดิม  
**หลักสำคัญ:** เป็นการต่อยอดระบบเดิม ไม่สร้าง Application, Catalog, Order หรือฐานข้อมูลอีกชุด  

> เอกสารนี้ใช้เตรียมความพร้อมและประกอบการตัดสินใจในอนาคตเท่านั้น ยังไม่อนุมัติให้แก้โค้ด
> Migration, Backend, Frontend, Environment หรือ Production หากจะเริ่มพัฒนาต้องบันทึกคำตัดสินใน
> `DECISION LOG.md` และจัดทำ Development Plan แยกก่อน

---

## 1. บทสรุป

GISP จะรองรับสินค้าจาก Supplier ภายในประเทศไทยด้วยรูปแบบ
`Curated Showroom + Order on Demand + Supplier Fulfilled` กล่าวคือ GISP จัดทำ Catalog,
นำสินค้าหรือตัวอย่างวัสดุมาจัดแสดงที่โชว์รูม และบริหารคำสั่งซื้อ ส่วน Supplier ผลิตหรือเตรียมสินค้า
ตาม Order แล้วจัดส่งตรงถึงหน้างาน โดย GISP ไม่ซื้อสินค้าเข้าสต๊อกและไม่ทำงานคลังสินค้าสำหรับสินค้าไทย

สมาชิกยังใช้ Catalog, Project, Order, Payment และ Timeline ชุดเดียวกับสินค้านำเข้า
ความแตกต่างอยู่ที่เส้นทางของ `Supplier Order`:

- สินค้านำเข้าใช้ Warehouse Receipt, Consolidation, International Shipment และ Customs
- สินค้าไทยใช้ Production/QC แล้วสร้าง Direct Shipment จาก Supplier ถึงหน้างาน

รูปแบบนี้ช่วยเพิ่มสินค้าไทยโดยรักษาการลงทุนและ Business Rule เดิมของ GISP ให้มากที่สุด

---

## 2. เป้าหมาย

1. ให้สมาชิกเลือกสินค้าไทยและสินค้านำเข้าไว้ใน Project เดียวกันได้
2. แสดงรูปสินค้า สเปก ราคา Lead Time สินค้าตัวอย่าง และตัวอย่างวัสดุได้
3. ป้องกันการรับเงินก่อนทราบว่า Supplier สามารถรับงานและส่งได้เมื่อใด
4. ใช้ Order, Payment, Production, QC, Delivery, Freight และ Claim เดิมต่อเนื่องกัน
5. ให้ Supplier ส่งตรงถึงหน้างานโดย GISP ไม่ต้องถือสต๊อก
6. รักษาความสัมพันธ์ลูกค้า เอกสาร ราคา และการรับประกันไว้ภายใต้การดูแลของ GISP
7. รองรับ Order เดียวที่มีหลาย Supplier และหลายประเทศโดยไม่ปะปน Workflow

---

## 3. สิ่งที่ไม่อยู่ในขอบเขต

- ระบบสต๊อกและจำนวนคงเหลือ
- การรับเข้า–เบิกออกสินค้าไทย
- Stock Reservation, Picking หรือ Packing
- คลังสินค้าไทยสำหรับเก็บสินค้า Domestic
- Marketplace ที่ Supplier เปิดร้านและบริหารหน้าร้านเอง
- Supplier Login หรือ Supplier Portal เต็มรูปแบบในระยะแรก
- ระบบแบ่งเงินให้ Supplier อัตโนมัติ
- การแยก Application หรือฐานข้อมูลสำหรับสินค้าไทย
- Catalog สินค้าไทยอีกชุดหนึ่ง
- การให้ยืมตัวอย่างแก่สมาชิกในระยะแรก

สินค้าตัวจริงและตัวอย่างวัสดุที่โชว์รูมเป็น `Display/Sample` ไม่ใช่สินค้าพร้อมขายและไม่นับเป็นสต๊อก

---

## 4. Operating Model ที่เสนอ

### 4.1 บทบาทของ GISP

- คัดเลือกและตรวจสอบ Supplier
- จัดทำ Catalog และข้อมูลสินค้า
- จัดแสดงสินค้าและตัวอย่างวัสดุ
- ยืนยันราคา คิวผลิต และกำหนดส่งก่อนเปิดรับชำระเงิน
- ออกเอกสารและรับชำระเงินจากสมาชิก
- ส่ง Supplier Order และติดตาม Production/QC
- ควบคุมการนัดส่ง หลักฐานส่งมอบ และ Claim

### 4.2 บทบาทของ Supplier ไทย

- ยืนยันราคา จำนวน คิวผลิต และวันที่พร้อมส่ง
- ผลิตหรือเตรียมสินค้าตาม Specification Snapshot
- ส่ง Production Update และหลักฐานที่จำเป็นให้ GISP
- ผ่าน QC และ Dispatch Gate ก่อนจัดส่ง
- จัดส่งตรงหรือส่งผ่านผู้ให้บริการที่ GISP อนุมัติ
- รับผิดชอบ Warranty/Claim ตามเงื่อนไข Partner Warranty

### 4.3 บทบาทของสมาชิก

- เลือกสินค้าและตัวอย่างเข้า Project
- ขอให้ GISP ยืนยันคิวและกำหนดส่ง
- ยอมรับราคา สเปก และกำหนดส่งที่ยืนยันแล้ว
- ชำระเงินตาม Payment Schedule เดิม
- ยืนยันหรือขอเลื่อนนัดส่ง
- ตรวจรับสินค้าและแจ้ง Claim ผ่าน GISP

---

## 5. Workflow เป้าหมาย

```text
Catalog / Showroom Sample
  -> เพิ่มสินค้าเข้า Project
  -> ขอ Supplier Readiness Confirmation
  -> GISP ติดต่อ Supplier และบันทึกผล
  -> Supplier ยืนยันราคา จำนวน Lead Time และวันหมดอายุ
  -> Project Item พร้อมสร้าง Order
  -> สมาชิกยืนยัน Order และชำระ Deposit
  -> ระบบสร้าง/ออก Supplier Order ตาม Workflow เดิม
  -> Supplier ผลิตหรือเตรียมสินค้า
  -> Production Update และ QC ตาม Slice 7
  -> Dispatch Gate ผ่าน
  -> สร้าง Direct Shipment ตาม Slice 8
  -> นัดส่ง / ขอเลื่อน / ยืนยันนัด
  -> Supplier หรือ Carrier ส่งตรงหน้างาน
  -> Proof of Delivery
  -> สรุป Actual Domestic Freight และ Finance Verification
  -> Order Completed หรือเปิด Claim
```

`Supplier Readiness Confirmation` ไม่ใช่ RFQ และไม่เปลี่ยนกติกาที่ Standard Product ไม่ผ่าน
Custom RFQ ระบบยืนยันเฉพาะความพร้อม ราคาเดิมที่มีผล จำนวน และ Lead Time หากมีการเปลี่ยนแบบหรือ
Specification จึงส่งเข้า Custom RFQ ตาม Workflow เดิม

---

## 6. การใช้โมดูลเดิม

| โมดูลเดิม | แนวทางต่อยอดสำหรับสินค้าไทย |
|---|---|
| Supplier Master | ใช้ประเทศ `TH`, สกุลเงิน `THB` และกำหนดเส้นทางเริ่มต้นเป็น Domestic Direct |
| Product Catalog | ใช้รูป สเปก Variant, Option, Lead Time, Price Version และ Warranty เดิม |
| Material Sample | ใช้ตัวอย่างวัสดุเดิมและเพิ่ม Product Display แบบไม่ถือเป็นสต๊อก |
| Project | รวมสินค้าไทยและสินค้านำเข้าในพื้นที่และ Product Schedule เดียวกัน |
| Custom RFQ | ใช้เฉพาะสินค้าที่แก้แบบหรือสเปกพิเศษเหมือนเดิม |
| Customer Order | สมาชิกซื้อจาก GISP และใช้ Order Snapshot เดิม |
| Supplier Order | แยกหนึ่ง Supplier Order ต่อ Supplier และเก็บ Fulfillment Route Snapshot |
| Payment | ใช้ Deposit/Balance และ Finance Verification เดิม |
| Production/QC | ใช้ Timeline, Evidence, Rework และ Dispatch Gate เดิม |
| Shipment | ใช้ Shipment Type `DIRECT` และ Method `TRUCK`/`COURIER` |
| Delivery | ใช้นัดส่ง Reschedule, Partial Delivery และ Proof เดิม |
| Freight | ใช้ Actual Logistics Cost และ Freight Invoice เดิม แต่แสดงเป็นค่าจัดส่งในประเทศ |
| Claim/Warranty | ใช้ Delivery Evidence, Claim และ Partner Warranty เดิม |

---

## 7. Fulfillment Route

Fulfillment Route ต้องกำหนดระดับ Supplier และ Snapshot ลง Supplier Order ไม่ควรอนุมานจากประเทศ
เพียงอย่างเดียว เพราะในอนาคต Supplier ต่างประเทศอาจมีจุดส่งในไทย หรือ Supplier ไทยอาจจัดหาของ
จากต่างประเทศ

ค่าเริ่มต้นที่เสนอ:

- `IMPORT_TO_THAILAND` — เส้นทางนำเข้าเต็มรูปแบบ
- `DOMESTIC_DIRECT` — Supplier ภายในไทยส่งตรงถึงหน้างาน

Customer Order หนึ่งรายการสามารถมี Supplier Orders คนละ Route ได้ เช่น โต๊ะจากไทยและโคมไฟจากจีน
ระบบติดตามแยกหลังบ้าน แต่ Member เห็นภาพรวมเดียวใน Project และ Order

### 7.1 เส้นทางนำเข้า

```text
Supplier -> Origin Warehouse -> Consolidation -> International Freight
-> Customs -> Thailand Warehouse -> Delivery
```

### 7.2 เส้นทางสินค้าไทย

```text
Supplier -> Production/QC -> Direct Shipment -> Delivery
```

สินค้า `DOMESTIC_DIRECT` ข้าม Warehouse Receipt, Consolidation, Export/Import Customs,
International Freight และ Thailand Import Warehouse แต่ห้ามข้าม Payment, Production/QC,
Dispatch Gate, Appointment, Proof of Delivery และ Claim

---

## 8. Supplier Readiness Confirmation

สินค้าไทยแบบไม่มีสต๊อกควรมีการยืนยันก่อนรับ Deposit เพื่อลดการคืนเงินและการผิดนัดส่ง

สถานะที่เสนอ:

- `REQUESTED`
- `CONFIRMED`
- `CHANGE_PROPOSED`
- `UNAVAILABLE`
- `EXPIRED`
- `CANCELLED`

ข้อมูลขั้นต่ำ:

- Project Item และ Supplier
- จำนวนและ Option/Specification ที่ขอยืนยัน
- ราคาทุนและ Member Price ที่ใช้ได้
- Lead Time และวันที่พร้อมส่งโดยประมาณ
- วันที่คำยืนยันหมดอายุ
- MOQ หรือเงื่อนไขเพิ่มเติม
- Note และหลักฐานจาก Supplier
- ผู้บันทึกและเวลาบันทึก

Business Rules:

1. ห้ามเปิด Deposit ให้ชำระหาก Confirmation ยังไม่เป็น `CONFIRMED`
2. Confirmation ต้องยังไม่หมดอายุในเวลาสร้าง Order
3. หากราคา สเปก จำนวน หรือกำหนดส่งเปลี่ยน ต้องให้ Member ยอมรับใหม่
4. `CHANGE_PROPOSED` ไม่เปลี่ยนเป็น Order โดยอัตโนมัติ
5. `UNAVAILABLE` ต้องคืน Project Item ไปให้ Member เลือกสินค้าทดแทนหรือยกเลิก
6. Order Snapshot ต้องคงข้อมูลที่ Member ยอมรับ แม้ Supplier เปลี่ยนข้อมูลภายหลัง

ระยะแรก Supplier ไม่ต้องเข้า App ทีม GISP ติดต่อผ่าน LINE, โทรศัพท์ หรืออีเมลและบันทึกผลใน
Back Office เมื่อจำนวน Supplier/Order มากขึ้นจึงพิจารณา Secure Action Link หรือ Supplier Portal

---

## 9. Catalog และ Showroom Experience

### 9.1 ข้อมูลที่ Member ต้องเห็น

- ป้าย `สินค้าพาร์ตเนอร์ไทย`
- ป้าย `ผลิต/เตรียมตามคำสั่งซื้อ`
- ข้อความ `ไม่มีสต๊อกพร้อมส่ง`
- ประเทศต้นทาง
- รูปสินค้าและรูป Detail
- ขนาด วัสดุ สี Finish และ Option
- Lead Time โดยประมาณ
- วันที่ Supplier ยืนยันข้อมูลล่าสุด
- วันที่ราคาหรือข้อมูลหมดอายุ
- MOQ
- พื้นที่จัดส่ง
- ค่าจัดส่งรวมแล้วหรือคิดแยก
- สถานะสินค้าตัวอย่างและตัวอย่างวัสดุที่โชว์รูม
- Warranty และข้อจำกัดการคืน/ยกเลิก

ปุ่มหลัก:

- `เพิ่มเข้า Project`
- `ขอยืนยันคิวและกำหนดส่ง`
- `ยืนยันสั่งซื้อ` หลัง Confirmation ผ่าน

### 9.2 Showroom Sample

ใช้ `material_samples` เดิมและพิจารณาเพิ่ม Sample Type:

- `PRODUCT_DISPLAY`
- `MATERIAL_SWATCH`
- `BUILT_IN_DISPLAY`

ข้อมูลที่ต้องมี:

- Product/Option Value ที่เกี่ยวข้อง
- Showroom และตำแหน่งจัดแสดง
- Sample Code และ QR Code
- รูปตัวอย่าง
- รหัสวัสดุ สี หรือ Finish
- Availability Status
- วันที่ตรวจสอบล่าสุด

Sample ต้องไม่สร้าง Inventory Transaction และต้องแสดงชัดว่าเป็นตัวอย่าง ไม่ใช่ของพร้อมขาย

---

## 10. Pricing และเอกสาร

Price Formula เดิมรองรับ Scope ระดับ Supplier/Product อยู่แล้ว จึงสร้าง Domestic Formula โดยไม่ต้อง
สร้าง Pricing Engine ใหม่

```text
ต้นทุน Supplier ไทย
+ ค่าบริหารสินค้า/โครงการของ GISP
+ Margin หรือ Pricing Component ที่อนุมัติ
= Member Price ก่อน VAT
```

Domestic Formula ไม่ใช้ค่าแลกเปลี่ยน CNY, ค่านำเข้า, Customs หรือ International Freight
และอาจเพิ่มค่าขนส่งในประเทศ ค่ายกของ ค่าติดตั้ง หรือค่าตรวจสินค้าเป็นรายการแยก

ข้อความ Member-facing ต้องเปลี่ยนตาม Route:

- นำเข้า: `ค่าขนส่งและค่านำเข้าประมาณการ`
- ไทยส่งตรง: `ค่าจัดส่งในประเทศประมาณการ`

หาก Supplier รวมค่าจัดส่งในราคาสินค้า ให้ Member Charge ของ Freight เป็นศูนย์และแสดงข้อความว่า
รวมการจัดส่งตามขอบเขตที่กำหนด หากมีค่าใช้จ่ายเพิ่มต้องให้ Member รับทราบก่อน Dispatch

ก่อนใช้งานจริงต้องให้ฝ่ายบัญชียืนยันผู้ขายตามเอกสาร ภาษีซื้อ/ภาษีขาย VAT และ e-Tax Invoice
โดยแนวทางตั้งต้นคือ Supplier ออกเอกสารให้ GISP และ GISP ออกเอกสารให้ Member

---

## 11. Production, QC และ Dispatch

ใช้ Slice 7 โดยไม่สร้าง Workflow ใหม่:

- Supplier Order และ Production Timeline เดิม
- ETA/Delay/Media เดิม
- QC Checklist และ Evidence เดิม
- Rework/Reinspection เดิม
- Custom Member Approval เดิม
- Dispatch Gate 4 เงื่อนไขเดิม

สินค้าไทยส่งตรงเริ่มสร้าง Delivery Appointment เมื่อ Supplier Order ผ่าน Dispatch Gate และอยู่ในสถานะ
`READY_FOR_DISPATCH` ไม่ต้องรอเหตุการณ์ `THAILAND_WAREHOUSE`

QC อาจดำเนินการด้วยภาพ/วิดีโอหรือการตรวจจริงตามความเสี่ยงของ Supplier/Product แต่ผลตรวจต้องถูก
บันทึกผ่านระบบเดิมและห้ามใช้ข้อความจาก LINE เป็นหลักฐานเพียงแหล่งเดียว

---

## 12. Shipment, Delivery และ Freight

ใช้ Slice 8 ต่อโดยกำหนดว่า `DIRECT` เป็นเส้นทางปกติของ `DOMESTIC_DIRECT` ไม่ใช่ข้อยกเว้น

กติกา:

1. Shipment Origin เป็น Supplier Dispatch Address Snapshot
2. ใช้ Shipping Method `TRUCK` หรือ `COURIER`
3. ไม่บังคับ Warehouse Receipt หรือ Consolidation
4. ตรวจ Dispatch Gate ซ้ำก่อน Dispatch
5. Member ยืนยันหรือขอเลื่อน Delivery Appointment ได้
6. Delivery ต้องมี Recipient, เวลา, Quantity และ Evidence
7. Partial Delivery ต้องมี Remaining Quantity และแผนส่งครั้งถัดไป
8. Delivery with Issue ส่งข้อมูลต่อไป Claim ได้
9. ค่าขนส่งจริงใช้ Logistics Cost/Freight Invoice เดิม
10. Order Completed เมื่อสินค้าทุก Route ส่งครบและ Payment ที่กำหนด Verified

---

## 13. Supplier Identity และ Customer Ownership

Direct Delivery อาจทำให้ Member เห็นชื่อ Supplier จากรถ บรรจุภัณฑ์ หรือผู้ส่ง จึงไม่ควรพึ่งการปกปิด
ข้อมูลเพียงอย่างเดียว

แนวทางที่เสนอ:

- ใช้ข้อตกลงไม่ขายข้าม GISP สำหรับลูกค้าที่ GISP แนะนำ
- Delivery Note และเอกสารที่ Member เห็นออกในชื่อ GISP
- Supplier ห้ามแนบราคาขาย โปรโมชั่น หรือนามบัตรฝ่ายขาย
- Warranty และ Claim ดำเนินการผ่าน GISP
- จำกัดข้อมูลผู้ติดต่อ Supplier ใน Member API ตาม Disclosure Rule เดิม
- หากต้องปกปิดเข้มงวด ให้ใช้ Carrier กลางแทนรถ Supplier โดยไม่ต้องสร้างคลังสินค้า

รายละเอียดสัญญาและการเปิดเผย Supplier ต้องได้รับคำตัดสินจากเจ้าของระบบก่อนเริ่มพัฒนา

---

## 14. Data Model ขั้นต่ำที่เสนอ

ชื่อ Field/Table เป็น Working Name และต้องตรวจซ้ำใน Technical Design

### ตารางเดิมที่อาจขยาย

- `suppliers.default_fulfillment_route`
- `products.ordering_status`
- `products.supplier_confirmed_at`
- `supplier_orders.fulfillment_route_snapshot`
- `supplier_orders.dispatch_origin_snapshot`
- `supplier_orders.readiness_confirmed_at`
- `shipments` ใช้ `DIRECT` และ Origin Snapshot ตาม Slice 8

### ตารางใหม่ขั้นต่ำ

- `supplier_readiness_confirmations`
- `supplier_readiness_events` สำหรับประวัติแบบ Append-only หากตารางหลักอย่างเดียวไม่เพียงพอ

ไม่สร้างตาราง Inventory, Stock Balance, Reservation หรือ Warehouse Movement สำหรับ Domestic Product

---

## 15. หน้าจอขั้นต่ำ

### Member

1. Catalog Filter ประเทศต้นทางและ Fulfillment Type
2. Product Detail แสดง Order-on-demand, Sample, Lead Time และข้อมูลยืนยันล่าสุด
3. Project Item Action: ขอ Supplier Confirmation
4. Confirmation Result: ยอมรับการเปลี่ยนแปลงหรือยกเลิก
5. Order Timeline แสดง Domestic Direct แบบย่อ
6. Delivery Appointment/Reschedule
7. Proof of Delivery, Freight Invoice และ Claim Entry

### GISP Back Office

1. Supplier/Product ตั้ง Domestic Direct และ Ordering Status
2. Readiness Confirmation Queue
3. บันทึกผล Supplier และวันหมดอายุ
4. Order/Production/QC เดิม
5. Direct Shipment และ Delivery เดิมจาก Slice 8
6. Actual Domestic Freight และ Finance Verification เดิม

### Supplier

ระยะแรกไม่มีหน้าจอ Supplier ทีม GISP บันทึกข้อมูลแทน ภายหลังอาจเพิ่ม Secure Action Link ที่จำกัด
เฉพาะการรับ/ปฏิเสธ Order, เสนอวันใหม่, Upload รูป และแจ้งพร้อมส่ง

---

## 16. Permission และข้อมูลลับ

- Member เห็นเฉพาะข้อมูล Organization ของตน
- Factory Cost, Margin, Supplier Payment และ Internal Note ยังเป็น Confidential
- Supplier Contact ใช้ Disclosure Rule เดิม
- Readiness Confirmation ที่มีราคาทุนหรือข้อความภายในต้องผ่าน Member-safe Projection
- Route และ Timeline ที่ Member เห็นต้องไม่เปิดเผยเอกสารภาษี ต้นทุน หรือข้อมูลภายใน Supplier
- State Transition ใช้ Action Endpoint/Trusted Function เหมือนโมดูลเดิม
- ทุกการยืนยัน เปลี่ยนราคา เปลี่ยนกำหนดส่ง และยกเลิกต้องมี Audit

---

## 17. Edge Cases ที่ต้องรองรับ

1. Supplier ยืนยันแล้วแต่ Confirmation หมดอายุก่อน Member สั่ง
2. Supplier เสนอวันส่งใหม่หรือราคาใหม่
3. Supplier รับได้เพียงบางจำนวน
4. สินค้าไทยและจีนอยู่ใน Customer Order เดียวกัน
5. Supplier ไทยส่งบางส่วนหลายเที่ยว
6. Member ขอเปลี่ยนที่อยู่หลัง Supplier ยืนยันค่าขนส่ง
7. สินค้าเสียหายระหว่าง Supplier Direct Delivery
8. รถ Supplier เปิดเผยชื่อโรงงานโดยไม่ตั้งใจ
9. Supplier ยกเลิกหลังรับ Deposit
10. ราคาจัดส่งจริงสูงกว่าประมาณการ
11. ตัวอย่างโชว์รูมถูกเปลี่ยนรุ่นหรือ Finish เลิกผลิต
12. Product ยังคง Published แต่ Supplier หยุดรับงานชั่วคราว

แต่ละกรณีต้องมี State, Reason, ผู้รับผิดชอบ และ Timeline ไม่ใช้การแก้ข้อมูลเดิมทับประวัติ

---

## 18. Acceptance Criteria สำหรับการพัฒนาในอนาคต

1. Admin เพิ่ม Supplier ไทย, THB และ Domestic Direct ได้
2. Product ไทยแสดงรูป สเปก ราคา Lead Time และ Showroom Sample ได้
3. Sample ไม่สร้างหรือเปลี่ยน Stock Quantity
4. Member เพิ่มสินค้าไทยลง Project เดิมได้
5. Member ขอ Supplier Confirmation และเห็นผลตอบกลับที่ปลอดภัยได้
6. ห้ามชำระ Deposit ก่อน Confirmation ที่ยังมีผล
7. ระบบสร้าง Order/Supplier Order โดยใช้ Snapshot ที่ยืนยันแล้ว
8. Production/QC/Dispatch Gate เดิมทำงานกับสินค้าไทยได้
9. สร้าง Direct Shipment โดยไม่ผ่าน Warehouse/Consolidation/Customs ได้
10. นัดส่ง เลื่อนนัด ส่งบางส่วน และ Proof of Delivery ทำงานได้
11. Actual Domestic Freight และ Finance Verification ใช้ Flow เดิมได้
12. Delivery with Issue เปิด Claim ต่อได้
13. Order เดียวมีทั้ง Import และ Domestic Supplier Orders ได้
14. Member API ไม่เปิดเผย Factory Cost, Margin, Internal Note หรือ Supplier Contact ที่ยังล็อก
15. Order ไม่ Completed ก่อนทุก Route ส่งครบและยอดที่กำหนด Verified

---

## 19. Automated Test ขั้นต่ำ

1. Confirmation หมดอายุแล้วสร้าง Order ไม่ได้
2. Change Proposed ต้องรอ Member ยอมรับ
3. Domestic Product ไม่สร้าง Warehouse Receipt/Consolidation โดยอัตโนมัติ
4. Direct Shipment ยังถูก Dispatch Gate ปิดกั้นได้
5. Import และ Domestic Route อยู่ใน Order เดียวโดย Quantity ไม่ซ้ำกัน
6. Delivery Quantity สะสมไม่เกิน Shipment Quantity
7. Partial Delivery คำนวณ Remaining ถูกต้อง
8. Member ไม่เห็นต้นทุน Supplier และ Internal Freight Cost
9. Price/Lead Time Snapshot ไม่เปลี่ยนตาม Master Data ภายหลัง
10. ส่งครบแต่ Freight ยังไม่ Verified ต้องห้าม Order Completed

---

## 20. ลำดับการพัฒนาที่แนะนำ

งานนี้ควรเริ่มหลัง Slice 8 หลักเสร็จ เพื่อใช้ Direct Shipment, Appointment, Delivery Evidence และ
Freight Flow ที่ผ่าน UAT แล้ว

### ระยะที่ 1 — Decision และ Technical Design

- อนุมัติ Operating Model และชื่อ Route
- ยืนยันว่า GISP เป็นผู้ขายหรือ Agent ในเอกสารจริง
- ยืนยัน Payment Timing ก่อน/หลัง Supplier Confirmation
- ยืนยัน Supplier Disclosure และ Direct Delivery Policy
- ยืนยัน VAT/e-Tax กับฝ่ายบัญชี
- ทำ Schema/API/UI Impact Review กับระบบเดิม

### ระยะที่ 2 — Catalog และ Readiness

- เพิ่ม Domestic Route และ Ordering Status
- ปรับ Product Detail/Project Item
- ทำ Supplier Readiness Confirmation และ Audit
- เพิ่ม Product Display/Sample ที่โชว์รูม

### ระยะที่ 3 — Order-to-Delivery Integration

- Snapshot Route ลง Supplier Order
- เชื่อม Production/QC/Dispatch Gate เดิม
- เปิด Domestic Direct ใน Slice 8
- ปรับ Timeline, Appointment และข้อความ Freight

### ระยะที่ 4 — Test และ Pilot

- Automated Test และ Member-safe Leakage Test
- Preview/Human UAT
- Pilot Supplier ไทย 2–3 ราย สินค้า 30–50 รายการ
- วัดผลก่อนขยาย Supplier หรือสร้าง Supplier Portal

---

## 21. ตัวชี้วัด Pilot

- เวลาที่ Supplier ใช้ตอบ Readiness Confirmation
- อัตรา Confirmation ที่เปลี่ยนเป็น Order
- ความแม่นยำของ Lead Time
- อัตราส่งตรงเวลา
- อัตราสินค้าเสียหาย/ไม่ตรงสเปก
- จำนวน Claim ต่อ Delivery
- ยอดสั่งซื้อที่เริ่มจาก Showroom Sample
- อัตราสมาชิกกลับมาใช้ใน Project ถัดไป
- Margin หลังหักต้นทุนดำเนินงานและ Claim

---

## 22. Open Decisions ก่อนอนุมัติ Build

1. GISP เป็นผู้ขายเต็มรูปแบบหรือเป็นตัวแทน/นายหน้าในเอกสารการค้า
2. Supplier Confirmation มีอายุกี่วันตามประเภทสินค้า
3. Supplier Direct Delivery เปิดเผยชื่อ Supplier ได้ระดับใด
4. ใครรับผิดชอบค่าขนส่งเพิ่มเมื่อส่งบางส่วนหรือเลื่อนนัด
5. Domestic Freight เรียกเก็บก่อนส่งหรือสรุปหลังส่งตาม Slice 8
6. Product Display ที่โชว์รูมให้ยืมหรือดูได้เฉพาะสถานที่
7. Supplier ต้องปฏิบัติตาม SLA และบทลงโทษใด
8. จะใช้ชื่อ Member-facing ว่า `สินค้าพาร์ตเนอร์ไทย`, `ผลิตตามคำสั่งซื้อ` หรือชื่ออื่น

คำแนะนำตั้งต้นคือ GISP เป็นผู้ขาย, Confirmation มีวันหมดอายุ, เก็บ Deposit หลัง Confirmation,
Supplier ส่งตรงภายใต้เอกสาร GISP และไม่ให้ยืม Product Display ในรุ่นแรก

---

## 23. Dependencies และเอกสารที่เกี่ยวข้อง

- [MVP Business Master Plan](active/MVP%20BUSINESS%20MASTER%20PLAN.md)
- [Decision Log](active/DECISION%20LOG.md)
- [Database Schema](active/DATABASE%20SCHEMA.md)
- [MVP Implementation Plan](active/MVP%20IMPLEMENTATION%20PLAN.md)
- [Current Project Status](active/CURRENT%20PROJECT%20STATUS.md)
- [Slice 8 Shipment and Delivery Plan](SLICE-8-SHIPMENT-DELIVERY-PLAN.md)

CR-TH-001 ต้องไม่ Override Business Rule ในเอกสารลำดับสูงกว่า จนกว่าจะมี Approved Decision ใหม่

---

## 24. Release Gate

ห้ามเริ่ม Build จนกว่าจะครบ:

1. Owner อนุมัติ Business Model และ Open Decisions
2. บันทึก Approved Decision ใน Decision Log
3. อัปเดต Business Master Plan, Database Schema และ Requirement Traceability
4. จัดทำ Development Plan, Branch Plan และ Rollback Plan
5. Slice 8 Dependency ผ่าน UAT และอยู่บน Development แล้ว
6. Automated Test/UAT Scenario ได้รับอนุมัติก่อนแก้ Production

เอกสารนี้จึงมีสถานะเป็นข้อเสนอเตรียมพัฒนาในอนาคต ไม่ใช่คำสั่งเริ่มงาน
