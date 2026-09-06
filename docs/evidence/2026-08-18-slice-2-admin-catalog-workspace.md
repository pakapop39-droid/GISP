# Slice 2 Admin Catalog Workspace — Branch Evidence

**วันที่ตรวจ:** 18 สิงหาคม 2569  
**Backend Branch:** `slice-2-catalog` (`schema-only`)  
**Production:** ไม่มีการเปลี่ยนแปลง

## สิ่งที่พัฒนา

- Migration `20260818152901_slice-2-catalog-actions.sql`
- Trusted Action สำหรับสร้าง Supplier Prospect และ Product Draft
- Product Draft ไม่สร้าง Member Price ก่อนมีต้นทุนและสูตร
- API รายการ/สร้าง Supplier, Product และ Catalog Options
- Admin Route `/admin/catalog` และเมนู `Catalog & Pricing`
- Workflow บนหน้าจอ: `Supplier → Product Draft → Factory Cost → Formula Preview → Member Price`
- Formula Builder รองรับ Global/Supplier/Product, Component เปอร์เซ็นต์หรือจำนวนเงิน,
  Preview, Activate Formula และ Activate Member Price
- หน้าจอรักษารูปแบบ Demo 1.4 และใช้ระยะบรรทัดแบบกระชับที่ผู้ใช้อนุมัติ

## ผลตรวจอัตโนมัติ

| การตรวจ | ผล |
|---|---|
| Catalog Schema Unit Test | ผ่าน 4/4 |
| Test ทั้งโครงการ | ผ่าน 52/52, 10 Test Files |
| Branch Pricing/Catalog Integration & Security | ผ่าน 8/8 |
| Typecheck | ผ่าน |
| Lint | 0 Error; Warning เดิมนอก Application 2 จุด |
| Production Build | ผ่าน; `/admin/catalog` และ API ใหม่ถูกรวมครบ |
| Protected Route Browser Check | ผ่าน; ผู้ไม่ Login ถูกส่งไป `/login?next=/admin/catalog` |

## Branch Assertions 8 รายการ

1. Product Draft ถูกสร้างโดยไม่มี Member Price ก่อนเวลา
2. ทุน 100 คำนวณ Member Price 125, Suggested Resale 156.25 และ Freight 15–20
3. Active Member เห็น Calculated Member Price
4. Member Catalog ไม่ส่ง Factory Cost, Formula, Margin หรือ Supplier Identity
5. RLS ปิด Direct Read ตาราง Formula และ Factory Cost จาก Member
6. Member เรียก Confidential Pricing Preview ไม่ได้
7. Direct Update Formula และ Calculated Price ถูกปฏิเสธ
8. Formula Activation และ Calculated Price Activation สร้าง Audit Event

## ขอบเขตผลตรวจ

หลักฐานนี้ยืนยัน Admin Catalog/Pricing Workspace รุ่นแรกบน Branch เท่านั้น งาน Product Detail,
Variant/Media, Review/Publish, Import และ Member Catalog UI ยังอยู่ใน Work Package ถัดไป
และยังไม่อนุญาต Merge หรือ Production Deployment
