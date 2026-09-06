# Production CN01, recovery rehearsal, and catalog verification

วันที่ 6 กันยายน 2569 — ต่อจากคำสั่งให้ทำ 6 ขั้นตอนที่เหลือต่อเนื่อง

## ผลที่ทำจริง

| รายการ | ผล |
| --- | --- |
| Production | `865860c2-49fa-4e53-908f-9396b2f75233` |
| เว็บจริง | https://m8ugbyak.insforge.site |
| Deployment ล่าสุด | `cc6afecf-83dc-4a96-b362-2bd4828834d9`, READY |
| ขอบเขตเปิดใช้ | Release A; ยังไม่เปิดสมัคร/ธุรกรรมสมาชิก |
| CN01 Products | 722: PUBLISHED 634, DRAFT 88 |
| หมวด / Supplier | 8 / 1 |
| Variants / Options / Option Values | 1,111 / 653 / 965 |
| Cost Versions / Member Prices | 722 / 722 |
| รูป / รูปหลัก | 3,942 / 722 |
| บัญชี / Member Profile / Order หลังนำเข้า | 1 / 0 / 0 |

## ขอบเขตข้อมูล

Owner อนุญาตใช้ CN01 เป็นชุดแรก นำเฉพาะข้อมูล CN01 และความสัมพันธ์ที่จำเป็นมาจาก
ชุดที่ใช้อยู่ใน Development ไม่ย้ายบัญชี สมาชิก ออเดอร์ ข้อมูล UAT หรือ audit เดิม
บันทึก source actors เป็นข้อมูลต้นทางในไฟล์หลักฐาน ส่วน actor ที่เขียนข้อมูล Production
ใช้ Owner ของ Production และบันทึก audit การนำเข้าชุดสินค้า

ใช้ราคาและสเปกของชุด CN01 ปัจจุบัน ตรวจจำนวนและ SKU ตรง manifest 722 รายการ
ตรวจ arithmetic ของราคาทั้ง 722 รายการตรง cost version และ calculation snapshot
ตรวจ hash รูปต้นทาง 3,942 รูปก่อนส่ง และตรวจ download hash จาก Production 12 รูปที่กระจายตลอดชุด
คงค่าเดิมที่ใช้กับชุดนี้: CNY → THB 5, lead time 60 วัน และสูตรราคาที่ source price อ้างอิง
ยังต้องตรวจข้อมูลทางธุรกิจและรับมอบก่อนเปิดธุรกรรม ไม่มีการรับรองราคาตลาดหรือประเมิน supplier ใหม่ในรอบนี้

สินค้าเข้าระบบเป็น DRAFT ก่อนแนบรูป จากนั้นเรียก validation, submit review, review,
publish ผ่านฟังก์ชันธุรกิจของ Production สำหรับเฉพาะ 634 รายการที่เคย PUBLISHED
อีก 88 รายการคง DRAFT ไม่เติมสเปกที่ยังขาดเพื่อบังคับเผยแพร่

สคริปต์: `scripts/production-cn01-transfer.mjs` ตรวจ project ID แบบระบุแน่นอนทุก target
เก็บ export/manifest/upload state/result ใน `output/production-completion-20260906/cn01`
ซ้อมการนำเข้าข้อมูลตารางใน branch ก่อน Production และสร้าง backup ก่อนนำเข้า

## การสำรองและกู้คืน

1. Database backup `ac61cef8-a7dd-4e11-8db8-75203844b5f4`: แก้ sentinel หลัง backup แล้ว restore ชื่อบริษัทกลับตรง baseline
2. Database + Storage backup `f1c9daaa-9645-4696-8e8c-a7b75caac05c`: เขียนทับไฟล์ตัวอย่างหลัง backup แล้ว restore และตรวจ hash กลับตรง baseline
3. พบว่า CLI ตอบ `restored:true` ก่อนอ่าน Storage ได้ข้อมูลที่กู้ครบ ต้องตรวจเนื้อหาจริงหลัง restore; รอบนี้ตรวจตรงและ signed URL ยืนยันได้ภายหลังประมาณ 45 วินาที
4. จัดทำ `docs/active/PRODUCTION OPERATIONS RUNBOOK.md` รวม cutover, rollback, การกระทบยอด และผู้รับผิดชอบ

การกู้ทั้งหมดทำใน branch ของการซ้อม ไม่มีการ restore ทับ Production

จุดสำรองสุดท้ายหลัง CN01 และ hardening: `cn01-catalog-ready-20260906`,
ID `7fc7db66-0ca1-4640-aa47-c9c6e7736940`, สถานะ `completed`

