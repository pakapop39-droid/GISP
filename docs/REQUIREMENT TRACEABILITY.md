# GISP MVP Requirement Traceability

**Document Version:** 1.6  
**Reconciled:** 6 September 2026  
**Authority:** `active/MVP BUSINESS MASTER PLAN.md` → `active/DECISION LOG.md` → `active/MVP IMPLEMENTATION PLAN.md` → เอกสารฉบับนี้

เอกสารนี้ใช้ตรวจว่า Approved Decision แต่ละข้อจะถูกนำไปวางไว้ตรงไหนในโค้ดและฐานข้อมูล ไม่ใช่เอกสารกำหนด Business Rule ฉบับใหม่ ช่อง Implementation ด้านล่างคือเป้าหมายของ MVP Build; Demo 1.4 พัฒนาเป็น Browser-local Prototype และ Deploy แล้ว แต่ยังไม่ใช่ Migration/API ของ App จริง

| Approved requirement | Implementation | Verification |
|---|---|---|
| Next.js + TypeScript บน InsForge Frontend Deployments | `src/app`, `next.config.ts`, InsForge deployment configuration | `npm run typecheck`, `npm run build`, InsForge deployment status |
| InsForge Auth แบบ Email + Password | `src/lib/insforge`, `/api/auth/*`, `proxy.ts` | Auth route และ SSR session check |
| App User ไม่เก็บ Password | `public.users` ใน Foundation Migration เชื่อม `auth.users` | Schema review และ RLS test เมื่อเชื่อม InsForge |
| Organization, Multi-role สำหรับทีมงาน GISP, Permission, RLS | Foundation Migration + Backend RPC Guard | Permission/RLS integration test บน InsForge Development |
| หนึ่ง Member Profile ต่อหนึ่ง Login; ไม่มี Member Team/Sub-user/Team Invitation | Member profile uniqueness + Auth/Member API โดยไม่มี Team endpoint | Schema/API search, duplicate-profile denial และ UAT shared-account audit |
| Public / Member-private / Confidential Storage | Storage Migration และ File Metadata | Signed URL และ cross-organization access test |
| Standard Product ข้าม RFQ | Catalog/Project RPC และ `READY_TO_ORDER` | Standard E2E scenario |
| Custom RFQ และ Versioned Quotation | Catalog/Quotation Migration + Member/Admin API | Custom quotation acceptance scenario |
| Accepted Quotation ล็อก Snapshot | `respond_custom_quotation` และ immutable trigger | Revision/immutability integration test |
| VAT Snapshot และ Decimal Round Half-up | Money helper + quotation/order/payment columns | Unit test และ snapshot integration test |
| Price Structure Builder แบบ Version: Global → Supplier → Product | Formula version/component/override/snapshot schema + Super Admin action API + `PRICE-004` | Preview ทุน 100 ได้ Member Price 125 และ Suggested Resale 156.25; role/audit/effective-date test |
| Member-safe Pricing และ Suggested Resale เป็นข้อมูลแนะนำเท่านั้น | Member-safe serializer/view ตัด Factory Cost, Formula และ Margin; Catalog/Project/Schedule/Export แสดง RRP | Field-leak test และยืนยัน Order/Invoice/Payment ไม่ใช้ Suggested Resale คำนวณ |
| Freight Estimate 15–20% ของทุนหลังแปลงบาท; Actual Freight และ VAT แยก | Calculation snapshot + catalog display + freight payment schedule | Formula test, display test และ regression payment/VAT |
| Deposit/Balance 50/50 + Partial Payment | Order/Operations Migration + payment APIs | Unit test และ partial/reject/resubmit scenarios |
| Freight แยกภายหลัง | Payment Schedule Type และ Order workflow | Standard E2E scenario |
| PO Gate และ Dispatch Gate | Trusted action functions ใน Operations Migration | Direct status mutation denial + gate scenarios |
| In-App + Email Retry โดยไม่ Rollback งานหลัก | Notification Outbox + InsForge Schedule | Failure/retry/dead-letter integration test |
| Fixed Basic Reports | `get_basic_dashboard_summary` + report repository/API | Report permission and result test |
| Material Swatch และ Built-in Display เท่านั้น | Sample type/location schema + Admin sample UI | Catalog/UAT แสดงผ้า ไม้ หิน ฯลฯ และไม่ใช้เฟอร์นิเจอร์ทั่วไปเป็น Sample |
| Factory Privacy และ Visit Disclosure ต่อ Member Profile + Supplier | Visit request + disclosure grant schema, member-safe serializer และ action endpoints | ก่อน `COMPLETED` ต้องไม่รั่วชื่อ/ที่อยู่/contact/Supplier ID; หลัง Complete เปิดเฉพาะสมาชิกนั้น; revoke audit test |
| Partner Warranty Version/Snapshot และ Claim Responsibility | Warranty version/order-item snapshot + suggested/confirmed responsibility fields | Snapshot immutability และ UAT Supplier/Logistics-or-Insurance/Installer โดย Order Admin ยืนยัน |
| Commission/Advanced BI/AI/Generic Task เป็น Post-MVP | Decision Log และไม่มี Core Migration/API/UI | Source/schema/API search |
| Demo 1.3 เป็น Baseline ที่ Deploy เดิม | `gisp-mvp-demo` ที่ใช้ Browser-local State Schema Version 3 | เก็บเป็นหลักฐานย้อนหลัง; ไม่ใช้อนุมัติข้อกำหนดใหม่แทน Demo 1.4 |
| Demo Gate ใหม่ใช้ Target Demo Application 1.4 | `/v1-4/member`, `/v1-4/admin`, `/v1-4/overview` และ Shared State Schema 4 ตาม `active/DEMO STORY AND MOCK DATA.md` | ผ่าน Human UAT 8/8 และ GISP Admin Sign-off เมื่อ 18 สิงหาคม 2569; หลักฐาน `evidence/2026-08-18-demo-1.4-uat-signoff.pdf` |
| Slice 1: Login, บริษัท, ผู้ใช้และสิทธิ์ | `/member/*`, `/admin/*`, `/api/auth/*`, Member/Admin/Foundation API และ Slice 1 migrations | Automated Gate + Human UAT ผ่าน; `SLICE_1_ACCEPTED` เมื่อ 18 สิงหาคม 2569; หลักฐาน `../output/pdf/2026-08-18-gisp-slice-1-uat-signoff.pdf` |
| Slice 2: Product และ Supplier Master | `/admin/catalog/*`, `/member/catalog/*`, Pricing Engine, Product Lifecycle, Batch, General Import และ Member-safe Catalog | Automated/Integration/Browser + Human UAT ผ่าน; `SLICE_2_ACCEPTED` เมื่อ 22 สิงหาคม 2569; หลักฐาน `evidence/2026-08-22-slice-2-acceptance.md` |
| Slice 4: Custom RFQ | `/member/custom-requests/*`, `/admin/custom-requests/*`, Aggregate RPC, File Version, Assignment, Candidate, Internal Note และ Append-only History | Automated/Integration/Browser E2E + Human UAT + Post-merge Smoke ผ่าน; `SLICE_4_ACCEPTED` เมื่อ 26 สิงหาคม 2569; หลักฐาน `evidence/2026-08-26-slice-4-custom-rfq.md` |
| Account Recovery/Suspension, Catalog Import และ Cancellation เป็น Core | Auth/Catalog/Order Slice ที่เกี่ยวข้อง | Integration/UAT ตาม Slice |
| Supplier Payment 50/50 และ Freight Verification เป็น Core | Finance/Operations Slice ที่เกี่ยวข้อง | Dispatch/Freight E2E |
| Canonical State/Number/Production Role | Decision Log + Implementation Plan Version 1.6 | Schema/API/UI contract review |
| Slice 12: Member Shared Catalog ตาม DEC-056 | `shared_catalogs`, draft items, append-only versions/events, `/api/member/shared-catalogs/*`, `/api/public/catalogs/[token]`, `/member/shared-catalogs/*`, `/catalog/share/[token]` | Snapshot stability, token expiry/revoke/rotate, public field-leak test, signed URL, two-member RLS, responsive และ Human UAT |
| Slice 12.1: Customer Browse Catalog ตาม DEC-061 | ขยาย `shared_catalogs/versions/version_items`, Public-safe paginated loader, Product/Project/Curated/Full Catalog scopes, Interest List ใน Browser และ Contact CTA | ลิงก์ 4 แบบ, no-price payload/UI, Snapshot vs Live contract, Project privacy, token lifecycle, signed URL, cross-member RLS, responsive และ Human UAT |
| Slice 13: Visual Product Sourcing ตาม DEC-057 | `product_sourcing_requests/files/candidates/history`, trusted workflow RPC, `/api/member/sourcing-requests/*`, `/api/admin/sourcing-requests/*`, Member/Admin UI | Workflow ทุกทาง, file type/size/count, confidential-field isolation, cross-member RLS, Product Lifecycle connection และ Human UAT |

