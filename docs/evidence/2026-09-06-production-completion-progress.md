# Production completion — execution record

วันที่ 6 กันยายน 2569; ยังไม่เปิด Member หรือธุรกรรมบน Production

## คำสั่งและขอบเขต

- เจ้าของระบบให้ดำเนินการตามแผน Production Completion ต่อเนื่อง
- อนุญาตใช้ CN01 เป็นสินค้าชุดแรก
- เมื่อโควตา Branch เต็ม เจ้าของระบบให้ตรวจและเสนอพื้นที่ที่จะลบก่อน ยังไม่ได้อนุญาตลบ

## สิ่งที่ตรวจและเตรียมแล้ว

- Production deployment ยัง `b90108ef-3d6b-447e-97de-fc8bcd9a9f7e`
- Production: users 1, products 0, suppliers 0
- Company Settings ยังไม่มี legal name, tax ID, address, company email
- มี bucket `gisp-confidential` / `gisp-member-private` แบบ private และ `gisp-public` แบบ public
- RLS table ที่ไม่มี policy = 0; public-schema security-definer ที่ anon เรียกได้ = 0
- ชุด migration จากประวัติ Development ที่ยังไม่อยู่ Production 29 รายการ พร้อม SHA-256
  เก็บใน `output/production-completion-20260906/manifest.json` และ `migrations/` ใต้โฟลเดอร์เดียวกัน
- ชุดนี้รวม Slice 3–11, hardening และ staff-job-groups ที่ใช้จริงบน Development;
  ไม่รวม local Slice 12–13 ที่ยังไม่ผ่านตรวจรับครบ
- Production-only hardening `20260904214500` ต้องรักษาไว้
- ยังไม่ apply ชุด migration หรือ deploy frontend Production
- CN01 บน Development: รวม 722 รายการ (PUBLISHED 634 / DRAFT 88);
  ห้ามเปิดขาย 88 รายการที่ยังไม่ผ่านเงื่อนไขโดยอัตโนมัติ
- สคริปต์ชื่อ `enrich-cn01-production.mjs` ตรวจ expected project เป็น Development;
  ห้ามรันบน Production ด้วยการเดาจากชื่อหรือเปลี่ยน ID โดยไม่ตรวจขั้นตอนทั้งหมด

## การแก้โค้ดและผลตรวจ

- เพิ่ม gate ฝั่ง Proxy สำหรับหน้า/API Slice 12–13 ที่ยังไม่เปิด เมื่อ RELEASE_STAGE เป็น A/B/C/D
  และ NEXT_PUBLIC_ENABLE_POST_GO_LIVE_FEATURES ไม่เป็น true; คง branch preview ที่เปิด explicit flag
- อนุญาตเฉพาะรูป Sale Page สองไฟล์ผ่าน Release A; ไม่ปลดล็อกโฟลเดอร์ assets ทั้งหมด
- Focused gate tests 8/8, TypeScript และ lint ไฟล์ที่แก้ผ่าน
- Full unit tests 39 files / 153 tests ผ่าน; local production build 118 pages ผ่าน
- Build ในเครื่องต้องใช้ `NODE_USE_SYSTEM_CA=1` เพื่อเชื่อมต่อ Google Fonts
- Workspace มีงาน Slice 12–13 จากงานอื่น ต้อง snapshot และตรวจ release manifest ซ้ำก่อน deploy

## Backup

- สร้าง `pre-production-completion-20260906` และดาวน์โหลด backup
  `output/production-completion-20260906/20260906_002131.sql.gz`
- SHA-256: `DC12F56179DAB0FBA875DD4643A6FCC5234AD5DD320845E73A26CAC34A1CA2BB`
- ยังไม่ได้ซ้อม restore; การมี backup ไม่ถือว่า Gate restore ผ่าน

## อุปสรรคการซ้อม Production

สร้าง `production-completion-20260906` แบบ schema-only ถูกปฏิเสธ:
`Per-org quota: max 3 parent projects with branches` จึงไม่มี Branch ใหม่ถูกสร้างสำเร็จ

ตรวจทุก parent ผ่าน linked directory แยกใน tmp โดยไม่เปลี่ยน link ของ GISP:

| Parent | Branch | ผลพิจารณา |
|---|---|---|
| GISP Development | slice-12-shared-catalog | Human UAT/Development Integration ผ่านภายหลังในวันเดียวกัน; เก็บไว้เป็นหลักฐานและรอจัดการ Branch Slot แยก |
| GISP Development | slice-8-shipment-delivery | งาน Slice 8 รวมแล้ว แต่ลบอันเดียวไม่คืน parent quota |
| VS Material Stock | s01-foundation-auth, s08-admin-material-edit | ยังไม่แนะนำลบ หลักฐานไม่พอว่างานและข้อมูลถูกรวมครบ |
| Smart BOQ for interior | import-data-maintenance-v1 | merged ตาม live state และ release evidence; เป็น candidate |
| Smart BOQ for interior | smart-import-resolution | ready แต่ release evidence ยืนยันว่างาน deployed; เป็น candidate หลังสำรองและ owner ยืนยันเลิกใช้ |

Parent อื่นอีก 10 โปรเจ็กต์ไม่มี Branch ตามผลตรวจครั้งนี้
ต้องคืน Branch ทั้งหมดของ parent ใด parent หนึ่งเพื่อให้ Production กลายเป็น parent ใหม่ได้

