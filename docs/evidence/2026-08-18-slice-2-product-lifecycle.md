# Slice 2 Product Lifecycle — Branch Evidence

**วันที่ตรวจ:** 18 สิงหาคม 2569  
**Backend Branch:** `slice-2-catalog` (`schema-only`)  
**Production:** ไม่มีการเปลี่ยนแปลง

## สิ่งที่พัฒนา

- Migration `20260818193000_slice-2-product-lifecycle.sql`
- Product Detail แบบข้อมูลจริง ครอบคลุมชื่อ, Supplier/Category, รายละเอียด, Specification,
  ประเทศ, Lead Time, ขนาด, น้ำหนัก, CBM, Material, Finish, MOQ และข้อมูลอ้างอิง
- Variant สร้าง/แก้ไข/พักใช้ โดยทุกการเปลี่ยนผ่าน Trusted Function และ Audit
- รูปสินค้า Private ใน `gisp-confidential` รองรับ JPEG/PNG/WebP ไม่เกิน 10 MB,
  สูงสุด 12 รูป และกำหนดรูปหลักได้
- เอกสารสินค้า Private รองรับ PDF ไม่เกิน 10 MB สูงสุด 10 ไฟล์ และเปิดผ่าน Signed URL 5 นาที
- Backend Validation ตรวจ Master Data, Active Supplier, Variant, Primary Image, Active Cost และ Active Price
- Workflow บังคับ `DRAFT → REVIEW → PASSED → PUBLISHED`; การแก้ข้อมูลหลังส่ง Review จะกลับเป็น Draft
- Review/Publish ใช้สิทธิ์ `catalog.publish`; การแก้ status โดยตรงถูกปิด
- Route จริง `/admin/catalog/products/[id]` พร้อมหน้า Detail, Variant, File และ Review/Publish

## ผลตรวจอัตโนมัติ

| การตรวจ | ผล |
|---|---|
| Unit Test ทั้งโครงการ | ผ่าน 54/54, 10 Test Files |
| Slice 2 Branch Integration/RLS/Security | ผ่าน 9/9 Assertions |
| Typecheck | ผ่าน |
| Lint | 0 Error; Warning เดิมนอก Application 2 จุด |
| Production Build | ผ่าน; Route Product Detail และ API ใหม่ครบ |
| Branch Preview Smoke Test | ผ่าน; Health `ok`, Login 200 และ Authenticated Catalog 200 |

**Branch Preview:** `https://kit6y4pj-63e.insforge.site`  
**Deployment ID:** `29d08337-33fa-4f05-ad18-da90f0c8e986`

## Branch Assertions 9 รายการ

1. Product Draft ไม่สร้างราคาเร็วเกินไป
2. Pricing Example 100 → 125 → 156.25 และ Freight 15–20 ถูกต้อง
3. Product Detail, Variant, Private Image, Cost และ Price ครบจึงพร้อม Review
4. Active Member เห็นราคาสมาชิกที่คำนวณแล้ว
5. Member Catalog ไม่ส่ง Cost, Formula, Margin หรือ Supplier Identity
6. RLS ปิด Direct Read Formula และ Factory Cost จาก Member
7. Member เรียก Confidential Pricing Preview ไม่ได้
8. Direct Update Formula, Price, Product Status และ Variant ถูกปฏิเสธ
9. Pricing, Review และ Publish Transition สร้าง Append-only Audit

## ขอบเขตผลตรวจ

หลักฐานนี้ยืนยัน Product Detail/Variant/Media/Validation/Review/Publish บน Branch เท่านั้น
ยังไม่ใช่ Human UAT ทั้ง Slice 2 และยังไม่อนุญาต Merge หรือ Production Deployment
Branch Preview ใช้เพื่อ Product Lifecycle UAT เท่านั้น
