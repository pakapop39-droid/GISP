# GISP — Slice 2 Development Plan

**วันที่เริ่ม:** 18 สิงหาคม 2569  
**สถานะ:** `SLICE_2_ACCEPTED — DONE ON DEVELOPMENT`  
**Backend Branch:** `slice-2-catalog` (`schema-only`, merged)  
**ระบบหลักที่ต้องคงสภาพ:** Slice 1 บน Development และ Demo 1.4

## ผลปิดงาน

- Human UAT ผ่านสำหรับชุดสินค้า 6 รายการเมื่อ 22 สิงหาคม 2569
- Merge เข้า Development สำเร็จ `79 additions, 5 modifications, 0 conflicts`
- Development Deployment `d0ae4784-a74d-4580-b828-f2adaccfb341` เป็น `READY`
- ผลการตัดสินคือ `SLICE_2_ACCEPTED`; เหลือ 0 ขั้นตอนเพื่อปิด Slice 2
- Production Release A ยังไม่ได้รับอนุมัติและไม่รวมอยู่ในการปิด Slice ครั้งนี้
- หลักฐาน: [Slice 2 Acceptance](evidence/2026-08-22-slice-2-acceptance.md)

## 1. เป้าหมาย

สร้าง Product และ Supplier Master ที่ใช้ข้อมูลจริงบน InsForge โดยให้ทีม GISP จัดการข้อมูลหลังบ้าน
และให้สมาชิกเห็น Catalog ที่ตัดข้อมูลลับออกตามสิทธิ์

## 2. ขอบเขต Slice 2

- Country, Supplier, Category, Collection และ Tag
- Product, Variant, Option, Option Value, Media และ Document
- Factory Cost และ Currency/Exchange-rate Snapshot
- Price Structure แบบ Version: `Global → Supplier → Product`
- Formula Component/Override แบบเปอร์เซ็นต์หรือยอดคงที่
- Member Price, Suggested Resale และ Freight Estimate
- Material Sample และ Built-in Display
- Partner Warranty Version
- Product Draft, Validation, Review, Publish และ Catalog QA
- Import Excel/CSV เป็น Draft พร้อม Validation และ Error Report
- Admin CRUD และ Member-safe Catalog

## 3. งานที่ยังไม่อยู่ใน Slice 2

- Showroom Visit Request และ Supplier Disclosure Grant — ทำใน Slice 3
- Project, Product Schedule และการนำสินค้าเข้า Project — ทำใน Slice 3
- Custom RFQ/Quotation — ทำใน Slice 4–5
- Order และ Price/Warranty Snapshot ลง Order — ทำใน Slice 6
- AI Catalog Import — Post-MVP

## 4. Work Package

### S2-WP01 — Schema และ Security Foundation

- ตรวจและขยายตาราง Product/Supplier เดิมโดยไม่ทำลายข้อมูล
- เพิ่ม Price Formula Version/Component/Override
- เพิ่ม Collection, Tag, Document, Sample, Warranty และ Import Job/Error
- สร้าง Member-safe projection และ RLS/Permission Matrix
- เพิ่ม Audit สำหรับ Publish, Formula, Cost, Warranty และ Import

สถานะล่าสุด:

- Branch `slice-2-catalog` พร้อมใช้งานแล้ว
- ใช้ Migration `20260818145357_slice-2-catalog-foundation.sql` สำเร็จบน Branch
- เพิ่มตารางใหม่ 15 ตารางและเปิด RLS ครบ 15/15
- Member-safe Catalog ไม่พบคอลัมน์ Supplier/Factory Cost/Formula/Internal Note รั่ว
- เพิ่ม Catalog Permission 8 รายการและผูก Super Admin ครบ 8/8
- Trusted Action/Audit Function และ Pricing Engine API ชุดแรกเสร็จแล้ว
- ใช้ Migration `20260818151117_slice-2-pricing-engine.sql` สำเร็จบน Branch
- Direct Write ไปยัง Formula, Factory Cost และ Calculated Price ถูกปิด ต้องผ่าน Trusted Function
- Admin Product/Supplier/Pricing Workspace รุ่นแรกเสร็จแล้วบน Branch
- ใช้ Migration `20260818152901_slice-2-catalog-actions.sql` สำเร็จบน Branch
- Product Draft แยกออกจากราคา และต้องผ่าน Cost → Formula → Price ตามลำดับ
- Product Detail, Variant/Media, Backend Validation และ Review/Publish Lifecycle เสร็จบน Branch แล้ว
- ใช้ Migration `20260818193000_slice-2-product-lifecycle.sql` สำเร็จบน Branch
- Supplier Source, Product Option และ Option Value เสร็จบน Branch แล้ว
- ใช้ Migration `20260818193001_add-product-options-workflow.sql` สำเร็จบน Branch

### S2-WP02 — Pricing Engine

