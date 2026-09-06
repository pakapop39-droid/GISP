# Slice 4 — Custom RFQ Engineering Evidence

**วันที่ตรวจ:** 26 สิงหาคม 2569 (Asia/Bangkok)  
**Backend Branch:** `slice-4-custom-rfq`  
**สถานะ:** `SLICE_4_ACCEPTED — DONE ON DEVELOPMENT`  
**Branch Preview:** https://kit6y4pj-gk5.insforge.site  
**Branch Deployment:** `ddd85b08-5ff8-47de-bb8f-9f5173ffa346` (`READY`)  
**Development:** https://kit6y4pj.insforge.site  
**Development Deployment:** `57144683-37a7-420b-be7b-5fb3189095b9` (`READY`)

## ขอบเขตที่เสร็จแล้ว

- Member สร้าง/แก้ไข Draft, ระบุข้อมูลสินค้าและตัวเลือกที่ต้องการ, แนบไฟล์แบบมี Version,
  ส่งคำขอ, ส่งข้อมูลเพิ่ม และยกเลิกก่อน Convert ได้
- Admin มี Queue และ Detail สำหรับเริ่มตรวจ, กำหนดผู้รับผิดชอบ/กำหนดส่ง,
  ขอข้อมูลเพิ่ม, บันทึก Candidate, บันทึกหมายเหตุภายใน และตั้งสถานะพร้อมทำใบเสนอราคา
- เลขอ้างอิงใช้รูปแบบ `CRQ-YYYY-NNNNNN` และสร้างแบบ Atomic
- Workflow ใช้สถานะมาตรฐาน `DRAFT`, `SUBMITTED`, `UNDER_REVIEW`, `NEED_INFO`,
  `READY_FOR_QUOTE`, `CONVERTED`, `CANCELLED`
- Member-safe Projection ไม่เปิดเผย Candidate, หมายเหตุภายใน หรือ Internal History
- History เป็น Append-only และ Base Tables อนุญาต Direct Access เฉพาะการอ่านตาม RLS
- เพิ่มเมนู Custom RFQ ใน Member Portal และ Custom RFQ Queue ใน Admin Portal

## Database และ Migration

Migration ที่มีผลบน Branch นี้:

- `20260824134357` — Slice 4 Custom RFQ foundation
- `20260824152626` — ปรับประสิทธิภาพ Custom RFQ detail
- `20260824153919` — ป้องกันข้อมูลภายในรั่วผ่าน Member projection
- `20260826044926` — ปิดช่องว่าง Workflow, Reference, File Version, Assignment,
  Candidate, Internal Note, Append-only History และ RLS

ผลตรวจหลัง Migration: ไม่พบสถานะเก่าที่ผิดกติกา, ไม่พบเลขอ้างอิงรูปแบบเก่า และ Policy ของ
Request/File/Candidate/History เป็น Select-only ตามบทบาท

## Automated Gate

| การตรวจ | ผล |
|---|---|
| TypeScript | ผ่าน |
| Unit Test | ผ่าน — 18 Test Files, 79 Tests |
| Slice 4 Branch Integration/RLS | ผ่าน — 18/18 Assertions |
| ESLint | ผ่าน — 0 Error, 0 Warning |
| Next.js Production Build | ผ่าน — 80 Routes |
| Accessibility | ผ่าน — Member/Admin Detail ไม่พบ WCAG A/AA violation |
| Preview Deployment | `READY` |

Integration Test ครอบคลุมเลข CRQ แบบ Atomic, Structured Options, Cross-member RLS,
Member-safe RPC, Direct-write Guard, Assignment Validation, NEED_INFO/Resubmit,
READY_FOR_QUOTE, Candidate, Internal Note, Append-only History, File Version และ Cancel Guard
ก่อน/หลัง Convert

## Browser E2E บน Branch Preview

ตรวจผ่านด้วย Browser จริง:

