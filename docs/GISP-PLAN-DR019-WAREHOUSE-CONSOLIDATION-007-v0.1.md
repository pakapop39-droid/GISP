# GISP-PLAN-DR019-WAREHOUSE-CONSOLIDATION-007 v0.1

## 1. สถานะและอำนาจอนุมัติ

- ผู้อนุมัติขอบเขตแผน: ภคภพ ช.เจริญยิ่ง
- วันที่บันทึก: 16 กันยายน 2569 เวลา 07:38 น. (Asia/Bangkok)
- Environment: Development เท่านั้น
- ระดับอนุมัติ: Planning / Analysis only
- อนุญาต: วิเคราะห์ขอบเขต ไฟล์ที่คาดว่าจะได้รับผลกระทบ Acceptance Criteria และแผนทดสอบ
- ไม่อนุญาต: แก้ Source Code, Database Function/Schema, Role, Permission, Master Data, ข้อมูลธุรกรรม, Data Migration, Deploy หรือ Production
- Implementation Authorization: ยังไม่มี

## 2. เป้าหมาย

ทำให้ผู้ใช้บทบาท Logistics สามารถทำงานผ่าน GISP App ได้ตามลำดับ:

`Warehouse Receipt → Release → Consolidation → Confirm → Create Shipment`

สำหรับ Dry Run `ORD-2026-000008 / DRYRUN-PRJ-001 / CN01-Y105 / จำนวน 1 ชิ้น` โดยไม่เขียนฐานข้อมูลตรง และไม่สร้างค่าใช้จ่าย Member ที่ไม่ได้รับอนุมัติ

## 3. ผลวิเคราะห์ระบบปัจจุบัน

### 3.1 ส่วนที่มีแล้วและควรนำกลับมาใช้

- มีตาราง Warehouse Receipt, Consolidation และ Shipment พร้อม RLS อยู่แล้ว
- มี RPC ต่อไปนี้อยู่แล้ว:
  - `create_warehouse_receipt`
  - `release_warehouse_receipt_item`
  - `create_consolidation`
  - `confirm_consolidation`
  - `create_shipment_v2`
- RPC ตรวจสิทธิ์ `shipments.manage` และตรวจจำนวนรับ/ปล่อย/รวมไม่ให้เกินสิทธิ์
- Receipt และ Release มี Audit; Consolidation มี append-only domain events
- Development มี Active Warehouse หนึ่งแห่ง และ Order ทดสอบยังไม่มี Receipt, Consolidation หรือ Shipment

### 3.2 ช่องว่างที่ทำให้ DR-019 ดำเนินต่อไม่ได้

- หน้า Logistics แสดง Receipt และ Consolidation ได้ แต่ไม่มีฟอร์มสร้าง Receipt, Release, Create Consolidation หรือ Confirm
- API Logistics ยังไม่มี Action สำหรับ 4 ขั้นตอนข้างต้น
- Order Detail ยังไม่ส่ง Active Warehouse และ Supplier Order Item ID ที่จำเป็นต่อ Logistics
- ชุดสถานะบนหน้าจอบางรายการไม่ตรงสถานะจริงในฐานข้อมูล
- UAT เดิมสร้าง Receipt/Consolidation ล่วงหน้าด้วย Fixture จึงยังไม่เคยพิสูจน์การทำงานตั้งแต่ต้นผ่าน App

### 3.3 ข้อขัดแย้งสำคัญที่ค้นพบ

1. ปุ่มสร้าง Shipment ปัจจุบัน hard-code `additional_member_charge=500` และ `charge_bearer=MEMBER` ซึ่งขัดกับขอบเขต Dry Run ที่ห้ามเปลี่ยนราคา/ค่าธรรมเนียม
2. Strategy `CONSOLIDATE_ALL` ถูกส่งเข้า `shipment_type` โดยตรง แต่ฐานข้อมูลรับค่า `CONSOLIDATED` จึงต้องแก้ mapping ในฟังก์ชันเดิมก่อนใช้เส้นทางมาตรฐาน
3. `create_shipment_v2` ตรวจ Dispatch Gate ครบ 4 ข้อตั้งแต่ขั้น Create Shipment แต่ Dry Run Checklist เดิมวางการตรวจ Gate หลัง DR-019 ขณะที่ Customer Balance ยังไม่ผ่าน จึงต้องตัดสินลำดับงานก่อน
4. `manageLogistics` ในหน้าจอรวมผู้มีเพียง `deliveries.manage` แต่ Receipt/Consolidation ต้องใช้ `shipments.manage`; ต้องแยกสิทธิ์แสดงปุ่มให้ตรง RPC โดยไม่เปลี่ยน Role หรือ Permission
5. หากนำ Supplier Operations model เดิมมาให้ Logistics ทั้งก้อน จะเสี่ยงเปิดเผยต้นทุนและข้อมูลการจ่าย Supplier ต้องสร้าง safe projection เฉพาะข้อมูลขั้นต่ำ

## 4. แนวทางสถาปัตยกรรม

### Reuse

- ตาราง, RLS, grants, indexes และ RPC เดิม
- Audit/Event mechanism เดิม
- รูปแบบ POST → RPC → Reload ของหน้า Order เดิม

