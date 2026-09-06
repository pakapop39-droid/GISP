# GISP — Product Lifecycle UAT (ทดสอบครั้งเดียวเป็นชุด)

**ขอบเขต:** Product Detail, Variant, รูป/เอกสาร, Validation, Review และ Publish  
**จำนวนรอบที่วางแผน:** 1 รอบ  
**เวลาประมาณ:** 15–20 นาที

**หน้า Branch Preview:** `https://kit6y4pj-63e.insforge.site`  
หน้านี้แยกจาก Development และ Production ใช้เฉพาะ UAT ชุดนี้

## ข้อมูลที่ควรเตรียม

- รูปสินค้า JPEG, PNG หรือ WebP จำนวน 1 รูป ไม่เกิน 10 MB
- เอกสารสินค้า PDF จำนวน 1 ไฟล์ ไม่เกิน 10 MB
- ข้อมูลสินค้า เช่น ชื่อ, หมวด, ขนาด, วัสดุ, Lead time และ MOQ

## ชุดทดสอบเดียว

1. เข้า `Catalog & Pricing` แล้วสร้าง Product Draft
2. เปิด Product Detail กรอกข้อมูลที่มีเครื่องหมาย `*` และบันทึก
3. เพิ่ม Variant อย่างน้อย 1 รายการ
4. อัปโหลดรูป 1 รูป ตั้งเป็นรูปหลัก และอัปโหลด PDF 1 ไฟล์ จากนั้นลองเปิด PDF
5. กลับไป `Catalog & Pricing → Cost & Formula` เลือกสินค้านี้ บันทึก Factory Cost,
   เลือก Formula ที่ Active แล้วกดเปิดใช้ราคาสมาชิก
6. กลับเข้า Product Detail → `Review / Publish` ตรวจว่ารายการที่ขาดเป็นศูนย์ จากนั้นกด
   `ส่งเข้าตรวจ → ผ่าน Review → Publish Product`

## ผลที่ถือว่าผ่าน

- Product เปลี่ยนสถานะ `DRAFT → REVIEW → PUBLISHED`
- QA เปลี่ยนเป็น `PASSED` ก่อน Publish
- รูปหลักแสดงถูกต้อง และ PDF เปิดผ่านลิงก์ชั่วคราวได้
- หากข้อมูลขาด ปุ่มส่ง Review/Publish ต้องกดไม่ได้และระบบบอกจุดที่ต้องแก้
- ไม่มีหน้าจอแสดง Factory Cost, Formula หรือข้อมูลลับให้บัญชี Member

เมื่อผ่านครบ ให้แจ้งเพียงข้อความเดียวว่า **“Product Lifecycle UAT ผ่าน”**
ถ้าพบปัญหา ให้ส่งภาพหน้าจอและบอกว่าหยุดที่ข้อใด ระบบจะรวบแก้เป็นชุดเดียวก่อนขอทดสอบซ้ำ