1. Member Login และสร้าง Custom RFQ
2. Upload ไฟล์ PDF จริงและตรวจว่าแสดงเป็น Version 1
3. Submit คำขอ
4. Admin เปิด Queue, รับงาน, ระบุผู้รับผิดชอบและกำหนดส่ง
5. Admin บันทึก Candidate และหมายเหตุภายใน
6. Admin เปลี่ยนเป็น `READY_FOR_QUOTE`
7. Member เปิดคำขอเดิมและเห็นสถานะ/Timeline ที่อนุญาต โดยไม่เห็นข้อมูลภายใน
8. ตรวจซ้ำบน Deployment ล่าสุดหลังปรับการโหลด Member Detail

### UAT Defect Fix — สถานะ Admin มองไม่เห็นบนจอแคบ

- ผู้ใช้รายงานจาก `CRQ-2026-000005` ว่าระบบแจ้งสำเร็จแต่เหมือนสถานะไม่เปลี่ยน
- ตรวจฐานข้อมูลยืนยันว่า Workflow เปลี่ยนจริงจาก `SUBMITTED` → `UNDER_REVIEW` → `NEED_INFO`
- สาเหตุคือป้ายสถานะหลุดพื้นที่มองเห็นที่ความกว้างประมาณ 773 px และข้อความสำเร็จเดิมไม่บอกผลของ Action
- แก้ให้ป้าย **สถานะปัจจุบัน** เรียงใต้หัวข้อบนจอแคบ และข้อความตอบกลับระบุสถานะใหม่
  หรือระบุชัดว่า Action นั้นไม่เปลี่ยนสถานะ
- Browser Regression ที่ 773×900 ผ่าน: `innerWidth = scrollWidth = 773`, ไม่พบ Error Overlay
- [ภาพหลังแก้ที่ความกว้าง 773 px](slice4-status-fix-773.png)

คำขอที่ใช้ตรวจ: `CRQ-2026-000004` (`c90242b3-8155-432a-b796-63e683150237`)

ภาพหลักฐาน:

- [Member List](slice4-preview-member.png)
- [Member Upload และ Detail](slice4-preview-upload.png)
- [Admin Queue](slice4-preview-admin.png)
- [Admin Ready for Quote](slice4-preview-admin-ready.png)
- [Member Ready for Quote](slice4-preview-member-ready.png)

## Gate และข้อจำกัด

- เจ้าของระบบผ่าน Human UAT และยืนยันข้อความ **“อนุมัติปิด Slice 4”** เมื่อ 26 สิงหาคม 2569
- ผลการตรวจรับคือ `SLICE_4_ACCEPTED` และสถานะ Slice 4 เป็น `DONE` บน Development
- Merge Dry-run ผ่านด้วยผล `21 added, 4 modified, 0 conflicts`
- สร้าง Backup ก่อน Merge ชื่อ `pre-slice-4-merge-2026-08-26`
- Backend Branch `slice-4-custom-rfq` รวมเข้า `gisp-mvp-development` สำเร็จ และ Branch อยู่ในสถานะ `merged`
- ระหว่าง Dry-run พบ Conflict เทียมจากเวลา Runtime ของ Schedule เดิม จึงเก็บ Config, ถอด Schedule
  ชั่วคราว, Merge แบบ 0 Conflict แล้วสร้าง Schedule เดิมกลับทันที; รายงานปัญหา InsForge ไว้ที่
  `fea1108e-86e0-40e7-bf71-e7e995cf5409`
- Schedule ใหม่ `2b5e096d-f6b8-4c4a-a990-23ffe573f54c` ชื่อ `GISP-Notification-Retry`
  ทำงานรอบ 15:40 สำเร็จด้วย HTTP 200
- Post-merge Automated Gate ผ่าน: Typecheck, 18 Test Files / 79 Tests, Lint 0/0 และ Build 80 Routes
- Post-merge Smoke Test ผ่าน: `/api/health` ตอบ HTTP 200, Protected Member/Admin Routes Redirect
  ไป Login ถูกต้อง, Custom RFQ Tables/RPCs ครบ และ RLS เป็น Select-only ตามบทบาท
- ไม่มีการ Deploy Production; Production ยังคงถูกพักไว้จนผ่าน Slice 6 ตาม DEC-049

## ขั้นตอนที่เหลือเพื่อปิด Slice 4

เหลือ **0 ขั้นตอน** — Slice 4 ปิดงานแล้วบน Development