### Modify

- เพิ่ม safe logistics projection: Active Warehouse, Supplier Order/Item ID, เลขอ้างอิง, จำนวนสั่ง/รับแล้ว/คงเหลือ
- เพิ่ม API Action สำหรับ Receipt, Release, Create Consolidation และ Confirm
- เพิ่มฟอร์มปฏิบัติงานสี่ขั้นบน Logistics panel
- ปรับ status labels ให้ตรงฐานข้อมูล
- แทนที่ปุ่ม UAT hard-code ด้วยฟอร์ม Shipment ที่ค่าใช้จ่ายเพิ่มเป็นศูนย์สำหรับ Consolidated shipment
- แยก action capability ให้ใช้ `shipments.manage` อย่างชัดเจนทั้ง UI และ Route; RPC ยังคงเป็นด่านสุดท้าย

### New แบบจำกัด

- เพิ่ม Function Migration เฉพาะ `CREATE OR REPLACE FUNCTION create_shipment_v2` เพื่อ map `CONSOLIDATE_ALL → CONSOLIDATED`
- ไม่เพิ่ม/เปลี่ยน Table, Column, Role หรือ Permission และไม่ทำ Data Migration/Backfill

## 5. ขอบเขตเสนอสำหรับ Implementation

### Must Have — Pilot GOOD Receipt

- Logistics เลือก Active Warehouse ที่มีอยู่แล้ว
- สร้าง Receipt สภาพ `GOOD`, รับ 1, Block 0
- Release จำนวน 1
- สร้าง `CONSOLIDATE_ALL` สำหรับ Order และ Warehouse เดียว จำนวน 1
- Confirm Consolidation
- สร้าง Shipment ชื่อทดสอบ `DRYRUN-SHP-001`; เลขเอกสารจริงให้ระบบออก `SHP-...`
- Shipment แบบ Consolidated ต้องมี `additional_member_charge=0` และไม่สร้าง Member Acknowledgement
- ป้องกันการกดซ้ำและแสดงข้อผิดพลาดภาษาไทยที่เข้าใจง่าย

### Future / แยก Slice

- Damage/Discrepancy พร้อม Confidential Evidence
- Cross-order/Cross-project Consolidation
- Cancel/Revision Consolidation
- List/detail แยกหน้าและ SLA/Exception Queue

### Out of Scope

- การเปลี่ยนราคา สูตร ภาษี Payment Term หรือ Freight
- Role, Permission, Authentication, Master Data ใหม่
- การแก้ข้อมูลเดิม เขียนฐานข้อมูลตรง หรือ Data Migration
- Production และ Production Deployment

## 6. ไฟล์ที่คาดว่าจะได้รับผลกระทบ

### Modify เมื่อได้รับ Implementation Authorization

- `src/components/logistics-panels.tsx`
- `src/app/api/admin/logistics/actions/route.ts`
- `src/lib/orders/server.ts`
- `src/lib/orders/types.ts`
- `src/lib/orders/admin-access.ts` เฉพาะการแยก capability สำหรับ action โดยไม่เปลี่ยนสิทธิ์ของ Role

### New

- Automated tests สำหรับ Route, UI workflow, safe projection และ permission boundary
- Function migration สำหรับ mapping `CONSOLIDATE_ALL → CONSOLIDATED` เท่านั้น

### ต้องไม่มี

- Table/Column migration
- Role/Permission migration
- Script แก้ข้อมูลธุรกรรมหรือ Master Data

## 7. Acceptance Criteria

- `DR019-AC-01` ผู้มี `shipments.manage` เห็นเฉพาะ Active Warehouse และ inbound source ของ Order นี้ โดยไม่เห็นต้นทุน สถานะจ่าย หรือข้อมูล Finance ที่ไม่จำเป็น
- `DR019-AC-02` สร้าง GOOD Receipt จำนวน 1 ผ่าน App แล้วได้เลข `WRC-...`; รับเกินจำนวนคงเหลือต้องไม่ผ่าน
- `DR019-AC-03` Release จำนวน 1 ได้ และ Release เกิน available quantity ต้องไม่ผ่าน
- `DR019-AC-04` สร้าง `CONSOLIDATE_ALL` ได้เฉพาะ released item ของ Order/Warehouse เดียว และ Confirm จาก `DRAFT` เป็น `CONFIRMED`
- `DR019-AC-05` `CONSOLIDATE_ALL` สร้าง Shipment type `CONSOLIDATED` จำนวน 1 โดยไม่มีค่าใช้จ่าย Member เพิ่มและไม่มี Partial Shipment Decision
- `DR019-AC-06` ห้ามสร้าง Receipt, Consolidation หรือ Shipment ซ้ำจากการกดครั้งเดียว/ดับเบิลคลิก
- `DR019-AC-07` Dispatch Gate ถูกตรวจตามกฎที่เจ้าของเลือก และไม่มีการ bypass
- `DR019-AC-08` Member, Finance, Purchasing, QC, ผู้มีเพียง `deliveries.manage`, บัญชี inactive และผู้ใช้ต่าง Organization เรียก Action เหล่านี้ไม่ได้
- `DR019-AC-09` Member API/หน้าเว็บ/Notification ไม่เปิดเผย Supplier/PO ID, Warehouse note, internal audit, ต้นทุน หรือข้อมูลการจ่าย
- `DR019-AC-10` ทุก Write ผ่าน RPC เดิม; Receipt/Release มี Audit และ Consolidation มี append-only Event โดยไม่เพิ่ม Notification ภายในที่ไม่จำเป็น
- `DR019-AC-11` ไม่มีการเปลี่ยนราคา ภาษี Payment Term, Role, Permission, Table, Master Data, ข้อมูลเดิม หรือ Production
- `DR019-AC-12` Typecheck, targeted tests, full tests, build และ Browser E2E ผ่านก่อน Deploy Development

