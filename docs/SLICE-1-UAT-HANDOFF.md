# GISP — Slice 1 UAT Sign-off and Handoff

**วันที่ส่งมอบ:** 18 สิงหาคม 2569  
**สถานะ:** `DONE — SLICE_1_ACCEPTED`  
**ระบบทดสอบ:** [GISP Development](https://kit6y4pj.insforge.site)  
**ขอบเขต:** Login, บริษัท, ผู้ใช้ และสิทธิ์

> เจ้าของระบบอนุมัติข้อความ “อนุมัติปิด Slice 1” เมื่อ 18 สิงหาคม 2569 หลัง Automated Gate
> และ Human UAT ผ่าน หลักฐานอยู่ที่ [Slice 1 UAT Sign-off PDF](../output/pdf/2026-08-18-gisp-slice-1-uat-signoff.pdf)

## 1. สิ่งที่ส่งมอบ

- สมัครบัญชีบริษัท → OTP 6 หลัก → Login → Onboarding หลายขั้น → ส่งคำขออนุมัติ
- หน้า Pending, Rejected/Resubmit และ Suspended พร้อม Redirect ตามสถานะ
- Forgot/Reset Password แบบลิงก์ใช้ครั้งเดียวและข้อความไม่เปิดเผยว่ามีอีเมลในระบบหรือไม่
- GISP App Session Registry, Sign-out, Force Logout, Session Revocation และ Security Log
- หน้าจอจริง `/member/*` และ `/admin/*` ใช้ข้อมูลและ Permission จาก Backend
- Fixed Role Catalog 10 Role, Multi-role, Permission Matrix และการป้องกัน Super Admin คนสุดท้าย
- Company Settings, Atomic Document Number, Unique Record Reference และ Append-only Audit
- ไฟล์สมัคร PDF/JPEG/PNG ไม่เกิน 10 MB สูงสุด 5 ไฟล์ ผ่าน Server API และ Signed URL 5 นาที
- Demo 1.4 ที่ `/v1-4/*` ถูกเก็บไว้เป็นหลักฐานและไม่ถูกเปลี่ยน

## 2. ผล Automated Gate

| Gate | ผล |
|---|---|
| TypeScript Typecheck | ผ่าน |
| ESLint | ผ่าน — 0 Error |
| Unit Test | ผ่าน — 43/43 |
| Production Build | ผ่าน — 62 Routes |
| Branch Integration/RLS/Security | ผ่าน — 12/12 |
| Browser E2E Desktop/Mobile | ผ่าน |
| Demo 1.4 Preservation | ผ่าน |
| Merge Dry-run | ผ่าน — 44 Added, 17 Modified, 0 Conflict |
| Development Deployment | `READY` |
| Development Smoke Test | Health `ok`, App Mode `application`, Environment ครบ |

หลักฐานเชิงเทคนิค:

- Deployment ID: `53f686d7-7d71-4161-9d42-229b0a75c9cd`
- Merge preview: `output/slice1-merge-dry-run.sql`
- ภาพ Login Development: `output/slice1-development-login.png`
- ภาพ Admin Desktop/Mobile: `output/slice1-admin-desktop.png`, `output/slice1-admin-mobile.png`
- ภาพ Member: `output/slice1-member-desktop.png`

## 3. ข้อมูลการตรวจรับ

สถานะ First Super Admin: **Bootstrap สำเร็จแล้ว** — บัญชีเป็น `ACTIVE`, มี Role `SUPER_ADMIN`,
Permission 29 รายการ และมี Audit `OPERATOR_BOOTSTRAP` บัญชี owner ไม่มีคำขอหรือ Profile Member
และไม่มี Role `MEMBER` แล้ว

เจ้าของระบบตรวจระบบจริงบน Development ด้วยบัญชี Super Admin และ Member โดยไม่ส่งรหัสผ่านหรือ OTP
ให้ผู้พัฒนา ผลตรวจรับครอบคลุมวงจรบัญชี, Permission, Session, Recovery, ไฟล์ และ Responsive UI

### ผล Human UAT ล่าสุด

- ผ่าน: Admin อนุมัติคำขอ Member และบัญชีเปลี่ยนเป็น `ACTIVE`
- ผ่าน: Member Login แล้วเข้า `/member/dashboard` ด้วย Role `MEMBER` และไม่เห็นเมนู Admin
- พบและแก้แล้ว: หน้า “ข้อมูลบริษัท” ไม่มีปุ่มแก้ไข; เพิ่มปุ่ม Edit/Cancel/Save และเชื่อม API บันทึกจริงแล้ว
- ปรับแล้ว: “ประเภทธุรกิจ” เป็น Dropdown จริง 7 ตัวเลือก ใช้ร่วมกันทั้งสมัคร/แก้ไข และตรวจค่าที่ Backend
- ผ่าน Human UAT แล้ว: ความกระชับรอบสองได้รับการยืนยันว่า “พอดี” ทั้งรูปแบบและความอ่านง่าย; Demo 1.4 ไม่เปลี่ยน
- ผ่าน Human UAT แล้ว: แก้ “ประเภทธุรกิจ” เป็น “บริษัทออกแบบตกแต่งภายใน” และค่ายังคงถูกต้องหลัง Browser Refresh ยืนยันการบันทึกลงฐานข้อมูลจริง
- ผ่าน Human UAT แล้ว: ปุ่ม “ออกจากระบบ” ฝั่ง Member มองเห็นและใช้เปลี่ยนจาก Member ไป Login เป็น Admin ได้
- ผ่าน Human UAT แล้ว: Admin ระงับ Member สำเร็จ ใบสมัครยังเป็น `APPROVED` และบัญชีเป็น `SUSPENDED`
- ผ่าน Human UAT แล้ว: Member ที่ถูกระงับ Login แล้วถูกส่งไปหน้า Read-only Suspended, เห็นเหตุผล และไม่สามารถเข้า Dashboard; ประวัติเป็นค่าว่างตามข้อมูลจริง
- ผ่าน Human UAT แล้ว: Admin Reactivate บัญชีสำเร็จ สถานะกลับเป็น `ACTIVE` และ Action กลับเป็น “ระงับ”
- ผ่าน Human UAT แล้ว: Member Login กลับเข้า Dashboard ได้ สถานะ `ACTIVE`, Role `MEMBER`, Session `Secured` และไม่มีเมนู Admin
- ผ่าน Human UAT แล้ว: Force Logout ยกเลิก Session เดิม 1 รายการและมี Security Log `SUCCESS`; การ Login ใหม่ภายหลังสร้าง Session ใหม่ได้ตามข้อกำหนด
- พบและแก้แล้ว: Admin Reset เคยไม่ตรวจ Error จาก Backend และ Redirect URL `/reset-password` ยังไม่ได้รับอนุญาต จึงไม่ส่งอีเมลแม้หน้าจอดูเหมือนสำเร็จ
- ตรวจหลังแก้แล้ว: Backend รับคำสั่งส่ง Reset Email โดยไม่มี Error, Admin แสดงผลสำเร็จ/ผิดพลาดจริง และ Deployment ล่าสุดเป็น `READY`
- ผ่าน Human UAT แล้ว: ผู้ใช้ได้รับ Reset Email ฉบับล่าสุด เปิดลิงก์ เปลี่ยนรหัสผ่าน และ Login ด้วยรหัสผ่านใหม่สำเร็จ
- ผ่าน Human UAT แล้ว: ระบบปฏิเสธ Reset Link เดิมเมื่อเปิดซ้ำ ยืนยันการทำงานแบบใช้ครั้งเดียวครบวงจร
- ผ่าน Human UAT แล้ว: Forgot Password ตอบข้อความกลางโดยไม่เปิดเผยว่าอีเมลมีบัญชีในระบบหรือไม่
- ผ่าน Human UAT แล้ว: บัญชี `ACTIVE` อัปโหลดเอกสารสมัครจริง ดูรายการ และกดเปิดไฟล์ผ่าน Signed URL ที่ตรวจสิทธิ์สำเร็จ

## 4. Checklist ตรวจรับ

### A. Auth และสถานะบัญชี

- [x] สมัครและรับ OTP 6 หลักจริง
- [x] OTP ผิดถูกปฏิเสธ และ Resend ทำงาน
- [x] Login สำเร็จและออกจากระบบแล้ว Session เดิมใช้ต่อไม่ได้
- [x] Forgot Password ตอบข้อความกลางทั้งอีเมลที่มี/ไม่มีบัญชี
- [x] Reset Link ใช้เปลี่ยนรหัสผ่านได้ และใช้ซ้ำไม่ได้
- [x] Pending, Rejected/Resubmit และ Suspended ไปหน้าที่ถูกต้อง

### B. Member

- [x] Onboarding กรอกข้อมูลหลายขั้นและส่งคำขอได้
- [x] Profile หนึ่งชุดต่อหนึ่ง Login และแก้เฉพาะข้อมูลของตนเอง
- [x] Active Member เปิด `/member/dashboard`, Profile และ History ได้
- [x] Suspended Member เห็นเฉพาะประวัติที่ตัดราคา ต้นทุน Supplier และข้อมูลภายในออก
- [x] Suspended Member สร้าง/แก้ Project หรือ Order ไม่ได้

### C. Admin และ Permission

- [x] Approve, Reject พร้อมเหตุผล, Suspend และ Reactivate ทำงาน
- [x] สร้าง Internal User และกำหนดหลาย Role ได้
- [x] เปลี่ยน Permission แล้วมีผลกับ Backend และ Direct URL/API
- [x] Force Logout ทำให้ Session ของบัญชีเป้าหมายใช้ต่อไม่ได้
- [x] ระบบไม่ยอม Suspend หรือถอด Role จาก Super Admin คนสุดท้าย
- [x] ไม่มี Role Switcher และไม่มีชื่อรวม `GISP Admin`

### D. File, Audit และ Responsive

- [x] Upload ได้เฉพาะ PDF/JPEG/PNG ไม่เกิน 10 MB และไม่เกิน 5 ไฟล์
- [x] Member อื่นเปิดไฟล์ข้าม Profile ไม่ได้
- [x] Signed URL หมดอายุภายในประมาณ 5 นาที
- [x] Status/Role/Permission/Settings/Session/File มี Audit Record และแก้ย้อนหลังไม่ได้
- [x] Desktop และ Mobile ใช้งานได้โดยไม่มีแนวนอนล้น
- [x] `/v1-4/member` และ `/v1-4/admin` ยังทำงานเหมือน Demo ที่อนุมัติ

## 5. ผลปิดงาน

- วันที่อนุมัติ: 18 สิงหาคม 2569
- ผลการตัดสิน: `SLICE_1_ACCEPTED`
- สถานะ: `DONE` บน Development
- หลักฐาน: [Slice 1 UAT Sign-off PDF](../output/pdf/2026-08-18-gisp-slice-1-uat-signoff.pdf)
- Production Deployment และการลบ Backend Branch `slice-1-access` ยังไม่ได้รับอนุมัติ
- Backend Branch คงอยู่ในสถานะ `merged` เพื่อเป็นหลักฐานและจุดอ้างอิง
- ไม่มี Human UAT ของ Slice 1 ที่ค้างอยู่
