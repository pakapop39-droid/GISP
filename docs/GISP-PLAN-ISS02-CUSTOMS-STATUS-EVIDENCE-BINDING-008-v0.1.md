# GISP-PLAN-ISS02-CUSTOMS-STATUS-EVIDENCE-BINDING-008 v0.1

## 1. สถานะและอำนาจอนุมัติ

- ผู้อนุมัติขอบเขตแผน: ภคภพ ช.เจริญยิ่ง
- วันที่บันทึก: 16 กันยายน 2569 เวลา 12:00 น. (Asia/Bangkok)
- Environment: Development เท่านั้น
- ระดับอนุมัติ: Planning / Analysis only
- อนุญาต: วิเคราะห์ขอบเขต ผลกระทบ ไฟล์ที่เกี่ยวข้อง Acceptance Criteria และแผนทดสอบ
- ไม่อนุญาต: แก้ Source Code, Database, Schema, Function, Role, Permission, ข้อมูลธุรกรรม, Data Migration, Deploy หรือ Production
- Implementation Authorization: ยังไม่มี
- Production Release Authorization: ไม่มี

ข้อความอนุมัติที่บันทึก:

> “อนุมัติจัดทำแผน ISS-02 Customs Status Evidence Binding สำหรับ Development เท่านั้น ไม่อนุญาตให้แก้โค้ด ฐานข้อมูล หรือ Production”

## 2. เป้าหมาย

ป้องกันไม่ให้ GISP แสดงว่า Shipment “ผ่านพิธีการนำเข้า” ทั้งที่ระบบมีเพียงเหตุการณ์ `IMPORT_CUSTOMS` และยังไม่มีหลักฐานยืนยัน โดยออกแบบทางแก้ที่:

- สื่อความหมายสถานะถูกต้อง
- ผูกหลักฐานกับ Shipment และการเปลี่ยนสถานะอย่างตรวจสอบย้อนหลังได้
- ไม่เปิดเผยเอกสารศุลกากรแก่ Member
- ใช้โครงสร้างและสิทธิ์เดิมให้มากที่สุด
- ไม่แก้หรือลบประวัติเดิม

## 3. ข้อเท็จจริงของระบบปัจจุบัน

1. หน้ากรอก Tracking แปล `IMPORT_CUSTOMS` ว่า “พิธีการศุลกากร” แต่หัวข้อ Shipment แปลสถานะเดียวกันว่า “ผ่านพิธีการนำเข้า” จึงสื่อความหมายไม่ตรงกัน
2. API ยอมรับ `IMPORT_CUSTOMS` โดย `evidence_file_id` เป็น Optional
3. Database Function `add_shipment_event` เปลี่ยน Shipment เป็น `IMPORT_CUSTOMS` ทันที และตรวจหลักฐานเฉพาะเมื่อมีการส่ง File ID มา
4. ฟอร์ม Tracking ปัจจุบันไม่อัปโหลดหรือส่ง `evidence_file_id`
5. Schema มี `shipment_documents` และชนิดเอกสาร `CUSTOMS_ENTRY` อยู่แล้ว แต่ Order Loader และหน้าจอ Logistics ยังไม่โหลด/แสดงหลักฐานดังกล่าว
6. Upload Endpoint ปัจจุบันรองรับ Production, QC และ Delivery Evidence เท่านั้น ยังไม่มี Customs Evidence ที่ใช้สิทธิ์ `shipments.manage`
7. `shipment_status_history` เป็น Append-only จึงไม่ควรแก้หรือลบประวัติเดิม
8. Active UX แยกคำว่า “อยู่ระหว่างพิธีการนำเข้า” และ “ผ่านพิธีการแล้ว” แต่ Code/Schema ปัจจุบันมีเพียง `IMPORT_CUSTOMS` ก่อน `THAILAND_WAREHOUSE`
9. UAT เดิมพิสูจน์เพียงการเลื่อน Milestone ตามลำดับ ยังไม่ได้พิสูจน์ Evidence Gate
10. Shipment ทดสอบ `SHP-2026-000002` อยู่ที่ `IMPORT_CUSTOMS` โดยไม่มี `CUSTOMS_ENTRY` หรือ Tracking Evidence และหมายเหตุระบุว่าเป็น Development Test ซึ่งยังไม่ใช่การยืนยันผ่านศุลกากรจริง

