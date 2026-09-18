# GISP Development UAT — QC Reopen / DR-024, R02 v0.1

วันที่ตรวจ: 2026-09-18 (Asia/Bangkok)  
สถานะ: **PARTIAL / ยังไม่ปิด Slice** — รายงานผลจริง ไม่ใช่การรับรอง AC-01–06 ทั้งชุด

## ขอบเขตและหลักฐาน

- อำนาจทดสอบ: `GISP-APR-QC-REOPEN-DR024-R02-DEVELOPMENT-RELEASE-20260918-v1.0.md` ตามแผน `GISP-PLAN-QC-REOPEN-DR024-R02-20260918-v0.1.md`; เฉพาะ `gisp-mvp-development`, Order `ORD-2026-000011`, Shipment `SHP-2026-000005`, สินค้า 1 ชิ้น ไม่ใช่ Production
- Deployment Development `79da8b9f-15bd-40d9-94f8-95eacff50b84` READY และ migration `20260918050000_qc-reopen-before-dispatch.sql` Applied ตาม Approval Record
- หลักฐานธุรกรรม: หน้า Order R02 ในบัญชี `bobady` หลัง Reopen/บันทึก QC/กด Dispatch ที่ถูกปฏิเสธ, และ SQL แบบอ่านอย่างเดียวกับ `order_items`, `qc_inspections`, `audit_events`, `shipments`, `shipment_status_history`
- เจ้าของปรับสิทธิ์บัญชีทดสอบ `pakapop39@hotmail.com` เอง; ตรวจจาก Development ว่าเป็น user ID `6edc29cd-8138-405a-9eb3-d0ace0b1c941`, ชื่อใน App `bobady`, `ACTIVE`, มีบทบาท `FINANCE`, `LOGISTICS`, `MEMBER_ADMIN`, `ORDER_ADMIN`, `PRODUCT_ADMIN`, `PURCHASING`, `QC` ณ รอบทดสอบนี้; ผู้ช่วยไม่ได้แก้สิทธิ์
- Automated test ล่าสุด: `npm test -- --reporter=dot` ผ่าน 83 ไฟล์ / 438 tests เมื่อ 12:10 ICT; ผลนี้เป็น **code-level test** ไม่เท่ากับ UAT ในระบบจริง โดยเฉพาะ security/concurrency

## ผล AC-01–06

| AC | ผล UAT จริง | หลักฐานและข้อจำกัด |
|---|---|---|
| AC-01 เปิดตรวจใหม่ก่อน Dispatch โดยมีเหตุผล และคงผลเดิม | **PASS** | บัญชี `bobady` กดเปิด QC ใหม่ของ R02; เหตุผลขึ้นต้น `DRYRUN-R02 Development Test`; Inspection เดิม `e5bd97f7-1a6b-4130-8bbf-fea0011a6d8f` ยังเป็น `PASSED` และ Shipment ยังไม่ Dispatch |
| AC-02 เปลี่ยนเป็น IN_PROGRESS, ปิด Gate, มี Audit/ประวัติ; เปิดซ้ำไม่เพิ่มรายการ | **PARTIAL** | หลังเปิด หน้า App แสดง `IN_PROGRESS` และ “ยังจัดส่งไม่ได้”; Audit `QC_REOPENED` ID `313fc294-1f9f-4e4a-9f35-2ae25d9bc715` เวลา 12:04:53 ICT มีเหตุผล, ผู้กระทำ และ parent inspection; พบ Audit 1 รายการ แต่ **ไม่ได้กดเปิดซ้ำขณะ IN_PROGRESS** จึงยังไม่รับรอง idempotency จาก UAT จริง |
| AC-03 Checklist จำลอง FAILED, ประวัติเป็น Reinspection, Gate ยังไม่ผ่าน | **PASS** | บันทึก Checklist ขนาด/สเปกเป็น `FAILED`, อีกสองข้อ `PASSED`; Inspection ใหม่ `28e38c41-0fd3-4888-a61a-b9cfe99c63c8` เป็น `FAILED`/`REINSPECTION` และอ้างผล PASS เดิม; `order_items.qc_status=FAILED`; App แสดง “ยังจัดส่งไม่ได้” |
| AC-04 Logistics กด Dispatch หนึ่งครั้งและถูกปฏิเสธ โดย Shipment/Audit/Event ไม่ผิดปกติ | **PASS ด้านการบล็อก / พบปัญหาข้อความแจ้งเตือน** | บัญชี `bobady` ซึ่งเจ้าของเพิ่มบทบาท `LOGISTICS` แล้วกด `ยืนยันออกเดินทาง` ของ `SHP-2026-000005` **หนึ่งครั้ง** ขณะ `qc_status=FAILED` และ `can_dispatch_order_item=false`; App ไม่ออกเดินทางแต่แจ้งข้อความทั่วไป “ระบบไม่สามารถดำเนินการได้ กรุณาลองอีกครั้ง” หลังคลิก SQL ยืนยัน Shipment ยังคง `GATE_CHECKED`, `dispatched_at=NULL`, Audit เท่าเดิม 1, status history เท่าเดิม 0; ไม่แตะ R01 |
| AC-05 ห้ามผิดองค์กร/ไม่มีสิทธิ์, ห้ามหลัง Dispatch, ปลอดภัยเมื่อคำสั่งแข่งกัน | **NOT TESTED ใน Development runtime** | Unit/static migration tests ตรวจข้อความกฎและ lock แล้ว แต่ไม่มี UAT ด้วยผู้ใช้ต่างองค์กร/ไร้สิทธิ์ หรือการแข่งคำสั่งจริง; R02 Shipment ต้องคงก่อน Dispatch เพื่อ AC-04 จึงไม่ใช้รายการเดียวกันทดสอบ “หลัง Dispatch” หรือการแข่งขันที่อาจออกเดินทางได้ |
| AC-06 Regression ของ QC/Member Approval/Payment Gate/Shipment ปกติ | **PARTIAL** | Automated tests 438/438 ผ่าน; หลัง deploy คลิก `เริ่มตรวจซ้ำ` จาก QC `FAILED` แล้วฟอร์ม Reinspection เปิดขึ้นจริง (ยังไม่บันทึกผลใหม่); ประวัติ R02 ก่อน deploy แสดงเส้นทาง QC PASS, Payment Gate ครบ และสร้าง Shipment ได้ แต่ยังไม่มี End-to-End regression หลัง deploy ครบทุกทางเลือก โดยเฉพาะ Custom Member approval และ Dispatch ปกติ จึงไม่ใช่ UAT PASS ทั้งข้อ |

