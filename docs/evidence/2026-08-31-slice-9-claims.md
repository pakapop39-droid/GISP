# Slice 9 — Claims Development Release Evidence

วันที่ปิด Slice: 31 สิงหาคม 2569

## ผลการตรวจรับ

- Human UAT: ผ่าน โดยเจ้าของระบบแจ้ง “ทดสอบเสร็จแล้ว”
- Owner Sign-off: “อนุมัติ Slice 9”
- Acceptance Result: `SLICE_9_ACCEPTED`
- Production: ไม่ถูกเปลี่ยนหรือ Deploy ในรอบนี้

## Automated และ Preview Gate

- Typecheck, Lint และ Production Build: ผ่าน
- Automated Test: 26 Test Files / 111 Tests ผ่านทั้งหมด
- Branch Integration: 9/9 Assertions
- Backend Branch: `slice-9-claims`
- Branch Preview: `https://kit6y4pj-hur.insforge.site`
- แก้ปุ่มเหตุผล/ขอข้อมูลจาก `window.prompt` เป็น Inline Form เพื่อให้ทำงานบน Hosted Browser ได้แน่นอน

## Backup และ Merge

- Cloud Manual Backup เต็มโควตา 5/5 จึงไม่ลบ Backup เก่า
- สร้าง Development Database Export ที่รวม Schema, Data, Functions, Sequences และ Views:
  `output/backups/pre-slice-9-merge-2026-08-31-full.json`
- SHA-256: `88226BA55403D52A44909E7FACA56AF5FB852977DF1621A7437D48730E835175`
- Export มี 100 Tables, 651 Insert Statements, 148 Functions และ 1 View; ไม่พบตารางใกล้เกิน Row Limit 10,000
- Dry-run รอบแรกพบ Conflict เฉพาะ Runtime Timestamp ใน `schedules.jobs`
- เก็บค่า Development Schedule แล้วลบชั่วคราวทั้ง Parent/Branch; Dry-run รอบสุดท้ายเป็น
  `12 added, 2 modified, 0 conflicts` และไม่พบ Drop Table, Drop Column, Delete หรือ Truncate
- Merge ครั้งแรกตอบ HTTP 502 แต่ Transaction ไม่ถูก Apply; Branch ยัง `ready` และ Development Schema ไม่เปลี่ยน
- รายงาน InsForge Feedback ID `13bdfd1c-517e-437c-ba5f-6553ad374a57`
- Merge ครั้งที่สองสำเร็จ: `12 added, 2 modified, 0 conflicts`; Branch เป็น `merged`

## Development Deploy และ Smoke

- Development Deployment: `d46f280c-1afb-4bef-993b-623d336d84ef` (`READY`)
- Development URL: `https://kit6y4pj.insforge.site`
- Health: HTTP 200
- Protected Admin/Member Claims Routes: HTTP 307 ไป Login พร้อม `next` ถูกต้อง
- Admin Login และ Claim Queue: ผ่าน ไม่มี Error Overlay/Console Error
- Member Login, Claim List และ New Claim Form: ผ่าน และเห็น Delivered Item จริง
- Post-merge Schema: Migration 1, Claim Policies 4, Claim RPC 4 และ Internal Cost RLS เปิดใช้งาน
- Notification Schedule สร้างกลับ ID `30f5d513-cf9a-4418-b7fb-39462cd3929a`; รอบแรก HTTP 200

## Gate ที่เหลือ

เหลือ **0 ขั้นตอน** เพื่อปิด Slice 9 บน Development

