# Slice 7 — Production & QC Engineering Evidence

**วันที่ตรวจ:** 29–30 สิงหาคม 2569  
**Backend Branch:** `slice-7-production-qc` (`kit6y4pj-xjf`)  
**สถานะ:** `SLICE_7_ACCEPTED` / `DONE` บน Development  
**Production:** ไม่ถูกเปลี่ยน

## ขอบเขตที่พัฒนา

- Production Timeline: Factory Confirmed, Material Preparation, In Production,
  Assembly, Finishing, Delayed และ Production Completed
- Progress %, ETA, Start/Actual Completion, เหตุผลล่าช้า และรูป/วิดีโอ/PDF
- Progress เป็นความคืบหน้ารวมของงาน มีค่าแนะนำอัตโนมัติตามสถานะ
  (0/10/30/60/85/100) ห้ามลดลง และสถานะล่าช้าคงค่าล่าสุด
- ช่อง Status, Progress, ETA และไฟล์ใน Production Form จัดแนวบนและความสูง
  Control เท่ากันทั้ง Desktop/Responsive
- QC Checklist: Passed / Failed / Not Inspected พร้อมหลักฐานและหมายเหตุ
- Fail → Rework → Reinspection เป็นเหตุการณ์ใหม่แบบ Append-only
- Standard Item ผ่าน QC โดย GISP; Custom Item ต้องให้ Member ดูรายงานและอนุมัติเอง
- Member เลือก “อนุมัติให้จัดส่ง” หรือ “ขอตรวจเพิ่มเติม” ได้ โดยไม่มี Auto-approval
- Dispatch Gate ตรวจ 4 เงื่อนไขจาก Backend: QC, Custom Member Approval,
  Customer Balance Verified และ Supplier Balance Paid
- ข้อมูล Supplier/Factory Cost ยังคงไม่ส่งให้ Member

## Database และ Security

- Migration ที่ใช้บน Branch:
  - `20260829120215_slice-7-production-qc.sql`
  - `20260829120915_slice-7-additional-review-event.sql`
  - `20260829121001_slice-7-rls-helpers.sql`
  - `20260829121209_fix-slice-7-file-id-array.sql`
  - `20260829125503_enforce-production-progress.sql`
- Timeline, Checklist, File Link และ Member Decision ห้าม Update/Delete
- การเปลี่ยนสถานะทำผ่าน Trusted RPC; Member เขียน Production/QC โดยตรงไม่ได้
- RLS ใช้ Security Definer ownership helper เพื่อป้องกัน Cross-member leakage
- Signed URL มีอายุจำกัดสำหรับไฟล์ Member-private

## Automated Gate

| การตรวจ | ผล |
|---|---|
| Lint | ผ่าน — 0 Error |
| TypeScript | ผ่าน |
| Unit/Regression | ผ่าน — 25 Test Files / 103 Tests |
| Production Build | ผ่าน — 91 Routes |
| Slice 7 Branch Integration | ผ่าน — 16/16 Assertions |
| Health | HTTP 200 |
| Protected Member/Admin Routes | HTTP 307 ไป Login พร้อม `next` ถูกต้อง |

Integration ครอบคลุม QC-before-production guard, ห้ามสถานะการผลิตถอยหลัง,
Progress baseline/ห้ามลดค่า, Delay ต้องมีเหตุผลและคง Progress ล่าสุด,
Checklist/result consistency, Member-safe Timeline,
Direct-write guard, Custom Approval, Additional Review, Reinspection,
Dispatch Gate 4 เงื่อนไข และ Append-only history

## Preview

- Deployment รอบสุดท้าย: `e59f7e80-f291-40be-8bca-c4ccae41e080`
- URL: `https://kit6y4pj-xjf.insforge.site`
- สถานะ: `READY`
- Human UAT Project: `PRJ-S7-HUAT-1788006316118 — Slice 7 Human UAT 1788006316118`
- Human UAT Order: `ORD-S7-HUAT-1788006316118`

