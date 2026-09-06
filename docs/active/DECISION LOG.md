# GISP — DECISION LOG

**Document Version:** 2.8  
**Status:** Approved Decisions  
**Last Updated:** 6 กันยายน 2569 (2026-09-06)  
**Authority:** อยู่ลำดับถัดจาก `MVP BUSINESS MASTER PLAN.md`

---

## วิธีใช้เอกสาร

เอกสารนี้บันทึกคำตัดสินที่ได้รับอนุมัติแล้วเพื่อป้องกันการตีความซ้ำ หากต้องแก้คำตัดสิน ให้เพิ่มรายการใหม่ที่อ้างถึง Decision ID เดิมและระบุว่า Superseded ห้ามแก้ประวัติเดิมจนไม่เหลือร่องรอย

| Decision ID | คำตัดสินที่อนุมัติแล้ว | ผลต่อระบบ | สถานะ |
|---|---|---|---|
| DEC-001 | `MVP BUSINESS MASTER PLAN.md` เป็น Source of Truth สูงสุด | เอกสารอื่นต้องแก้ตาม ไม่สามารถ Override Business Rule ได้ | Approved |
| DEC-002 | Frontend ใช้ Next.js + TypeScript และ Deploy บน Vercel | คำตัดสินเดิม ถูกแทนที่ด้วย DEC-024 | Superseded |
| DEC-003 | Backend เปลี่ยนจาก Supabase เป็น InsForge | ใช้ InsForge Auth, PostgreSQL, RLS, Storage, Email, Migration และ Backup | Approved |
| DEC-004 | Login ใช้ Email + Password | Password อยู่ใน `auth.users`; `public.users` ห้ามมี `password_hash` | Approved |
| DEC-005 | พัฒนาแบบ Workflow Vertical Slice | ทำ DB/API/Admin/Member/Document/Notification/Test ให้จบเป็นโมดูล | Approved |
| DEC-006 | Standard Product ที่มี Active Price ไม่ผ่าน RFQ | ใช้ Product Schedule แล้วสร้าง Order ได้ | Approved |
| DEC-007 | RFQ และ Quotation ใช้เฉพาะ Custom Product | Quotation ออกในชื่อ GISP | Approved |
| DEC-008 | Commission ทุกประเภทเป็น Post-MVP | ไม่สร้าง Commission Table/API/UI/KPI ใน Core MVP | Approved |
| DEC-009 | Member Price เป็นราคาก่อน VAT | เอกสารแยก Subtotal, VAT และ Grand Total | Approved |
| DEC-010 | VAT เริ่มต้น 7% และ Configurable | Snapshot VAT ลง Quotation, Order และ Financial Document | Approved |
| DEC-011 | Deposit/Balance เป็น 50/50 ของยอดรวมหลัง VAT | แบ่งโอนได้หลายครั้ง; Balance = Grand Total - Deposit | Approved |
| DEC-012 | Freight แยกเอกสารและชำระภายหลัง | ไม่รวม Freight ใน Deposit/Balance สินค้า | Approved |
| DEC-013 | Custom Quotation เป็น Versioned Document | หนึ่ง Active Version; Revision เดิมเป็น SUPERSEDED; Accepted Immutable | Approved |
| DEC-014 | Quote Validity เริ่มต้น 30 วัน | Admin แก้ได้ก่อนส่ง | Approved |
| DEC-015 | ใช้ Decimal และ Round Half-up 2 ตำแหน่ง | ห้ามใช้ Binary Floating Point คำนวณยอดเงิน | Approved |
| DEC-016 | Payment VERIFIED จากยอด Finance-verified สะสม | ยอดเกินต้อง Flag และตรวจโดย Finance | Approved |
| DEC-017 | State Transition ใช้ Action Endpoint/Trusted Function | Frontend ห้าม PATCH Status โดยตรง | Approved |
| DEC-018 | Dispatch Gate มี 4 เงื่อนไข | QC ผ่าน, Custom Approved, Customer Balance Verified, Supplier Balance Paid | Approved |
| DEC-019 | Notification ใช้ In-App + InsForge Email | Email Failure ไม่ Rollback ธุรกรรมหลัก; Retry และ Log | Approved |
| DEC-020 | Volume 3-C/3-D ส่วนขั้นสูงเป็น Post-MVP | Core คง Finance, Permission, Configuration, Backup และ Logging ขั้นต่ำ | Approved |
| DEC-021 | Dashboard/Reports ใน MVP เป็นพื้นฐาน | คง Fixed Report: Order, Payment, Delay, Delivery และ Claim | Approved |
| DEC-022 | Storage แบ่งตามระดับความลับ | Public, Member-private, Confidential พร้อม Signed URL/File Metadata | Approved |
| DEC-023 | Environment แยก 3 ระดับ | Frontend และ Backend ใช้ InsForge Development, Staging/UAT และ Production ที่ตรงกัน | Approved — Revised by DEC-024 |
| DEC-024 | ใช้ InsForge ทั้ง Frontend Hosting และ Backend | Frontend Deploy ผ่าน InsForge Deployments; Auth/DB/RLS/Storage/Email/Migration/Backup ใช้ InsForge | Approved |
| DEC-025 | Scheduled Jobs ใช้ InsForge Schedules | Notification Retry และงานตามเวลาไม่ผูกกับ Cron ของ Frontend Host แยก | Approved |
| DEC-026 | ทำ Interactive Demo ก่อนพัฒนา Application จริงต่อ | ใช้ข้อมูลสมมติและ Guided Story เพื่อยืนยัน Workflow/UX ก่อนลงระบบจริง | Approved |
| DEC-027 | Demo แยกจาก Development | ใช้ชื่อ `gisp-mvp-demo`, URL `gisp-mvp-demo.insforge.site` และห้ามเขียนข้อมูลเข้า `gisp-mvp-development` | Approved |
| DEC-028 | Demo ระยะเตรียม MVP จำกัดเฉพาะงาน 1–8 ที่อนุมัติ | ต่อเติม Demo เดิมแบบ Browser-local เท่านั้น ไม่สร้าง Auth, Database, Migration, API หรือ Storage จริง และไม่เพิ่ม Feature นอก Core MVP | Approved |
| DEC-029 | Demo Gate ต้องผ่าน Human UAT ครบ 8 หมวดก่อนเริ่ม MVP Build | รายการ `ต้องแก้` ไม่เป็น Approved Decision; Gate ปัจจุบันใช้ Target Demo 1.4 ตาม DEC-042 และต้องผ่านครบพร้อม Admin Sign-off จึงเปลี่ยนเป็น `APPROVED FOR MVP BUILD` | Approved — Revised by DEC-042 |
| DEC-030 | Demo Version 1.3 ที่ Deploy อยู่เคยเป็น Baseline สำหรับ Demo Gate เดิม | คำตัดสินเดิมถูกปรับโดย DEC-042; Version 1.3 ยังคงเป็น Deployed Baseline เชิงประวัติ แต่ไม่เพียงพอสำหรับ Gate ใหม่ | Approved — Revised by DEC-042 |
| DEC-031 | งาน Development ที่สร้างไว้ก่อน Demo Gate ผ่านถือเป็น Preliminary Baseline | Migration/API/UI ที่มีอยู่ไม่ถือว่าได้รับ UAT Approval และห้ามใช้เป็นเหตุผลข้าม Gate; ก่อนเริ่ม Slice ถัดไปต้องผ่าน UAT ของ Target Demo 1.4 ตาม DEC-042 | Approved — Revised by DEC-042 |
| DEC-032 | Core MVP ต้องคง Account Recovery, Member Suspension, Excel/CSV Catalog Import, Cancellation Request, Supplier Payment 50/50, Freight Invoice/Payment Verification และ Configuration/Backup/Logging ขั้นต่ำ | ต้องผูกรายการเหล่านี้กับ Vertical Slice และ Definition of Done ที่เกี่ยวข้อง; การนำออกต้องมี Decision ใหม่ | Approved |
| DEC-033 | ใช้ Canonical State Dictionary แยก Custom Request, Custom Quotation, Payment/Order และ Claim | Custom Request ห้ามใช้สถานะ Quotation; Customer Payment/Order ใช้คำว่า `VERIFIED` หลัง Finance ตรวจ; Claim `REJECTED` ต้องมีเหตุผล ส่วน `CLOSED` ต้องมี Resolution และการยืนยันผล | Approved |
| DEC-034 | แยกเลขเอกสารหลักออกจากรหัสอ้างอิง Record | Atomic Document Number ใช้ `QT`, `ORD`, `SO`, `PO`, `INV`, `PAY`, `SHP`, `DLV`, `CLM`; `INV` แยก subtype Deposit/Balance/Freight ส่วน `PRJ`, `CRQ`, `QCI`, `WRC`, `CNS` เป็น Unique Record Reference | Approved |
| DEC-035 | Role ของ Demo ไม่ใช่ Role Catalog ของ Production | Production ใช้ `MEMBER`, `MEMBER_ADMIN`, `PRODUCT_ADMIN`, `ORDER_ADMIN`, `PURCHASING`, `FINANCE`, `QC`, `LOGISTICS`, `EXECUTIVE_VIEWER`, `SUPER_ADMIN`; `GISP Admin` เป็น Role Mapping สำหรับ Demo เท่านั้น | Approved |
| DEC-036 | ข้อความเก่าหรือส่วนรายละเอียดที่ขัดกับ Reconciled Scope ไม่มีผลขยาย Core MVP | Username ไม่เป็น Credential บังคับ, Generic Task Center และ Generic API/Integration UI เป็น Post-MVP; Core คงเฉพาะ Assignment บน Transaction และ Configuration/Backup/Logging ขั้นต่ำ | Approved |
| DEC-037 | Core MVP ใช้หนึ่ง Member Profile ต่อหนึ่ง Login และไม่มี Member Team/Sub-user/Team Invitation | `MEMBER_ADMIN` เป็นทีมงาน GISP ที่ดูแลสถานะสมาชิก; Multi-role ใช้กับทีมงานภายใน สมาชิกที่ให้ผู้อื่นใช้ Credential เดียวกันยอมรับว่าระบบ Audit แยกบุคคลจริงไม่ได้ | Approved |
| DEC-038 | Price Structure Builder เป็น Core MVP และใช้สูตรแบบ Versioned/Inherited | ลำดับสูตรกลาง → โรงงาน → สินค้า; Override เฉพาะองค์ประกอบได้; Component เป็นเปอร์เซ็นต์หรือยอดคงที่; เฉพาะ `SUPER_ADMIN` สร้าง แก้ Preview และ Activate | Approved |
| DEC-039 | Template ราคาเริ่มต้นเป็น 5% + 10% + 10% และ Suggested Resale Markup 25% | ทุนหลังแปลง THB 100 ให้ Member Price 125 และ Suggested Resale 156.25; Member เห็นสองราคากับ Freight Estimate 15–20% แต่ไม่เห็นทุน สูตร หรือ Margin; VAT/Actual Freight แยก | Approved |
| DEC-040 | Core Sample หมายถึง Material Swatch และ Built-in Display บางรายการ พร้อม Visit Disclosure | ก่อน Visit Completed ปกปิดชื่อ/ที่อยู่/Contact/Supplier ID; เมื่อ Completed เปิดชื่อโรงงานแบบถาวรเฉพาะ Member Profile + Supplier จน Super Admin เพิกถอน | Approved |
| DEC-041 | Warranty ใช้เงื่อนไข Partner แบบ Version และ Order Snapshot | Manufacturing/Spec เป็น Supplier, Transit เป็น Logistics/Insurance, Installation เป็น Installer; ระบบเสนอผู้รับผิดชอบแต่ Order Admin ยืนยัน และไม่คำนวณค่าชดเชยอัตโนมัติ | Approved |
| DEC-042 | Demo Application 1.4 เป็น Demo Gate เป้าหมายใหม่ | Demo 1.3 ที่ออนไลน์ยังเป็น Baseline เดิม; ต้องเพิ่ม Pricing Formula, Suggested Resale, Material Sample/Visit Privacy และ Warranty Responsibility ลง UAT 8 หมวดก่อน `APPROVED FOR MVP BUILD` | Approved |
| DEC-043 | Demo 1.4 แยก Member Application และ GISP Back Office เป็นคนละลิงก์ภายใต้โดเมนเดิม | ใช้ `/v1-4/member` และ `/v1-4/admin` คนละ App Shell แต่ใช้ Browser-local State Schema 4 ชุดเดียวกัน; `/v1-4/overview` เป็น Guided Story และ `/v1-3` เก็บ Historical Baseline | Approved |
| DEC-044 | ใช้แนวทางภาพแบบ Quiet Architectural Operations ซึ่งวิเคราะห์จาก Euro Creations เป็น Visual Direction ของ GISP | ใช้ Editorial Minimalism, ภาพคุณภาพสูง, Typography แบบ Serif/Sans, พื้นที่ว่าง, เส้นบางและปุ่มทรงเหลี่ยมตาม `GISP VISUAL DESIGN INSTRUCTION.md`; ไม่คัดลอกทรัพย์สินของแบรนด์อ้างอิง ไม่เปลี่ยน Business Rule และไม่เพิ่ม Feature นอก Core MVP | Approved |
| DEC-045 | Member Application และ GISP Back Office ใช้ Comfortable Typography 16px เป็น Application Body Baseline | เมนูและรายการใช้ 15px, Label/Helper/Compact Action ใช้ 14px, Metadata/Status ใช้ 12px, ห้ามข้อความสำคัญต่ำกว่า 14px และห้ามข้อความใดต่ำกว่า 12px; Control มาตรฐานสูง 48–52px และ Touch Target ไม่น้อยกว่า 44×44px | Approved |
| DEC-046 | Slice 1 ใช้ Demo 1.4 เป็น UX Baseline และพัฒนาระบบจริงแยกที่ `/member/*` กับ `/admin/*` บน Backend Branch `slice-1-access` | ใช้ OTP 6 หลัก, Recovery Link, One Login/One Member Profile, GISP App Session Registry, Fixed Production Role Catalog, Operator-only First Super Admin Bootstrap และไม่มี Member Team; ผ่าน Automated Gate แล้วจึง Merge/Deploy Development ส่วน Production และการลบ Branch ต้องรอ Human UAT | Approved — Slice 1 DONE on Development |
| DEC-047 | Slice 1 ผ่าน Human UAT และเจ้าของระบบอนุมัติปิดงานบน Development | กำหนดผลเป็น `SLICE_1_ACCEPTED` และ Slice 1 `DONE`; การอนุมัตินี้ไม่รวม Production Deployment หรือการลบ Backend Branch `slice-1-access` ซึ่งต้องขออนุมัติแยก | Approved — 18 August 2026 |
| DEC-048 | พัก Production Release ของ Slice 1 และเริ่มพัฒนา Slice 2 บน Development ต่อ | สร้าง Backend Branch `slice-2-catalog` แบบ `schema-only`; ไม่ Deploy Production และไม่ลบ `slice-1-access`; Showroom Visit/Disclosure อยู่ Slice 3 ตาม Implementation Plan | Approved — 18 August 2026 |
| DEC-049 | ใช้ Staged Production Release เพื่อให้เริ่มใช้งานได้เร็วโดยไม่รอครบ 10 Slice | หลัง Slice 2 UAT เปิด Internal Catalog Operations; หลัง Slice 3 UAT เปิด Member Pilot 3–5 บริษัทโดยยังไม่รับธุรกรรม; หลัง Slice 6 UAT เปิด Quotation/Order/Payment จริง; Slice 7–10 เปิดเพิ่มทีละ Slice การ Deploy แต่ละรอบต้องมี Owner Approval แยก | Approved — 18 August 2026 |
| DEC-050 | Slice 4 Custom RFQ ผ่าน Human UAT และเจ้าของระบบอนุมัติปิดงานบน Development | กำหนดผลเป็น `SLICE_4_ACCEPTED` และ Slice 4 `DONE`; รวม Backend Branch `slice-4-custom-rfq` เข้า Development และผ่าน Post-merge Smoke Test แล้ว การอนุมัตินี้ไม่รวม Production Deployment | Approved — 26 August 2026 |
| DEC-051 | บันทึกผลตรวจรับ Slice 2 ที่เจ้าของระบบอนุมัติไว้เมื่อ 22 สิงหาคม 2569 | กำหนดผลเป็น `SLICE_2_ACCEPTED` และ Slice 2 `DONE`; Backend Branch `slice-2-catalog` รวมเข้า Development ด้วยผล 79 additions, 5 modifications, 0 conflicts การอนุมัตินี้ไม่รวม Production Release A | Approved — 22 August 2026; recorded 26 August 2026 |
| DEC-052 | Slice 7 Production & QC ผ่าน Human UAT และเจ้าของระบบสั่งให้ทำทั้งสองขั้นตอนเพื่อปิด Slice ต่อเนื่อง | กำหนดผลเป็น `SLICE_7_ACCEPTED` และ Slice 7 `DONE` บน Development; Backend Branch `slice-7-production-qc` รวมด้วยผล 19 additions, 6 modifications, 0 conflicts และผ่าน Post-merge Smoke การอนุมัตินี้ไม่รวม Production Deployment หรือการลบ Branch | Approved — 30 August 2026 |
| DEC-053 | อนุมัติลบ Backend Branch `slice-7-production-qc` หลังยืนยันว่า Merge แล้ว | ลบ Branch และข้อมูลเฉพาะ Branch เพื่อคืนโควตา; Slice 7 ที่อยู่บน `gisp-mvp-development`, Slice 8 และ Production ไม่เปลี่ยนแปลง | Approved and executed — 30 August 2026 |
| DEC-054 | อนุมัติ Phase 4, ยอมรับความเสี่ยง RPC ที่เหลือ และเริ่ม Phase 5 บน Production | จำกัดขอบเขตที่ Release A ตาม DEC-049; หลัง Backup/Config/Hardening ยังเป็น Conditional No-Go จนกว่า SMTP, Owner SUPER_ADMIN, Notification Schedule และ Authenticated UAT จะผ่าน | Approved — 4 September 2026; Phase 5 in progress |
| DEC-055 | อนุมัติ Go-Live Release A โดยรับทราบ Known Issue หน้า Member Requests และให้แก้ก่อน Release B | เปิดใช้เฉพาะ Internal Catalog Operations ตาม DEC-049; `/admin/members` และ `/api/admin/members` ยังไม่อยู่ในขอบเขตเปิดใช้และต้องแก้ก่อน Member Pilot; Production Data Load ต้องได้รับอนุมัติแยก | Approved — 5 September 2026; Release A live |
| DEC-056 | Member สร้าง Shared Catalog หลายชุดและส่งลิงก์ให้ลูกค้าดูได้โดยไม่ต้องสมัครสมาชิก | ใช้ Snapshot ตอน Publish, ราคาขาย THB ก่อน VAT ที่ Member กำหนด, Branding/Contact ของ Member, Token แบบสุ่ม, Expiry/Revoke/Rotate และ Public-safe Projection; รุ่นแรกไม่มี Checkout หรือแบบฟอร์มลูกค้า | Approved — 5 September 2026; Slice 12 authorized |
| DEC-057 | สินค้าสำเร็จรูปที่หาไม่พบใช้ Visual Product Sourcing แยกจาก Custom RFQ | Member ส่งภาพและรายละเอียดให้ทีม GISP ตรวจด้วยคน, ทีมเสนอ Candidate แล้วนำตัวเลือกที่เลือกผ่าน Product Lifecycle เดิม; งานผลิตหรือปรับแบบยังใช้ Custom RFQ และรุ่นแรกไม่มี AI วิเคราะห์ภาพ | Approved — 5 September 2026; Slice 13 authorized |
| DEC-058 | อนุมัติลบ Backend Branch `release-security-hardening` เพื่อคืนโควตาและสร้าง `slice-12-shared-catalog` | ลบเฉพาะ Branch ที่ใช้ Hardening เสร็จแล้ว; สร้าง Slice 12 แบบ schema-only และดำเนิน Integration/RLS/Public Link/Preview Test ต่อ โดย Production Release A ไม่เปลี่ยน | Approved and executed — 5 September 2026 |
| DEC-059 | Slice 12 ผ่าน Human UAT ครบ 7 ขั้นตอน | บันทึกผล `PASS 7/7` รวมการยืนยันว่า Draft ราคาไม่เปลี่ยน Public Snapshot จน Publish ใหม่; ขั้น Merge/Development Deployment ยังรอ Owner Approval แยก และ Production Release A ไม่เปลี่ยน | Approved UAT result — 6 September 2026 |
| DEC-060 | อนุมัติขั้นตอนสุดท้ายเพื่อปิด Slice 12 บน Development | สำรองฐาน, รวม Schema/Migration, Deploy และ Post-merge Smoke; เปิดเฉพาะ Shared Catalog ด้วย Feature Flag แยก และคง Product Sourcing/Production Release A ปิดไว้ | Approved and executed — 6 September 2026 |
| DEC-061 | Customer Browse Catalog ทุกแบบต้องไม่แสดงราคา และ Member ส่งได้ทั้งลิงก์สินค้ารายชิ้น สินค้าใน Project Catalog ที่คัดเอง และสินค้าทั้งหมด | ต่อยอด Token/Snapshot ของ Slice 12; Product/Project/Curated ใช้ Snapshot, Full Catalog ใช้ Live Public-safe Products, ลูกค้าเก็บรายการสนใจใน Browser และติดต่อ Member โดยไม่สร้าง Lead/Checkout; ส่วนการแสดงราคาลูกค้าใน DEC-056 ถูกแทนที่ | Approved — 6 September 2026; implemented and accepted on Development |
| DEC-062 | Slice 12.1 ผ่าน Human UAT และเจ้าของระบบอนุมัติปิดบน Development | เจ้าของระบบยืนยันว่า “ใช้ได้หมด”; รวม Schema/Migration, Deploy Development และ Post-merge Smoke ครบ 4 Scope โดย Production Release A ไม่เปลี่ยน | Approved and executed — 6 September 2026 |

