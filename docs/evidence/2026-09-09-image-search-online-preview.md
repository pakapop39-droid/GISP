# Image Search — Development Online Preview

วันที่: 9 กันยายน 2569

เว็บไซต์: https://gisp-image-search-development.vercel.app/member/catalog/image-search

เป็นเว็บไซต์ Development แยก (`gisp-image-search-development`, Vercel project `prj_pkUVmbInUqz3y4beTj75wiv4gwL7`)
เชื่อมฐานข้อมูล Development `kit6y4pj` ไม่ใช่การเปิด GISP Production
Vercel ใช้ชื่อ environment ว่า production สำหรับโดเมนหลักของเว็บไซต์ทดลองนี้
โฟลเดอร์ deploy แยกที่ `output/image-search-deploy`; `.vercel/project.json` ของ workspace เดิมยังชี้ Slice 13 ตามเดิม

## สิ่งที่ส่งมอบ

- เก็บ vector ภาพหลักของ 634 สินค้าใน `product_image_embeddings` ด้วย pgvector 1024 dimensions
- นำ cache ที่ผ่านการทดลองมา seed ทั้งหมด ไม่มี model calls ในการ seed
- ค้นหาแบบ exact cosine ใน PostgreSQL แล้วกรองผ่าน `member_catalog` ก่อนเลือก 12 ผล
- ไม่ส่ง vector, storage key, ข้อมูลโรงงาน หรือต้นทุนไป browser
- มี jobs อ้างอิง product/media/file และ revision; เปลี่ยนภาพหลัก/ลำดับ/ไฟล์แล้วเข้าคิวใหม่
- ลบภาพหลักแล้วลบ index เดิมและเข้าคิวภาพทดแทน; สินค้าเลิกเผยแพร่ไม่ผ่าน member view
- ใช้ lease และตรวจ revision ก่อนเขียนผล ป้องกัน worker เก่าเขียนทับข้อมูลใหม่
- ลองใหม่สูงสุด 3 ครั้ง ห่าง 5 นาที; งานค้าง lease หมดอายุสามารถรับใหม่ได้
- Worker ทำครั้งละไม่เกิน 4 งาน พร้อมกันไม่เกิน 2 งาน และนำ vector ของภาพ hash เดิมกลับมาใช้ได้
- งานรอ 88 รายการเป็นสินค้าร่าง ไม่ประมวลผลจนผ่านเงื่อนไขเผยแพร่/QA/ราคา
- โควตาอยู่ฐานข้อมูล: 30 ครั้งต่อบัญชี/องค์กรต่อวันตามเวลาไทย, เว้นอย่างน้อย 2 วินาทีระหว่างรับคำค้น
- เพดานรวมรอบทดลอง 10,000 reservations รวมงานสร้างดัชนีและการ retry; request ที่อาจคิดเงินแล้วไม่คืน reservation
- ค่า reservation ไม่ใช่ invoice และไม่ควรตีความเป็นค่าใช้จริง; failed/uncertain calls อาจอยู่ในยอดนี้
- Jobs/budget/index tables เปิด RLS และ revoke สิทธิ์ anon/member; worker, queue และ quota RPC เรียกได้เฉพาะ server admin
- `match_product_images` ตรวจสมาชิก ACTIVE/APPROVED/role MEMBER; ผลลัพธ์มีเพียง product ID, media ID และ similarity
- Query image ประมวลผลใน memory ไม่มีการบันทึก query ลง storage; คง provider no-training routing เดิม

## Worker และการดูแล

Endpoint: `POST /api/internal/image-search/process` ต้องมี server-only `IMAGE_SEARCH_CRON_SECRET`
ไม่รับ cookie สมาชิกเป็นสิทธิ์เรียก worker

