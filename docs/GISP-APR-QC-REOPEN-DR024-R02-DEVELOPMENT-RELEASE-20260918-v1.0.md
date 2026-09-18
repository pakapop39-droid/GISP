# GISP QC Reopen / DR-024 R02 — Development Apply, Deploy and Retest Approval v1.0

## Approval Record

| รายการ | รายละเอียด |
|---|---|
| `approval_level` | Development Apply / Deploy / Retest Authorization (ไม่ใช่ Production Release) |
| `approved_by` | ภคภพ ช.เจริญยิ่ง |
| `approval_text_or_reference` | ข้อความใน Codex Task: “อนุมัติแยกให้ Apply migration, Deploy และ Retest เฉพาะ Development” อ้างต่อจากผล QA รอบสองและข้อเสนอ 2 ขั้นตอนเพื่อปิด Slice QC Reopen / DR-024 R02 |
| `scope_document_version` | `GISP-PLAN-QC-REOPEN-DR024-R02-20260918-v0.1` D01–D03, AC-01–06; Implementation Approval ใน §2.1 ของแผน; ผล QA รอบสอง PASS เฉพาะโค้ดในเครื่อง 438/438 tests |
| `environment` | โปรเจกต์ `gisp-mvp-development` เท่านั้น (InsForge project ID `db09b94e-fc37-4f90-9530-3289afef0b79`, backend `kit6y4pj.ap-southeast.insforge.app`, เว็บไซต์ `gisp-mvp-development.insforge.site`) |
| `migration_authorized` | Yes — Apply เฉพาะ `migrations/20260918050000_qc-reopen-before-dispatch.sql` หลังตรวจ remote migration head; ห้าม Apply migration อื่น |
| `data_migration_authorized` | No — ไม่มี backfill หรือแก้ข้อมูลเดิมนอกขั้น Retest R02 ที่ระบุ |
| `development_deploy_authorized` | Yes — เฉพาะ GISP QC Reopen code ที่ QA ตรวจผ่าน; ต้องตรวจว่าการ deploy source ไม่พางานอื่นที่ยังไม่อนุมัติขึ้นไป |
| `transaction_retest_authorized` | Yes — เฉพาะ R02 `ORD-2026-000011`, `SHP-2026-000005` ตาม AC-01–06; Reopen QC ด้วยเหตุผล Development Test, บันทึก Checklist FAILED จำลอง, ลอง Dispatch หนึ่งครั้งซึ่งคาดว่าจะถูกบล็อก แล้วตรวจสถานะ/Audit/ประวัติ ห้ามแตะ R01 หรือธุรกรรมอื่น |
| `production_allowed` | No |
| `approved_at` | 2026-09-18 ก่อนเวลา 11:59 ICT; ไม่มี timestamp ข้อความอนุมัติที่แม่นยำกว่า |

## Release guardrails

- ก่อน Apply: ตรวจ CLI linked project, remote migration head, source diff, local tests/build, deployment environment และแผนย้อนกลับสำหรับฟังก์ชันที่เปลี่ยน
- Apply แบบระบุชื่อไฟล์เดียว ไม่ใช้ `--all`; หากมี migration ค้างก่อนหน้า/ปลายทางไม่ตรง ให้หยุด
- Deploy source เฉพาะ Development project; ตรวจ URL และสถานะหลัง Deploy ก่อน Retest
- Retest เฉพาะ R02; ผลลัพธ์ที่ไม่แน่ชัดให้หยุดและตรวจสถานะก่อนกดซ้ำ
- หลักฐาน PDF ของ `PAY-2026-000030` ที่เก็บบนเซิร์ฟเวอร์ยัง NOT TESTED / ไม่ใช่ UAT PASS ตามข้อยกเว้นก่อนหน้า
- ไม่มีอำนาจ Deploy Production, เปลี่ยน Table/Column/Role/ราคา/ข้อมูลเดิมอื่น หรือทำ Data Migration

## Pre-apply safeguard (2026-09-18)

