# Slice 12.1 — Customer Browse Catalog

**สถานะ:** `DONE ON DEVELOPMENT`  
**วันที่:** 6 กันยายน 2569 (2026-09-06)  
**Decision:** DEC-061 / DEC-062  
**ฐานเดิม:** Slice 12 — Member Shared Catalog (`DONE` บน Development)

## 1. เป้าหมาย

ให้ Member ส่งลิงก์ที่มี Branding และช่องทางติดต่อของตนให้ลูกค้าเปิดดูสินค้าได้โดยไม่ต้องสมัครสมาชิก
หน้า Public ต้องไม่มีราคา ลูกค้าค้นหา เลือกหมวด เปิดรายละเอียด และเก็บรายการที่สนใจหลายรายการไว้ใน
Browser ก่อนติดต่อ Member ผ่าน LINE โทรศัพท์ หรืออีเมล

Member สร้างลิงก์ได้ 4 แบบ:

1. **สินค้ารายชิ้น** — เปิดตรงไปยังรายละเอียดสินค้าหนึ่งรายการ
2. **สินค้าในโครงการ** — แสดงเฉพาะสินค้าที่ Member เลือกไว้ใน Project และจัดกลุ่มตามพื้นที่ได้
3. **Catalog ที่คัดเอง** — ใช้ Shared Catalog เดิมที่ Member เลือกและจัดลำดับสินค้าเอง
4. **สินค้าทั้งหมด** — ให้ลูกค้าค้นหาและเลือกจากสินค้าที่พร้อมขายทั้งหมด แยกตามหมวด

## 2. กติกาที่ล็อกแล้ว

- หน้า Public และ Public API ไม่ส่งหรือแสดงราคาใด ๆ รวมถึง Customer Price, Member Price,
  Suggested Resale, Freight Estimate, Factory Cost, Margin และ Formula
- กติกาไม่แสดงราคาแทนที่เฉพาะส่วนการแสดงราคาลูกค้าใน DEC-056; Snapshot ราคาเดิมเก็บเป็น
  ประวัติภายในได้ แต่ห้ามออก Public API หรือ Public UI
- สินค้าที่แสดงต้องเป็น `PUBLISHED` และมี Active Member Price เพื่อให้ตรงกับสินค้าที่ Member เลือกได้
- ลิงก์ Project รุ่นแรกแสดงเฉพาะ Standard Product ที่ผ่านเงื่อนไขข้างต้น; Custom/Manual Item
  ที่ยังไม่เป็น Product พร้อมขายจะถูกข้ามและแจ้ง Member ในหน้า Preview
- ลิงก์แบบสินค้ารายชิ้น โครงการ และ Catalog ที่คัดเองใช้ Snapshot เมื่อ Publish
- ลิงก์สินค้าทั้งหมดใช้รายการสินค้าแบบ Live Public-safe เพื่อให้สินค้าใหม่และหมวดใหม่ปรากฏได้โดยไม่ต้อง
  Snapshot หลายร้อยรายการ แต่ Branding, Contact และการตั้งค่าลิงก์ยัง Snapshot ตอน Publish
- สินค้าที่เลิกขายหลัง Publish ยังคงอยู่ใน Snapshot และแสดง “กรุณาสอบถามความพร้อม”
- Project Snapshot ส่งเฉพาะข้อมูลสินค้า สเปก ตัวเลือก และชื่อพื้นที่ที่ Member อนุญาต ห้ามส่งชื่อลูกค้า
  ที่อยู่หน้างาน จำนวน ราคา สถานะออเดอร์ Supplier หรืองานภายใน
- รายการที่ลูกค้าสนใจเก็บใน `localStorage` ของ Browser เท่านั้น รุ่นแรกไม่สร้าง Lead ไม่เก็บข้อมูลลูกค้า
  และไม่มี Checkout
- ปุ่มติดต่อสร้างข้อความสรุปรายการสินค้าให้คัดลอกหรือใส่ในอีเมลล่วงหน้า แล้วเปิดช่องทางที่ Member ยืนยันไว้
- ลิงก์ใช้ Token สุ่ม อายุเริ่มต้น 30 วัน เลือกไม่หมดอายุได้ และรองรับ Revoke, Extend และ Rotate
- Public Page ใช้ `noindex, nofollow, noarchive` และ `Cache-Control: no-store`
- รูปยังอยู่ใน Private Storage และออก Signed URL อายุ 5 นาทีหลังตรวจ Token/สถานะ/วันหมดอายุ
- Production Release A ไม่เปลี่ยน งานนี้เตรียมสำหรับ Development และ Release B เท่านั้น

## 3. แนวทางข้อมูล

ต่อยอดตาราง Slice 12 เดิมเพื่อลดระบบ Token และ Lifecycle ที่ซ้ำกัน:

- เพิ่ม `scope_type` ใน `shared_catalogs` และ `shared_catalog_versions`:
  `CURATED`, `PRODUCT`, `PROJECT`, `FULL_CATALOG`
- เพิ่ม `source_product_id` และ `source_project_id` โดยใช้ Trusted Function ตรวจว่าเป็นข้อมูลของ Member
- เพิ่ม Snapshot เฉพาะ Project ที่จำเป็น เช่น `project_area_name` และ `selected_options`
- `FULL_CATALOG` ไม่มี Item Snapshot; Public Loader อ่านเฉพาะ Product ที่ผ่าน Public-safe Eligibility
- Version และ Event เดิมยังเป็น Append-only; Owner, Organization, Token, Current Version และ Status
  แก้จาก Client ตรงไม่ได้
