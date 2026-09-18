# GISP Development UAT — Custom R03 Execution v0.1

วันที่: 2026-09-18 (Asia/Bangkok)  
สถานะ: **การทดสอบ R03 ผ่านใน Development แบบจำลอง; ยังไม่ปิด QC Reopen UAT Slice หรืออนุมัติ Production**

## ขอบเขต

- Development เท่านั้น ตาม `GISP-APR-QC-REOPEN-D02-R03-DEVELOPMENT-UAT-20260918-v1.0.md` และ `GISP-APR-QC-REOPEN-R03-SIMULATED-DATA-20260918-v1.0.md`
- ข้อมูลทุกขั้นเป็น `DEVELOPMENT TEST ONLY`; ไม่มีเงินจริง สินค้าจริง การยืนยันจาก Supplier ภายนอก หรือ Production
- ไม่แก้ App, Code, Schema, Role, Permission, Master Data หรือ R01/R02

## หลักฐานจากหน้าจอ Development

| ขั้น | ผลที่เห็นใน App |
|---|---|
| Project / Custom Request | `PRJ-2026-2899ED3B` (`DRYRUN-R03-PRJ-001`), `CRQ-2026-000009`, 1 EA |
| Quotation / Order | `QT-2026-000007` ถูก Member รับ; `ORD-2026-000012`, Custom item 1 EA, ฿2,000 ก่อน VAT + ฿140 VAT = ฿2,140 |
| Customer Deposit | `PAY-2026-000031` ฿1,070; เจ้าของเปิดไฟล์ที่ App ให้และยืนยันว่าข้อมูลตรง; Finance กดตรวจครบใน Development; Codex ไม่ได้ตรวจเนื้อหาไฟล์บนเซิร์ฟเวอร์ด้วยตนเอง |
| Supplier PO / Deposit | `PO-2026-000006`, `SO-2026-000012`, ต้นทุน CN¥200; `PAY-2026-000032` CN¥100 เป็น `PAID` หลังแนบหลักฐานจำลอง |
| Production / QC | บันทึกผลิตเสร็จ 100% แบบจำลอง; QC checklist 3 ข้อเลือกผ่าน ระบบสรุป `ผ่าน QC` อัตโนมัติและแจ้งว่า “ผลถูกส่งให้ Member ตรวจรายงานและอนุมัติก่อนจัดส่งแล้ว” เวลา 19:23:59 |
| Supplier Balance | `PAY-2026-000033` CN¥100 จาก `REQUESTED` → `APPROVED` → `PAID` หลังแนบหลักฐานจำลอง; Gate แสดง Supplier balance ผ่าน |
| Warehouse / Consolidation | `WRC-2026-000009` รับ 1 EA, 1 หีบห่อ, น้ำหนัก 1 กก., 0.1 CBM; ปล่อย 1; `CNS-2026-000007` ยืนยันแล้ว |
| Negative Gate | กดสร้าง `DRYRUN-R03-SHP-001` วิธี LCL ขณะ Gate ไม่ครบ ระบบแสดง “ยังสร้าง Shipment ไม่ได้ เพราะ Dispatch Gate ยังไม่ผ่านครบทุกเงื่อนไข”; **ไม่มีหมายเลข Shipment ใหม่จากการกดนี้** |
| Member decision | บัญชี Member เจ้าของ Order กด “อนุมัติให้จัดส่ง” หลัง QC ผ่าน; หน้า Member แสดง QC และ Member ผ่าน แต่ Finance Balance ยังไม่ผ่าน. SQL แบบอ่านอย่างเดียวพบ `qc_member_decisions.id=17c10018-7297-4042-8954-5f803af7b32a`, `decision=APPROVED`, `decided_at=2026-09-18T12:30:45.661Z`; `decided_by` ตรงกับ `member_profiles.user_id` ของเจ้าของ Order (`owner_decided=true`). ไม่มีการอนุมัติอัตโนมัติ |
| Customer Balance | Member ส่ง PDF จำลอง `GISP_R03_CUSTOMER_BALANCE_SIMULATED.pdf` ยอด ฿1,070 เวลาโอนทดสอบ 19:30; App ออก `PAY-2026-000034` สถานะรอตรวจ. Finance กดยืนยันใน Development; App แสดงตรวจครบ ฿1,070/฿1,070. **ตรวจเนื้อหา PDF ต้นฉบับใน Workspace แล้ว แต่ไม่ได้เปิดไฟล์ที่เก็บบนเซิร์ฟเวอร์ จึงไม่นับเป็น UAT PASS ด้าน Payment Evidence Integrity** |
| Positive Gate / Shipment | เมื่อครบ 4 ข้อ หน้า Admin และ Member แสดง ✓ ทั้ง QC, Member approval, Customer Balance verified และ Supplier Balance paid พร้อมข้อความ “พร้อมจัดส่ง”; การกดสร้างเดิมจึงสร้าง `SHP-2026-000006` / `DRYRUN-R03-SHP-001` วิธี LCL จำนวน 1 ได้; ต่อมากด “ยืนยันออกเดินทาง” และ App แสดง “ออกเดินทางแล้ว” ฝั่ง Admin และ Member |

## หลักฐานฐานข้อมูล/Audit แบบอ่านอย่างเดียว

