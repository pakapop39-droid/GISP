# GISP Development UAT — QC Reopen / DR-024, R02 v0.2

วันที่ตรวจ: 2026-09-18 (Asia/Bangkok)  
สถานะ: **PARTIAL / ยังไม่ปิด Slice** — ต่อจาก v0.1 โดยไม่แก้ผลการทดสอบเดิม

## ขอบเขต

- ผู้อนุมัติ: ภคภพ ช.เจริญยิ่ง; ข้อความล่าสุด “อนุมัติและทดสอบกรณี AC-02/05/06 ที่ยังขาดด้วยชุดทดสอบที่เหมาะสม”; บันทึกขอบเขตใน `GISP-APR-QC-REOPEN-AC0256-R02-RETEST-20260918-v1.0.md`
- Environment: `gisp-mvp-development` เท่านั้น; บัญชีภายใน `pakapop39@hotmail.com` (App แสดง `bobady`); R02 `ORD-2026-000011`, `SHP-2026-000005`, order item `d2246320-b6c8-47d4-9626-481986bd1bef`
- ผล QC, Reopen และ Dispatch ในรายงานนี้เป็น **Development Test จำลอง**; ไม่มีการตรวจสินค้าหรือจัดส่งจริง ไม่ใช้ R01 หรือ Production
- หลักฐาน: หน้าจอ Order ใน App, ข้อความตอบกลับของ App, SQL แบบอ่านอย่างเดียวกับ `order_items`, `qc_inspections`, `audit_events`, `shipments`; ไม่ใช้สิทธิ์ `project_admin` ทำธุรกรรมแทนผู้ใช้

## ผลทดสอบเพิ่มจาก v0.1

| กรณี | ผล | หลักฐานและข้อจำกัด |
|---|---|---|
| AC-02 เปิดซ้ำไม่เพิ่มรายการ | **PASS สำหรับ R02** | หลัง Reinspection จำลอง `PASSED` เวลา 12:55:01 ICT เปิด Reopen จากหน้าจอหนึ่ง แล้วส่งคำสั่งเดียวกันอีกครั้งจากหน้าจอที่เปิดค้างไว้; `qc_status=IN_PROGRESS`, Inspection 3 รายการ และ `QC_REOPENED` เพิ่มจาก 1 เป็น **2 เท่านั้น** ไม่เป็น 3. Audit ใหม่เวลา 12:55:45 ICT มี reason, actor และ `parent_inspection_id=e020c4a0-d424-4b81-b35a-1ea3f4fdff71`; Gate ปิดตามหน้า App. ครอบคลุมการส่งซ้ำจากหน้าจอค้าง ไม่ใช่ stress test หลายร้อยคำขอ |
| AC-05 Reopen แข่งกับ Dispatch | **PASS สำหรับผลการแข่งขันที่ทดสอบ 1 ครั้ง** | หลัง Reinspection จำลอง `PASSED` เวลา 12:56:31 ICT ส่ง Reopen และ Dispatch จากสองหน้าจอใกล้กัน; Dispatch ชนะ, App แจ้ง “Dispatch Shipment แล้ว” ส่วน Reopen ถูกปฏิเสธ “สถานะปัจจุบันไม่รองรับการทำรายการนี้”. SQL หลังคำสั่ง: Shipment `DISPATCHED`, `dispatched_at=2026-09-18T05:57:03.154Z`, QC ยัง `PASSED`, `QC_REOPENED` ยัง 2 และ Audit `DISPATCHED` 1. ไม่พบสถานะต้องห้าม “Shipment ออกแล้วแต่ QC IN_PROGRESS”. ยังไม่พิสูจน์ทุก interleaving หรือผลกรณี Reopen ชนะ |
| AC-05 Reopen หลัง Dispatch | **PASS ด้าน backend / พบ UX issue** | จากหน้าจอหลัง Dispatch ลอง Reopen อีกหนึ่งครั้ง; App ปฏิเสธ “สถานะปัจจุบันไม่รองรับการทำรายการนี้”; SQL ยืนยัน Shipment ยัง `DISPATCHED`, QC `PASSED`, `QC_REOPENED` 2, Inspection 4. อย่างไรก็ตามหน้า App **ยังแสดงปุ่ม** “เปิดตรวจ QC ใหม่ก่อน Dispatch” หลัง Dispatch และปล่อยให้กรอกเหตุผลก่อนปฏิเสธ |
| AC-05 ไม่มี `qc.manage` / ต่างองค์กร | **NOT TESTED** | `bobady` มี QC และบทบาทภายในหลายบทบาท; ไม่ใช่ตัวแทนของผู้ใช้ไร้สิทธิ์/ต่างองค์กร. ไม่สร้างบัญชีหรือเปลี่ยน Role และไม่ใช้ SQL สิทธิ์ผู้ดูแลระบบอ้างเป็นผล Permission UAT |
| AC-06 QC FAILED → Reinspection → PASS; Payment Gate; Shipment ปกติ | **PARTIAL** | R02 มี Inspection `FAILED` ที่เก็บประวัติเดิม, ต่อด้วย Reinspection `PASSED`; หลัง QC ผ่าน App แสดง Gate ทั้ง 4 ข้อเป็น ✓ และ “พร้อมจัดส่ง”; Shipment ที่สร้างไว้ก่อนหน้านี้เปลี่ยน `GATE_CHECKED` → `DISPATCHED` สำเร็จหลัง deploy โดยมี Audit `DISPATCHED` 1. Payment 50/50 และ Supplier Balance แสดงครบก่อน Dispatch. ไม่ได้ทดสอบการสร้าง Shipment ใหม่หลัง deploy และไม่ได้ตรวจเนื้อหาไฟล์ PAY-2026-000030 บนเซิร์ฟเวอร์ |
| AC-06 Member Custom approval | **NOT TESTED ใน hosted Development** | R02 เป็นสินค้า `STANDARD` จึงแสดง “ไม่ต้องรอ Member อนุมัติ”; ไม่มี Custom test transaction ในขอบเขตนี้. ห้ามนับทาง STANDARD เป็น PASS ของ Custom approval |

