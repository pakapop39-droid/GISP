# GISP Release C/D — แผนย้อนกลับฉบับตรวจช่องว่าง v0.1

**สถานะ: Local implementation และ Static QA ผ่าน / ยังไม่ผ่าน Hosted Rehearsal; ห้ามนำไปสั่ง Production.** อ้างอิง `docs/active/PRODUCTION OPERATIONS RUNBOOK.md`, `docs/active/STAGED PRODUCTION RELEASE PLAN.md`, SQL 12 ไฟล์และ Emergency package ใน `release-candidates/pay-rpc-gate-001`. เอกสารนี้ไม่ได้อนุญาต Apply SQL, Restore, เปลี่ยน Config หรือ Deploy.

## สิ่งที่ตรวจยืนยัน ณ 19 ก.ย. 2569

- Production project ID `865860c2-49fa-4e53-908f-9396b2f75233` ยังมี Migration 26 รายการ ล่าสุด `20260908170000_release-b-member-pilot`; ไม่มี Order/Payment จริง. Deployment ล่าสุดที่ CLI รายงาน `READY` คือ `a3cf70ea-4394-45bd-8874-166800adc93d` วันที่ 11 ก.ย. หลักฐานชุด source อยู่ใน `docs/evidence/2026-09-11-staff-management-deployment.md` และ `output/staff-management-deploy-20260911`, แต่ความเข้ากันได้กับ Schema หลัง C ยังไม่ได้ทดสอบ.
- Backup ที่ CLI แสดง `completed` ล่าสุดในรายการเป็น scheduled เวลา `2026-09-18T01:00:04Z`. Manual Backup 5 รายการเต็มช่องที่เคยบันทึกไว้; Named pre-C ยังไม่มี. การซ้อม Restore ฐาน/Storage ครั้งล่าสุดใน Runbook เป็นวันที่ 6 ก.ย. ไม่ใช่ชุด C/D นี้.
- C Migration เปิด RPC ธุรกรรม 9 signatures ใน `20260920010300_release-c-privileges.sql` หลังแก้ Function Payment/ปิดช่อง legacy. D7/D8/D9/D10 เปิดสิทธิ์เพิ่มทีละ Slice. การย้อนหน้าเว็บเป็น Stage B อย่างเดียว **ไม่ปิด** direct RPC ที่ได้รับ GRANT แล้ว.

## แนวทางที่ต้องเตรียมก่อนขออนุมัติ C

1. ตรึง Hash ของ source/SQL/env และบันทึกค่าปัจจุบันของ Stage, Slice flags, Deployment ID, Migration head, Function definition/ACL สำหรับทุก signature ที่แพ็กเกจจะแก้; เก็บข้อมูลอ้างอิงในพื้นที่จำกัดสิทธิ์โดยไม่พิมพ์ Secret ลงรายงาน.
2. สร้าง Named Production Backup ใหม่เมื่อถึงเวลา Cutover ตามคำอนุมัติที่ระบุ Project/ชื่อ/เวลา แล้วตรวจ `completed`; ถ้า Manual slot เต็ม ต้องเสนอ Backup ID ที่จะเก็บถาวรหรือถอดออกพร้อมผลกระทบให้เจ้าของตัดสินใจก่อน ห้ามลบเอง.
3. ใช้ **Emergency Stop-Write SQL Draft** ที่ระบุ signature แน่นอนใน `release-candidates/pay-rpc-gate-001/emergency`: ปิด C transactional RPC และ D RPC เฉพาะ Slice โดยไม่เปิดกลับ legacy Payment path. Local contract/static test ผ่านแล้ว แต่ต้องได้รับอำนาจ Apply-to-rehearsal แยกและทดสอบจริงทั้งก่อน/หลัง Gate ว่า App และ direct RPC ถูกบล็อก.
4. ใช้ Forward Resume Draft คืน Function/ACL ตาม snapshot และทดสอบความเข้ากันของหน้าเว็บเก่ากับ Schema ใหม่บนพื้นที่แยก. D ต้องย้อนเฉพาะ Slice ล่าสุดก่อน ไม่ล้ม C หากธุรกรรม C ยังปกติ. การ Restore ฐาน/Storage เป็นทางเลือกสุดท้าย ไม่ใช่วิธีย้อนเริ่มต้น.
5. กำหนดผู้หยุดรับรายการ ผู้ตรวจธุรกรรมและหลักฐานที่เกิดหลัง Cutover ผู้ตัดสินใจแก้ไปข้างหน้าหรือ Restore, ช่องทางแจ้งผู้ใช้ และเงื่อนไขเปิดกลับ. บันทึกจำนวน Order/Payment/Shipment/File/Audit ก่อน–หลังทุกขั้น.

## เหตุการณ์จริงหลังเปิด C/D

เมื่อพบปัญหากระทบเงินหรือข้อมูล ให้หยุดรับรายการใหม่ทั้ง App และ RPC ที่เกี่ยวข้องก่อน เก็บ snapshot/Backup ใหม่ของสถานะปัจจุบันและรายการธุรกรรมหลัง Cutover แล้วกระทบยอดกับ Finance/เจ้าของ. ห้าม Restore Backup เก่าทับ Order, เงินรับหรือไฟล์ใหม่โดยไม่มีแผนรักษาข้อมูลและคำอนุมัติเฉพาะครั้ง. หากเป็น UI อย่างเดียว ใช้ source เดิมที่ตรวจความเข้ากันกับ Schema แล้ว; หากเป็นสิทธิ์/Function ให้ใช้ Stop-Write/Forward Fix ที่ซ้อมและอนุมัติไว้. หลังแก้ ตรวจ Login, Member isolation, Payment evidence, Audit, Order, Shipment และ Notification อีกครั้ง.

## Verdict

**Rollback readiness = PARTIAL / ยังเป็น Blocker ก่อน Production C/D.** Local Stop/Resume/Reconcile Draft, hash inventory, staged-order contract และ QA ผ่านแล้ว แต่ยังขาด Named Backup สด, ช่องว่าง Manual Backup 5/5, การ Apply/ทดสอบจริงบน Production-derived isolated rehearsal, exact candidate ACL/Security check และ restore rehearsal. ต้องขออำนาจ Apply-to-rehearsal แยกก่อนขั้นนั้น; Production Rollback ใด ๆ ต้องมีคำอนุมัติ Production เฉพาะเหตุการณ์.