## สถานะการตรวจรับ

### Demo Application 1.4 Human UAT — ผ่านแล้ว

- `PASS` 8/8 หมวด
- `NEEDS FIX` 0
- `NOT TESTED` 0
- Gate: `APPROVED_FOR_MVP_BUILD`
- GISP Admin Human Sign-off: 18 สิงหาคม 2569
- หลักฐาน: `evidence/2026-08-18-demo-1.4-uat-signoff.pdf`

### Slice 1 Human UAT — ผ่านและปิดแล้ว

- Automated Gate ผ่าน: Typecheck, Lint, Unit 43/43, Build, Browser E2E และ Branch RLS/Security 12/12
- Human UAT ผ่าน: Account lifecycle, Member/Admin Permission, Session Actions, Recovery Email และไฟล์จริง
- ผลการตัดสิน: `SLICE_1_ACCEPTED`
- สถานะ: `DONE` บน Development
- หลักฐาน: `../output/pdf/2026-08-18-gisp-slice-1-uat-signoff.pdf`
- Production Deployment และการลบ Branch ต้องได้รับอนุมัติแยก

### Slice 4 Human UAT — ผ่านและปิดแล้ว

- Automated Gate ผ่าน: Typecheck, Lint 0/0, 18 Test Files / 79 Tests และ Build 80 Routes
- Branch Integration/RLS ผ่าน 18/18 และ Browser E2E ผ่านครบ Member/Admin Workflow
- เจ้าของระบบอนุมัติข้อความ “อนุมัติปิด Slice 4” เมื่อ 26 สิงหาคม 2569
- Merge Dry-run ผ่าน `21 added, 4 modified, 0 conflicts`; Backend Branch รวมเข้า Development แล้ว
- Development Deployment และ Post-merge Smoke Test ผ่าน
- ผลการตัดสิน: `SLICE_4_ACCEPTED`; สถานะ: `DONE` บน Development
- Production Deployment ต้องได้รับอนุมัติแยกตาม DEC-049