Schedule: `GISP-Image-Search-Index`, ID `fb62bdd1-08c4-4958-9a70-bef5f3efba92`
รอบปกติทุก 5 นาที เชื่อม Secret ของ InsForge เข้ากับ Authorization header
ระหว่างตรวจครั้งแรกใช้รอบทุก 1 นาทีชั่วคราว จากนั้นคืนรอบ 5 นาที
ตรวจยืนยัน `isActive=true`, `cronSchedule=*/5 * * * *`, nextRun `2026-09-08T23:25:00Z`
และมี scheduled executions จริง 200 สำเร็จที่ `23:20:00Z` และ `23:21:00Z`

ผู้ดูแลที่มี `catalog.manage` อ่าน `GET /api/admin/catalog/image-search` ได้
เพื่อดูจำนวน READY/PENDING/PROCESSING/FAILED, รายการล้มเหลวล่าสุด และโควตา
ส่ง `POST` endpoint เดียวกันด้วย `{ "productId": "<uuid>" }` เพื่อเข้าคิวใหม่เฉพาะสินค้าที่ต้องการ
ไม่มีการ reset quota อัตโนมัติเมื่อ retry

วิธีปิด: ตั้ง `ENABLE_IMAGE_SEARCH=false` ในเว็บไซต์นี้แล้ว redeploy
หรือหยุดการคิด model requests ทันทีด้วย `image_search_budget.enabled=false`
และ pause schedule หากต้องหยุด worker ทั้งหมด เก็บข้อมูล index ไว้เพื่อนำกลับมาใช้
Feature flag ไม่เปิดได้กับ backend อื่นนอกจาก Development kit6y4pj

## หลักฐานทดสอบ

- Typecheck, lint ไฟล์ที่แก้ และ Vitest 44 files / 178 tests ผ่าน
- Hosted Next.js build และการเรียก runtime ผ่าน หลังเพิ่ม native Sharp/libvips ให้ครบใน bundle
- Anonymous, staff ที่ไม่ใช่สมาชิก, request ต่าง origin, ไฟล์เสีย และไฟล์เกินขนาดถูกปฏิเสธ
- Worker ไม่มี secret ถูกปฏิเสธด้วย 401
- Hosted API เรียก Voyage จริงและพบสินค้าต้นฉบับในผล 12 รายการ ไม่ซ้ำ ไม่มี field ภายใน
- เปิดรายละเอียดสินค้าและ signed image URLs ได้; response เป็น `Cache-Control: no-store`
- Hosted smoke หนึ่งครั้งใช้เวลารวม 2.83 วินาที (ไม่ใช่ p95)
- Browser จริงบนเว็บออนไลน์: upload → search → 12 results → เปิดรายละเอียดได้
- Mobile viewport 390×844: scrollWidth=390; ไม่พบ console errors
- Burst 5 คำค้นพร้อมกันจากบัญชีเดียว: 1×200 และ 4×429; budget เพิ่มเท่ากับ 1 คำที่รับเท่านั้น ไม่มี 500
- Worker จริงเข้าคิวสินค้าเดิมจาก revision 1 → READY revision 2; indexed=1, reused=1, failed=0 ไม่เรียก AI ซ้ำ
- Scheduled worker รันจริงสำเร็จ 2 ครั้ง และตรวจรอบสุดท้ายทุก 5 นาทีแล้ว
- SDK ตรวจสิทธิ์จริง: anon/member อ่านตาราง index/jobs/budget ไม่ได้ และเรียก admin RPC ไม่ได้; สมาชิกที่อนุมัติค้นผ่าน RPC ได้
- RPC ปฏิเสธ null vector; ผลทุก ID อยู่ใน member view ที่ผู้ทดสอบอ่านได้จริง
- Lifecycle verification ใน transaction ที่ rollback ตรวจ stale lease, retry cap, ลบภาพหลัก/ภาพทดแทน และเพดาน budget ผ่าน
- ไม่ได้เปลี่ยนสถานะสินค้า/สมาชิกถาวรเพื่อการทดสอบ

Artifacts อยู่ใน `output/image-search-spike/`: `hosted-smoke.json`, `worker-smoke.json`,
`hosted-quota-smoke.json`, `hosted-desktop.png`, `hosted-mobile.png`, `schedule.json`
ไฟล์ auth state / schedule headers / credentials เป็นข้อมูลส่วนตัวใน gitignored paths ห้ามเผยแพร่

