# GISP-APR-ISS02-IMPLEMENTATION-010 v1.0

## 1. Approval Record

| รายการ | รายละเอียด |
|---|---|
| `approval_level` | Implementation |
| `approved_by` | ภคภพ ช.เจริญยิ่ง |
| `approval_text_or_reference` | ข้อความอนุมัติของเจ้าของใน Codex Task วันที่ 16 กันยายน 2569 |
| `scope_document_version` | `GISP-PLAN-ISS02-CUSTOMS-STATUS-EVIDENCE-BINDING-008 v0.1` และ `GISP-APR-ISS02-PLANNING-CLOSURE-009 v1.0` |
| `environment` | Development workspace เท่านั้น |
| `data_migration_authorized` | No |
| `production_allowed` | No |
| `apply_migration_authorized` | No |
| `deploy_authorized` | No |
| `transaction_retest_authorized` | No |
| `approved_at` | 16 กันยายน 2569 เวลา 12:13 น. (Asia/Bangkok) |

## 2. ข้อความอนุมัติจากเจ้าของ

> ข้าพเจ้า ภคภพ ช.เจริญยิ่ง อนุญาตให้ดำเนินการพัฒนา ISS-02 Customs Status Evidence Binding ตาม GISP-PLAN-ISS02-CUSTOMS-STATUS-EVIDENCE-BINDING-008 v0.1 และผลอนุมัติใน GISP-APR-ISS02-PLANNING-CLOSURE-009 v1.0 สำหรับ Development เท่านั้น อนุญาตให้แก้ Source Code, Automated Tests และสร้าง Migration ใหม่เฉพาะการปรับ Function `add_shipment_event` ตาม Option A รวมถึงการป้องกัน Milestone ซ้ำ ไม่อนุญาตให้ Apply Migration, Deploy, Retest, แก้ข้อมูลธุรกรรมเดิม, เปลี่ยน Table, Column, Role, Permission, ราคา, ภาษี, Payment Term, ทำ Data Migration หรือแก้ Production

## 3. ขอบเขตที่อนุญาต

- แก้ Source Code เพื่อให้ `IMPORT_CUSTOMS` หมายถึง “อยู่ระหว่างพิธีการนำเข้า”
- เพิ่ม Customs Evidence Upload ที่ใช้ `shipments.manage`, ผูก Shipment/Organization และเก็บแบบ Confidential
- บังคับ Evidence ก่อนเปลี่ยนเป็น `THAILAND_WAREHOUSE`
- เพิ่ม Audit สำหรับการยืนยันผ่านพิธีการและถึงคลังไทย
- ป้องกันการบันทึก Milestone ลำดับเดิมซ้ำ
- เพิ่มหรือแก้ Automated Tests ตาม Acceptance Criteria ของแผน
- สร้าง Migration ใหม่เฉพาะ `CREATE OR REPLACE FUNCTION public.add_shipment_event`

## 4. ข้อห้าม

- ห้าม Apply Migration หรือเขียนข้อมูลลง Development Backend
- ห้าม Deploy หรือ Retest ธุรกรรม
- ห้ามแก้ข้อมูลเดิม รวมถึง `SHP-2026-000002`
- ห้ามเปลี่ยน Table, Column, Constraint, Role, Permission หรือ Authentication
- ห้ามเปลี่ยนราคา ภาษี Payment Term หรือ Master Data
- ห้ามทำ Data Migration หรือ Backfill
- ห้ามแก้หรือ Deploy Production

## 5. Release Status

- Implementation: **AUTHORIZED** ตามขอบเขตข้างต้น
- Apply Migration: **NOT AUTHORIZED**
- Development Deployment: **NOT AUTHORIZED**
- Production Release: **NOT AUTHORIZED**

