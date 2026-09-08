# Release B — Production Readiness, Cutover และ Post-deploy Verification

วันที่ตรวจล่าสุด: 9 กันยายน 2569 (Asia/Bangkok)

## ผลสรุป

Owner อนุมัติ Production Deployment เมื่อ 9 กันยายน 2569 และดำเนินการ Release B Cutover แล้ว
Migration, RLS, API, หน้าเว็บ และสิทธิ์ Admin/Member ผ่านตาม Gate ที่กำหนด Production ปัจจุบัน
เป็น Release B Member Pilot และ Transaction Workflow ที่อยู่นอกขอบเขตยังปิดอยู่

## ขอบเขตที่จะเปิดเพิ่ม

- หน้าอนุมัติและดูแลบัญชีสมาชิกตาม DEC-055
- Member Catalog, Project และ Workflow ของ Member Pilot ตาม Release B เดิม
- Slice 12/12.1: Shared Catalog แบบ Product, Project, Curated และ Full Catalog โดยหน้าลูกค้าไม่แสดงราคา
- Slice 13: ส่งภาพสินค้าที่ไม่มีในแอป, Operations Sourcing Queue, Candidate และเชื่อม Product Lifecycle
- ยังคงปิด Quotation, Order, Payment และ Post-go-live Workflow ที่ไม่อยู่ใน Member Pilot

## ระบบและ Artifact ที่ตรวจ

| รายการ | ค่า |
| --- | --- |
| Production Project | `865860c2-49fa-4e53-908f-9396b2f75233` |
| Production URL | `https://m8ugbyak.insforge.site` |
| Production Deployment ก่อน Release B | `6b865051-aebc-4919-959e-d5aae0bc145b` (`READY`) |
| Production Deployment หลัง Release B | `e992de1f-be9a-4344-89d9-0b502fe7d777` / Provider `dpl_Cmnn8odtk794aJdjNGcLavCiyeNX` (`READY`) |
| Current-production Rehearsal Branch | `release-b-rehearsal-20260908` / `f0f9a36b-ec7d-4ceb-ae28-b2d5feef85f9` |
| Rehearsal Backend | `https://m8ugbyak-p4a.ap-southeast.insforge.app` |
| Rehearsal Web | `https://gisp-release-b-rehearsal.vercel.app` |
| Rehearsal Deployment | `dpl_9J8o6uNNL5w4nbzmeduk3xWYhiKo` (`READY`) |
| Source Branch / Commit ที่ Deploy | `codex/release-b-readiness` / `45b7b03` |
| Migration Bundle | `20260908170000_release-b-member-pilot.sql` |
| Bundle SHA-256 | `F46811B41386D824B66A795201EA6E20A596E99F6E1778E3B3AE8C0BF9399AE5` |

Bundle รวม Migration Slice 12, Slice 12.1, Slice 13, Migration ซ่อน Draft จาก Member และ
Backend Transaction Gate ของ Release B จำนวน 6 ไฟล์ตาม Manifest ใน
`output/release-b-20260908/manifest.json`
ตรวจ SHA-256 ของ Runtime Source ระหว่าง Commit กับ Source ที่ Deploy ซ้อมแล้ว พบความต่าง 0 ไฟล์

## Merge Rehearsal บนฐาน Production ปัจจุบัน

Branch รุ่นแรก `production-completion-20260906` เก่ากว่า Production ปัจจุบัน จึงไม่นำผลรอบนั้น
มาใช้เป็นหลักฐาน Merge Dry-run ขั้นสุดท้าย แม้ Integration จะผ่านก็ตาม

สร้าง Schema-only Branch `release-b-rehearsal-20260908` จาก Production ปัจจุบันใหม่ แล้วดำเนินการดังนี้:

1. ตรวจฐานว่ามี Migration Production เดิม 25 รายการ
2. Apply Release B Bundle หนึ่งไฟล์สำเร็จ ไม่มี Conflict
3. Slice 12.1 Integration/RLS ผ่าน 19 Assertions
4. Slice 13 Integration/RLS/File/Workflow ผ่าน 25 Assertions รวมการปฏิเสธ Member จากคำสั่ง Admin 5 รายการ
5. Backend Transaction Gate ผ่าน 16 Assertions โดยเรียก RPC ตรงด้วยบัญชี Member
6. สร้างเฉพาะบัญชีและข้อมูล UAT ใน Branch ไม่มีการคัดลอกข้อมูลทดสอบเข้า Production

