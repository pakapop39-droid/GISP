# GISP QC Reopen — Owner UAT Acceptance Candidate v0.1

วันที่จัดทำ: 2026-09-18 (Asia/Bangkok)  
สถานะ: **Candidate เดิม — มี Approval Record แยกแล้วใน `GISP-APR-QC-REOPEN-OWNER-UAT-ACCEPTANCE-20260918-v1.0.md`; ห้ามใช้ Candidate นี้แทน Record**

## ขอบเขตที่เสนอให้รับรอง

Development UAT ของ QC Reopen / DR-024 ตามรายงาน R02 v0.1–v0.3 และ `GISP-UAT-QC-REOPEN-R03-EXECUTION-20260918-v0.1.md` เท่านั้น; ไม่มีเงินจริง สินค้าจริง หรือ Production Release Authorization.

| หัวข้อ | ผลที่เสนอ |
|---|---|
| AC-01–04 | ใช้ผล Development R02 ที่บันทึกไว้; ไม่ทดสอบซ้ำใน R03 |
| AC-05 ไม่มี `qc.manage` และ Reopen หลัง/แข่งกับ Dispatch | PASS ตาม R02; กรณี scoped role ผิดองค์กรเป็น `N/A` ตามมติ D01-A ไม่ใช่ PASS |
| AC-06 Custom Member approval / Gate / Shipment | PASS เฉพาะ Development Test แบบจำลองตาม R03: Member เจ้าของ Order อนุมัติเอง, ก่อน Gate ครบสร้าง Shipment ไม่ได้, หลังครบสร้างและ Dispatch `SHP-2026-000006` ได้ |
| Payment Evidence Integrity | **ยังไม่รับรอง** เนื้อหา PDF ที่เก็บบนเซิร์ฟเวอร์; App รับไฟล์และ Finance กดตรวจแบบทดสอบเท่านั้น |

## สอง UX findings ที่เจ้าของต้องเลือก

1. เมื่อ Dispatch Gate ไม่ผ่าน ข้อความจาก App ยังบอกเพียงว่าเงื่อนไขไม่ครบ ไม่ชี้ว่าขาดข้อใด แม้หน้า Gate แสดงสถานะ 4 ข้อ
2. หลัง Shipment `DISPATCHED` หน้าจอยังแสดงปุ่ม Reopen QC แต่ backend ปฏิเสธการกด; ไม่ทำให้ข้อมูลเปลี่ยนในการทดสอบ R02

ทางเลือกของเจ้าของสำหรับแต่ละข้อ: **แก้และ Retest ใน Development ก่อนรับรอง UAT** หรือ **รับเป็น Known Issue สำหรับ UAT เท่านั้น** โดยระบุผู้รับผิดชอบและกำหนดแก้ก่อน Production Release. การเลือกอย่างหลังไม่ใช่การอนุญาตให้เปิด Production โดยอัตโนมัติ.

## ข้อมูลที่ต้องใส่เมื่ออนุมัติจริง

- ผู้อนุมัติ: ภคภพ ช.เจริญยิ่ง
- ข้อความตัดสินใจ UX finding 1 และ 2: **รอระบุ**
- การยอมรับข้อจำกัด Payment Evidence Integrity หรือคำสั่งให้ทดสอบเพิ่ม: **รอระบุ**
- ระดับอนุมัติ: Owner UAT Acceptance ใน Development เท่านั้น
- เอกสารขอบเขต: Candidate v0.1 และรายงาน R02/R03 ที่อ้างข้างต้น
- Environment: GISP Development
- Data Migration: No
- Production allowed: No
- เวลาอนุมัติ: **รอบันทึกเมื่อเจ้าของยืนยัน**

ห้ามเปลี่ยนสถานะ Candidate เป็น Approved จากการทดสอบผ่านเอง; ต้องมีข้อความตัดสินใจของเจ้าของแยกต่างหาก.