## Automated checks แยกจาก UAT

- `npm test -- src/app/api/admin/qc-inspections/reopen/route.test.ts src/lib/orders/qc-reopen-migration.test.ts`: **8/8 PASS** (2 ไฟล์) เวลา 12:58 ICT
- `npm test -- --reporter=dot`: **438/438 PASS** (83 ไฟล์) เวลา 12:58 ICT
- `npm run typecheck`: **PASS** เวลา 12:58 ICT
- การทดสอบเหล่านี้ตรวจระดับโค้ด/สัญญา API และไม่ทดแทนผล permission หรือ Custom Member approval ในระบบจริง

## Findings และข้อห้ามตีความ

1. Finding เดิมจาก v0.1 ยังเปิด: เมื่อ QC Gate ไม่ผ่าน ปุ่ม Dispatch ให้ข้อความทั่วไปแทนสาเหตุที่ต้องแก้ (`DISPATCH_GATE_CHANGED` คาดว่าไม่ถูก map ใน API). ยังไม่ได้แก้โค้ดหรือ Deploy
2. Finding ใหม่: App ยังแสดงปุ่ม Reopen หลัง Dispatch แม้ backend ป้องกันได้; ควรซ่อน/ปิดปุ่มและอธิบายสถานะให้ชัด โดยต้องขออนุมัติแก้โค้ดแยกต่างหาก
3. AC-05 ทั้งข้อยัง **PARTIAL** เพราะไม่เคยทดสอบผู้ใช้ไร้ `qc.manage` และต่างองค์กรจริง; AC-06 ทั้งข้อยัง **PARTIAL** เพราะ Custom Member approval และการสร้าง Shipment ใหม่หลัง deploy ยังขาด. ห้ามสรุป AC-01–06 ทั้งชุดว่า UAT PASS
4. PDF ของ `PAY-2026-000030` ไม่ได้เปิดตรวจเนื้อหาที่เก็บบนเซิร์ฟเวอร์; PO Version/Supplier Acknowledgement ยังเป็นช่องว่างของ UAT R02 ตามรายงานเดิม
5. รายงานนี้ไม่เป็น Production Release Authorization

## เหลือ 3 ขั้นตอนเพื่อปิด Slice QC Reopen UAT

1. ทดสอบ AC-05 ด้วย **บัญชีเดิมที่มีสิทธิ์จำกัด/ต่างองค์กร** โดยเจ้าของสลับบัญชีเอง; หากไม่มี fixture ที่เหมาะสม ให้ขออนุมัติขอบเขต test fixture ใหม่ก่อน (ห้ามเปลี่ยน Role เอง)
2. อนุมัติชุด Custom test แยกและทดสอบ AC-06 Member approval/Shipment creation หลัง deploy; ทบทวนข้อยกเว้น PDF ตามขอบเขต UAT ที่ต้องการ
3. เจ้าของตัดสิน 2 UX findings ว่าแก้และ Retest ใน Development หรือรับเป็น Known Issue แล้วทบทวน/รับรอง UAT โดยไม่ตีความเป็น Production approval