## Human UAT Fix

- ระหว่าง Human UAT พบข้อความ `Cannot read properties of null (reading 'reset')`
  หลังบันทึก Production สำเร็จ เพราะฟอร์มอ้าง `event.currentTarget` หลังรอ Async Upload/API
- แก้ Production และ QC Form ให้เก็บ Form Element ก่อนเริ่ม Async Operation แล้วจึง Reset
  จาก Reference ที่คงอยู่
- ยืนยันว่ารายการ `PRODUCTION_COMPLETED · 100%` ของ UAT ถูกบันทึกเพียงหนึ่งครั้ง จึงไม่สร้างข้อมูลซ้ำ
- TypeScript, Lint, 24 Test Files / 101 Tests, Build 91 Routes, Branch Integration 16/16
  และ Health HTTP 200 ผ่านหลังแก้ไข
- ทบทวน QC Workflow จาก Human UAT: Checklist เริ่มที่ `NOT_INSPECTED` และต้องตรวจครบ
  ทุกข้อก่อนบันทึก; ถ้าผ่านครบ ผลรวมเปลี่ยนเป็น `PASSED` อัตโนมัติ; ถ้ามีข้อไม่ผ่าน
  ผลรวมตั้งต้นเป็น `FAILED` และ Admin เลือก `REWORK_REQUIRED` ได้
- หลังปรับ Workflow: TypeScript/Lint ผ่าน, 24 Test Files / 101 Tests, Build 91 Routes,
  Branch Integration 16/16 และ Health HTTP 200 ผ่าน
- ปรับ UX หลังบันทึก QC ไม่ให้แสดง Checklist ว่างว่า “ยังไม่ตรวจ” ทันที ซึ่งทำให้เข้าใจผิดว่า
  ผลที่เพิ่งบันทึกหายไป: ระบบแสดงผลรอบล่าสุดและสถานะที่บันทึกแล้วก่อน หากรอบล่าสุดไม่ผ่าน
  จะแสดงปุ่ม “เริ่มตรวจซ้ำ” และเปิด Checklist ใหม่เมื่อ Admin กดปุ่มเท่านั้น
- การตัดสินใจ Initial/Reinspection อิงผล QC รอบล่าสุด ไม่ย้อนกลับไปติดผลไม่ผ่านจากประวัติรอบเก่า
- หลังแก้ UX: TypeScript/Lint ผ่าน, 24 Test Files / 101 Tests, Build 91 Routes,
  Branch Integration 16/16, Preview `fe1ad5c4-912e-4177-abfa-d84d3da7ff10` READY และ Health HTTP 200
- เพิ่ม Search และ Status Filter เหนือ Order List ทั้ง Member/Admin: Member ค้นจากเลข Order,
  เลข/ชื่อโครงการ; Admin ค้นเพิ่มจากบริษัทและผู้ติดต่อ พร้อมจำนวนผลลัพธ์ ปุ่มล้าง และ Empty State
- Browser Verification บน Member Order จริง: ค้น `HUAT` ได้ 1/12, กรอง `CANCELLED` ได้ 2/12
  และทั้งสองแถวเป็นสถานะยกเลิก; ล้างตัวกรองกลับเป็น 12/12, ไม่มี Console Error หรือ Horizontal Overflow
- เปลี่ยน `window.prompt` ของ “ขอตรวจเพิ่มเติม” เป็น Dialog ที่อธิบายว่าผล QC เดิมยังผ่าน
  แต่พักการอนุมัติจัดส่ง พร้อมเหตุผลสำเร็จรูป 6 ตัวเลือกและช่องรายละเอียด โดย `อื่น ๆ`
  บังคับกรอกรายละเอียด; Admin เห็นคำขอที่มีโครงสร้างเหนือปุ่มเริ่มตรวจซ้ำ