---

## Open Decisions

ไม่มี Open Decision ด้าน Business Rule สำหรับหัวข้อราคา ตัวอย่างวัสดุ การเยี่ยมชม และ Warranty
Demo 1.4 พัฒนาและ Deploy แล้วตาม DEC-043 และผ่าน Human UAT 8/8 หมวดพร้อม GISP Admin
Sign-off เมื่อ 18 สิงหาคม 2569 สถานะปัจจุบันคือ `APPROVED FOR MVP BUILD` ตามเงื่อนไขของ DEC-029
และ DEC-042 หลักฐานอยู่ที่ `docs/evidence/2026-08-18-demo-1.4-uat-signoff.pdf`

Slice 1 ผ่าน Automated Gate และ Human UAT แล้ว เจ้าของระบบอนุมัติปิดเมื่อ 18 สิงหาคม 2569
สถานะคือ `SLICE_1_ACCEPTED` / `DONE` ตาม DEC-047 หลักฐานอยู่ที่
`output/pdf/2026-08-18-gisp-slice-1-uat-signoff.pdf` ส่วน Production Deployment และการลบ Branch
ยังเป็นการตัดสินใจที่ต้องอนุมัติแยก

เจ้าของระบบเลือกเดินหน้าทางที่ 2 เมื่อ 18 สิงหาคม 2569: พัก Production Release และเริ่ม Slice 2
บน Backend Branch แยกตาม DEC-048 รายละเอียดอยู่ที่ `docs/SLICE-2-DEVELOPMENT-PLAN.md`