- Last scheduled Development backup: `20260918_010003.sql.gz` (01:00 UTC / 08:00 ICT); เกิดก่อนธุรกรรม R02 บางรายการ จึง **ไม่ใช้ Full Restore** เพื่อย้อน QC Reopen เพราะจะทำให้ข้อมูลทดสอบล่าสุดหาย
- พยายามสร้าง manual backup ใหม่ก่อน Apply แล้ว แต่ InsForge แจ้ง `Manual backup quota full (5/5)`; **ไม่ได้ลบ backup เดิม**
- จึงบันทึกนิยาม Database Function จริงก่อน Apply ด้วย `pg_get_functiondef` ใน `docs/GISP-QC-REOPEN-PREAPPLY-FUNCTION-ROLLBACK-20260918.sql` สำหรับ rollback แบบเจาะจงฟังก์ชัน โดยไม่แก้ข้อมูลธุรกรรม; ไฟล์นี้ยังไม่ได้ Apply และหากต้อง rollback ให้ตรวจผลกระทบ/ขออนุมัติการดำเนินการแยก
- Development deployment ก่อนหน้าที่ READY คือ `0b2d63e8-e683-42de-8946-193e32beec59` ณ 2026-09-16 06:02 UTC; เก็บ ID ไว้ตรวจย้อนหลัง

## Execution status — 2026-09-18

- `20260918050000_qc-reopen-before-dispatch.sql` Applied สำเร็จเฉพาะ `gisp-mvp-development` เวลา 05:02:13 UTC; ไม่ Apply migration อื่น
- Development deployment `79da8b9f-15bd-40d9-94f8-95eacff50b84` สถานะ `READY` เวลา 05:04:09 UTC; custom domain `gisp-mvp-development.insforge.site` ตอบ `/api/health` ว่า `status: ok` (`environment: production` ใน health เป็นค่า runtime ของ Next.js ภายใน Development project ไม่ใช่การ Deploy GISP Production)
- ก่อน Retest: `ORD-2026-000011` มี QC `PASSED`, `SHP-2026-000005` เป็น `GATE_CHECKED`, `dispatched_at=NULL`; Reopen Audit 0
- Retest ผ่านบัญชีทดสอบ Purchasing/QC `bobady`: เปิด QC ใหม่ด้วยเหตุผล Development Test; App แสดง `IN_PROGRESS` และ Gate ปิดทันที พร้อม Audit 1 รายการ; บันทึก Checklist จำลองหนึ่งข้อ `FAILED` และอีกสองข้อ `PASSED` ได้ผลรวม `FAILED`
- หลังบันทึก: DB แสดง `order_items.qc_status=FAILED`, inspection ทั้งหมด 2 (ผลเดิม `PASSED` ยังอยู่, ผลล่าสุด `FAILED`), Reopen Audit 1, Shipment ยัง `GATE_CHECKED` และ `dispatched_at=NULL`; หน้า App แสดงประวัติ PASS → Reopen → FAILED ตามลำดับ
- ขั้นกด Dispatch ที่คาดว่าจะถูกบล็อกยัง **PENDING** จนกว่าจะเปลี่ยนไปบัญชี Logistics ทดสอบ; ไม่สรุป AC-04 ว่าผ่านก่อนผลจริง

### Addendum — AC-04 หลังเจ้าของปรับสิทธิ์บัญชีทดสอบ

- เจ้าของแจ้งว่าเปลี่ยนสิทธิ์ของ `pakapop39@hotmail.com` เองให้ใช้ทดสอบงานภายในทุกบทบาทยกเว้น Member; ตรวจ Development แล้วบัญชีนี้คือ `bobady` และมีบทบาท `LOGISTICS` เพิ่มอยู่จริง ผู้ช่วยไม่ได้แก้ Role/Permission
- ก่อนกด `SHP-2026-000005` ยัง `GATE_CHECKED`, `dispatched_at=NULL`, QC `FAILED`, Shipment Audit 1 และ Status History 0
- กดปุ่ม `ยืนยันออกเดินทาง` **หนึ่งครั้ง** ใน App; App ปฏิเสธด้วยข้อความทั่วไป `ระบบไม่สามารถดำเนินการได้ กรุณาลองอีกครั้ง`; หลังคลิก DB ยืนยัน Shipment/เวลาออกเดินทาง/Audit/Status History **ไม่เปลี่ยน**
- สรุป AC-04 ผ่านด้านการบล็อก Dispatch แต่พบ Finding ว่าข้อความแจ้งเหตุ Gate ไม่ชัด; รายละเอียดอยู่ใน `GISP-UAT-QC-REOPEN-DR024-R02-20260918-v0.1.md` การทดสอบส่วนอื่นของ AC-02/05/06 และ Production ยังคงไม่ผ่าน/ไม่ได้รับอนุญาตตามลำดับ