- Browser Verification Dialog: แสดงครบ 6 ตัวเลือก, ปุ่มส่งปิดก่อนเลือก, เปิดเมื่อเลือกเหตุผลทั่วไป,
  ปิดเมื่อเลือก `อื่น ๆ` โดยไม่กรอกรายละเอียด และเปิดอีกครั้งเมื่อกรอก; ไม่มี Console Error/
  Horizontal Overflow และไม่ได้ส่งคำขอแทน Human UAT
- Human UAT ทำเส้นทางจริงครบ: QC ครั้งแรก → Member ขอตรวจเพิ่มเติม → Reinspection ผ่าน →
  Member อนุมัติ → Dispatch Gate ครบ 4 เงื่อนไขและแสดง “พร้อมจัดส่ง”
- แก้ประวัติขั้นสุดท้ายไม่ให้แสดงภาษาระบบ `REWORK_REQUIRED`: เหตุการณ์ดังกล่าวแสดงเป็น
  “Member ขอตรวจเพิ่มเติม”, ผลตรวจแสดง “ผ่าน QC/ไม่ผ่าน QC/ต้องแก้ไข” เป็นภาษาไทย และใช้
  “สิ่งที่ขอตรวจเพิ่ม” แยกจาก “การแก้ไข” ของ QC
- Browser Verification บน Preview รอบสุดท้าย: ไม่พบสถานะดิบ, ไม่มี Console Error หรือ
  Horizontal Overflow และผู้ใช้สั่งให้ทำทั้งสองขั้นตอนเพื่อปิด Slice 7 ต่อเนื่องเมื่อ 30 สิงหาคม 2569

## Owner Sign-off และ Development Release

- Owner Approval: “ทำทั้ง2 ขั้นตอนเพื่อปิด Slice 7: ต่อเนื่อง” หลังตรวจ Human UAT Flow จริง
- Acceptance Result: `SLICE_7_ACCEPTED`
- Backup ก่อน Merge: `pre-slice-7-merge-2026-08-30`
  (`f72604be-bd97-4c3a-b904-8258646d6e62`, completed)
- Merge Dry-run รอบแรกพบ Conflict เฉพาะ `schedules.jobs` จาก Runtime Timestamp;
  ค่า Schedule ทั้งสองฝั่งเหมือนกัน จึงสำรองค่า ลบชั่วคราว และสร้างกลับหลัง Merge
- Merge รอบสุดท้าย: `19 added, 6 modified, 0 conflicts`; ไม่พบ Drop Table, Drop Column
  หรือ Delete Data; Branch อยู่สถานะ `merged` และยังไม่ถูกลบ
- Development Deployment: `31923d72-589c-45c9-9cc8-bcc20adb1395` (`READY`)
- Development URL: `https://kit6y4pj.insforge.site`
- Post-merge Integration: ผ่าน 16/16 Assertions
- Post-merge Health: HTTP 200; Protected Member/Admin Routes: HTTP 307 พร้อม `next` ถูกต้อง
- Browser Smoke บน Development: Standard และ Custom แสดง “พร้อมจัดส่ง”, ประวัติแสดง
  “Member ขอตรวจเพิ่มเติม” และ “ตรวจซ้ำ · ผ่าน QC”, ไม่พบสถานะดิบ, Console Error หรือ
  Horizontal Overflow
- Notification Schedule สร้างกลับชื่อ `GISP-Notification-Retry`, ทุก 10 นาที,
  ID `294c5f55-faea-492e-a34b-8a8d57acdc25`; รอบแรกทำงานสำเร็จ HTTP 200

## Gate ที่เหลือ

เหลือ **0 ขั้นตอน** เพื่อปิด Slice 7 บน Development

Production Deployment และการลบ Backend Branch ไม่อยู่ในการอนุมัติครั้งนี้ และต้องได้รับ
Owner Approval แยกต่างหาก