- `order_items.id=d916fdca-b5e8-456d-8760-9a867e9cdc4f` เป็น `item_type=CUSTOM`, `qc_status=MEMBER_APPROVED`; Inspection `f0f93ae5-4109-4960-841e-cde9eae63fff` เป็น `PASSED` เวลา `2026-09-18T12:23:59.732Z`
- Notification ถึง Member เจ้าของ Order `type=QC_MEMBER_APPROVAL_REQUIRED`, `entity_id=94082233-e02a-462d-bc93-93fe75bb92f1`, เวลา `2026-09-18T12:23:59.732Z`
- `shipments.id=6e118745-6f73-48e9-be38-92fe79713962` เป็น `SHP-2026-000006`, `status=DISPATCHED`, `dispatched_at=2026-09-18T12:33:35.333Z`, มี `shipment_items` จำนวน 1 ของ Custom item ข้างต้น
- Audit ที่ผูก entity ตรง: `qc_inspection/PASSED`, `qc_member_decision/APPROVED`, `shipment/GATE_CHECKED` เวลา `12:33:19.213Z`, `shipment/DISPATCHED` เวลา `12:33:35.333Z`; แถว Audit ใน UI แสดงชนิด/เวลาแต่ไม่แสดงเลข Order จึงยืนยัน entity ด้วย SQL `SELECT` เพิ่มเติม
- `SHP-2026-000005` ของ R02 ยังเป็น `DISPATCHED` ด้วย `dispatched_at` เดิม `2026-09-18T05:57:03.154Z`; การตรวจนี้ไม่พิสูจน์ว่าทุกฟิลด์ของ R02 ไม่เปลี่ยน แต่ไม่ได้สั่งแก้ R02

## ผล AC-06 และข้อจำกัด

- **PASS เฉพาะ Workflow Custom ใน Development Test:** QC ผ่านแล้วรอ Member, Member เจ้าของ Order อนุมัติเอง, Gate ยังบล็อกก่อน Finance ตรวจ Balance, หลังครบ 4 ข้อจึงสร้าง Shipment และ Dispatch ได้. Audit/Notification ที่เกี่ยวข้องมีหลักฐานผูก entity
- **ไม่ใช่ PASS ด้านเงินจริง/สินค้าจริงหรือ Payment Evidence Integrity:** PDF เป็นข้อมูลจำลอง, ไม่มีการโอนเงินจริง/ตรวจสินค้าจริง และ Codex ไม่ได้เปิดเนื้อหาไฟล์ที่เก็บบนเซิร์ฟเวอร์. ข้อความอัตโนมัติใน App ว่า “ยอดตรงตามหลักฐาน” หมายถึงผลกดรับใน Development ไม่ใช่คำรับรองการโอนเงิน
- ไม่ทดสอบทางเลือก Reopen ของ Custom หลัง Member อนุมัติ เพราะข้อ 3 ของ AC-06 เป็น optional และการทำจะเปลี่ยนสถานะ R03 ที่เพิ่ง Dispatch แล้ว; R02 มีผล Reopen/Dispatch แยกไว้แล้ว
- UX findings จาก R02 ยังเปิด: ข้อความเมื่อ Dispatch Gate ไม่ผ่านไม่ระบุเหตุเฉพาะ; ปุ่ม Reopen ยังแสดงหลัง Dispatch แม้ backend ปฏิเสธ. R03 ยืนยันข้อความบล็อก Shipment แบบกว้าง แต่ยังไม่มีการแก้ UX

## สถานะก่อนมติเจ้าของ: เหลือ 1 ขั้นตอนเพื่อปิด QC Reopen UAT Slice

เจ้าของทบทวนผล AC-01–06 รวม, เลือกว่า 2 UX findings จะให้แก้/Retest หรือรับเป็น Known Issue พร้อมผู้รับผิดชอบและกำหนดเวลา, และออก Owner UAT acceptance เป็นลายลักษณ์อักษร. AC-05 กรณี scoped role ต่างองค์กรเป็น `N/A` ตาม D01-A ไม่ใช่ PASS; Payment Evidence Integrity ที่ยังไม่ตรวจไฟล์บนเซิร์ฟเวอร์ต้องคงเป็นข้อจำกัดหรือทดสอบแยกก่อน Release.

เอกสารนี้ไม่ใช่ Production Release Authorization และไม่เปลี่ยน SOP, App, Code, Schema, Role, Permission หรือ Production.

## Closure addendum — 2026-09-18

ภายหลังเจ้าของระบุว่า หากข้อค้างเป็นเรื่องเล็กน้อยและไม่ทำให้การสั่งของมีปัญหา ให้ผ่านได้ ผลประเมินใน `GISP-APR-QC-REOPEN-OWNER-UAT-ACCEPTANCE-20260918-v1.0.md` รับสอง UX findings เป็น Minor สำหรับ Development UAT และปิด **QC Reopen UAT Slice แบบ PASS WITH CONDITIONS**. ข้อจำกัด Payment Evidence Integrity ยังคง `NOT VERIFIED` และไม่ใช่ Production Release Authorization. **เหลือ 0 ขั้นตอนเพื่อปิด Slice นี้**; หัวข้อก่อน Production เป็นงานแยก.
