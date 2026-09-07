# Slice 12.1 — Development Acceptance

วันที่ปิดงาน: 6 กันยายน 2569 (2026-09-06)

## ผลตรวจรับ

- Human UAT ผ่าน 7/7 ขั้นตอน
- เจ้าของระบบยืนยันว่า **“ใช้ได้หมด”**
- ผลการตัดสิน: `SLICE_12_1_ACCEPTED`
- สถานะ: `DONE` บน Development

## การรวม Backend และการสำรองข้อมูล

- ต้นทาง: Backend Branch `slice-12-shared-catalog` แบบ schema-only
- Migration: `20260905120600_slice-12-1-customer-browse-catalog.sql` จำนวน 17 Statements
- Full Export ก่อนรวม: `output/backups/pre-slice-12-1-merge-2026-09-06-full.json`
- Backup SHA-256: `210C75A5097E2116A28DF27C1FAA1FBE5D3F211308FB5870697FB2409BAA43C6`
- Migration Runner ปกติถูก PostgreSQL ปฏิเสธเพราะตาราง Slice 12 เดิมเป็นเจ้าของโดย `postgres`
- จึงใช้ PostgreSQL Transaction ด้วยเจ้าของตารางกับ Migration เดิมทุก Statement และบันทึก Migration History เดิมจาก Branch
- ตรวจ Schema หลังรวมตรงกับ Branch; Dry-run เหลือเฉพาะ Migration History three-way conflict 1 รายการ และไม่มี Schema/Data Diff
- แจ้ง InsForge เรื่อง Migration Runner แล้ว: `aa2400ef-6f84-41ac-ba33-f8016278337d`
- หลักฐาน Dry-run ก่อน/หลัง: [merge dry-run](2026-09-06-slice-12-1-merge-dry-run.sql) และ
  [merge ready](2026-09-06-slice-12-1-merge-ready.sql)

## Quality Gate

- Lint: PASS
- Typecheck: PASS
- Unit Test: 40 Test Files / 162 Tests PASS
- Production Build: 118 Pages PASS
- Branch Hosted Integration/RLS/Security: 69 Assertions PASS
- Development Post-merge Smoke: 54 Assertions PASS
- Scope ที่ตรวจ: `PRODUCT`, `PROJECT`, `CURATED`, `FULL_CATALOG`
- Full Catalog ตรวจด้วยสินค้าพร้อมขาย 635 รายการ ระบบอ่านข้อมูลเป็นชุดย่อยและเปิดหน้าได้
- Public Payload ไม่มีราคา Currency Supplier Factory Cost Formula Internal Note หรือข้อมูล Project ภายใน
- `Cache-Control: no-store`, Token ผิดเป็น 404 และ Product Detail ตรวจสิทธิ์ตาม Token
- Fixture หลัง Smoke เหลือ 0; Append-only Trigger ทั้ง 3 รายการอยู่สถานะ Enabled

## Development Deployment

- URL: `https://kit6y4pj.insforge.site`
- Deployment ID ล่าสุด: `526c7cf7-1354-42b1-92c6-e25cfad92f09`
- Status: `READY`
- Feature Flag: Shared Catalog เปิด; Product Sourcing และ Post-go-live Feature ปิด
- หลังรับข้อสังเกตจาก Owner ปรับหน้า Member ให้เห็น “หน้ารวมสินค้าทั้งหมดของฉัน” เป็นการ์ดหลัก
  พร้อม Prefill ชื่อบริษัท/ผู้ติดต่อ และข้อความยืนยันว่าลิงก์ผูกกับ Member ผู้สร้าง
- แก้กรณีกดสร้างแล้ว API ตอบ 500: PostgREST ยังใช้ Schema Cache เก่าและรายงาน `PGRST202`
  แม้ Function/ACL อยู่ครบ จึงสั่ง Reload Schema Cache และยืนยันผ่าน PostgREST ด้วย Role Member
- ปุ่ม “สร้างลิงก์ของฉัน” สร้าง Full Catalog Draft ทันที แสดงสถานะกำลังสร้าง และเปิดหน้าแก้ไขต่อ
- Browser Verification บัญชี Member จริงผ่าน และ Post-merge Smoke 54 Assertions ผ่านซ้ำหลัง Deploy
- Production Release A ไม่ถูก Deploy หรือเปลี่ยนค่า

## สถานะสุดท้าย

คงเหลือ 0 ขั้นตอนเพื่อปิด Slice 12.1
