# GISP-APR-ISS02-DEVELOPMENT-RELEASE-011 v1.0

## 1. Approval Record

| รายการ | รายละเอียด |
|---|---|
| `approval_level` | Development Release / Retest |
| `approved_by` | ภคภพ ช.เจริญยิ่ง |
| `approval_text_or_reference` | ข้อความอนุมัติของเจ้าของใน Codex Task วันที่ 16 กันยายน 2569 |
| `scope_document_version` | `GISP-PLAN-ISS02-CUSTOMS-STATUS-EVIDENCE-BINDING-008 v0.1`, `GISP-APR-ISS02-PLANNING-CLOSURE-009 v1.0`, `GISP-APR-ISS02-IMPLEMENTATION-010 v1.0` |
| `environment` | GISP Development เท่านั้น |
| `migration_authorized` | Yes — เฉพาะ `20260916123000_iss02-customs-evidence-binding.sql` |
| `data_migration_authorized` | No |
| `development_deploy_authorized` | Yes — เฉพาะการแก้ ISS-02 ที่ผ่าน QA |
| `transaction_retest_authorized` | Yes — เฉพาะ `SHP-2026-000002` ตามขั้นตอนที่ระบุ |
| `production_allowed` | No |
| `approved_at` | 16 กันยายน 2569 เวลา 12:33 น. (Asia/Bangkok) |

## 2. ข้อความอนุมัติจากเจ้าของ

> ข้าพเจ้า ภคภพ ช.เจริญยิ่ง อนุมัติให้ Apply migration 20260916123000_iss02-customs-evidence-binding.sql และ Deploy การแก้ไข ISS-02 ตาม GISP-PLAN-ISS02-CUSTOMS-STATUS-EVIDENCE-BINDING-008 v0.1 ไปยัง GISP Development เท่านั้น พร้อมอนุญาตให้ Retest SHP-2026-000002 โดยใช้ไฟล์ DRYRUN-R01-DR-026-Manual-Import-Compliance-Checklist-25690916.pdf หนึ่งครั้ง เพื่อยืนยันถึงคลังไทยและเปลี่ยนเป็นพร้อมนัดส่ง รวมถึงสร้าง Audit และประวัติที่ระบบสร้างอัตโนมัติ ไม่อนุญาตให้เปลี่ยน Table, Column, Role, Permission, Master Data, ราคา, ภาษี, Payment Term, ลบหรือแก้ประวัติเดิม, ทำ Data Migration หรือ Deploy Production

## 3. ลำดับการดำเนินการที่อนุมัติ

1. ตรวจยืนยันว่า CLI เชื่อมกับ `gisp-mvp-development`
2. Apply เฉพาะ Migration ที่อนุมัติ
3. Deploy Source ปัจจุบันไปยัง GISP Development
4. ตรวจ Deployment/Health
5. Retest `SHP-2026-000002` ด้วยไฟล์ที่ระบุหนึ่งครั้ง
6. ยืนยัน `THAILAND_WAREHOUSE` แล้วเปลี่ยนเป็น `READY_FOR_DELIVERY`
7. ตรวจ History, Customs Evidence และ Audit ที่ระบบสร้างอัตโนมัติ

## 4. ข้อห้าม

- ห้าม Apply Migration อื่น
- ห้ามเปลี่ยน Table, Column, Constraint, Role, Permission หรือ Authentication
- ห้ามแก้ Master Data ราคา ภาษี Payment Term หรือข้อมูลอื่น
- ห้ามลบหรือแก้ประวัติเดิม
- ห้าม Data Migration หรือ Backfill
- ห้าม Deploy หรือแก้ Production

