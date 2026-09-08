# Release B — Production Readiness และ Merge Rehearsal

วันที่ตรวจ: 8 กันยายน 2569 (Asia/Bangkok)

## ผลสรุป

Release B ผ่านการซ้อมบน Backend Branch ที่สร้างจาก Production ปัจจุบันโดยตรงแล้ว
Migration, RLS, API, หน้าเว็บ และสิทธิ์ Admin/Member ผ่านตาม Gate ที่กำหนด
Production ยังเป็น Release A และยังไม่ได้ Apply Migration หรือ Deploy Release B

เงื่อนไขก่อนทำจริงเหลือ Owner Approval สำหรับ Production Deployment และการทำ Cutover พร้อม
Post-deploy Smoke Test เท่านั้น

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
| Current-production Rehearsal Branch | `release-b-rehearsal-20260908` / `f0f9a36b-ec7d-4ceb-ae28-b2d5feef85f9` |
| Rehearsal Backend | `https://m8ugbyak-p4a.ap-southeast.insforge.app` |
| Rehearsal Web | `https://gisp-release-b-rehearsal.vercel.app` |
| Rehearsal Deployment | `dpl_9J8o6uNNL5w4nbzmeduk3xWYhiKo` (`READY`) |
| Source Branch / Commit | `codex/release-b-readiness` / `7b88c43` |
| Migration Bundle | `20260908150000_release-b-shared-catalog-sourcing.sql` |
| Bundle SHA-256 | `F3889A61057C2DD7AD84F3E4ECFA88FFA97DD872664284A721267848F4E0FC72` |

Bundle รวม Migration Slice 12, Slice 12.1, Slice 13 และ Migration ซ่อน Draft จาก Member
จำนวน 5 ไฟล์ตาม Manifest ใน `output/release-b-20260908/manifest.json`
ตรวจ SHA-256 ของ Runtime Source ระหว่าง Commit กับ Source ที่ Deploy ซ้อมแล้ว พบความต่าง 0 ไฟล์

## Merge Rehearsal บนฐาน Production ปัจจุบัน

Branch รุ่นแรก `production-completion-20260906` เก่ากว่า Production ปัจจุบัน จึงไม่นำผลรอบนั้น
มาใช้เป็นหลักฐาน Merge Dry-run ขั้นสุดท้าย แม้ Integration จะผ่านก็ตาม

สร้าง Schema-only Branch `release-b-rehearsal-20260908` จาก Production ปัจจุบันใหม่ แล้วดำเนินการดังนี้:

1. ตรวจฐานว่ามี Migration Production เดิม 25 รายการ
2. Apply Release B Bundle หนึ่งไฟล์สำเร็จ ไม่มี Conflict
3. Slice 12.1 Integration/RLS ผ่าน 19 Assertions
4. Slice 13 Integration/RLS/File/Workflow ผ่าน 20 Assertions
5. สร้างเฉพาะบัญชีและข้อมูล UAT ใน Branch ไม่มีการคัดลอกข้อมูลทดสอบเข้า Production

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
| Slice 13 Integration/RLS/File/Workflow | ผ่าน 20 Assertions บน Current-production Rehearsal |
| Hosted Smoke | ผ่าน 27 Assertions |
| Responsive Browser | ผ่านที่ 390×844; ไม่มี Horizontal Overflow |
| Admin Members | หน้าและ API เปิดให้ Admin; Anonymous 401/Login; Member 403 |
| Shared Catalog | Member page/API เปิด; ปุ่มสร้างลิงก์พร้อมใช้งาน |
| Visual Sourcing | Member/Admin page/API เปิด; หน้าแนบภาพพร้อมใช้งาน |
| Public Catalog | Invalid Token ตอบ 404; Public-safe Serializer และ No-price Contract ผ่าน Integration |
| Release B Boundary | ปิด Member Custom RFQ, Quotation, Order, Payment, Claim และ Report รวม 11 Page/API Checks |
| Member Pilot Dashboard | แสดงเฉพาะ Catalog, Project, Shared Catalog, Product Sourcing และ Profile; ไม่มีลิงก์ไป Workflow ที่ปิด |