## 4. ปัญหาและความเสี่ยง

### Blocker ของ Dry Run

- คำว่า “ผ่านพิธีการนำเข้า” เป็นการรับรองเกินกว่าหลักฐานที่ระบบมี
- ผู้ใช้สามารถเลื่อนไป `THAILAND_WAREHOUSE` ผ่าน API/Database Function ได้โดยไม่แนบ Customs Evidence
- หากเดินหน้าต่อ ประวัติระบบอาจสื่อว่าผ่านขั้นตอนควบคุมแล้วทั้งที่ไม่มีหลักฐานรองรับ

### ช่องว่างข้างเคียงที่พบ แต่ยังไม่รวมแก้โดยอัตโนมัติ

- Database Guard ใช้ `new_rank < last_rank` จึงอาจบันทึก Milestone ลำดับเดิมซ้ำผ่าน API ได้ แม้ UI จะพยายามซ่อนตัวเลือกที่ใช้แล้ว
- Tracking ปัจจุบันยังไม่เขียน Audit/Notification สำหรับทุก Event
- การเพิ่ม Notification เป็นผลข้างเคียงใหม่ ต้องขออนุมัติแยกหากต้องการ

## 5. ทางเลือกการออกแบบ

### Option A — ใช้สถานะเดิมและผูกหลักฐานที่ทางเข้าคลังไทย (แนะนำสำหรับ Pilot)

- `IMPORT_CUSTOMS` หมายถึง “อยู่ระหว่างพิธีการนำเข้า” เท่านั้น
- เปลี่ยนเป็น `THAILAND_WAREHOUSE` ได้เมื่อแนบ Customs Evidence และยืนยันอย่างชัดเจน
- ปุ่มใช้ข้อความ “ยืนยันผ่านพิธีการและถึงคลังไทย”
- เก็บเอกสารเป็น `CUSTOMS_ENTRY`, Internal-only และบันทึก Audit
- ใช้ `shipments.manage` เดิม ไม่เพิ่ม Role/Permission
- ไม่เพิ่ม Table/Column/Status และไม่แก้ข้อมูลเดิม
- ต้องมี Function Migration แบบ `CREATE OR REPLACE FUNCTION` เพื่อบังคับ Gate ในฐานข้อมูล แต่ไม่ใช่ Data Migration

ข้อดี: กระทบน้อย, ใช้โครงสร้างเดิม, Dashboard เดิมยังทำงาน และ `SHP-2026-000002` ไม่ต้องแก้ข้อมูล

ข้อจำกัด: ไม่สามารถแสดงช่วง “ผ่านศุลกากรแล้ว แต่ยังไม่ถึงคลังไทย” เป็นสถานะแยก

### Option B — แยก Customs In Progress และ Customs Cleared

- คง `IMPORT_CUSTOMS` เป็น “อยู่ระหว่างพิธีการนำเข้า”
- เพิ่มสถานะ `IMPORT_CUSTOMS_CLEARED` ก่อน `THAILAND_WAREHOUSE`
- เพิ่ม Approval Record/ผู้ยืนยัน/เวลายืนยันและ Evidence Gate แยกชัดเจน
- ต้องแก้ Status Constraints, Ranking, Function, UI, Types, Dashboard/Report และ Automated Tests
- อาจต้องมี Table/Column หรือ Permission ใหม่ ขึ้นกับผู้อนุมัติที่กำหนด

ข้อดี: ตรงกับ Active UX และสถานะธุรกิจจริงมากกว่า

ข้อจำกัด: ขอบเขตกว้างกว่าและต้องอนุมัติ Schema/Business Rule เพิ่ม

## 6. ข้อเสนอแนะ

