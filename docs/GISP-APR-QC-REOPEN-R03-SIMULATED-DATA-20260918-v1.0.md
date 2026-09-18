# GISP — Approval Addendum: R03 Simulated Development Data v1.0

วันที่บันทึก: 2026-09-18 (Asia/Bangkok)  
สถานะ: **อนุมัติใช้ข้อมูลจำลองเฉพาะ R03 ใน Development; ยังไม่เริ่มสร้างธุรกรรม**

## Approval Record

| รายการ | ค่าที่บันทึก |
|---|---|
| approval_level | Implementation Authorized — ขยาย D02 เฉพาะข้อมูลจำลองของธุรกรรม R03 |
| approved_by | ภคภพ ช.เจริญยิ่ง |
| approval_text_or_reference | ข้อความเจ้าของ: “ผมทำไปทำมาหลายรอบแล้ว ต้องการทำครั้งเดียวให้เสร็จ จำลองข้อมูลได้ทุกอย่าง ทำให้เสร็จเพื่อปิด slice” |
| scope_document_version | `GISP-PLAN-QC-REOPEN-REMAINING-UAT-20260918-v0.1.md` D02 และ `GISP-APR-QC-REOPEN-D02-R03-DEVELOPMENT-UAT-20260918-v1.0.md`; Addendum นี้แทนข้อจำกัดเรื่องตัวเลขจำลองของ Quotation **เฉพาะ R03** |
| environment | GISP Development เท่านั้น |
| data_migration_authorized | No |
| production_allowed | No |
| approved_at | 2026-09-18 18:52:48 +07:00 (เวลาบันทึกมติจากข้อความเจ้าของ) |

## ขอบเขตการจำลองที่ใช้ได้

- เลือกข้อมูลตัวอย่างใหม่เฉพาะธุรกรรม R03 ผ่าน App รวมถึงสเปก ราคาเสนอขาย Custom และต้นทุน Supplier เพื่อพิสูจน์ Workflow; ทุกช่องที่มีข้อความอิสระให้ติดป้าย `Development Test / DRYRUN-R03`
- ตัวเลขทดสอบที่ตั้งใจใช้: **ราคาขาย Custom ก่อน VAT ฿2,000.00 และต้นทุน Supplier CN¥200.00 จำนวน 1 ชิ้น**; เป็นค่าทดสอบ ไม่ใช่ราคาเสนอขายจริงหรือการอนุมัตินโยบายราคา
- VAT, Payment Term, สูตรคำนวณ และ Freight ให้ App ใช้ค่าปัจจุบันเอง; ห้ามแก้ Master Data หรือบริษัท settings
- เอกสาร/หลักฐานจำลองใช้เพื่อทดสอบการรับและผูกไฟล์เท่านั้น; ไม่อ้างว่าเป็นการชำระเงินจริง การผลิตจริง การส่งมอบจริง หรือการตอบรับจากบุคคลภายนอก และไม่สรุปว่าตรวจเนื้อหาไฟล์บนเซิร์ฟเวอร์แล้วหากยังไม่ได้เปิดตรวจ

## สิ่งที่ยังห้ามและจุดหยุด

- ไม่แตะ R01/R02/ข้อมูลเดิม, Role, Permission, Authentication, Source Code, Schema, Migration, Production หรือเงินจริง
- ไม่ใช้สิทธิ์ผู้ดูแลระบบเขียนฐานข้อมูลลัด App; ถ้า Workflow ของ App ไม่รองรับหรือบัญชีไม่พร้อม ให้หยุดและรายงานตามข้อเท็จจริง
- ผู้ใช้เป็นผู้สลับบัญชี Member เอง; การยืนยัน Member ต้องทำจากบัญชี Member ไม่ใช่บัญชีภายใน
- Addendum นี้ไม่ใช่ UAT PASS หรือ Production Release Authorization