Preflight บน Production Parent ยืนยันว่ามี Role `PRODUCT_ADMIN`, `PURCHASING` และ
`SUPER_ADMIN` ครบสำหรับรับ Permission ใหม่ และยังไม่มีตาราง `shared_catalogs`,
`product_sourcing_requests` หรือ Permission `sourcing.manage` ก่อน Cutover

## ผลตรวจคุณภาพ

| Gate | ผล |
| --- | --- |
| Type Check | ผ่าน |
| ESLint | ผ่าน |
| Unit Test | ผ่าน 42 Test Files / 172 Tests |
| Production Build | ผ่าน 118 Pages/Routes |
| Slice 12.1 Integration/RLS | ผ่าน 19 Assertions บน Current-production Rehearsal |
| Slice 13 Integration/RLS/File/Workflow | ผ่าน 25 Assertions บน Current-production Rehearsal |
| Hosted Smoke | ผ่าน 27 Assertions |
| Responsive Browser | ผ่านที่ 390×844; ไม่มี Horizontal Overflow |
| Admin Members | หน้าและ API เปิดให้ Admin; Anonymous 401/Login; Member 403 |
| Shared Catalog | Member page/API เปิด; ปุ่มสร้างลิงก์พร้อมใช้งาน |
| Visual Sourcing | Member/Admin page/API เปิด; หน้าแนบภาพพร้อมใช้งาน |
| Public Catalog | Invalid Token ตอบ 404; Public-safe Serializer และ No-price Contract ผ่าน Integration |
| Release B Boundary | ปิด Member Custom RFQ, Quotation, Order, Payment, Claim และ Report รวม 11 Page/API Checks |
| Member Pilot Dashboard | แสดงเฉพาะ Catalog, Project, Shared Catalog, Product Sourcing และ Profile; ไม่มีลิงก์ไป Workflow ที่ปิด |
| Backend Transaction Gate | ผ่าน 16 Assertions; Member เรียก RPC สร้าง Transaction โดยตรงไม่ได้ |

หลักฐาน Runtime อยู่ใน `output/release-b-20260908/` และไม่ถูก Commit เพราะมีข้อมูลเชื่อมระบบซ้อม
ไฟล์ที่ใช้อ้างอิงหลัก ได้แก่ `final-bundle-slice12-test.log`,
`final-bundle-slice13-test.log`, `final-bundle-backend-gate.log`, `final-bundle-hosted-smoke.log`,
ผล Security Advisor และภาพ Responsive Test

## Security Review

Trigger Security Advisor Scan ใหม่ทั้ง Production ก่อน Release B และ Rehearsal หลังลง Final Bundle:

| Rule | Production ก่อนลง | Rehearsal หลังลง |
| --- | ---: | ---: |
| `dangerous-function` | 135 | 142 |
| `rls-permissive` | 4 | 4 |
| `rls-select-only` | 72 | 82 |
| รวม | 211 | 228 |

ผลต่างประกอบด้วย `dangerous-function` ใหม่ 22 รายการจาก RPC ของ Shared Catalog และ Product
Sourcing ที่ต้องเปิดให้ Member/Operations เรียกผ่าน Authenticated Session และ `rls-select-only`
ใหม่ 10 รายการจากตารางใหม่ที่ตั้งใจให้ Client อ่านอย่างเดียว ส่วนการเขียนต้องผ่าน Trusted RPC
Advisor จึงแจ้งตามรูปแบบสิทธิ์ แม้ฟังก์ชันมี Owner/Permission/State Guard

Final Bundle ถอนสิทธิ์ `dangerous-function` เดิม 15 รายการที่ใช้สร้างธุรกรรมหลัง Release B
และ Backend Test เรียกครบ 16 Transaction RPC ด้วยบัญชี Member แล้วได้ `permission denied`
ทุกครั้ง RPC ใหม่ 22 รายการผ่าน Integration/RLS 44 Assertions ครอบคลุมข้ามบริษัท, Admin Permission,
Controlled Field, Append-only และ Member-safe Projection โดยไม่ Suppress Advisor Finding

