# GISP Release C/D Candidate Manifest v0.3

**สถานะ: Local frozen candidate / ไม่ใช่ Production Release Authorization**

## ขอบเขตที่ตรึง

- Emergency Stop/Resume/Reconcile และ security triage: commit `9901c04` (`feat: add release c d emergency rollback drafts`).
- Payment Verify presentation fix: `EVIDENCE_PREVIEW_REQUIRED` ตอบ HTTP 409 โดยไม่เปลี่ยนกฎการเงินหรือ SQL.
  - `src/app/api/admin/payment-transfers/[id]/verify/route.ts`: SHA-256 `ecea79e228e32b98e5a01f62ab9036b4cb93c774da1542afd94b2982f3d7045a`
  - `src/app/api/admin/payment-transfers/[id]/verify/route.test.ts`: SHA-256 `595044765b35ae6dfbb2d294cdf5bc384773da66f40ffb831eaee883c19d2f36`
- SQL ต้นทาง 12 ไฟล์ใช้ canonical UTF-8/LF SHA-256 ตาม `release-candidates/pay-rpc-gate-001/README.md` และ Emergency README; QA ตรวจตรง 12/12.
- ไม่รวม `pnpm-lock.yaml`, `tools_tmp/`, Python cache และงานอื่นนอกขอบเขต.

## หลักฐาน QA ของ Candidate เดียวกัน

- `npm test`: PASS — 96 test files / 504 tests.
- `npm run typecheck`: PASS.
- `npm run build`: PASS — Next.js production build, 128 pages.
- `git diff --check`: PASS ก่อนตรึง.
- Emergency package: inventory/order/idempotency/fail-closed/reconcile static contracts PASS; ไม่มี SQL ถูก Apply ระหว่างการทดสอบนี้.

## ข้อจำกัดและ Stop Conditions

- ยังไม่ได้ Apply Emergency SQL หรือทดสอบ Stop/Resume/Restore บน backend; ต้องมี Apply-to-rehearsal Authorization แยก.
- Production Advisor snapshot เก่าและแสดงรายละเอียดเพียง 50/543 รายการ; exact-candidate ACL/Security ยังไม่ผ่าน.
- `pakapop39@yahoo.com` เป็นบัญชีพนักงานที่มี 5 roles และไม่มี Member Profile/Application/Organization จึงยังไม่ใช่ Member จริงสำหรับ Pilot.
- Production Backup manual slots เต็ม 5/5 และยังไม่มี fresh named pre-C backup.
- ห้าม Apply, Deploy, เปลี่ยนสิทธิ์/ข้อมูล Production หรือเปิด C/D จาก Manifest นี้.

หลังบันทึกการรวม Payment fix แล้ว ให้ใช้ commit ที่รายงานใน Completion Record เป็น source commit คู่กับ Manifest นี้; หากไฟล์ข้างต้นเปลี่ยนแม้แต่ไฟล์เดียว Candidate ต้องสร้าง hash และ QA ใหม่เฉพาะส่วนที่ได้รับผลกระทบ.