เลือก **Option A สำหรับ Development Pilot** เพื่อหยุดการแสดงสถานะเกินจริงโดยเปลี่ยนงานน้อยที่สุด และเก็บ Option B เป็น Slice หลัง Pilot หากต้องติดตามช่วงผ่านศุลกากรแต่ยังไม่ถึงคลังแยกกัน

ลำดับที่เสนอ:

1. แก้ความหมาย `IMPORT_CUSTOMS` เป็น “อยู่ระหว่างพิธีการนำเข้า” ทุกจุด
2. เพิ่ม Upload Kind `CUSTOMS_ENTRY` ที่ตรวจ `shipments.manage` และผูกกับ Shipment/Organization
3. เก็บไฟล์ในพื้นที่ Confidential และไม่ให้ Member เห็น
4. บังคับ Evidence Gate ใน Database Function เมื่อเปลี่ยนไป `THAILAND_WAREHOUSE`
5. สร้าง History, Document Link, Shipment Status และ Audit ใน Transaction เดียว
6. คง `SHP-2026-000002` และประวัติเดิมไว้ทั้งหมด แล้ว Retest ด้วยหลักฐาน Development Test ที่ได้รับอนุมัติ

## 7. Requirements ที่เสนอสำหรับ Option A

- `ISS02-REQ-001` `IMPORT_CUSTOMS` ต้องแสดงว่า “อยู่ระหว่างพิธีการนำเข้า” และห้ามใช้คำว่า “ผ่าน”
- `ISS02-REQ-002` `THAILAND_WAREHOUSE` ต้องถูกปฏิเสธหากไม่มี Customs Evidence ที่ถูกต้อง
- `ISS02-REQ-003` Customs Evidence ต้องผูกกับ Shipment และ Organization เดียวกัน
- `ISS02-REQ-004` การยืนยันต้องบันทึก Actor, Timestamp, Evidence Link และ Audit แบบ Atomic
- `ISS02-REQ-005` ใช้สิทธิ์ `shipments.manage` เดิม และให้ Database Function ตรวจสิทธิ์ซ้ำ
- `ISS02-REQ-006` Customs Evidence ต้องเป็น Internal-only โดยปริยายและ Member ดาวน์โหลดไม่ได้
- `ISS02-REQ-007` ห้ามแก้ ลบ หรือ Backfill ประวัติ `SHP-2026-000002`
- `ISS02-REQ-008` Dashboard ต้องยังนับ `IMPORT_CUSTOMS` เป็น Shipment ระหว่างทาง
- `ISS02-REQ-009` การแก้ Duplicate Milestone และ Notification ต้องทำเฉพาะเมื่อเจ้าของอนุมัติใน Scope

## 8. ขอบเขตไฟล์ที่คาดว่าจะได้รับผลกระทบเมื่อได้รับ Implementation Authorization

### Modify

- `src/components/logistics-panels.tsx`
  - แก้ Label และเพิ่ม Customs Evidence Upload/Confirmation
- `src/app/api/admin/logistics/actions/route.ts`
  - รับ Evidence ID และแสดง Business Error ที่เข้าใจง่าย
- `src/app/api/admin/operations-media/route.ts`
  - รองรับ `CUSTOMS_ENTRY`, ตรวจ `shipments.manage`, Shipment และ Organization
- `src/lib/orders/server.ts`
  - โหลดข้อมูล Customs Document ขั้นต่ำสำหรับ Admin
- `src/lib/orders/types.ts`
  - เพิ่ม Type สำหรับ Customs Evidence Summary
- `docs/SLICE-8-HUMAN-UAT.md`
  - ปรับ Checklist ให้แยก “อยู่ระหว่างพิธีการ” กับ “ยืนยันผ่านและถึงคลัง”

### New

- Migration ใหม่สำหรับ `CREATE OR REPLACE FUNCTION public.add_shipment_event` เท่านั้น
- Automated Tests สำหรับ UI, API, Upload, Function Guard, Permission และ Privacy
- Signed-download Endpoint เฉพาะกรณีต้องให้ Logistics เปิดดูไฟล์จาก App

