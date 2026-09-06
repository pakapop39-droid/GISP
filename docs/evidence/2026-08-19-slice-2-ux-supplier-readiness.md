# Slice 2 — UX/UI and Supplier CN01 Readiness Evidence

**วันที่ตรวจ:** 19 สิงหาคม 2569  
**Backend Branch:** `slice-2-catalog`  
**Preview:** `https://kit6y4pj-63e.insforge.site`  
**สถานะ:** Product Lifecycle Functional และ UX/UI UAT ผ่าน; Supplier Import ยังรออนุมัติแยก

## Feedback ที่ได้รับ

- Product Lifecycle ทำงานผ่าน UAT
- Typography เดิมมีบางข้อความเล็กเกินไปและบางหัวข้อใหญ่เกินไป
- หน้าจอ Pricing แบบ 3 คอลัมน์แคบและอ่านยาก
- Product Detail ยังต้องรองรับข้อมูลจากตาราง Supplier โดยเฉพาะ Option และ Option Value

## สิ่งที่แก้

- กำหนด Typography Scale สำหรับหน้าระบบจริงโดยไม่แก้ Demo 1.4
- เปลี่ยน Price Cockpit เป็น 2 คอลัมน์บน Desktop และเรียงแนวตั้งบน Mobile
- เพิ่ม Supplier Source: รหัสสินค้าจาก Supplier, แถวต้นทาง และสเปกต้นฉบับ
- เพิ่ม Product Option และ Option Value พร้อมสถานะ Active/Inactive
- แสดง Factory Cost Delta ด้วยสกุลเงินของ Supplier และ Member Price Delta เป็น THB
- ป้องกัน Direct Table Write; ทุกการแก้ไขผ่าน Trusted Function และ Audit

## ผล Automated Gate

| การตรวจ | ผล |
|---|---|
| Typecheck | ผ่าน |
| Lint | ผ่าน — 0 Error; Warning เดิม 2 จุดในสคริปต์ช่วยงาน |
| Unit Test | ผ่าน — 10 Files, 56/56 Tests |
| Production Build | ผ่าน |
| Branch Integration/Security | ผ่าน — 10/10 Assertions |
| Desktop Browser | ผ่าน — 1600×900 ไม่มี Overflow/Error |
| Mobile Browser | ผ่าน — 390×844 ไม่มี Overflow/Error |
| Browser Console | 0 Error |

## Supplier CN01 Dry-run

ไฟล์ต้นทางถูกแปลงเป็นชุดตรวจสอบแล้ว แต่ยังไม่เขียนเข้าฐานข้อมูลจริง

| รายการ | จำนวน |
|---|---:|
| Products | 723 |
| Variants | 729 |
| Option Values | 965 |
| Images | 723 |
| READY | 707 |
| REVIEW | 16 |

ตรวจ 16 REVIEW แบบอ่านอย่างเดียวแล้ว แบ่งเป็น:

- ต้องตรวจหมวดสินค้า 8 รายการ
- ชื่อสินค้าซ้ำแต่รหัส Supplier ต่างกัน 6 รายการ
- พบข้อความสีแต่แยกตัวเลือกไม่ได้ 2 รายการ

ตรวจรูปฝังในไฟล์ของ Source Row 650 และ 696 แล้ว ทำให้มีกฎแก้ข้อมูลครบทั้ง 16 รายการ
และไม่มีรายการคลุมเครือค้างอยู่
รายละเอียดอยู่ที่ [Supplier CN01 Review Triage](2026-08-19-cn01-review-triage.md)

Dry-run workbook:
`outputs/catalog-import-cn01/gisp-catalog-import-dry-run-cn01.xlsx`

## Boundary

- ยังไม่ Merge เข้า Development
- ยังไม่ Deploy Production
- เจ้าของยืนยัน “หน้าตา Slice 2 ผ่าน” เมื่อ 19 สิงหาคม 2569
- ยังไม่ Import 723 Products จนกว่าเจ้าของอนุมัติกฎแก้ข้อมูลและอนุมัติ Import แยก
- ขั้นถัดไปคือขออนุมัติ Import เป็น Draft แล้วจึงรัน Validation และ Error Report
