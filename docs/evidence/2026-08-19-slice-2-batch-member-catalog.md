# Slice 2 — Batch Enrichment และ Member Catalog Evidence

**วันที่ตรวจ:** 19 สิงหาคม 2569  
**ขอบเขต:** InsForge Backend Branch `slice-2-catalog` เท่านั้น  
**Branch Preview:** `https://kit6y4pj-63e.insforge.site`  
**ผล:** งานพัฒนาและ Automated/Browser Verification ผ่าน; ยังไม่ใช่ Slice 2 Human UAT หรือ Production Release

## สิ่งที่พัฒนา

- หน้า Admin `/admin/catalog/batch` สำหรับค้นหา กรอง เลือก และจัดการสินค้าเป็นชุด
- Batch Action แบบไม่เขียนทับค่าที่มีอยู่: Lead time, Material และ Default Variant
- Batch Action ผ่าน Pricing Engine: สร้าง Cost Version จาก Factory Cost + อัตราแลกเปลี่ยนที่อนุมัติ และเปิดใช้ Member Price จาก Formula Active
- ตาราง Batch Run/Item พร้อม Audit และ RLS สำหรับผู้มีสิทธิ์ภายใน
- Database RPC `get_catalog_batch_relation_state` สำหรับตรวจสูงสุด 1,000 สินค้าด้วยคำสั่งเดียว โดยไม่ส่ง UUID จำนวนมากผ่าน URL
- Member Catalog List/Detail และ API จาก `member_catalog` safe projection
- Signed URL 5 นาทีสำหรับรูปและเอกสารที่ Member มีสิทธิ์ดู
- Explicit member-safe serializer และทดสอบห้าม Supplier Identity, Factory Cost, Exchange Rate, Formula, Margin และ Internal Note รั่ว

## ผลตรวจข้อมูล CN01 แบบ Read-only

| รายการ | จำนวน |
|---|---:|
| Product ทั้งหมด | 723 |
| ขาด Lead time | 723 |
| ขาด Material | 723 |
| มิติไม่ครบ | 53 |
| ไม่มี Active Variant | 438 |
| ไม่มี Active Cost Version | 723 |
| ไม่มี Active Member Price | 723 |
| พร้อม Review | 0 |

ไม่มีการกรอกค่าทดลอง สร้างต้นทุน เปิดราคา Review หรือ Publish สินค้า CN01 ในการตรวจครั้งนี้

## Automated Gate

- Typecheck: ผ่าน
- Unit Test: 13 files, 64/64 tests ผ่าน
- Lint: 0 error; warning เดิม 2 จุดในไฟล์เครื่องมือชั่วคราวนอก Application
- Production Build: ผ่าน
- Member-safe forbidden-column check: ผ่าน
- Batch table RLS และ Function execute boundary: ผ่าน
- Migration ใช้สำเร็จเฉพาะ Branch:
  - `20260819004500_catalog-batch-operations.sql`
  - `20260819010500_catalog-batch-rls.sql`
  - `20260819013000_catalog-batch-state.sql`

## Browser Verification

- บัญชี Branch UAT `SUPER_ADMIN` เปิด `/admin/catalog/batch` สำเร็จ
- Supplier CN01 และ Validation 723 รายการโหลดสำเร็จ
- ตัวกรองและตัวเลข Issue ตรงกับฐานข้อมูล
- ไม่มี Console Error ระหว่างตรวจ
- ไม่กด Action ที่เปลี่ยนข้อมูลจริง
- บัญชี Admin ถูก Redirect กลับ `/admin/dashboard` เมื่อเปิด `/member/catalog` ยืนยัน Role Boundary; Member UI/API จะรวมตรวจใน Human UAT ด้วยบัญชี Member

## ข้อจำกัดการทดสอบ Backend

InsForge CLI ปัจจุบันไม่รองรับการรัน Transaction/DO block สำหรับ Branch Test แบบ rollback และ RPC Tool ไม่อนุญาตการจำลอง JWT claims จึงไม่ใช้ค่าทดลองกับ CN01 เพื่อแลกกับผล Test การทำงานของ Batch Action จะตรวจด้วยข้อมูล UAT ที่ได้รับอนุมัติในรอบรวมครั้งเดียว

## ขั้นตอนถัดไป

1. อนุมัติ Lead time ที่จะใช้กับกลุ่มสินค้า
2. อนุมัติ Material mapping ตามกลุ่มสินค้า
3. อนุมัติอัตรา CNY → THB และ Effective Date
4. แก้ 53 รายการที่มิติไม่ครบ แล้วรัน Default Variant
5. รัน Cost Version → Member Price → Review/Publish กับชุด UAT ที่เลือก
6. ทำ Human UAT Admin Batch + Member Catalog ครั้งเดียวเป็นชุด
