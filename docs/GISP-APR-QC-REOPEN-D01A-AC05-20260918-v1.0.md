# GISP — Approval Record: D01-A / QC Reopen AC-05 v1.0

วันที่บันทึก: 2026-09-18 (Asia/Bangkok)  
สถานะ: **อนุมัติการตีความ AC-05 ตาม App baseline เท่านั้น; ยังไม่ปิด QC Reopen UAT Slice**

## Approval Record

| รายการ | ค่าที่บันทึก |
|---|---|
| approval_level | Scope Approved — ข้อความและการจำแนกผล AC-05 เท่านั้น |
| approved_by | ภคภพ ช.เจริญยิ่ง |
| approval_text_or_reference | ข้อความเจ้าของในบทสนทนา: “D01-A ตามคำแนะนำ” |
| scope_document_version | `GISP-PLAN-QC-REOPEN-REMAINING-UAT-20260918-v0.1.md` §2 ทางเลือก D01-A |
| environment | GISP Development; การบันทึกเอกสารใน Workspace |
| data_migration_authorized | No |
| production_allowed | No |
| approved_at | 2026-09-18 17:35:42 +07:00 (เวลาบันทึกมติจากข้อความเจ้าของในรอบนี้) |

## ผลของมติ D01-A

1. QC ภายในปัจจุบันได้รับบทบาทแบบ Global (`organization_id IS NULL`) และปฏิบัติงานข้ามองค์กรได้ตาม App baseline; ห้ามเรียกบัญชี QC แบบ Global ว่าเป็น “QC ผิดองค์กร” เพื่อทดสอบกรณีปฏิเสธสิทธิ์
2. ใช้ถ้อยคำ AC-05 ด้านสิทธิ์ว่า **“บัญชีที่ไม่มี `qc.manage` ต้องถูกปฏิเสธ; บทบาท QC แบบจำกัดองค์กร หากมีในอนาคต ต้องไม่ข้ามองค์กร”**
3. ผลบัญชีที่ไม่มี `qc.manage`: **PASS เฉพาะกรณีนี้** จากคำขอ Development HTTP 403 และไม่มี QC/Audit ใหม่ ตาม `GISP-UAT-QC-REOPEN-DR024-R02-20260918-v0.3-AC05-PERMISSION-ADDENDUM.md`
4. ผลกรณี QC แบบจำกัดองค์กรข้ามองค์กร: **N/A สำหรับรูปแบบบัญชีที่ใช้อยู่ปัจจุบัน; ไม่ใช่ PASS หรือผลทดสอบจริง** ให้ติดตามเป็น Future security test หากเริ่มใช้ scoped QC role
5. ผล Reopen หลัง Dispatch และการแข่งขันกับ Dispatch ยังคงตาม `GISP-UAT-QC-REOPEN-DR024-R02-20260918-v0.2.md`: backend ปฏิเสธหลัง Dispatch และไม่พบสถานะขัดกันในการแข่งขันที่ทดสอบหนึ่งครั้ง; ไม่อ้างว่าพิสูจน์การแข่งขันทุกรูปแบบ

## ขอบเขตที่ยังไม่อนุมัติ

- D01-A **ไม่อนุมัติ D02** หรือการสร้างชุดทดสอบ Custom R03; ต้องขออำนาจสร้างและแก้เฉพาะข้อมูล Development แยกต่างหาก
- ไม่อนุมัติการสร้างบัญชี/องค์กร, เปลี่ยน Role/Permission, แก้ App/Source Code/Schema, Apply Migration, Deploy, แก้ข้อมูล R01/R02/ข้อมูลเดิม หรือ Production
- ไม่เปลี่ยนผล AC-06 ซึ่งยังขาด Custom Member approval และ Shipment creation หลัง Deploy; ไม่ใช่ Owner UAT Acceptance หรือ Production Release Authorization

## สิ่งที่ต้องทำต่อเพื่อปิด Slice

1. เจ้าของตัดสิน D02 ว่าอนุมัติหรือไม่ให้สร้างชุด Custom R03 ใน Development ตามแผน v0.1
2. หากอนุมัติและข้อมูลทดสอบพร้อม ให้ทดสอบ AC-06 พร้อมหลักฐาน App/Audit โดยไม่แตะ R01/R02
3. ตัดสิน UX findings เรื่องข้อความ Dispatch Gate และปุ่ม Reopen หลัง Dispatch แล้วสรุปผล AC-01–06 เพื่อให้เจ้าของรับรอง UAT แยกจาก Production

**เหลือ 3 ขั้นตอนเพื่อปิด QC Reopen UAT Slice**