### ต้องไม่มีใน Option A

- Table หรือ Column ใหม่
- Status/Constraint ใหม่
- Role หรือ Permission ใหม่
- Data Migration หรือ Backfill
- การลบหรือแก้ข้อมูลธุรกรรมเดิม
- Production Change

## 9. Acceptance Criteria

- `ISS02-AC-001` เมื่อ Shipment เป็น `IMPORT_CUSTOMS` ทุกหน้าต้องแสดง “อยู่ระหว่างพิธีการนำเข้า” และไม่มีคำว่า “ผ่าน”
- `ISS02-AC-002` การเพิ่ม `IMPORT_CUSTOMS` โดยไม่มีหลักฐานยังบันทึกได้ในความหมาย “กำลังดำเนินการ”
- `ISS02-AC-003` การเปลี่ยนไป `THAILAND_WAREHOUSE` โดยไม่มี Evidence ต้องได้ Business Error และต้องไม่สร้าง History, Document, Audit หรือเปลี่ยน Shipment
- `ISS02-AC-004` Evidence ผิด Shipment, ผิด Organization, Visibility ผิด หรือ File ID ไม่มีอยู่จริงต้องถูกปฏิเสธ
- `ISS02-AC-005` เมื่อ Evidence ถูกต้อง ระบบสร้าง History + `CUSTOMS_ENTRY` + Shipment Status + Audit สำเร็จพร้อมกัน หรือไม่สร้างอะไรเลย
- `ISS02-AC-006` ผู้ไม่มี `shipments.manage` และผู้ใช้ต่าง Organization อัปโหลดหรือยืนยันไม่ได้
- `ISS02-AC-007` Member เห็นเฉพาะ Milestone ที่อนุญาต แต่ไม่เห็น Metadata, URL หรือเนื้อหา Customs Evidence
- `ISS02-AC-008` `SHP-2026-000002` และ Event เดิมยังอยู่ครบ โดย `IMPORT_CUSTOMS` ถูกตีความเป็น In Progress
- `ISS02-AC-009` Tracking Status อื่น, DR-019, Delivery และ Dashboard ไม่เกิด Regression
- `ISS02-AC-010` Typecheck, Lint, Targeted Tests, Full Tests, Build และ Development Browser Retest ผ่านก่อนขอ Deploy

## 10. แผนทดสอบ

1. Label Test: `IMPORT_CUSTOMS` แสดง “อยู่ระหว่างพิธีการนำเข้า” ทั้ง Admin และ Member
2. API Test: ไม่มี Evidence, File ID ผิด, Shipment ผิด, Organization ผิด และ Permission ผิดต้องถูกปฏิเสธตามกฎ
3. Upload Test: อนุญาตเฉพาะชนิดไฟล์/ขนาดที่กำหนด, ใช้พื้นที่ Confidential และล้าง Object หากสร้าง Metadata ไม่สำเร็จ
4. Function Test: Missing/Wrong Evidence ต้องไม่เปลี่ยนข้อมูล; Evidence ถูกต้องต้องเขียนทุกส่วนแบบ Atomic
5. Privacy Test: Member ต้องอ่านหรือดาวน์โหลด Customs Evidence ไม่ได้
6. Audit Test: บันทึกผู้ยืนยัน เวลา Shipment และ Evidence Reference โดยไม่เผยข้อมูลลับใน Member Projection
7. Regression Test: Status อื่น, Receipt/Consolidation/Shipment, Dashboard, Delivery และ Freight เดิม
8. Browser Retest: ใช้เฉพาะ `SHP-2026-000002` ใน Development และหลักฐาน Development Test ที่ได้รับอนุมัติ
9. Separate Test หากรวม D04: API/Function ต้องปฏิเสธ Milestone ลำดับเดิมที่บันทึกซ้ำ

## 11. Security และ Privacy

