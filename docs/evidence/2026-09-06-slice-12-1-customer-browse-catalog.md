# Slice 12.1 — Customer Browse Catalog Engineering Evidence

วันที่ตรวจ: 6 กันยายน 2569 (2026-09-06)

## ขอบเขตที่ตรวจแล้ว

- ลิงก์ 4 แบบ: `PRODUCT`, `PROJECT`, `CURATED`, `FULL_CATALOG`
- หน้า Public ไม่มีราคาและไม่มีข้อมูลภายใน
- Product/Project/Curated สร้าง Snapshot ตอน Publish
- Full Catalog อ่านสินค้าที่พร้อมขายแบบ Live Public-safe พร้อม Search, Category และ Server Pagination
- Interest List เก็บใน `localStorage` ของ Browser และสร้างข้อความสำหรับติดต่อ Member
- Token Lifecycle: Expired, Revoked, Rotated และ Token ผิด
- Private Image ใช้ Signed URL หลังตรวจลิงก์
- Cross-member RLS ป้องกันการอ่านและแก้ข้อมูลข้ามบริษัท

## Backend และ Deployment

- Backend Branch: `slice-12-shared-catalog` แบบ schema-only
- Migration: `20260905120600_slice-12-1-customer-browse-catalog.sql`
- Preview URL: `https://kit6y4pj-hm4.insforge.site`
- Deployment ID: `686904bf-8744-4f70-957f-3547def36895`
- Deployment Status: `READY`
- Feature Flag: Shared Catalog เปิด; Product Sourcing และ Post-go-live รวมปิด
- Production Release A ไม่ถูก Deploy หรือเปลี่ยนค่า

## ผล Automated Gate

- Lint: PASS
- Typecheck: PASS
- Unit Test: 40 Test Files / 162 Tests PASS
- Production Build: 118 Pages PASS
- Hosted Integration/RLS/Security: 69 Assertions PASS
- Public Item Detail API ตรวจ Token/สถานะ/วันหมดอายุ, ปฏิเสธสินค้านอก Catalog และไม่มีข้อมูลราคา: PASS
- Public Response: `Cache-Control: no-store` และไม่มี Price/Currency/Member Price/Supplier/Factory Cost/Formula/Internal Note
- Snapshot Stability, Full Catalog Live Contract, Project Privacy, Signed Image และ Append-only Event: PASS

## ผล Browser Gate

- Mobile 390×844: Layout, Search, Empty State, Product Detail, Interest List และ Contact CTA PASS
- Desktop: Layout และ Public Catalog Flow PASS
- ตรวจลิงก์ Curated และ Full Catalog บน Deployment จริง
- ระหว่างตรวจพบ Contrast ปุ่ม Public ไม่ชัดเพราะขาด Theme Scope; เพิ่ม `v14-app`, Build/Deploy และตรวจซ้ำแล้ว PASS
- ไม่มีราคาแสดงใน Accessibility Tree หรือหน้าจอลูกค้า

## สถานะ

`DONE ON DEVELOPMENT`

- Human UAT: `PASS 7/7`; เจ้าของระบบยืนยันว่า **“ใช้ได้หมด”** เมื่อ 6 กันยายน 2569
- Development Deployment ล่าสุด: `526c7cf7-1354-42b1-92c6-e25cfad92f09` (`READY`)
- UX Follow-up: แสดงการ์ด “หน้ารวมสินค้าทั้งหมดของฉัน” โดยตรงและ Prefill Branding/Contact จาก Member Profile
- Post-merge Smoke: 54 Assertions ผ่านครบทั้ง 4 Scope
- Full Catalog ตรวจด้วยสินค้าพร้อมขาย 635 รายการและแก้การอ่านข้อมูลเป็นชุดย่อยแล้ว
- Fixture หลังทดสอบเหลือ 0 และ Append-only Trigger ทั้ง 3 รายการอยู่สถานะ Enabled
- หลักฐาน Development Acceptance: [2026-09-06-slice-12-1-development-acceptance.md](2026-09-06-slice-12-1-development-acceptance.md)
- Production Release A ไม่ถูกเปลี่ยน

คงเหลือ 0 ขั้นตอนเพื่อปิด Slice 12.1