## ขอบเขตคุณภาพและข้อจำกัด

Owner UAT ของ Local Preview ผ่านแล้วตามคำยืนยัน “ทดสอบแล้ว ผ่าน”
วันที่ 9 กันยายน 2569 หลังส่งมอบ URL ออนไลน์ เจ้าของงานยืนยันอีกครั้งว่า “ทดสอบแล้ว ผ่าน”
สถานะ Owner UAT ของ Development Online Preview: **PASS** และยอมรับการส่งมอบในขอบเขต Development
คำยืนยันนี้มาจากเจ้าของงานโดยตรง ไม่มีการอนุมานจำนวนภาพหรือสถิติความแม่นยำเพิ่มเติม

รุ่นทดลองยังไม่มี threshold สำหรับคำตอบ “ไม่มีสินค้าที่คล้ายพอ” จึงอาจคืนสินค้าใกล้เคียงแม้ไม่มีรุ่นที่ต้องการ
หน้า UI แจ้งข้อจำกัดนี้แล้ว ไม่มีตัวเลขเปอร์เซ็นต์ความถูกต้อง
การรับรองชุดภาพจริง/negative cases และ load test ของผู้ใช้ 5 คนแยกกันยังไม่ใช่หลักฐานที่ได้จาก burst บัญชีเดียว
ให้เก็บเป็นเกณฑ์ก่อนขยายไป Production ไม่ตีความว่าเป็นเงื่อนไขให้ผู้ใช้ทดสอบ Local ซ้ำ

ดัชนีครอบคลุมภาพหลักหนึ่งภาพต่อสินค้า ไม่ใช่ทุกมุมของภาพ 3,568 รายการ
การแก้ไฟล์ผ่าน GISP ใช้ file/media references และ metadata ที่ trigger ตรวจได้
การเขียนทับ bytes ตรงใน storage key เดิมโดยไม่แก้ metadata อยู่นอก flow ที่รองรับ ต้องสั่งเข้าคิวใหม่
รอบ 5 นาทีเป็นรอบเรียก worker ไม่ใช่ SLA ว่าคิวขนาดใหญ่จะเสร็จทั้งหมดใน 5 นาที

## หมายเหตุการติดตั้ง

- Backend branches เต็ม 2 สาขา จึงใช้ additive tables/functions ใน Development ไม่แก้ RLS ตารางธุรกิจเดิม
- Manual backup เต็ม 5/5; ไม่ลบ backup เดิมเพื่อเปิดที่ว่าง Latest backup ที่ตรวจได้ชื่อ `20260908_112357.sql.gz`
- แยก migration แรกไป `output/image-search-migration` เพื่อไม่ให้ติดตั้งไฟล์ Release B ที่ยัง pending และอยู่นอกงานนี้
- Migration `20260908230528_verify-image-search-lifecycle.sql` เป็นการตรวจ Development หลัง seed: ต้องมี seeded index ก่อนใช้ ไม่ใช่คำสั่งสำหรับ fresh production bootstrap
- Platform ไม่อนุญาตเปลี่ยน SQL session claims ผ่าน CLI จึงตรวจสิทธิ์จริงด้วย SDK login แทน ไม่ปิดหรือหลบข้อจำกัดนั้น
- New Vercel project ต้องระบุ `framework: nextjs`; ตั้ง runtime region `sin1` ให้ใกล้ฐานข้อมูล
- Sharp 0.35.3 ต้องรวม Linux native runtime/libvips ใน output tracing; อ้างอิง [Next.js output tracing](https://nextjs.org/docs/app/api-reference/config/next-config-js/output) และ [Sharp installation](https://sharp.pixelplumbing.com/install/)

## สถานะปิด Slice: เหลือ 0 ขั้นตอน

ปิด Slice Image Search สำหรับ Development แล้ว หลังเจ้าของงานยืนยันการใช้งานรุ่นออนไลน์ผ่าน
การเปิด GISP Production อยู่ในแผน release แยกตามขอบเขตเดิม