- Resolve สูตรตามลำดับ Global → Supplier → Product
- Preview และ Activate เฉพาะ `SUPER_ADMIN`
- Decimal Round Half-up 2 ตำแหน่ง
- Test ทุน 100 → Member Price 125 → Suggested Resale 156.25
- Freight Estimate 15–20 แสดงแยกจาก Member Price

สถานะล่าสุด:

- Backend Pricing Engine และ API ชุดแรกเสร็จแล้ว
- รองรับ Component Basis `FACTORY_COST_THB` และ `MEMBER_PRICE`
- Formula ระดับล่าง Override Component Code และสืบทอดรายการอื่นจากระดับบน
- API ครบสำหรับ Formula List/Create/Update/Preview/Activate/Retire,
  Factory Cost Version, Price List และ Calculated Member Price Activation
- Unit Test Pricing ผ่าน 5/5 และ Branch Integration/Security ผ่าน 8/8
- หลักฐานอยู่ที่
  [Slice 2 Pricing Engine Branch Evidence](evidence/2026-08-18-slice-2-pricing-engine.md)
- งานหน้าจอ Formula Builder และ Admin Pricing Workspace อยู่ใน S2-WP03

### S2-WP03 — Admin Product/Supplier Workspace

- Supplier/Country/Category/Collection/Tag CRUD
- Product Draft แบบหลายขั้น พร้อม Variant/Option/Media/Document
- Review, Validation, Publish/Unpublish และ Catalog QA
- Material Sample/Built-in Display และ Warranty Version

สถานะล่าสุด:

- เพิ่มเมนูและ Route จริง `/admin/catalog`
- สร้าง/ดู Supplier และ Product Draft จากฐานข้อมูลจริง
- บันทึก Factory Cost Version, สร้าง Formula Draft, Preview, Activate Formula และ Member Price ได้
- Formula Builder รองรับ Global/Supplier/Product และ Component ที่คำนวณจากต้นทุนหรือราคาสะสม
- Unit Test รวมทั้งโครงการผ่าน 59/59 และ Branch Test ผ่าน 10/10
- หลักฐานอยู่ที่
  [Slice 2 Admin Catalog Workspace Evidence](evidence/2026-08-18-slice-2-admin-catalog-workspace.md)
- Product Detail/Variant/Media และ Review/Publish เสร็จแล้ว; Direct Status/Variant Update ถูกปิด
- รูป/เอกสารเป็น Private และเปิดผ่าน Signed URL; Validation บล็อก Publish เมื่อข้อมูลไม่ครบ
- หลักฐานเพิ่มที่ [Slice 2 Product Lifecycle Evidence](evidence/2026-08-18-slice-2-product-lifecycle.md)
- Product Lifecycle Functional UAT ผ่านแล้ว
- แก้ Typography และ Layout ตาม Feedback: ลดหัวข้อที่ใหญ่เกินไป, เพิ่มข้อความเล็กให้อ่านได้,
  เปลี่ยน Pricing เป็น 2 คอลัมน์ และตรวจ Desktop/Mobile ผ่าน
- เพิ่ม Supplier Source, Option และ Option Value เพื่อรองรับข้อมูล CN01 แล้ว
- เจ้าของยืนยัน “หน้าตา Slice 2 ผ่าน” เมื่อ 19 สิงหาคม 2569; Product Lifecycle UX/UI Sign-off ผ่าน
- งานที่เหลือใน WP03: Collection/Tag, Sample และ Warranty UI

### S2-WP04 — Excel/CSV Import

- Upload Template และสร้าง Import Job
- Validate รายแถวและสร้าง Draft เท่านั้น
- แสดง Error Report และให้ Admin แก้ก่อน Publish

สถานะล่าสุด:

- แปลงไฟล์ Supplier CN01 เป็น Dry-run แล้ว: 723 Products, 729 Variants, 965 Option Values,
  723 Images; 707 READY และ 16 REVIEW
- ตรวจ 16 REVIEW แบบอ่านอย่างเดียวแล้ว: หมวดสินค้า 8, ชื่อซ้ำ 6 และข้อความสี 2
- ตรวจรูป Source Row 650 และ 696 แล้ว ยืนยันว่าเป็นโต๊ะข้างทรงแจกันและประติมากรรมตกแต่ง
  รูปม้าขนาดกลางตามลำดับ; กฎแก้ข้อมูลครบทั้ง 16 รายการ ไม่มีรายการคลุมเครือค้างอยู่
- เจ้าของอนุมัติกฎ CN01 และ Import 723 สินค้าเป็น Draft แล้วเมื่อ 19 สิงหาคม 2569
- Import Job `2b5f864b-267f-480f-aaad-89d2f537623c` สำเร็จบน Branch: 723 Products,
  729 Variants, 654 Product Options, 966 Option Values, 723 Primary Images และ Import Error 0
- Product ทั้งหมดเป็น `DRAFT`; ไม่มีรายการถูก Review หรือ Publish
- Storage มีไฟล์ลับครบ 724 ไฟล์และสร้าง Signed URL ตัวอย่างผ่าน 4/4
- งานถัดไปก่อน Review/Publish: เติม Lead time/Material, แก้ 53 มิติ, สร้าง Default Variant ให้
  438 Product และสร้าง Active Cost/Member Price ผ่าน Pricing Engine
