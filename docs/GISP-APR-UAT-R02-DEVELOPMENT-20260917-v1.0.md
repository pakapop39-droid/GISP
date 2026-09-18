# GISP UAT R02 — Development Test Data Approval Record v1.0

- `approval_level`: Scope Approved + Implementation Authorized (test transactions only)
- `approved_by`: ภคภพ ช.เจริญยิ่ง
- `approval_text_or_reference`: ข้อความผู้ใช้ในงานนี้: “รับรอง Checklist v0.4 และอนุมัติสร้างข้อมูลทดสอบ DRYRUN-R02 ใน GISP Development โดยใช้ Member/Supplier ทดสอบเดิม, SKU CN01-Y105 จำนวน 1 ชิ้น, ค่าปัจจุบันของระบบ; อนุญาตให้ทดสอบ QC ไม่ผ่านและคำสั่ง Dispatch ที่คาดว่าจะถูกบล็อก โดยไม่แก้ข้อมูล R01 หรือ Production”
- `scope_document_version`: Checklist v0.4 ที่เริ่มจาก `GISP_DRYRUN_R01_Checklist_Amendment_REVIEW_CANDIDATE_v0.4.docx`; สำเนาที่ปรับสถานะตามการรับรองคือ `GISP_DRYRUN_R01_Checklist_Amendment_APPROVED_DEVELOPMENT_UAT_v0.4.docx` โดยไม่เปลี่ยนเกณฑ์ DR-024
- `environment`: GISP Development เท่านั้น
- `data_migration_authorized`: No
- `production_allowed`: No
- `approved_at`: 2026-09-17 ประมาณ 13:55 ICT (เวลาที่ได้รับข้อความอนุมัติในงานนี้; ไม่มีเวลา timestamp ของข้อความที่แม่นยำกว่า)

## ขอบเขตการดำเนินงาน

- ใช้บัญชี Member และ Supplier ทดสอบเดิมเท่านั้น; สินค้า `CN01-Y105` จำนวน 1 ชิ้น และราคา/ภาษี/Payment Term ตามที่ App แสดงในขณะสร้างรายการ
- สร้างระเบียนใหม่เฉพาะชุด `DRYRUN-R02` ตามเส้นทาง App เพื่อทดสอบการบล็อก Dispatch เมื่อ Gate ไม่ครบ รวมการบันทึก QC `FAILED` บนข้อมูล R02 เท่านั้น
- เก็บเลขระเบียนที่ App สร้างจริง, เวลา, ภาพ/ข้อความผล, สถานะก่อน–หลัง และ Audit/Event ที่ระบบสร้างอัตโนมัติ
- ไม่แก้ระเบียน `DRYRUN-R01`, Master Data, App, Source Code, Schema, Role, Permission หรือ Production; ไม่ทำ Data Migration
- ไม่สร้าง Supplier Acknowledgement แทนบุคคลอื่น หากไม่มีหลักฐานตอบรับจริงให้คง DR-012 เป็น `NOT DEMONSTRATED`

## เงื่อนไขหยุด

หากบัญชีทดสอบ, Supplier, SKU, สิทธิ์ หรือข้อมูลสำหรับสร้าง R02 ไม่พร้อม; ระบบเรียกธุรกรรมจริง; หรือจำเป็นต้องแก้ R01/ข้อมูลเดิม ให้หยุดและรายงานก่อน ไม่ขยายขอบเขตเอง
