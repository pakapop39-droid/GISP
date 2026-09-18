# PAY-SEQ-02 — สถานะพื้นที่ซ้อม ณ 2026-09-18

## ขอบเขตและคำอนุมัติ

อ้างอิง `GISP-APR-PAY-SEQ-02-REHEARSAL-20260918-v1.0.md` และ `GISP-APR-PAY-SEQ-02-BRANCH-RECLAIM-20260918-v1.0.md` โดยผู้อนุมัติ ภคภพ ช.เจริญยิ่ง. งานนี้อนุญาตเฉพาะพื้นที่ซ้อมจาก Production B และข้อมูลจำลอง `REH-PAY-RPC-001`; ไม่อนุญาต Apply หรือ Deploy Production, ใช้เงินจริง หรือเปิด Release C/D.

## คืนช่อง Branch และเก็บสำเนา

- Branch เก่า `release-b-rehearsal-20260908` ID `f0f9a36b-ec7d-4ceb-ae28-b2d5feef85f9` ถูกลบตามคำอนุมัติ หลังเก็บสำเนาฐาน, Storage 1 object, Function source และ manifest ในโฟลเดอร์จำกัดสิทธิ์ `C:\Users\ASUS\AppData\Local\GISP-PAY-SEQ-02-Archive-20260918`.
- Database backup gzip SHA-256 `c6ea7aea9faf775b76a31f65cb900fb923f9471510351e3ac48ec875e6156ddb`; Storage object SHA-256 `431ced6916a2a21a156e38701afe55bbd7f88969fbbfc56d7fe099d47f265460`; Function source SHA-256 `0fb6731dc7be7a81849ed36df002a2ed378fc06c3421cd715cae9b72e0425a04`. ตรวจ Hash ซ้ำและเปรียบเทียบจำนวนข้อมูลก่อนลบแล้ว.
- สำเนานี้ไม่ใช่ระบบกู้คืนอัตโนมัติ; การลบ Branch เก่าย้อนคืนไม่ได้.

## พื้นที่ซ้อมใหม่และ Migration

- สร้าง schema-only Branch `pay-seq-02-rehearsal-20260918` ID `e902393a-ffe7-433d-96d8-a37256948959` จาก Production B ID `865860c2-49fa-4e53-908f-9396b2f75233`. Branch อื่น `production-completion-20260906` ยังคง active/ready.
- ก่อน Apply มี 26 Migration ล่าสุด `20260908170000_release-b-member-pilot`; Backup ใหม่ `PAY-SEQ-02-pre-migration` ID `ac4aec5a-8789-4332-b974-cd7a1c78a171` สถานะ completed.
- สถาปนิกตรวจ Branch, lineage, function signatures/ACL และ Hash 12/12 แล้วให้ GO เฉพาะการ Apply ใน Branch ซ้อม.
- Apply SQL ตาม `release-candidates/pay-rpc-gate-001/README.md` ทีละไฟล์ครบ 12/12 (`20260920010000` ถึง `20260920011100`); ตอนจบมี Migration 38 รายการ, Package hash 23/23 ตรง. ไม่มีการ Apply ไป Production.
- Checkpoint ขณะ Apply: หลัง C safety legacy Payment verify ปิด; หลัง C เปิด Order/Payment แต่ QC/Shipment/Freight ยังปิด; หลัง D7 QC เปิดแต่ Shipment ยังปิด; หลัง D8 Shipment เปิดแต่ Freight payment flag ยัง false จนถึง migration `20260920010900`; หลัง D9/D10 Claim/Report เปิด. QA ตรวจอิสระสถานะสุดท้ายและให้ PASS WITH CONDITIONS เฉพาะ Migration/ACL.

## Fixture และผลทดสอบหลังอนุมัติเพิ่ม