ตารางใหม่ 10 ตารางเปิด RLS ครบ มี Policy ตารางละ 1 รายการ, `anon` ไม่มีสิทธิ์ SELECT
ตารางฐาน และ `authenticated` ไม่มีสิทธิ์ INSERT ตารางฐานโดยตรง การเขียนและเปลี่ยนสถานะต้องผ่าน
Trusted RPC/API ที่ตรวจสิทธิ์ ส่วน `next_record_reference(text)` ไม่เปิดให้ `anon` หรือ
`authenticated` เรียกตรง

หลัง Production Cutover รัน Scan `f33db0a7-f5b6-4efd-81c2-801952d6d1ce` ซ้ำ ได้ Security
Findings 228 รายการ (`dangerous-function` 142, `rls-permissive` 4, `rls-select-only` 82)
ตรงกับ Rehearsal ทุกค่า และไม่ได้ Suppress Finding

## ผล Production Cutover

1. ตรวจ Project ID เป็น Production `865860c2-49fa-4e53-908f-9396b2f75233` และ Bundle Hash ตรง
2. ลบ Manual Backup เก่าสุด `pre-release-a-phase5-2026-09-04` เนื่องจากโควตา 5/5 โดยยังเก็บ
   Backup ก่อน/หลังงาน Production รุ่นใหม่กว่าไว้ แล้วสร้าง `pre-release-b-20260909`
   Backup ID `4ceb701e-fed3-4ee6-95e0-e821093526dd` สถานะ `completed`
3. Apply `20260908170000_release-b-member-pilot.sql` สำเร็จหนึ่งไฟล์
4. ตรวจตารางใหม่ 10 ตาราง: RLS เปิดครบ, Policy ตารางละ 1, `anon` ไม่มี SELECT และ
   `authenticated` ไม่มี INSERT ตารางฐานโดยตรง
5. ตรวจ Transaction RPC 16 รายการ: `authenticated` และ `anon` มีสิทธิ์ Execute 0 รายการ
6. Deploy Source Commit `45b7b03` โดย Runtime ตรงกับชุดซ้อม เปิด Release B, Shared Catalog,
   Product Sourcing และ Staff Operations พร้อมคง Post-go-live Transaction Features ปิด
7. Anonymous Production Smoke ผ่าน 25 Assertions; Owner Session เปิด `/admin/members` และ
   `/admin/sourcing-requests` พร้อมโหลดข้อมูลสำเร็จ
8. ข้อมูลเดิมหลัง Cutover ยังครบ 722 สินค้า, 722 ราคา และ 3,942 รูป; ตารางใหม่เริ่มที่
   Shared Catalog 0 และ Product Sourcing Request 0 รายการ

## แผนย้อนกลับ

- หากเว็บมีปัญหาแต่ยังไม่มี Member เขียนข้อมูล ให้ย้อน Frontend ไป Deployment
  `6b865051-aebc-4919-959e-d5aae0bc145b` และตรวจ Release A Smoke Test
- หาก Migration ผ่านแต่ Frontend ไม่ผ่าน ให้ย้อนเว็บก่อน ตารางใหม่เป็น Additive และยังไม่ถูกรันจาก
  Release A จึงเก็บ Schema ไว้ได้ระหว่างแก้
- หากมี Member เริ่มเขียนข้อมูลแล้ว ห้าม Restore Backup ทับทันที ให้ปิดทางเข้าฟังก์ชันใหม่ด้วย Release
  Flags, เก็บข้อมูลที่เกิดหลัง Cutover และแก้ไปข้างหน้า
- Restore Backup ทำได้เฉพาะเมื่อยืนยันว่าไม่มีข้อมูลใหม่ที่ต้องเก็บ หรือผ่านการกระทบยอดกับ Owner แล้ว

## สถานะการอนุมัติ

- Slice 12, 12.1 และ 13: Human UAT / Owner Sign-off ผ่านบน Development
- Technical Production Rehearsal: ผ่าน
- Production Release B Deployment: `OWNER APPROVED / LIVE`
- Production Deployment: `e992de1f-be9a-4344-89d9-0b502fe7d777` สถานะ `READY`
- `/api/health` ตอบ 200, `/register` เปิด, Member/Admin Feature Routes เปิดตาม Release B,
  Public Invalid Token ตอบ 404 และ Transaction Routes ยังตอบ 404

คงเหลือ **0 ขั้นตอนเพื่อเปิด Release B**