เจ้าของระบบอนุมัติให้ยึด Staged Production Release ตาม DEC-049 เป็นแผนหลัก รายละเอียดอยู่ที่
`docs/active/STAGED PRODUCTION RELEASE PLAN.md`

Slice 4 ผ่าน Automated Gate, Human UAT และ Post-merge Smoke Test แล้ว เจ้าของระบบอนุมัติปิดเมื่อ
26 สิงหาคม 2569 สถานะคือ `SLICE_4_ACCEPTED` / `DONE` ตาม DEC-050 และ Production Deployment
ยังต้องได้รับอนุมัติแยกตาม DEC-049

Slice 2 ผ่าน Human UAT ชุดสินค้า 6 รายการและรวมเข้า Development แล้วเมื่อ 22 สิงหาคม 2569
สถานะคือ `SLICE_2_ACCEPTED` / `DONE` ตาม DEC-051 ส่วน Production Release A ต้องได้รับ
Owner Approval แยกตาม DEC-049

Slice 7 ผ่าน Human UAT เส้นทาง Production/QC/Additional Review/Reinspection/Dispatch Gate และ
รวมเข้า Development แล้วเมื่อ 30 สิงหาคม 2569 สถานะคือ `SLICE_7_ACCEPTED` / `DONE`
ตาม DEC-052 และ Branch `slice-7-production-qc` ถูกลบตามคำอนุมัติ DEC-053 แล้ว ส่วน Production
Deployment ยังต้องได้รับ Owner Approval แยก