- อ้างอิง `GISP-APR-PAY-SEQ-02-FIXTURE-20260918-v1.0.md`; เจ้าของอนุญาต Gmail `+aliases` 3 บัญชีและอีเมลแจ้งเตือนอัตโนมัติไปยัง aliases เดิมเฉพาะ Branch ซ้อม.
- ตัวรันทดสอบชั่วคราว `C:\Users\ASUS\AppData\Local\Temp\gisp-release-cd-readonly-20260918\reh-pay-rpc-001.mjs` ตรวจ Project ID/name/parent/host ก่อนรัน; ไม่ได้แก้ App source. การเริ่มครั้งแรกหยุดหลังสร้าง Member A auth user เพราะ SDK ไม่คืน ID ในรูปที่คาด; ตรวจว่ามีเพียง alias ที่อนุมัติ 1 บัญชี, ไม่มีข้อมูลธุรกิจค้าง แล้วใช้โหมด resume เข้าสู่ระบบบัญชีนี้ ไม่สมัครซ้ำ.
- Phase 1 (`--phase=1-resume`) exit 0: 3 auth aliases ที่ยืนยันแล้ว, 2 องค์กรจำลอง, 3 public users ACTIVE, MEMBER A/B ผูกแต่ละองค์กร, FINANCE A ผูกสิทธิ์ `payments.verify` เฉพาะองค์กร A และ primary organization เป็น NULL, 2 Member profiles/applications APPROVED. QA ตรวจข้อมูลและสิทธิ์นี้อย่างอิสระแล้วผ่าน.
- Phase 2 (`--phase=2`) exit 0: สร้าง 2 Order, 4 Schedules, 5 Transfers และ PDF จำลองใน private Storage แยก 5 ไฟล์. Terminal assertions ผ่าน: ไฟล์ที่ถูกปฏิเสธใช้ซ้ำไม่ได้; legacy/direct private RPC ปฏิเสธ authenticated caller; SHA ผิดและ replay อนุมัติไม่ได้; Member A ส่งยอดขององค์กร B ไม่ได้; Finance A preview/verify องค์กร B ไม่ได้; Deposit/Balance ของ A อย่างละ 53.50 และ Freight 21.40 กระทบยอดตรง; Invoice Freight เป็น PAID; Deposit ของ B ยังค้าง; Audit/Verification Log ระบุ Finance A. ไม่มี Notification Job.
- QA ตรวจอิสระ DB และดาวน์โหลด private Storage ทั้ง 5 ไฟล์: จำนวน/ขนาด/MD5 ETag และ PDF signature ตรง, SHA-256 ทั้ง 5 แตกต่างกัน, digest ใน 3 preview audit ตรงกับไบต์จริง; 4 Finance logs ระบุ actor ที่ถูกต้อง. Negative RPC assertions อ้างอิง terminal log และ source harness ซึ่งต้องเก็บเป็นหลักฐานประกอบ ไม่อนุมานจากสถานะสุดท้ายอย่างเดียว.
- App ในเครื่องเริ่มที่ `http://127.0.0.1:3100` แบบ loopback เท่านั้น โดยตั้ง `RELEASE_STAGE=C` และตัวแปร backend ทั้งหมดชี้ Branch ซ้อม; ยังไม่ Deploy. Package hash test `src/lib/payments/pay-rpc-gate-package.test.ts` ผ่าน 3/3.
- Phase 3a ใช้ตัวรันชั่วคราว `reh-pay-rpc-001-http.mjs --phase=3a` ผ่าน exit 0: Finance A ล็อกอิน App ได้ตรง ID ของ Branch ซ้อม, เปิด PDF ที่ผูกกับ Deposit A ผ่าน App แล้ว SHA-256 ตรงกับไบต์ใน private Storage; POST อนุมัติซ้ำได้ HTTP 409; GET/POST รายการองค์กร B ได้ HTTP 404; ผู้รับ Notification ยังอยู่ใน 3 aliases ที่อนุมัติ.
- Phase 3b ใช้ตัวรันเดียวกัน `--phase=3b` ผ่าน exit 0: สร้าง Order/Deposit/PDF จำลองใหม่ในองค์กร A หนึ่งชุด, POST ก่อนเปิดหลักฐานถูกปฏิเสธและรายการยัง `SUBMITTED`; GET ผ่าน App คืนไฟล์ที่ Hash ตรง; POST หลังยืนยันหลักฐานผ่าน HTTP 200 แล้วรายการและยอด Deposit เป็น `VERIFIED` โดย Finance A; Audit preview ผูก Payment, ผู้ตรวจ และ Hash; มี Notification Job ใหม่เพียงหนึ่งรายการถึง Finance A alias. ไม่ใช่การรับเงินจริง.
- Focused automated tests สำหรับ Evidence GET, Verify POST และ bound-evidence ผ่าน 21/21 (`npm test -- ...`). ผลนี้ใช้โค้ด Local ปัจจุบันและ Branch ซ้อม ไม่ใช่ Hosted Production UAT.
- QA ตรวจ Phase 3 อย่างอิสระบน Branch ซ้อม: Order เพิ่มหนึ่ง, Deposit/Transfer เพิ่มหนึ่ง, PDF private เพิ่มหนึ่ง, Notification Job เพิ่มหนึ่งถึง Finance A alias เท่านั้น. `PAY-2026-000006` เป็น `VERIFIED` ยอด 53.50/53.50; ผู้ตรวจถือ Role องค์กร A; Audit เรียง `SUBMITTED → EVIDENCE_PREVIEWED → VERIFIED`. PDF จริง 945 bytes, SHA-256 `9e9627b7757475b7e7eea4b698be2b960f7de55207ca4bfe000373a0dee33166` ตรง Audit; องค์กร B ยัง `PENDING` 0.00. QA รัน Vitest ตรงอีก 6 files/32 tests ผ่าน; ไม่แก้ Source.

