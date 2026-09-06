# Slice 10 — Dashboard and Fixed Reports Branch UAT Evidence

วันที่เตรียม UAT: 31 สิงหาคม 2569  
วันที่ผ่าน Human UAT: 1 กันยายน 2569

## สถานะ

- Human UAT: ผ่าน โดยเจ้าของระบบแจ้ง “ทำครบแล้ว”
- Owner Sign-off: อนุมัติ โดยเจ้าของระบบแจ้ง “อนุมัติ Slice 10” เมื่อ 1 กันยายน 2569
- สถานะ Slice: `SLICE_10_ACCEPTED` / `DONE` บน Development
- Backend Branch: `slice-10-dashboard-reports`
- Branch Preview: `https://kit6y4pj-xjz.insforge.site`
- Branch Deployment: `9ef56d53-f599-47d6-81c6-d65d7069fabf` (`READY`)
- Development Deployment: `eaa9a407-7dec-468e-a4cd-9b96d955ea5e` (`READY`)
- Development URL: `https://kit6y4pj.insforge.site`
- Production: ไม่ถูกเปลี่ยนหรือ Deploy ในรอบนี้

## สิ่งที่พัฒนา

- Member Dashboard จากข้อมูลจริง: งานเร่งด่วน, Order, Production, Shipment, Delivery,
  Claim และยอดคงค้างแยกตามสกุลเงิน
- Admin Operations Dashboard แสดง Queue ตาม Permission ของผู้ใช้
- Executive Summary แบบ Read-only พร้อมช่วงวันที่ และยอดเงินแยกตาม Currency
- Fixed Reports 5 แบบ: Order, Payment, Delay, Delivery และ Claim
- Filter ช่วงวันที่/สถานะ, เวลา Generate, จำนวนแถว และ Export CSV
- Export ทุกครั้งบันทึก Append-only Audit Event
- Member เห็นเฉพาะข้อมูลบริษัทตนเอง และไม่เห็น Supplier Cost, Internal Claim Cost,
  Internal Note, ข้อมูลติดต่อ หรือหลักฐานลับ

## Automated Gate

- TypeScript: ผ่าน
- Lint: ผ่าน — 0 Error, 0 Warning
- Unit/Component Test: 27 Test Files / 116 Tests ผ่านทั้งหมด
- Slice 10 Branch Integration: 25/25 Assertions ผ่าน
- Next.js Production Build: ผ่าน — 106 Routes
- React/Next.js Review: ผ่าน; Dashboard/Report ใช้ Server Component และไม่มี Client-side
  data-fetch waterfall เพิ่ม

Integration ครอบคลุม Member isolation, Role permission, Currency grouping, Report ทั้ง 5 แบบ,
ช่วงวันที่ไม่เกิน 366 วัน, CSV Audit และการตรวจ Confidential-field leakage

## UAT Fixture

- Company: `GISP UAT Company`
- Order: `ORD-S10-HUAT-1788189316670`
- Shipment: `SHP-S10-HUAT-1788189316670`
- Delivery รอยืนยัน: `DLV-S10-PROPOSED-1788189316670`
- Claim รอข้อมูล: `CLM-S10-HUAT-1788189316670`
- มี Internal Claim Cost ทดสอบอยู่ใน Backend แต่ Member Report ต้องไม่แสดง

## Hosted Smoke Test

- Member Login, Dashboard, Claim Report และ Delay Report: HTTP 200
- Admin Login, Operations Dashboard, Order Report และ Executive Summary: HTTP 200
- Fixture ปรากฏใน Member Claim Report และ Admin Order Report
- Member Claim Report ไม่พบจำนวนเงิน/ประเภท/หมายเหตุของ Internal Claim Cost
- Member เรียก Admin Dashboard API: HTTP 403
- Login page ทำงานบน Branch Preview จริง

## Development Release Gate

- สำรอง Development ก่อน Merge ด้วย Full Database Export เนื่องจาก Manual Backup เต็ม 5/5
- Backup: `output/backups/pre-slice-10-merge-2026-09-01-full.json`
- ขนาด Backup: 963,554 bytes
- SHA-256: `BD07A87CDF9B4C848841CE6DD3CCB40474F3A2C3F3ECD49F5D7C62E8D9BBFD3D`
- Merge dry-run พบ conflict เฉพาะ runtime timestamp ของ `GISP-Notification-Retry`
  จึงเก็บค่าของ Development, นำ schedule ออกชั่วคราว และสร้างคืนด้วยค่าเดิมหลัง Merge
- Merge-ready dry-run: 0 conflicts และไม่พบ `DROP TABLE`, `DROP COLUMN`, `TRUNCATE`
  หรือ `DELETE FROM`
- Dashboard/Report RPC บน Development: ครบ 4 ฟังก์ชัน
- Report Permissions: ครบ `reports.fixed.read` และ `reports.fixed.export`
- Report Index: ครบ 6 รายการ
- Release Gate หลัง Merge: TypeScript ผ่าน, 27 Test Files / 116 Tests ผ่าน และ Build 106 Routes ผ่าน
- Development Deployment `eaa9a407-7dec-468e-a4cd-9b96d955ea5e`: `READY`
- Post-merge Smoke: Health, Member/Admin Login, Member/Admin Dashboard, Fixed Reports และ
  Executive Summary ผ่าน HTTP 200
- Member เรียก Admin Dashboard API: HTTP 403
- Member/Admin Fixed Report ไม่พบ confidential fields ที่ห้ามเปิดเผย
- Schedule `GISP-Notification-Retry` Active; รอบหลัง Deployment เวลา 07:20 น.
  (Asia/Shanghai) สำเร็จ HTTP 200

## Human UAT Checklist

### Member

1. Login ด้วย `uat-member-all@gisp.example.com` และรหัส UAT กลางเดิม
2. หน้า Dashboard ตรวจว่าเห็น Action ของ Order, QC, Payment, Delivery และ Claim
3. เปิด “รายงานของฉัน” แล้วตรวจทั้ง 5 แท็บ
4. ใน Claim Report ค้นหา `CLM-S10-HUAT-1788189316670` และยืนยันว่าไม่เห็น Internal Cost/Internal Note
5. เปลี่ยนช่วงวันที่หรือสถานะ แล้วกดแสดงรายงาน
6. Export CSV อย่างน้อย 1 รายงาน

### Admin

1. Login ด้วย `uat-admin-all@gisp.example.com` และรหัส UAT กลางเดิม
2. ตรวจ Operations Dashboard และ Queue ที่ต้องดำเนินการ
3. เปิด Fixed Reports ทั้ง 5 แบบ และค้นหา `ORD-S10-HUAT-1788189316670`
4. เปิด Executive Summary และเปลี่ยนช่วงวันที่
5. ยืนยันว่าตัวเลขการเงินแยกตาม Currency และไม่มีการรวม THB/CNY เป็นยอดเดียว

## Gate ที่เหลือ

เหลือ **0 ขั้นตอน** เพื่อปิด Slice 10 บน Development

Production Release ไม่รวมอยู่ในการอนุมัติครั้งนี้ และต้องได้รับ Owner Approval แยกต่างหาก