- ไม่ใช้ `gisp-member-private` สำหรับเอกสารศุลกากร เพราะ Member อาจเข้าถึง Metadata ตามความสัมพันธ์ของ Order
- ใช้พื้นที่ Confidential และเปิดไฟล์ผ่าน Server Route ที่ตรวจ Shipment, Organization และ `shipments.manage`
- ไม่เพิ่ม `files.confidential.*` ให้ Logistics ทั้งระบบ เพราะจะขยายสิทธิ์กว้างเกินความจำเป็น
- Database Function ต้องคง `SECURITY DEFINER`, Fixed `search_path`, `auth.uid()` และ Organization Check
- Audit เก็บ File ID/Reference ได้ แต่ห้ามเปิด URL หรือเนื้อหาเอกสารใน Member Response/Notification

## 12. Rollback Plan

1. Roll back App Deployment ก่อน
2. Apply Forward Rollback Migration เพื่อคืน Function Definition เดิม
3. ไม่ลบ History, Audit, File หรือ Shipment Document ที่สร้างสำเร็จแล้ว
4. Option A ไม่มี Table/Column/Data Migration จึงไม่ต้องย้อนข้อมูล

## 13. จุดตัดสินใจของเจ้าของก่อน Implementation

- `ISS02-D01` เลือกโครงสร้างสถานะ
  - **แนะนำ:** Option A — `IMPORT_CUSTOMS` = อยู่ระหว่างดำเนินการ และบังคับหลักฐานก่อน `THAILAND_WAREHOUSE`
  - Option B — เพิ่มสถานะ Customs Cleared แยกต่างหาก
- `ISS02-D02` ผู้ยืนยัน
  - **แนะนำสำหรับ Pilot:** ผู้มี `shipments.manage` ยืนยันได้ โดย Database Function ตรวจซ้ำ
  - ทางเลือก: Two-person Check หรือผู้อนุมัติบทบาทอื่น ซึ่งจะเป็น Scope/Permission ใหม่
- `ISS02-D03` หลักฐานขั้นต่ำและการมองเห็น
  - **แนะนำสำหรับ Development Pilot:** PDF/JPG/PNG อย่างน้อย 1 ไฟล์ที่ระบุชัดว่าเป็น Development Test; เก็บ Confidential และ Member ไม่เห็นไฟล์
  - Production Compliance Set เช่น HS Code, Permit, Invoice, Packing List, B/L ต้องออก Business/Legal Decision แยกก่อน Production
- `ISS02-D04` Duplicate Milestone
  - **แนะนำ:** รวมการป้องกัน Milestone ลำดับเดิมซ้ำใน Function Migration เดียวกัน
  - ทางเลือก: แยกเป็น Issue/Slice ใหม่เพื่อลด Scope
- `ISS02-D05` ข้อมูลทดสอบปัจจุบัน
  - **แนะนำ:** ไม่แก้ `SHP-2026-000002`; ให้ Relabel เป็น In Progress และ Retest ขั้นถัดไปหลัง Deploy Development

## 14. หลักฐานที่ตรวจ

- `src/components/logistics-panels.tsx`
- `src/app/api/admin/logistics/actions/route.ts`
- `src/app/api/admin/operations-media/route.ts`
- `src/lib/orders/server.ts`
- `src/lib/orders/types.ts`
- `migrations/20260830035151_slice-8-shipment-delivery.sql`
- `migrations/20260830035826_slice-8-logistics-actions.sql`
- `migrations/20260831145347_slice-10-dashboard-reports.sql`
- `docs/SLICE-8-SHIPMENT-DELIVERY-PLAN.md`
- `docs/SLICE-8-HUMAN-UAT.md`
- `docs/active/UX-UI FLOW VOLUME 2.md`
- `DRYRUN-R01-DR-026-Manual-Import-Compliance-Checklist-25690916.pdf`

## 15. สถานะ

- แผนและการตรวจ Read-only: เสร็จ
- Source Code / Database / Transaction Data / Production: ไม่ได้แก้ไข
- เอกสารที่สร้าง: แผนฉบับนี้เท่านั้น
- ยังไม่อนุญาตให้ Implement, Apply Migration, Deploy หรือ Retest ธุรกรรม