### Slice 2 Human UAT — ผ่านและปิดแล้ว

- Human UAT ผ่านสำหรับชุดสินค้า 6 รายการเมื่อ 22 สิงหาคม 2569
- Backend Branch รวมเข้า Development สำเร็จ `79 additions, 5 modifications, 0 conflicts`
- ผลการตัดสิน: `SLICE_2_ACCEPTED`; สถานะ: `DONE` บน Development
- Production Release A ต้องได้รับอนุมัติแยกตาม DEC-049

### Slice 12.1 Human UAT — ผ่านและปิดแล้ว

- Backend/Security, Member Flow และ Public Browse Flow พัฒนาเสร็จและรวมเข้า Development แล้ว
- Hosted Integration/RLS/Security 69 Assertions, Lint, Typecheck, Unit 162 Tests และ Build 118 Pages ผ่าน
- Public Payload ไม่มีราคา Supplier Cost Formula Internal Note ข้อมูลลูกค้า Project หรือ Site Address
- Responsive Browser Test ผ่านบนมือถือ 390×844 และ Desktop
- Human UAT ผ่าน 7/7 และเจ้าของระบบยืนยันว่า “ใช้ได้หมด” เมื่อ 6 กันยายน 2569
- Development Deployment ล่าสุด `15cf9ce5-e135-4541-9f78-ccd5059a12db` เป็น `READY`; Post-merge Smoke 54 Assertions ผ่าน
- หน้า Member แสดง “หน้ารวมสินค้าทั้งหมดของฉัน” โดยตรงและ Prefill Branding/Contact จาก Member Profile
- สถานะ: `DONE`; คงเหลือ 0 ขั้นตอนเพื่อปิด Slice 12.1
- หลักฐาน: `evidence/2026-09-06-slice-12-1-customer-browse-catalog.md`

### Preliminary Baseline ที่เคยผ่านใน Local

- TypeScript Type Check
- Unit Test สำหรับ VAT, การปัดเศษ, Deposit/Balance และ Dispatch Gate
- Production Build
- ESLint
- Responsive Browser Check
- Accessibility Check ของหน้าหลักและ Workflow

### Preliminary Baseline ที่เคยผ่านบน InsForge Development

รายการในส่วนนี้เป็น Preliminary Baseline ตาม DEC-031 สำหรับขอบเขต MVP ทั้งระบบ ส่วนขอบเขต
Slice 1 ได้ผ่าน Integration/UAT แยกแล้วตามหลักฐาน Sign-off ด้านบน

- Frontend Deployment และ Health Check
- Migration 8 ฉบับบน PostgreSQL
- ตาราง `public` 47 ตารางเปิด RLS ครบทุกตาราง
- Anonymous access ถูกปฏิเสธสำหรับ `public.users` และ `member_catalog`
- `member_catalog` อนุญาตเฉพาะ `SELECT` สำหรับผู้ใช้ที่ยืนยันตัวตน
- First Super Admin bootstrap ถูกจำกัดไว้ที่ Privileged operator
- Storage Bucket แบบ Public, Member-private และ Confidential
- Protected Notification Retry endpoint และ Schedule ทุก 10 นาที

### ต้องตรวจใน Slice ถัดไปและก่อน Production

- Backup และ Restore บน Staging
- RLS/Permission ของข้อมูลธุรกรรมใน Slice 2–10 ระหว่างหลาย Organization
- Email sender/domain และ retry สำหรับ Notification ของ Workflow ถัดไป
- Signed URL และ Confidential file access สำหรับชนิดไฟล์ใน Slice ถัดไป
- UAT Standard Flow และ Custom Flow ตั้งแต่ต้นจนจบ
- InsForge Staging และ Production Deployment