- หลักฐาน: [Supplier CN01 Draft Import](evidence/2026-08-19-cn01-draft-import.md)
- Batch Enrichment/Validation พัฒนาแล้วบน `/admin/catalog/batch` พร้อม Audit/RLS และไม่เขียนทับ
  ค่าที่มีอยู่; Browser ตรวจ CN01 ครบ 723 รายการ
- รองรับสร้าง Cost Version และ Member Price เป็นชุดผ่าน Pricing Engine เท่านั้น
- ยังไม่รันกับ CN01 จนกว่า Lead time, Material Mapping และอัตรา CNY → THB จะได้รับอนุมัติ
- ตารางอนุมัติ CN01 พร้อมแล้ว: 14 Lead-time Rules, 16 Material Candidate Rules,
  FX/Effective Date Input, รายการมิติขาด 53 และ Audit Sheet สินค้า 723 รายการ
- Material Candidate จับคำชัดเจนได้ 481 รายการ; 242 รายการต้อง Enrich เพิ่มและ 134 รายการมีหลายวัสดุ
- มิติ 53 รายการมีข้อเสนอ `ØD × H → D × D × H` 30 รายการ; ที่เหลือ 23 ต้องตรวจด้วยคน
- ยังไม่มี Backend Write จากตารางอนุมัติ และทุก Approval Status เป็น `PENDING`
- หลักฐาน: [CN01 Data Approval Workbook](evidence/2026-08-19-cn01-data-approval-workbook.md)
- หลักฐาน: [Batch and Member Catalog](evidence/2026-08-19-slice-2-batch-member-catalog.md)

### S2-WP05 — Member Catalog และ Gate

- Catalog List/Detail จากข้อมูลจริง
- ปกปิด Factory Cost, Formula, Margin, Internal Note และ Supplier Identity ที่ยังไม่เปิดเผย
- ทดสอบ RLS/API/UI/Export/Direct URL ข้ามสมาชิกและข้ามสิทธิ์
- Automated Gate, Development Merge/Deploy และ Human UAT

สถานะล่าสุด:

- Member Catalog List/Detail และ API พัฒนาแล้วบน `/member/catalog` และ `/member/catalog/[id]`
- ใช้ `member_catalog` safe projection พร้อม explicit serializer และ Signed URL 5 นาที
- Unit Test ป้องกัน Supplier/Cost/Formula/Margin/Internal Field รั่วผ่าน
- Test รวม 64/64, Typecheck, Lint 0 Error และ Production Build ผ่าน
- Admin Role Boundary ตรวจผ่าน; Human UAT ด้วยบัญชี Member จะทำครั้งเดียวหลังมี Product UAT
  ที่ผ่าน Cost/Price/Review/Publish
- รวมเข้า Development แล้ว; การตรวจภายหลังพบว่า Production มี Release A แบบ Staged อยู่แล้ว
  แต่ยังไม่เปิดใช้งานและยังไม่ได้รับ Owner Approval

## 5. Definition of Done

- Import Excel/CSV เป็น Draft พร้อม Error Report ได้
- Product Publish ไม่ได้หากข้อมูลขั้นต่ำหรือ Active Member Price ไม่ครบ
- Super Admin Preview/Activate สูตรได้และมี Audit
- ทุน 100 แสดง Member Price 125 และ Suggested Resale 156.25
- Member เห็นเฉพาะ Member Price, Suggested Resale และ Freight Estimate
- Factory Cost, Formula, Margin, Internal Note และ Supplier Identity ไม่รั่วผ่าน UI/API/Export/URL
- Typecheck, Lint, Unit, Build, Browser E2E และ Branch RLS/Security Test ผ่าน
- Human UAT ผ่านและ Slice 2 เป็น `DONE` บน Development

## 6. Release Boundary

- งานพัฒนาและ UAT ทำบน `slice-2-catalog` และรวมเข้า Development แล้ว
- การปิด Slice 2 ไม่ได้อนุมัติให้เปิดหรือเปลี่ยน Production
- ไม่ลบ `slice-1-access`
- Merge เข้า Development ผ่านแล้วหลัง Automated Gate และ Merge Dry-run
- หลัง Slice 2 ผ่าน Development Human UAT ให้เตรียม Production **Release A — Internal Catalog Operations**
- Release A เปิดเฉพาะเจ้าของระบบและทีมงานภายในเพื่อกรอก Supplier/Product/ราคา/เอกสารจริง
- ยังไม่เปิด Member Pilot จนกว่า Slice 3 UAT ผ่าน
- การเปิด Production Release A ต้องผ่าน Security/Environment Gate และได้รับอนุมัติแยกตาม
  [Staged Production Release Plan](active/STAGED%20PRODUCTION%20RELEASE%20PLAN.md)
