# Production Release A — Readiness Audit

**วันที่ตรวจ:** 26 สิงหาคม 2569  
**สถานะ:** `PREPARED — NOT AUTHORIZED TO OPEN`  
**ขอบเขต:** Internal Catalog Operations จาก Slice 1–2 เท่านั้น  
**Production Project:** `gisp-mvp-production` (`865860c2-49fa-4e53-908f-9396b2f75233`)  
**Production URL:** https://m8ugbyak.insforge.site  

> อัปเดต 4 กันยายน 2569: Owner อนุมัติ Phase 4 และเริ่ม Phase 5 แล้ว เอกสารนี้เป็น Baseline
> ก่อนเปลี่ยน Production; ผลล่าสุดอยู่ที่
> [Phase 5 Execution Record](2026-09-04-production-release-a-phase-5.md)
**Current Deployment:** `b90108ef-3d6b-447e-97de-fc8bcd9a9f7e` (`READY`)

## สรุปผล

Production มี Deployment และ Migration ของ Slice 1–2 เตรียมไว้อยู่แล้ว แต่ **ยังไม่ถือว่าเปิด Release A**
และยังไม่ได้รับ Owner Approval สำหรับเปิดใช้งานจริง การตรวจครั้งนี้เป็น Read-only Audit ยกเว้นการสั่ง
Security Advisor Scan; ไม่มีการ Deploy, เปลี่ยน Config, สร้างผู้ใช้ หรือนำข้อมูลขึ้น Production

สถานะ Release A คือ **ยังไม่พร้อมเปิด** เพราะ Security Advisor พบ 264 ประเด็น ได้แก่ Critical 98,
Warning 126 และ Info 40 โดย Critical ที่ตรวจตัวอย่างเป็นฟังก์ชัน `SECURITY DEFINER` ที่เปิดให้
`authenticated` หรือ `anon` เรียก และอาจเพิ่มสิทธิ์เกินขอบเขต ฟังก์ชันของ Slice ที่ยังไม่เปิดบางส่วนก็อยู่
ในฐานข้อมูลแล้ว จึงต้องตรวจสิทธิ์ที่ Backend โดยตรง ไม่สามารถอาศัยเพียงการซ่อนหน้าเว็บ

## Readiness Gate

| Gate | ผลตรวจ | สถานะ |
|---|---|---|
| Slice 1 และ Slice 2 ผ่าน Human UAT | ผ่านและปิดบน Development แล้ว | PASS |
| Production Project/Deployment | Project Active; Deployment `b90108ef...` READY | PASS |
| ขอบเขตหน้าเว็บ | Login และ Admin Catalog ตอบสนอง; Member/Project/RFQ ไม่ถูกเปิด | PASS |
| Migration Release A | Migration ของ Slice 1–2 อยู่บน Production | PASS |
| สุขภาพระบบ | CPU 1.9%, Memory 52.3%, Disk 57.8%, DB Connections 4/30, ไม่มี Waiting Lock | PASS |
| Backup ตามรอบ | Scheduled Backup สำเร็จ; ล่าสุด 26 สิงหาคม 2569 08:00 น. | PASS |
| Storage | Bucket Public/Private มีครบและยังไม่มีข้อมูล | PASS |
| ข้อมูลและผู้ใช้จริง | User, Organization, Product, Supplier และ Import Job เป็น 0 | INFO |
| Security Advisor | 98 Critical / 126 Warning / 40 Info; ต้อง Review และแก้ก่อนเปิด | **BLOCKED** |
| Production Email | SMTP ยังปิด; Email Verification เปิดอยู่ จึงสมัคร/ยืนยัน/Recovery จริงไม่ได้ | **BLOCKED** |
| Redirect URL | `allowedRedirectUrls` ยังว่าง | **BLOCKED** |
| Notification Retry | ไม่มี `CRON_SECRET` และไม่มี Schedule | **BLOCKED** |
| First SUPER_ADMIN | ยังไม่มีผู้ใช้ ต้อง Bootstrap แบบ Privileged และมี Audit หลัง Email พร้อม | **BLOCKED** |
| Owner Approval | ยังไม่มีคำอนุมัติเปิด Production Release A | **BLOCKED** |
| Named Pre-change Backup | ให้สร้างทันทีหลังอนุมัติและก่อนเปลี่ยน Production | PENDING |
| Post-open Smoke/UAT | ทำหลัง Config/สิทธิ์/ผู้ใช้พร้อม | PENDING |