## 8. แผนทดสอบ

1. Unit/API: validation และ mapping ของ 4 Action ใหม่, payload ไม่ถูกต้อง, error ไม่เปิดเผย SQL/stack trace
2. Quantity guard: รับเกิน, Release เกิน, Consolidate เกิน ต้องถูกปฏิเสธ
3. Isolation: ผิด Order, Warehouse, Organization หรือ inactive warehouse ต้องไม่ผ่าน
4. Permission: Logistics ที่มี `shipments.manage` ผ่าน; Member/Finance/Purchasing/QC/deliveries-only/inactive ไม่ผ่าน
5. Privacy: safe projection ต้องไม่มีต้นทุน ตารางจ่าย และข้อมูล Supplier ที่ไม่จำเป็น
6. UI: ทำ Receipt → Release → Consolidate → Confirm → Shipment ได้, ปุ่ม disable ระหว่างส่งคำขอ, ไม่มีข้อความ UAT หรือค่า 500
7. Integration: `CONSOLIDATE_ALL` ต้องได้ Shipment type `CONSOLIDATED`; สร้างซ้ำและ concurrent request ต้องไม่ทำให้จำนวนเกิน
8. Gate: ปิดทีละ Gate แล้วระบบต้องปฏิเสธตามกฎที่อนุมัติ; ครบทุก Gate จึงดำเนินต่อได้
9. Regression: DR-014 Supplier Payment, Production, QC, Order redaction, Tracking, Delivery และ Freight เดิม
10. Commands ก่อนส่ง QA: typecheck, targeted Vitest, full Vitest, lint และ build
11. Development Browser E2E ใช้เฉพาะ DRYRUN data ที่อนุมัติ; ไม่ใช้ Fixture ที่สร้างข้อมูลจำนวนมาก

## 9. จุดตัดสินใจก่อน Implementation

- `DR019-D01` ค่า Shipment แบบ Consolidated: `additional_member_charge=0`, `charge_bearer=GISP` และไม่สร้าง Member Acknowledgement — แนะนำอนุมัติ
- `DR019-D02` ลำดับ Dispatch Gate:
  - ทางเลือกแนะนำเพื่อเปลี่ยนน้อยที่สุด: คงกฎ App เดิมที่ต้อง Gate ครบก่อน Create Shipment และแทรกขั้น Finance Customer Balance ก่อน DR-019
  - ทางเลือกอื่น: อนุญาตสร้าง Shipment สถานะ Draft ก่อน Gate ครบ แต่ยังห้าม Dispatch; เป็นการเปลี่ยน Business Rule/Stored Function เพิ่มและต้องอนุมัติแยก
- `DR019-D03` ใช้ Active Warehouse ทดสอบเดิมใน Development; ห้ามสร้าง Master Data ใหม่ — แนะนำอนุมัติถ้ายืนยันว่า Warehouse เดิมใช้กับ Dry Run ได้
- `DR019-D04` รอบนี้รองรับ GOOD Receipt สำหรับ Pilot เท่านั้น; Damage/Discrepancy Evidence แยก Slice — แนะนำอนุมัติ
- `DR019-D05` อนุญาต Function Migration เฉพาะ mapping `CONSOLIDATE_ALL → CONSOLIDATED` ใน Development โดยไม่มี Schema/Data migration — จำเป็นต่อเส้นทางมาตรฐาน

## 10. หลักฐานตรวจสอบ

- `docs/SLICE-8-SHIPMENT-DELIVERY-PLAN.md`
- `migrations/20260830035151_slice-8-shipment-delivery.sql`
- `migrations/20260830035826_slice-8-logistics-actions.sql`
- `src/components/logistics-panels.tsx`
- `src/app/api/admin/logistics/actions/route.ts`
- `src/lib/orders/server.ts`
- `src/lib/orders/types.ts`
- `src/lib/orders/admin-access.ts`
- Baseline test: `src/lib/orders/admin-access.test.ts` ผ่าน 3/3 เมื่อ 16 กันยายน 2569

## 11. สถานะ

- แผนและการตรวจ Read-only: เสร็จ
- Source Code / Database / Transaction Data / Production: ไม่ได้แก้ไข
- ยังไม่อนุญาตให้ Builder พัฒนา, Deploy หรือ Retest ธุรกรรม