หลักฐาน Runtime อยู่ใน `output/release-b-20260908/` และไม่ถูก Commit เพราะมีข้อมูลเชื่อมระบบซ้อม
ไฟล์ที่ใช้อ้างอิงหลัก ได้แก่ `current-production-rehearsal-slice12-test.log`,
`current-production-rehearsal-slice13-test.log`, `current-production-rehearsal-hosted-smoke.log`,
ผล Security Advisor และภาพ Responsive Test

## Security Review

เปรียบเทียบ Security Advisor ของ Production ก่อน Release B กับ Rehearsal หลังลง Bundle:

| Rule | Production ก่อนลง | Rehearsal หลังลง |
| --- | ---: | ---: |
| `dangerous-function` | 137 | 137 |
| `rls-permissive` | 4 | 4 |
| `rls-select-only` | 72 | 72 |
| รวม | 213 | 213 |

ไม่มี Finding ใหม่และไม่มี `affectedObject` ที่มีชื่อ `shared_catalog`, `product_sourcing` หรือ
`sourcing` รายการเดิมยังต้องบริหารตาม Production Security Baseline และไม่ถือว่าถูกยอมรับสำหรับ
Release อื่นโดยอัตโนมัติ

ตารางใหม่ 10 ตารางเปิด RLS ครบ มี Policy ตารางละ 1 รายการ, `anon` ไม่มีสิทธิ์ SELECT
ตารางฐาน และ `authenticated` ไม่มีสิทธิ์ INSERT ตารางฐานโดยตรง การเขียนและเปลี่ยนสถานะต้องผ่าน
Trusted RPC/API ที่ตรวจสิทธิ์ ส่วน `next_record_reference(text)` ไม่เปิดให้ `anon` หรือ
`authenticated` เรียกตรง

## Cutover ที่เตรียมไว้

หลัง Owner อนุมัติ Production Deployment ให้ทำตามลำดับนี้:

1. ตรวจ Project ID ต้องเป็น Production `865860c2-49fa-4e53-908f-9396b2f75233`
2. สร้าง Backup ใหม่ชื่อ `pre-release-b-20260908` และรอจนสถานะ `completed`
3. ตรวจ SHA-256 ของ Migration Bundle ต้องตรงค่าด้านบน แล้ว Apply Bundle เพียงหนึ่งครั้ง
4. ตรวจตาราง, RLS, Permission และ Function ACL หลัง Migration ก่อน Deploy เว็บ
5. Deploy Source ที่ตรวจผ่าน โดยตั้ง `RELEASE_STAGE=B`, เปิด Shared Catalog และ Product Sourcing,
   คง `ENABLE_STAFF_OPERATIONS=true` และคง Post-go-live/Transaction Features เป็น `false`
6. ตรวจ `/api/health`, Login Owner, `/admin/members`, Member Catalog/Project, Shared Catalog,
   Visual Sourcing, สิทธิ์ Member 403 บน Admin API และ Public Invalid Token 404
7. บันทึก Deployment ID, Backup ID, เวลาตรวจ และผล Smoke Test ในเอกสารนี้

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
- Production Release B Deployment: `AWAITING OWNER APPROVAL`
- Production ณ เวลาปิดรายงาน: ยังเป็น Release A และไม่ถูกเปลี่ยน
- Final untouched check: `/api/health` ตอบ 200 ส่วน `/register`, Member Shared Catalog API และ
  Admin Sourcing API ยังตอบ 404; ตารางเป้าหมายและ `sourcing.manage` ยังไม่มีใน Production

คงเหลือ **2 ขั้นตอนเพื่อเปิด Release B**: Owner อนุมัติ Production Deployment และดำเนินการ
Cutover/Post-deploy Smoke Test ตามรายการด้านบน