Smart BOQ `smart-import-resolution` dry-run: 0 added / 0 modified / 1 conflict
ที่ `edge_function.preview-organization-data-import` (parent และ branch เป็นคนละรุ่น)
ไม่ merge ไม่ resolve conflict ไม่แก้ Smart BOQ production
เริ่มสร้าง backup แยกสำหรับทั้งสอง candidate ชื่อ `before-proposed-branch-cleanup-20260906`
ต้องตรวจว่า backup เสร็จและเก็บนอก Branch ก่อนลบ; backup ฐานข้อมูลไม่ครอบคลุมไฟล์ Storage โดยอัตโนมัติ
ตรวจ/เก็บไฟล์และ runtime artifact ที่จำเป็นหากเจ้าของระบบต้องการรักษาสภาพแวดล้อมนี้

## ขั้นตอนถัดไป

### Update หลังคำอนุมัติลบ Branch

- เจ้าของระบบอนุญาตลบ Smart BOQ test branches ทั้งสองอันโดยระบุชื่อผ่านข้อความก่อนหน้า
- ดาวน์โหลด backup ทั้งคู่ ตรวจ gzip integrity และ SHA-256 แล้ว; ลบสำเร็จและ Branch list ของ Smart BOQ ว่าง
- สร้าง GISP Production branch `production-completion-20260906` สำเร็จ (id `2cff11a0-9e16-41d4-989a-dcfc9f48103d`)
- CLI ไม่ยอม apply migration ย้อนก่อน production hardening head จึงรวม 29 source migrations
  เป็น `20260906010000_production-mvp-upgrade.sql` โดยรักษาลำดับและ hash ต้นฉบับ
- Schema-only branch ไม่เก็บ lookup rows; กู้ branch กลับ T0 แล้ว seed เฉพาะ roles, permissions,
  role_permissions, company settings และ countries จาก Production ก่อนซ้อมต่อ
- Seed migrations เป็นของพื้นที่ซ้อมเท่านั้น ห้ามนำเข้า Production หรือใช้ branch merge ทั้งชุด
- Integration Slice 1–11 ผ่าน 180 assertions; anon definer execute = 0; missing RLS policies = 0
- Frontend snapshot build ผ่าน 118 pages; rehearsal deployment `d94931ce-aac1-432c-a010-c9c34d74a7c7` READY
- URL ซ้อม `https://m8ugbyak-nfh.insforge.site`; authenticated HTTP smoke 20/20
- หน้าและ API `/admin/members` เปิดได้ด้วย staff; member ถูกปฏิเสธ 403
- หน้า Sale Page และ Login เปิดได้ใน browser; mobile width 390 ไม่มี horizontal overflow
- เตรียมนำเฉพาะ upgrade bundle และ frontend ที่ตรวจแล้วขึ้น Production โดยคง RELEASE_STAGE=A
  จนข้อมูลบริษัท/ทีมงาน/สมาชิกเริ่มต้นและการตรวจรับพร้อม; ไม่ถือว่า Member launch เสร็จแล้ว

1. ให้เจ้าของระบบพิจารณา candidate cleanup; ยังไม่ลบหากไม่อนุญาต
2. เมื่อมีโควตา สร้างพื้นที่ซ้อมจาก Production และทดสอบชุด migration/สิทธิ์/restore
3. ยืนยันข้อมูลบริษัท บัญชีรับเงิน ทีมงาน และสมาชิกเริ่มต้น; เตรียม CN01 ตามสถานะที่ตรวจได้จริง
4. ดำเนิน release ตามแผนพร้อม production UAT ก่อนประกาศพร้อมใช้งาน

## ผลเผยแพร่ Production รอบนี้

- Backup `pre-mvp-upgrade-20260906` completed ก่อนเปลี่ยนฐานข้อมูล;
  สำเนาอยู่ใน `output/production-completion-20260906/production/` และ SHA-256
  `34F6ED91BC113D46E790D2482863811DE416A35B9F86666DC80E59B56D3FF1D5`
- Apply เฉพาะ `20260906010000_production-mvp-upgrade` สำเร็จ;
  ไม่ใช้ branch merge และไม่ apply rehearsal seed migrations
- หลังอัปเกรด: Owner ACTIVE/SUPER_ADMIN; users 1, products 0, orders 0, members 0
- anon security-definer execute = 0; RLS tables without policy = 0
- Production frontend deployment `338c77b3-dfd5-438d-84c1-cc02066f7de9` READY
- URL จริง `https://m8ugbyak.insforge.site`; RELEASE_STAGE=A และ post-go-live features=false
- Sale Page เป็นหน้าแรกจริง; menu ฝั่ง admin กรองตาม Release A; เปิดเส้นทาง staff member review
  แต่การสมัครสมาชิกภายนอกยังปิด
- Public HTTP smoke 10/10: home/login/health/assets 200, member review page redirect ไป login,
  member review API anonymous 401, signup/member-order/pending-feature paths 404
- Browser จริงเปิด Sale Page ได้และไม่พบ console errors; ไม่ได้ใช้บัญชี Owner ล็อกอิน Production รอบนี้
- Authenticated staff/member HTTP smoke 20/20 เป็นผลบน rehearsal ไม่ใช่ Production
- หลักฐาน source hashes: `output/production-completion-20260906/frontend-manifest.json`

สถานะ 8 ขั้นตอน: ขั้นตอน 1 ตรวจช่องว่างและขั้นตอน 2 แก้/ซ้อมผ่าน;
ยังเหลือ 6 ขั้นตอนหลักที่ยังปิดไม่ครบ: ข้อมูลจริง, แผนกู้คืน/restore ที่ครอบคลุมข้อมูลจริง,
เปิด Member Pilot, เปิดธุรกรรม, เปิดงานหลังสั่งซื้อ, UAT/ส่งมอบ
การมี schema ครบและหน้าเว็บเผยแพร่แล้วไม่เท่ากับเปิด Member launch แล้ว