## Security review เพิ่มเติม

Advisor scan ก่อน hardening รอบนี้แจ้ง critical 137 รายการ ทั้งหมดเป็น rule
`dangerous-function` สำหรับ SECURITY DEFINER ที่ authenticated เรียกได้
อ่าน definitions จริง 160 ฟังก์ชัน: anon เรียกได้ 0, ทุกฟังก์ชันตั้ง search_path
ตัวเลข rule ไม่ใช่หลักฐานว่ามี privilege escalation ทั้งหมด และไม่ได้ suppress ผลเพื่อทำให้รายงานเป็นศูนย์

พบตัวสร้างเลข `next_document_number(text)` และ `next_record_reference(text)`
ไม่จำเป็นต้องเปิดเป็น RPC โดยตรง จึง revoke จาก PUBLIC/anon/authenticated ด้วย migration
`20260906020000_restrict-sequence-helper-rpc.sql` ทั้ง rehearsal และ Production
ฟังก์ชันธุรกิจที่มีสิทธิ์ครบยังเรียกภายในได้

- Direct member RPC ทั้งสองตัว: permission denied จริง
- Privileged allocation: ผ่าน
- Slice 3 + Slice 6 regression ใน rehearsal: 22 + 19 assertions ผ่าน
- Production ตรวจ ACL หลัง migration: authenticated/anon false ทั้งสองตัว
- ข้อเตือนส่วนที่เหลือยังเป็นรายการที่ต้องพิจารณาร่วมกับ permission/RLS tests และขอบเขต release; ไม่ใช้การยอมรับความเสี่ยง Release A เป็นการยอมรับอัตโนมัติของ Release B–D

## ข้อผิดพลาดที่พบจากเว็บจริงและแก้แล้ว

Owner session โหลด `/admin/catalog` เห็น PRODUCTS 300 ทั้งที่ DB มี 722
สาเหตุ API จำกัด `.limit(300)` แก้เป็นอ่านทีละ 200 ด้วยลำดับ created_at และ id
จนได้ครบ ไม่ส่งรายการบางส่วนเป็นผลสำเร็จหากหน้าใดอ่านล้มเหลว

- Regression tests 3 ข้อ: 722 รายการครบ, batch ถัดไปล้มเหลวไม่ส่งข้อมูลไม่ครบ, ตรวจสิทธิ์ก่อนอ่าน
- TypeScript, ESLint เฉพาะไฟล์ และ production build ผ่าน
- Deploy READY และ browser Owner เห็น PRODUCTS **722** จริง
- เอาข้อความเก่า “Backend Branch ของ Slice 2” ออกจาก Catalog และ “Slice 1” ออกจากหน้า login
- Public smoke หลัง deploy 10/10 ผ่าน

## สิ่งที่ยังต้องใช้ข้อมูลจาก Owner

ถามข้อมูลบริษัทแล้ว Owner ถามกลับว่าหมายถึงบริษัทตนเองหรือ Member จึงชี้แจงว่า
เป็นบริษัทผู้ดำเนินงาน GISP ซึ่งใช้เป็นผู้ออกเอกสารการขาย ข้อมูลของ Member ให้สมาชิกกรอกแยก
เปิด `/admin/settings` ใน Chrome ของ Owner ให้แล้ว โดยยังไม่ได้ใส่ข้อมูลสมมติ

ตรวจล่าสุดชื่อนิติบุคคล เลขภาษี ที่อยู่ และอีเมลบริษัทยังว่าง
ยังไม่มีรายชื่อทีมปฏิบัติงานหรือ Member Pilot ที่ยืนยัน และยังไม่มีผลรับมอบจาก Owner

## จำนวนขั้นตอนหลักที่เหลือ

จากแผน 8 ขั้นตอน: ขั้น 1–2 เสร็จก่อนรอบนี้; รอบนี้ปิดขั้น 4 backup/restore/runbook
ขั้น 3 นำ CN01 สำเร็จแล้ว แต่ยังขาดข้อมูลบริษัทและทีม

เหลือ **5 ขั้นตอนหลัก**: (3) ข้อมูลบริษัท/ทีมและตรวจรับข้อมูลธุรกิจ, (5) Member Pilot,
(6) เปิดธุรกรรม, (7) เปิดงานหลังสั่งซื้อ, (8) UAT/รับมอบ
การพัฒนาและซ้อมฟังก์ชันหลักทำไว้แล้ว แต่ยังไม่รายงานว่าครบวงจรบน Production
