# GISP Release C/D Emergency Stop Runbook v0.1

**สถานะ: Local draft / ไม่ใช่ Production Authorization**
อ้างอิง `GISP-PLAN-RELEASE-CD-ROLLBACK-20260919-v0.1`, `GISP-APR-RELEASE-CD-ROLLBACK-IMPLEMENTATION-20260919-v0.1` และ package `release-candidates/pay-rpc-gate-001/emergency`.

## เป้าหมาย

หยุดการเขียนธุรกรรมใหม่อย่างรวดเร็วทั้งหน้า App และ direct RPC โดยรักษาข้อมูลหลัง Cutover ไว้ แล้วเลือก Forward Fix เป็นหลัก. Database/Storage Restore เป็นทางเลือกสุดท้ายและห้ามทำโดยไม่มีอำนาจเฉพาะเหตุการณ์.

## ผู้รับผิดชอบและอำนาจ

- Release Executor: Primary Codex thread หลังมี Production Release/Incident Authorization เท่านั้น
- Owner / Incident decision: ภคภพ ช.เจริญยิ่ง
- Finance reconciliation: ผู้มี `payments.verify` ที่เจ้าของมอบหมาย
- Operations reconciliation: Order/QC/Logistics owners
- QA: ตรวจ ACL, fail-closed calls, counts, audit และ smoke อย่างอิสระ

## ก่อนเปิด Release C

1. ตรึง commit, SQL/app hashes, Project ID, migration head, deployment ID, Stage/flags และ Function definition/ACL snapshot.
2. สร้าง Named pre-cutover Backup และตรวจ `completed`; ทดสอบวิธีกู้ในพื้นที่แยก.
3. ทดสอบไฟล์ stop/resume ทีละไฟล์ใน Production-derived isolated rehearsal. ห้าม `up --all`.
4. บันทึก cutover timestamp และผล `reconcile.sql` ก่อนเปิด.
5. ยืนยัน Member จริงแยกจาก staff identity; บัญชี `pakapop39@yahoo.com` ยังเป็น staff และไม่มี Member Profile/Application/Organization จึงยังใช้เป็น Member จริงไม่ได้.

## เมื่อพบเหตุการณ์

1. บันทึกเวลา อาการ Stage/D slices ที่เปิด และผู้ประกาศ Incident.
2. หยุด Database writes/direct RPC จาก Slice ใหม่สุดลงมา: D10 → D9 → D8 → D7 → C ตามขอบเขตเหตุการณ์. D8 stop ต้องตรวจ Freight flag เป็น FALSE; D7 stop ปิดเฉพาะ 5 writes และคง read helpers `get_dispatch_gate`/`can_dispatch_order_item`.
3. ตรวจว่า exact RPC ที่หยุดตอบ fail-closed และ counts/Audit ไม่มี write delta ใหม่หลังเวลาหยุด. หากยังมี delta ให้คง Incident เปิดและปิด entry point ที่ระบุได้ก่อนทำขั้นถัดไป.
4. หลัง Database stop ผ่านแล้วจึงย้อน App Stage/flags หรือ Frontend deployment ด้วย action ที่อนุมัติเฉพาะครั้ง เพื่อให้หน้า App ตรงกับ Gate ที่ปิด.
5. สร้าง incident-state Backup **หลังหยุด writes** เพื่อเก็บธุรกรรมที่เกิดจริง; ห้ามลบ Backup เก่าเอง.
6. รัน `reconcile.sql` แบบอ่านอย่างเดียว พร้อม cutover timestamp; เก็บผล Order/Payment/Shipment/File/Audit และ Finance totals.
7. แยก post-cutover rows/files/audits และให้ Finance/Operations ลงความเห็น ไม่แก้หรือลบหลักฐานระหว่างตรวจ.
8. เลือก Forward Fix หรือ Restore. ถ้ามี post-cutover writes ห้าม Restore จนมีแผน export/replay/รักษาไฟล์และคำอนุมัติเฉพาะ.

## Smoke หลัง Stop

- App อยู่ Stage ที่ปิด Gate และ UI ไม่เสนอ action ที่หยุด.
- `authenticated` เรียก exact stopped RPC ไม่ได้.
- private preview/verify จาก server ได้ `EMERGENCY_WRITE_DISABLED` หลัง stop C.
- legacy Payment paths ยังเรียกไม่ได้.
- Functions ของ Slice ก่อนหน้าที่ยังอนุญาตต้องทำงานตาม smoke ที่ไม่สร้างเงินจริง.
- Audit/Notification ไม่มี unexpected success หลังเวลาหยุด.

## เปิดกลับ

1. QA ยืนยัน reconciliation และ root cause/forward fix.
2. Owner อนุมัติ Resume ระบุ Environment, Gate, hash และเวลา.
3. เปิด C → smoke; D7 → smoke; D8 → smoke; D9 → smoke; D10 → smoke. ห้ามข้ามลำดับ.
4. หลังแต่ละ Gate ตรวจ Member isolation, Payment evidence, Finance actor/audit, Dispatch, Shipment/Delivery, Claim/Report ตาม Slice.
5. ติดตาม Order จริงรายการแรกและมีเกณฑ์หยุดซ้ำชัดเจน.

## เกณฑ์ห้ามเปิดกลับ

ACL/function hash ไม่ตรง, Backup ไม่ complete, post-cutover reconciliation ยังไม่ลงตัว, Legacy path เปิด, private executor ไม่จำกัด `project_admin`, Freight เปิดผิด Slice, Advisor/QA มี Blocker หรือ Owner ยังไม่ได้อนุมัติ Production เฉพาะ Gate.