Owner อนุมัติ Go-Live Release A เมื่อ 5 กันยายน 2569 ตาม DEC-055 หลัง Backup, Hardening,
SMTP, Owner `SUPER_ADMIN`, Notification Schedule และ Authenticated Production UAT ผ่านครบ
โดยรับทราบ Known Issue ของหน้า Member Requests และกำหนดให้แก้ก่อน Release B

## Post-MVP Backlog ที่ล็อกแล้ว

รายละเอียดรายการรอพิจารณาอยู่ที่ `docs/post-mvp/POST-MVP BACKLOG.md` และไม่มีผลอนุมัติให้พัฒนา

* Commission ทุกประเภท
* Advanced Executive BI
* Custom Report Builder และ Full Export Center
* AI Catalog Import
* Generic Task Center
* Advanced Integration/Infrastructure UI
* Member-branded Quotation Builder
* Member Team, Sub-user และ Team Invitation
* Full Trip Booking, Calendar, Itinerary และค่าเดินทาง
* Automatic Warranty/Compensation Decision

## Demo Versioning

* Version 1.3 เป็น Historical Baseline และใช้ State Version 3
* Version 1.4 เป็น Target Demo Gate และใช้ Shared State Schema 4 ตาม DEC-043
* ทั้งสอง Version ต้อง Reset และเก็บข้อมูลแยกกัน