## Snapshot ก่อน–หลัง AC-04

- `SHP-2026-000005`: `GATE_CHECKED`, `dispatched_at=NULL`
- Order item `d2246320-b6c8-47d4-9626-481986bd1bef`: `qc_status=FAILED`
- QC Inspection 2 รายการตามลำดับ: `INITIAL/PASSED` → `REINSPECTION/FAILED`; Audit `QC_REOPENED` 1 รายการ
- Shipment Audit 1 รายการ (`GATE_CHECKED`), Shipment status history 0 รายการ **ทั้งก่อนและหลัง** ลอง Dispatch หนึ่งครั้ง
- หลังเจ้าของเพิ่มบทบาท Logistics ให้ `pakapop39@hotmail.com` และเข้าสู่บัญชีใหม่ หน้า App แสดง `bobady · ระบบงานและออเดอร์ · การเงิน · โลจิสติกส์`; เป็นบัญชีทดสอบแบบรวมสิทธิ์ ไม่ใช่บัญชี Logistics-only ดังนั้น AC-04 พิสูจน์ Gate แต่ไม่พิสูจน์การแยกหน้าที่

## Finding: ข้อความ Dispatch Gate ไม่ตรงสาเหตุ

- หน้า App แสดงข้อความ `ระบบไม่สามารถดำเนินการได้ กรุณาลองอีกครั้ง` ทั้งที่ Gate ด้าน QC ไม่ผ่าน; ข้อความชวนกดซ้ำและไม่บอกว่าต้องแก้ QC
- จากการอ่าน source (เป็น **ข้ออนุมาน**, ไม่ใช่ server log): `dispatch_shipment` ใน migration โยน `DISPATCH_GATE_CHANGED` เมื่อ `can_dispatch_order_item=false` แต่ `logisticsErrorMessages` ใน API route ไม่มี mapping ของรหัสนี้ จึงน่าจะตกไปเป็น `SERVER_ERROR` 500 ใน `apiError`
- แนะนำแก้ mapping เป็น HTTP 409 พร้อมข้อความไทยที่ระบุว่า Gate เปลี่ยน/ให้ตรวจ QC แล้วเพิ่ม automated test และ Retest ใน Development; **ยังไม่ได้รับอนุญาตให้แก้โค้ดหรือ Deploy เพิ่มในงานนี้** เจ้าของต้องตัดสินว่าจะถือเป็น Blocker ก่อนปิด Slice หรือรับเป็น Known Issue สำหรับ Development Pilot

## ข้อจำกัดที่ห้ามตีความว่า PASS

- ทุกจำนวนเงินและ QC ใน R02 เป็นข้อมูลจำลองของ Development; ไม่มีการรับ/จ่ายเงินจริงหรือการตรวจสินค้าจริง
- เนื้อหา PDF ที่เก็บบนเซิร์ฟเวอร์สำหรับ `PAY-2026-000030` ไม่ได้เปิดตรวจ จึงยัง **NOT TESTED / ไม่ใช่ UAT PASS** ตามข้อยกเว้นเดิม
- PO Version และ Supplier Acknowledgement ยังไม่มีหลักฐานตรวจย้อนกลับได้ใน UAT R02; ไม่สร้างคำตอบรับ Supplier สมมติ
- รายงานนี้ไม่อนุญาต Deploy Production และไม่เป็น Production Release Authorization

## เพื่อปิด Slice นี้

1. เจ้าของตัดสิน Finding ข้อความผิดพลาดของ Dispatch: อนุมัติแผนแก้ไข/Retest เฉพาะ Development หรือรับเป็น Known Issue ที่ระบุชัด
2. กำหนดชุดทดสอบและอำนาจที่ไม่ทำให้ R02 เสีย precondition สำหรับ AC-02 ส่วนกดซ้ำ, AC-05 ด้วยบัญชีสิทธิ์จำกัด/ต่างองค์กรและกรณีแข่งคำสั่ง, และ AC-06 runtime ที่ยังไม่ได้พิสูจน์; ทดสอบและบันทึกผลแยกจาก automated tests
3. เจ้าของทบทวนผล UAT ครบทุก AC และตัดสินใจรับรองหรือคง Blocker; ห้ามสรุป PASS ทั้งชุดหรืออนุมัติ Production จากรายงานฉบับนี้