- Migration ต้องกำหนด Catalog เดิมทั้งหมดเป็น `CURATED` และบังคับ Public Projection เป็นไม่มีราคา

## 4. API

### Member

- ขยาย `POST /api/member/shared-catalogs` ให้รับ `scopeType` และ `sourceId` ตามชนิดลิงก์
- ขยาย `GET/PATCH /api/member/shared-catalogs/[id]` สำหรับชื่อ คำแนะนำ Branding Contact และ Expiry
- ใช้ Action เดิมสำหรับ Publish, Revoke, Extend และ Rotate Link
- เพิ่ม Preview ที่คืน Payload แบบเดียวกับ Public โดยไม่มีราคา
- Project และ Product API ส่งเฉพาะข้อมูลที่จำเป็นให้ Member สร้างลิงก์จากหน้าปัจจุบัน

### Public

- `GET /api/public/catalogs/[token]?search=&categoryId=&page=&pageSize=`
- `GET /api/public/catalogs/[token]/items/[itemId]`
- ทุก Request ตรวจ Token, `PUBLISHED`, Expiry และ Current Version ก่อนอ่านข้อมูลหรือสร้าง Signed URL
- รายการ Full Catalog ใช้ Pagination ฝั่ง Server เพื่อไม่สร้าง Signed URL ให้สินค้าหลายร้อยรายการพร้อมกัน
- Public Response ใช้ Allow-list Serializer และมี Test ป้องกันข้อมูลภายในหลุดทุกระดับของ Object

## 5. หน้าจอ

### Member

- เพิ่มปุ่ม **“ส่งให้ลูกค้าดู”** ที่หน้าสินค้า หน้ารายละเอียด Project และหน้า Member Catalog
- Dialog ให้เลือกชนิดลิงก์ ตั้งชื่อ ข้อความแนะนำ วันหมดอายุ Branding และ Contact
- หน้า “Catalog ของฉัน” แสดงชนิดลิงก์ สถานะ วันหมดอายุ และปุ่ม Preview/Copy/Extend/Rotate/Revoke
- เอาช่องกำหนดราคาและข้อความราคาบน Customer Catalog ออกจาก Flow ใหม่
- ก่อน Publish แสดงคำยืนยันว่า “ลูกค้าจะไม่เห็นราคาและข้อมูลภายใน”

### ลูกค้า

- ใช้ `/catalog/share/[token]` เดิมและปรับ Layout ตาม `scopeType`
- Header แสดงชื่อ/โลโก้ Member คำแนะนำ และปุ่มติดต่อ
- Full Catalog มี Search, หมวดสินค้า, Pagination และ Empty State
- Project แสดงสินค้าแยกกลุ่มตามพื้นที่เมื่อมีข้อมูลพื้นที่ที่อนุญาต
- Product Card เปิดหน้ารายละเอียด และมีปุ่ม “สนใจรายการนี้”
- แถบ “รายการที่สนใจ” แสดงจำนวนรายการ แก้ไข/ล้างได้ และสร้างข้อความสรุปสำหรับติดต่อ Member
- Mobile-first, Touch Target อย่างน้อย 44×44px และรองรับ Keyboard/Screen Reader ขั้นพื้นฐาน

## 6. การทดสอบและ UAT

- Member สองบริษัทอ่าน แก้ Publish หรือ Rotate ลิงก์ข้ามกันไม่ได้
- ทดสอบลิงก์ทั้ง 4 แบบในสถานะ Published, Expired, Revoked, Rotated และ Token ผิด
- ยืนยัน Public API/UI/HTML ไม่มีราคา Supplier Cost Formula Internal Note Project Customer และ Site Address
- ยืนยัน Snapshot ของ Product/Project/Curated ไม่เปลี่ยนจน Publish ใหม่
- ยืนยัน Full Catalog เห็นสินค้า/หมวดใหม่แบบ Live และซ่อนสินค้าที่ไม่ผ่าน Eligibility
- ทดสอบ Search, Category, Pagination, Product Detail และ Signed URL หมดอายุ
- ทดสอบ Interest List เพิ่ม/ลบ/ล้าง/Reload และข้อความติดต่อ LINE/Email โดยไม่สร้างข้อมูลลูกค้าใน Backend
- ผ่าน Typecheck, Unit Test, Integration/RLS Test, Production Build, Responsive Browser Test และ Human UAT

## 7. ลำดับดำเนินงานและเกณฑ์ปิด Slice

1. **Backend และ Security Gate — ผ่าน:** Migration, Trusted Function, RLS, Public-safe API และ Automated Test
2. **Member Flow — ผ่าน:** ปุ่มสร้างลิงก์ 3 จุด, Preview และ Link Management
3. **Public Browse Flow — ผ่าน:** 4 Layout, Search/Category/Detail, Interest List และ Contact CTA
4. **Development Acceptance — ผ่าน:** Human UAT 7/7, Owner Sign-off, Schema/Migration Integration,
   Development Deployment ล่าสุด `15cf9ce5-e135-4541-9f78-ccd5059a12db` และ Post-merge Smoke 54 Assertions ผ่าน

**คงเหลือ 0 ขั้นตอนเพื่อปิด Slice 12.1**

## 8. Dependency และลำดับกับ Slice 13

Owner ระบุให้ทำ Slice 12.1 ก่อน จึงใช้ Backend Branch `slice-12-shared-catalog` เดิมแบบ `schema-only`
ซึ่งมีฐาน Slice 12 อยู่แล้ว โดยไม่ลบ `slice-8-shipment-delivery` และไม่เปลี่ยน Production Release A
Development พร้อมใช้งานที่ `https://kit6y4pj.insforge.site`; Production Release A ไม่เปลี่ยน
