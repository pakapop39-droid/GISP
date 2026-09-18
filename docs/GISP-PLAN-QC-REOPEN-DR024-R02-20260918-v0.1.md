# GISP QC Reopen Before Dispatch — Scope and Implementation Plan v0.1

วันที่จัดทำ: 2026-09-18 · สถานะ: **D01–D03 approved; implementation authorized for source/tests/new function-only migration, not applied or deployed**

## 1. เหตุและเป้าหมาย

ใน GISP Development ชุด `DRYRUN-R02` มี Order `ORD-2026-000011` และ Shipment `SHP-2026-000005` (`DRYRUN-R02-SHP-001`) จำนวน 1 ชิ้น สถานะก่อนออกเดินทาง แต่ผล QC ล่าสุดเป็น `PASSED` จึงไม่สามารถใช้หน้าจอเดิมบันทึกผล `FAILED` เพื่อทดสอบ DR-024 ว่า Dispatch ถูกบล็อกเมื่อ Gate เปลี่ยนได้ ขณะนี้ **ยังไม่ได้กดออกเดินทาง**

เป้าหมายขอบเขตใหม่คือเปิดการตรวจ QC ใหม่อย่างควบคุมได้ **ก่อน Dispatch** โดยไม่ลบหรือแก้ผลเดิม บังคับเหตุผล มีประวัติ/Audit และให้ Dispatch Gate ปิดเมื่อ QC กลับเข้าสู่การตรวจหรือไม่ผ่าน

## 2. Approval Record — Scope เท่านั้น

- `approval_level`: Scope Approved (concept)
- `approved_by`: ภคภพ ช.เจริญยิ่ง
- `approval_text_or_reference`: ข้อความในแชท “อนุมัติขอบเขตใหม่” หลังข้อเสนอ “เปิดตรวจ QC ใหม่ก่อน Dispatch โดยต้องระบุเหตุผลและเก็บ Audit”
- `scope_document_version`: เอกสารนี้ v0.1 เป็นรายละเอียดเสนอภายหลังการอนุมัติ concept; **ยังไม่ถือว่าเจ้าของอนุมัติรายละเอียด D01–D03 ด้านล่าง**
- `environment`: วางแผนสำหรับ Local/Development; ไม่อนุญาต Production
- `data_migration_authorized`: No; ยังไม่อนุญาตสร้างหรือ Apply migration
- `production_allowed`: No
- `approved_at`: 2026-09-18 ก่อนเวลาจัดทำ 11:31 ICT; ไม่มี timestamp ของข้อความที่แม่นยำกว่า

ไม่ตีความข้อความนี้เป็น Implementation Authorization, Development Deploy, Retest transaction หรือ Production Release Authorization

## 2.1 Approval Record — Implementation (แทนสถานะรอการตัดสิน D01–D03)

- `approval_level`: Implementation Authorized (Development code only)
- `approved_by`: ภคภพ ช.เจริญยิ่ง
- `approval_text_or_reference`: “ข้าพเจ้า ภคภพ ช.เจริญยิ่ง ยืนยัน D01–D03 และอนุญาตให้พัฒนา GISP QC Reopen ตาม GISP-PLAN-QC-REOPEN-DR024-R02-20260918-v0.1 ใน Source Code และ Automated Tests พร้อมสร้าง Migration ใหม่เฉพาะ Database Function ที่จำเป็นสำหรับ Development ไม่อนุญาตให้ Apply Migration, Deploy, Retest ธุรกรรม, เปลี่ยน Table/Column, Role, ราคา, ข้อมูลเดิม หรือ Production”
- `scope_document_version`: GISP-PLAN-QC-REOPEN-DR024-R02-20260918-v0.1, D01–D03 และ AC-01–06
- `environment`: Local source สำหรับ GISP Development เท่านั้น
- `data_or_migration_authority`: สร้างไฟล์ Migration ใหม่เฉพาะ Database Function ที่จำเป็น; ห้าม Apply, เปลี่ยนข้อมูลเดิม, Table/Column หรือ Data Migration
- `production_allowed`: No; ห้าม Deploy และ Retest ธุรกรรมใน Development ด้วยจนกว่าอนุมัติแยก
- `approved_at`: 2026-09-18 ก่อนเวลาบันทึก 11:34 ICT; ไม่มี timestamp ของข้อความอนุมัติที่แม่นยำกว่า

การตรวจสิทธิ์ `qc.manage` ตามองค์กรใน D03 เป็นการบังคับใช้สิทธิ์เดิมให้ถูกต้อง ไม่อนุญาตเปลี่ยน Role assignment หรือขยายสิทธิ์ หากการออกแบบจำเป็นต้องเปลี่ยนสิทธิ์นอกเหนือจากนี้ ให้หยุดและขออนุมัติใหม่

