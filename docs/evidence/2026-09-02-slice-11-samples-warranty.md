# Slice 11 — Samples & Partner Warranty Acceptance and Development Release Evidence

วันที่เตรียม UAT: 1 กันยายน 2569  
วันที่ผ่าน Human UAT: 2 กันยายน 2569

## สถานะ

- Human UAT: ผ่านครบ Admin และ Member
- Owner Sign-off: อนุมัติ โดยเจ้าของระบบแจ้ง
  “ทำครบแล้ว อนุมัติผล UAT Slice 11” เมื่อ 2 กันยายน 2569
- สถานะ Slice: `SLICE_11_ACCEPTED` / `DONE` บน Development
- Backend Branch: `slice-11-samples-warranty`
- Branch Preview: `https://kit6y4pj-tvr.insforge.site`
- Branch Deployment: `33043247-6279-4341-b5ac-52082879a144` (`READY`)
- Development Deployment: `839745fa-08fe-4db2-a021-167b5b53f311` (`READY`)
- Development URL: `https://kit6y4pj.insforge.site`
- Production: ไม่ถูกเปลี่ยนหรือ Deploy

## Automated Gate

- TypeScript: ผ่าน
- Unit/Component Test: 28 Test Files / 118 Tests ผ่านทั้งหมด
- Lint: ผ่าน — 0 Error, 0 Warning
- Next.js Production Build: ผ่าน — 108 Static Pages
- Slice 11 Branch Integration: 21/21 Assertions ผ่าน
- Hosted Health: HTTP 200
- Hosted Admin/Member Smoke และ Confidential-field Isolation: ผ่าน

## Human UAT Result

### Admin

1. Login ด้วยบัญชี Admin และเปิดหน้า Samples & Partner Warranty สำเร็จ
2. พบตัวอย่างหลัก Built-in และ Material พร้อมชื่อ ประเภท สินค้า สถานที่ และสถานะครบ
3. เปลี่ยนสถานะ Material เป็น `ถูกยืม` และเปลี่ยนกลับ `พร้อมให้บริการ` สำเร็จ
4. เมื่อเลือกสินค้า Material ตัวเลือก Built-in Display ถูกปิดใช้งาน
5. ตรวจพบ Warranty V2 ระยะ 36 เดือนเป็น `ใช้งานอยู่`
6. ตรวจพบ Warranty V1 ระยะ 24 เดือนเป็น `ยกเลิกใช้แล้ว` หลัง V2 ถูก Activate

ข้อมูล Fixture มีรายการ Automated Test `SMP-T-...` เพิ่มอีกหนึ่งรายการนอกชุด Human UAT หลัก
จึงแสดงรวม 3 รายการ แต่ตัวอย่างหลัก `SMP-S11-BIN-...` และ `SMP-S11-MAT-...` ถูกต้องครบถ้วน

### Member

1. เปิด Member Catalog และพบสินค้า `S11-BIN-...` กับ `S11-MAT-...`
2. Built-in แสดงชุดตัวอย่าง Built-in, สถานที่สาธารณะ, สถานะ และ Warranty V2 36 เดือน
3. Material แสดง `ตัวอย่างวัสดุ` ไม่ใช่ Built-in Display
4. ไม่พบชื่อ Supplier, ที่อยู่จริง, ผู้ติดต่อ, เบอร์โทร, อีเมล, ตำแหน่งชั้นวาง
   หรือหมายเหตุภายใน

## Development Release Gate

- Cloud Manual Backup เต็มโควตา 5/5 จึงไม่ลบ Backup เก่าและใช้ Full Database Export แทน
- Backup: `output/backups/pre-slice-11-merge-2026-09-02-full.json`
- Backup Size: 999,222 bytes
- SHA-256: `83CFCAD4D6D05002260DB220261FE0B53ADA91F6983F40468D862A7CBE9F9841`
- Merge dry-run รอบแรกพบ Runtime Conflict เฉพาะ `schedules.jobs`
- เก็บค่า Development ของ `GISP-Notification-Retry`, ลบ Schedule ชั่วคราวทั้ง Branch/Parent,
  ทำ Merge-ready dry-run แล้วผ่าน `12 added, 2 modified, 0 conflicts`
- ตรวจ Merge-ready SQL แล้วไม่พบ `DROP TABLE`, `DROP COLUMN`, `TRUNCATE` หรือ `DELETE FROM`
- Backend Branch `slice-11-samples-warranty` Merge สำเร็จและอยู่สถานะ `merged`
- สร้าง Schedule `GISP-Notification-Retry` คืนด้วยค่าเดิม, Active และใช้ Secret Reference เดิม;
  รอบแรกหลัง Deployment เวลา 09:10 น. (Asia/Shanghai) ผ่าน HTTP 200
- Development Schema ตรวจครบ: Migration 1, Order Item Columns 2, Functions 11,
  Triggers 3, Indexes 2 และ Permissions 2
- Quality Gate หลัง Merge: TypeScript, Lint, 28 Test Files / 118 Tests และ Build 108 Pages ผ่าน
- Development Deployment `839745fa-08fe-4db2-a021-167b5b53f311` เป็น `READY`
- Post-merge Smoke ผ่าน: Health HTTP 200, Admin Workspace/API, Member Catalog/API,
  Protected Redirect และ API Response Shape

## Gate ที่เหลือ

เหลือ **0 ขั้นตอน** เพื่อปิด Slice 11 บน Development

Production Release ไม่รวมอยู่ในการอนุมัติ UAT ครั้งนี้ และต้องได้รับ Owner Approval แยกต่างหาก
