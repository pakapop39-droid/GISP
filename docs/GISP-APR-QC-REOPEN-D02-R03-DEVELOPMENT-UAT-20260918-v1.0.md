# GISP — Approval Record: D02 / Custom R03 Development UAT v1.0

วันที่บันทึก: 2026-09-18 (Asia/Bangkok)  
สถานะ: **อนุมัติให้ดำเนินชุดทดสอบ Custom R03 ใน Development ภายใต้เงื่อนไขของแผน; ไม่ใช่ Production Release**

## Approval Record

| รายการ | ค่าที่บันทึก |
|---|---|
| approval_level | Implementation Authorized — สร้าง/แก้เฉพาะข้อมูลธุรกรรมทดสอบ R03 ผ่าน App ใน Development |
| approved_by | ภคภพ ช.เจริญยิ่ง |
| approval_text_or_reference | ข้อความเจ้าของในบทสนทนา: “อนุมัติชุดทดสอบ Custom R03 ใน Development” |
| scope_document_version | `GISP-PLAN-QC-REOPEN-REMAINING-UAT-20260918-v0.1.md` §3–4, D02 |
| environment | GISP Development (`gisp-mvp-development`) เท่านั้น |
| data_migration_authorized | No |
| production_allowed | No |
| approved_at | 2026-09-18 18:48:05 +07:00 (เวลาบันทึกมติจากข้อความเจ้าของ) |

## ขอบเขตที่ได้รับอนุญาต

- ชุดใหม่ R03: `DRYRUN-R03-PRJ-001`, `DRYRUN-R03-CUSTOM-001`, `DRYRUN-R03-ORD-001`, `DRYRUN-R03-SHP-001`; Custom item จำนวน 1 ชิ้น
- ใช้เฉพาะ Member, Supplier ทดสอบเดิมที่เหมาะสม และราคา ภาษี Payment Term กับ Freight ที่มีอยู่/อนุมัติแล้ว
- เดินตาม Workflow ใน App สำหรับการทดสอบ AC-06 และบันทึก Audit/Notification ที่ระบบสร้างอัตโนมัติ; ข้อมูลและหลักฐานจำลองต้องแสดงว่าเป็น Development Test
- ผู้ใช้สลับบัญชี Member เอง; บัญชีภายในใช้เฉพาะบัญชีเดิมที่ได้รับอนุญาต

## ข้อห้ามและเงื่อนไขหยุด

- ห้ามกำหนดราคา Custom ใหม่ สูตร ภาษี Payment Term, เปลี่ยน Master Data, Role/Permission, App, Source Code, Schema, Apply Migration หรือ Deploy
- ห้ามแก้ R01/R02/Custom order เดิม หรือ Production; ไม่มีการเงินจริงหรือสินค้าจริง
- ถ้า Member/Supplier/Custom Quotation ที่เหมาะสมไม่พร้อม, ต้องให้เจ้าของกำหนดราคา/ผู้อนุมัติใหม่, หรือ App ทำทางที่อนุมัติไม่ได้ ให้หยุดก่อนสร้างข้อมูลลัดทางฐานข้อมูลและรายงาน
- การอนุมัตินี้ไม่ใช่การรับรอง UAT หรือ Production Release Authorization

## ขั้นตอนตรวจรับ

ตรวจข้อมูลและหน้าจอที่จำเป็นก่อนสร้าง R03; เมื่อพร้อมจึงทดสอบ Custom QC → รอ Member อนุมัติ → Member ตัดสิน → Payment/Dispatch Gate → Shipment ตาม §3 ของแผน พร้อมหลักฐาน App/Audit แยกจากข้อสรุปเรื่องเนื้อหาไฟล์ที่ยังไม่ได้ตรวจจริง