## 3. หลักฐานระบบปัจจุบัน

- `src/components/production-qc-panels.tsx` — `QcForm` ซ่อนฟอร์มหลังผล `PASSED`; ปุ่มเริ่มตรวจซ้ำแสดงเฉพาะผลล่าสุดที่ไม่ผ่าน
- `src/app/api/admin/qc-inspections/route.ts` — รับ `INITIAL`/`REINSPECTION` และส่งเข้า `record_qc_inspection`
- `migrations/20260829121209_fix-slice-7-file-id-array.sql` — ฟังก์ชันปัจจุบันรับ parent ของ `REINSPECTION` เฉพาะ `FAILED`/`REWORK_REQUIRED`; ตรวจ `qc.manage` โดยยังไม่ระบุ organization ในจุดต้นฟังก์ชัน
- `migrations/20260829120215_slice-7-production-qc.sql` — `order_items.qc_status` มี `IN_PROGRESS` แล้ว; Gate ผ่านเมื่อ QC เป็น `PASSED`/`MEMBER_APPROVED`
- `migrations/20260830035826_slice-8-logistics-actions.sql` — `dispatch_shipment` ตรวจ Gate ซ้ำและโยน `DISPATCH_GATE_CHANGED` ถ้าเงื่อนไขไม่ครบก่อนออกเดินทาง
- `docs/GISP-UAT-R02-EXECUTION-20260917-v0.1.md` — หลักฐาน R02 ปัจจุบัน: Shipment สร้างแล้ว แต่ยังไม่มี QC FAILED หลัง PASS หรือ Negative Dispatch Result

## 4. แนวทางแนะนำและจุดให้เจ้าของตัดสิน

| รหัส | ทางเลือกแนะนำ | เหตุผล / ผลกระทบ |
|---|---|---|
| D01 | เมื่อกด “เปิดตรวจ QC ใหม่” ให้บันทึกเหตุผลและเปลี่ยน QC เป็น `IN_PROGRESS` **ทันที** ก่อนกรอกผล | Gate ปิดระหว่างรอตรวจ; ถ้าแค่เปิดฟอร์มใน Browser แล้ว Gate ยัง PASS จะยัง Dispatch ได้ |
| D02 | ให้เป็นความสามารถมาตรฐานสำหรับรายการที่ยังไม่ Dispatch ไม่จำกัดเฉพาะ R02 | รับมือกรณีพบข้อบกพร่องหลัง QC ผ่านในงานจริง; ต้องห้ามรายการที่ออกเดินทางแล้ว |
| D03 | ในขอบเขตพัฒนาเดียวกัน ให้แก้การตรวจ `qc.manage` ให้ผูก organization ของ Order และให้คำสั่ง Reopen/Dispatch ล็อกข้อมูลที่เกี่ยวข้องพร้อมตรวจ Gate ภายใต้การแข่งขันของสองคำสั่ง | ป้องกันข้ามองค์กรและกรณีกดออกเดินทางพร้อมกับเปิด QC ใหม่; ไม่เปลี่ยน Role/Permission assignment |

หากเจ้าของไม่รับ D01 ให้ระบุชัดว่าช่วง “เปิดฟอร์มแต่ยังไม่บันทึกผล” อาจ Dispatch ได้; หากไม่รับ D02 ให้กำหนดว่าจะจำกัดความสามารถเฉพาะ Test อย่างไรโดยไม่ทำให้ Production รับกฎผิด; หากไม่รับ D03 ต้องแยก Security/Concurrency Blocker ออกจากผล QA

## 5. ขอบเขตพัฒนาเมื่อได้รับ Implementation Authorization แยกต่างหาก

1. เพิ่มคำสั่ง “เปิดตรวจ QC ใหม่ก่อน Dispatch” ในหน้า Order/QC สำหรับผู้มี `qc.manage` ที่องค์กรตรงกัน บังคับเหตุผลและไม่ให้ใช้หลัง Shipment ออกเดินทาง
2. Backend บันทึกสถานะ `IN_PROGRESS` และ Audit ที่อ้างถึงผล `PASSED` เดิม โดยไม่แก้หรือลบ QC Inspection เดิม; การกดเปิดซ้ำต้องไม่สร้างเหตุการณ์ซ้ำ
3. ฟอร์มตรวจใหม่บันทึกเป็น `REINSPECTION` อ้างอิง parent `PASSED` พร้อม Checklist และผลจริง; ประวัติใช้คำว่า “ตรวจซ้ำหลังผ่าน” ไม่แสดงเป็น “ตรวจครั้งแรก”
4. เมื่อผลใหม่ `FAILED`/`REWORK_REQUIRED` Gate ต้องไม่ผ่าน; ถ้าผลใหม่ `PASSED` ให้กลับผ่านตาม 4 เงื่อนไขเดิม; ห้าม Dispatch ระหว่าง `IN_PROGRESS`
5. ปรับฟังก์ชันฐานข้อมูลผ่าน migration ใหม่แบบ `CREATE OR REPLACE FUNCTION` เฉพาะที่จำเป็น รวมการตรวจ organization และ atomicity; **ไม่เพิ่มตาราง/คอลัมน์หรือทำ Data Migration** หากออกแบบจริงจำเป็นต้องเปลี่ยน Schema ให้กลับมาขออนุมัติใหม่
6. เพิ่ม Automated Tests สำหรับ UI/API, กฎ SQL, สิทธิ์ข้ามองค์กร, ประวัติ/Audit, กดซ้ำ, หลัง Dispatch, และการแข่งขัน QC Reopen ↔ Dispatch