## ขอบเขตที่อนุญาตสำหรับ Release A

เปิดเฉพาะ:

- Login, Recovery, User/Role/Permission สำหรับทีมภายใน
- Supplier, Product, Category, Option, Media และ Document
- Factory Cost, Price Structure, Import, Review, Publish และ Catalog QA

ไม่เปิด:

- Member Pilot, Project และ Showroom Visit
- Custom RFQ, Quotation, Order และ Payment
- Production/QC, Shipment/Delivery และ Claim

> Deployment ปัจจุบันมีขอบเขตหน้าเว็บเหมาะกับ Slice 1–2 มากกว่า Development Build ล่าสุดซึ่งรวม
> Slice 3–4 แล้ว ดังนั้นห้ามนำ Development Build ล่าสุดขึ้น Production ตรง ๆ

## ขั้นตอนเปิด Release A หลังได้รับอนุมัติ

1. Review Security Advisor ทุก Critical โดยเฉพาะ RPC ที่เปิดให้ `anon`/`authenticated`; แก้ Grant,
   `search_path`, Permission Guard และทดสอบ Direct API/RLS จนไม่มี Critical ที่ยังไม่อธิบายหรือแก้ไข
2. ตั้งค่า Production SMTP และ Allowed Redirect URL แล้วทดสอบ Signup, Verification และ Recovery
3. ตั้ง `CRON_SECRET`, สร้าง Notification Retry Schedule และทดสอบการส่งซ้ำ
4. ยืนยัน Release Artifact ว่าเป็น Slice 1–2 เท่านั้น; รักษา Deployment ปัจจุบันไว้หรือสร้าง Artifact
   เฉพาะ Release A โดยไม่ใช้ Development Build ล่าสุดตรง ๆ
5. ขอ Owner Approval สำหรับเปิด Production Release A โดยระบุขอบเขตและผล Security Gate
6. สร้าง Named Production Backup ก่อนเปลี่ยนค่า แล้วดำเนินการใน Change Window พร้อม Rollback Plan
7. สมัคร/ยืนยันบัญชี Owner และ Bootstrap `SUPER_ADMIN` ผ่าน Privileged Operator พร้อม Audit
8. ทำ Production Smoke Test และ Human UAT สำหรับ Login, Permission, Supplier, Product, Pricing,
   Import/Review/Publish และ Leakage Test แล้วจึงลงนามเปิด Release A

ข้อมูล CN01/ไฟล์จริงยังไม่อยู่บน Production การ Import ต้องมี Preview และคำอนุมัติ Data Load แยก
หลังยืนยัน Lead Time, Material Mapping, CNY → THB, Effective Date และมิติสินค้าแล้ว

## Rollback

- หยุดการเปิดใช้งานและไม่เชิญผู้ใช้เพิ่มทันทีเมื่อ Smoke/UAT ไม่ผ่าน
- ย้อน Config/Deployment เฉพาะรายการที่เปลี่ยนใน Change Window
- Restore จาก Named Pre-change Backup เมื่อเกิดการเปลี่ยน Schema/Data ที่ย้อนด้วย Migration ไม่ได้
- ตรวจ Health, Login และ Audit Log ซ้ำหลัง Rollback และบันทึกเหตุการณ์

## จำนวนขั้นตอนที่เหลือ

- **Slice 2:** เหลือ **0 ขั้นตอน** — ปิดงานแล้วบน Development
- **Production Release A:** เหลือ **8 ขั้นตอน** ตาม Runbook ด้านบน
