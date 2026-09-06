# Supplier CN01 — Draft Import Evidence

**วันที่:** 19 สิงหาคม 2569  
**Backend Branch:** `slice-2-catalog`  
**Import Job:** `2b5f864b-267f-480f-aaad-89d2f537623c`  
**ผล:** `COMPLETED — VERIFIED DRAFT IMPORT`

## ขอบเขตที่ได้รับอนุมัติ

เจ้าของระบบอนุมัติข้อความ “อนุมัติกฎ CN01 และ Import 723 สินค้าเป็น Draft” จึงใช้กฎที่ตรวจไว้
ครบ 16 รายการและนำข้อมูลเข้าเฉพาะ Branch `slice-2-catalog` โดยไม่ Merge เข้า Development
และไม่ Deploy Production

## ผลนำเข้า

| รายการ | จำนวน | ผลตรวจ |
|---|---:|---|
| Supplier | 1 | `CN01`, สถานะ `ACTIVE` |
| Categories | 8 | ไม่มี `REVIEW` ค้าง |
| Products | 723 | `DRAFT` 723, สถานะอื่น 0 |
| Product Variants | 729 | ตรงกับ Dry-run ที่อนุมัติ |
| Product Options | 654 | กลุ่ม `สี/วัสดุ` |
| Option Values | 966 | Dry-run 965 + `สีขาว` ของ Source Row 684 ตามกฎที่อนุมัติ |
| Primary Images | 723 | Product ครบ 723 รายการ |
| File Metadata | 724 | ไฟล์ต้นทาง 1 + รูปสินค้า 723 ใน `gisp-confidential` |
| Import Rows | 723 | สถานะ `IMPORTED` ทุกแถว |
| Import Errors | 0 | ไม่พบ Structural Import Error |

Storage ตรวจรายการภายใต้ Prefix ของ Import Job ได้ครบ 724 ไฟล์ และสร้าง Signed URL อายุ 5 นาที
สำหรับตัวอย่าง 4 จุดได้ครบ โดยไม่เปิดเผย URL ในหลักฐาน

## กฎ 16 รายการ

- หมวดสินค้า 8 รายการถูกจัดเป็น `EQUIPMENT`, `CHAIR_STOOL`, `TABLE` และ `DECORATIVE`
- ชื่อซ้ำ 6 รายการยังเป็นคนละ Supplier SKU และเพิ่ม Series/Finish ในชื่อแล้ว
- Source Row 173 ใช้ Finish “ตามภาพ” และไม่สร้าง Color Option ปลอม
- Source Row 684 สร้าง Option Value “สีขาว” และคงรายละเอียดโครงสร้างไว้ใน Specification
- Source Row 650 ใช้ชื่อ “โต๊ะข้างทรงแจกัน YCJ-T002” หมวด `TABLE`
- Source Row 696 ใช้ชื่อ “ประติมากรรมม้าขนาดกลาง DY2020” หมวด/ชนิด `DECORATIVE`

## สิ่งที่ยังขาดก่อน Review/Publish

รายการต่อไปนี้ไม่ใช่ Import Error แต่เป็นข้อมูลธุรกิจที่ไม่ควรเดาแทน Supplier หรือเจ้าของระบบ:

| รายการที่ต้องเติม | จำนวน Product |
|---|---:|
| Lead time | 723 |
| Material Summary | 723 |
| มิติ กว้าง × ลึก × สูง ที่ยังแยกไม่ครบ | 53 |
| Active Variant อย่างน้อย 1 รายการ | 438 |
| Active Cost Version | 723 |
| Active Member Price | 723 |

Product Validation จะบล็อก Review/Publish จนกว่าข้อมูลบังคับและราคาที่ผ่าน Formula ครบ จึงไม่มี
Product ใดถูก Publish จาก Import ครั้งนี้

## ความปลอดภัยและการย้อนกลับ

- เพิ่ม Migration `20260818234345_catalog-import-file-guard.sql` ให้ไฟล์ `CATALOG_IMPORT`
  รองรับ XLSX/CSV เฉพาะถัง `gisp-confidential`, Visibility `CONFIDENTIAL` และไม่เกิน 10 MB
- กฎเอกสารสมัครสมาชิกเดิมยังรับเฉพาะ PDF/JPEG/PNG และการทดสอบ Regression ผ่าน
- ไฟล์ Import และรูปทุกไฟล์ใช้ Prefix เฉพาะ Job; มี Manifest, SQL และ Rollback Script แยก
- CLI Import ถูกปฏิเสธก่อนเขียนด้วย `FORBIDDEN`; ตรวจฐานข้อมูลแล้วเป็นศูนย์ทุกตารางก่อนใช้
  Admin SDK ของ Branch พร้อม Rollback อัตโนมัติ และการนำเข้ารอบจริงสำเร็จ

## ขั้นตอนถัดไป

1. ทำ Batch Enrichment/Validation สำหรับ Lead time, Material, 53 มิติ และ 438 Default Variant
2. สร้าง Active Cost Version และคำนวณ Member Price ผ่าน Pricing Engine ที่อนุมัติ
3. ทำ Member-safe Catalog UI/API และ Leakage Test
4. รวมการทดสอบ Slice 2 เป็นชุดเดียวก่อนขอ Human UAT; ยังไม่ Merge/Deploy จนกว่าได้รับอนุมัติแยก