ไฟล์ที่คาดว่าจะกระทบ: `src/components/production-qc-panels.tsx`, `src/app/api/admin/qc-inspections/route.ts`, route ใหม่สำหรับ Reopen ตามแบบที่ Architect ยืนยัน, migration ใหม่ของฟังก์ชัน QC/Dispatch และไฟล์ทดสอบที่เกี่ยวข้อง รายการนี้เป็น **แผน** ไม่ใช่สิทธิ์แก้ไฟล์

## 6. Acceptance Criteria และ UAT R02

| รหัส | เกณฑ์ตรวจรับ |
|---|---|
| AC-01 | `bobady` เปิดตรวจ QC ใหม่ของ `ORD-2026-000011` ได้ก่อน Dispatch โดยใส่เหตุผล `DRYRUN-R02 Development Test`; ผล PASS เดิมยังอยู่ |
| AC-02 | ทันทีหลังเปิดใหม่ QC เป็น `IN_PROGRESS`, Gate = ไม่พร้อมจัดส่ง, มี Audit/ประวัติอ้างเหตุผลและผู้กระทำ; เปิดซ้ำไม่เพิ่มรายการ |
| AC-03 | บันทึก Checklist จำลองอย่างน้อย 1 ข้อ `FAILED`, ผลรวม `FAILED`; ประวัติเป็นการตรวจซ้ำและ Gate ยังไม่ผ่าน |
| AC-04 | Logistics กด `ยืนยันออกเดินทาง` ของ `SHP-2026-000005` หนึ่งครั้ง; App ปฏิเสธและ Shipment ยังคงสถานะก่อน Dispatch; ตรวจ Audit/Event ตามที่ระบบสร้างจริง ไม่แตะ R01 |
| AC-05 | ผู้ใช้ผิดองค์กร/ไม่มี `qc.manage` ทำไม่ได้; หลัง Dispatch ทำไม่ได้; การกด QC Reopen แข่งกับ Dispatch ต้องไม่มีกรณี Shipment ออกแล้วแต่ QC กลาย `IN_PROGRESS` |
| AC-06 | Regression: QC ไม่ผ่าน → Reinspection เดิม, QC ผ่านปกติ, Member Custom approval, Payment Gate, Shipment สร้าง/ออกเดินทางตามปกติ ยังทำงานตามกฎเดิม |

ผล UAT เดิมและเอกสาร PDF จำลองเป็นหลักฐาน Development เท่านั้น; การตรวจเนื้อหา PDF ที่เก็บบนเซิร์ฟเวอร์ของ `PAY-2026-000030` ยัง **NOT TESTED / ไม่ใช่ UAT PASS** ตามข้อยกเว้นที่เจ้าของอนุมัติไว้

## 7. ลำดับควบคุม

1. เจ้าของยืนยัน D01–D03 และออก **Implementation Authorization** ที่ระบุ Local/Development Source Code, Tests, migration ใหม่เฉพาะ function, สิ่งที่ห้าม และยืนยันว่า **ยังไม่อนุญาต Apply/Deploy/Retest/Production**
2. Builder แก้เฉพาะขอบเขตที่ได้รับอนุมัติ; QA ตรวจแยกด้วยผลทดสอบจริงและประเมิน Security/Concurrency
3. ขออนุมัติ Apply migration และ Deploy ไป **Development** แยกจากขั้นพัฒนา แล้ว Retest `SHP-2026-000005` ตาม AC-01–04; ไม่ถือเป็น Production Release
4. สรุป UAT โดยแยกผลผ่านจริง, ไม่ผ่าน, ไม่ได้ทดสอบ และช่องว่าง PO Version/Supplier Acknowledgement กับ Evidence Viewing ก่อนพิจารณาปิด Slice