## สิ่งที่ยังไม่ผ่าน

- QA ให้ **PASS WITH CONDITIONS เฉพาะ PAY-SEQ-02 บน Branch ซ้อม/Local App**; ไม่เท่ากับตรวจสลิปกับธนาคารหรือรับเงินจริง. ยังไม่ได้ทดสอบ Preview หมดอายุเกิน 10 นาที, ไฟล์ที่เก็บหาย/เสีย และยอด Partial/Overpayment ผ่าน HTTP บน Branch นี้; automated tests/SQL structural check ครอบคลุมบางกรณีเท่านั้น. กรณี POST ก่อน Preview พิสูจน์ว่าระบบปฏิเสธและไม่เปลี่ยน Payment แต่จาก Local App log ได้ HTTP **500** (ไม่ใช่ 409); เป็นข้อบกพร่องการสื่อสาร Error ที่ต้องบันทึกและพิจารณาแก้ก่อนเผยแพร่.
- จัดระดับก่อนใช้เงินจริง: ช่องว่าง Hosted/Release Candidate, Preview หมดอายุ, ไฟล์หาย/เสีย และ Partial/Overpayment เป็น **Major ที่ต้องทดสอบก่อน Production**; ข้อความ/รหัส Error ก่อน Preview เป็น Minor. Notification Job ยัง `PENDING` จึงพิสูจน์เพียงเข้าคิว ไม่ใช่ส่งอีเมลถึงแล้ว. เจ้าของยังไม่ได้รับความเสี่ยงเหล่านี้สำหรับ Production.
- ยังไม่ได้ทดสอบการปิด Order หลังส่งมอบหรือ Freight ก่อน D8 บน Branch ที่อยู่ D10 แล้ว; ไม่ตีความเป็น PASS.
- Auth config มี SMTP จริง; ใช้เฉพาะ aliases ที่อนุมัติ. Schedule แจ้งเตือนที่ติดมากับ Branch ยังชี้ URL เดิมของ Production และมีเวลารันค้างก่อนสร้าง Branch; ไม่เรียกหรือแก้ Schedule นี้. การทดสอบ DB ตรงไม่ได้สร้าง Notification Job.
- QA ยังไม่ได้ยืนยัน DB head/count ของ Production parent และ Branch อีกแห่งโดยอิสระ; ยืนยันเพียงสถานะ active/ready และไม่มีคำสั่ง Apply/Deploy ที่สั่งไปยังสองเป้าหมายนั้น.
- PAY-SEQ-02 ปิดแบบมีเงื่อนไขเฉพาะพื้นที่ซ้อม; Production Release C/D ยัง **NOT AUTHORIZED**. ห้ามนำผลซ้อมไปนับเป็น Production Release Approval. เงื่อนไขที่ยังขาดต้องรวมใน Release Candidate risk review ก่อนคำตัดสิน Production.

## ขั้นตอนที่เหลือเพื่อปิด PAY-SEQ-02

**0 ขั้นตอนสำหรับงานทดสอบ PAY-SEQ-02 — QA สรุป PASS WITH CONDITIONS เฉพาะพื้นที่ซ้อมแล้ว.** การรับเงื่อนไขโดยเจ้าของและงานที่ยังค้างเป็นของ Slice เตรียม Production Release C/D: ทดสอบช่องว่าง Major บน Release Candidate, ตรวจ Backup/Rollback และข้อมูล Member จริง, สรุปความเสี่ยงให้เจ้าของตัดสินใจ, จากนั้นขอคำอนุมัติ Production C และ D แยกกัน.
