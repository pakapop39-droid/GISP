# GISP Image Search — Local Preview

วันที่: 9 กันยายน 2569 (Asia/Bangkok)

สมาชิกทดลองอัปโหลดภาพค้นหาสินค้าจริงได้ที่ `http://127.0.0.1:3108/member/catalog/image-search`
บนเครื่องพัฒนาที่เปิดเซิร์ฟเวอร์ไว้ ใช้บัญชีสมาชิก Development เดิม หน้า Catalog มีปุ่ม “ค้นหาด้วยรูปภาพ · ทดลอง”
ไม่ได้เผยแพร่ขึ้น Production และลิงก์ loopback นี้ไม่ใช่ลิงก์สำหรับเปิดจากมือถือหรือเครื่องอื่น

## วิธีทดลอง

1. เข้าสู่ระบบด้วยบัญชีสมาชิก Development
2. เลือกรูป JPEG, PNG หรือ WebP ไม่เกิน 10 MB / 40 ล้านพิกเซล
3. เลือกทุกหมวดหรือหมวดที่ต้องการ แล้วกด “ค้นหาด้วยรูปนี้”
4. เปิดรายละเอียดจากผลค้นหา หรือล้างรูป/เปลี่ยนรูปเพื่อค้นหาใหม่

ภาพเกิน 3 MB ย่อใน browser ก่อนส่ง ส่วน API จำกัด request ที่ 3 MB + multipart overhead
และ decode/ตรวจลายเซ็น/จำกัดพิกเซลก่อนประมวลผล ไม่รองรับภาพเคลื่อนไหวในตัว decoder
ใช้ภาพหลัก 634 สินค้า แสดงสูงสุด 12 ผล ไม่แสดงความคล้ายเป็นเปอร์เซ็นต์ความถูกต้อง
ยังไม่ตัดผลด้วย threshold ดังนั้นภาพที่ไม่มีสินค้าตรงอาจยังแสดงสินค้าใกล้เคียง

## เปิดเซิร์ฟเวอร์อีกครั้ง (สำหรับผู้ดูแล)

ต้องมี `.env.local` ของ Development พร้อม existing `OPENROUTER_API_KEY`
และไฟล์ gitignored `output/image-search-spike/dataset.json` กับ `voyage-multimodal-3.5/embeddings.json`
ไม่คัดลอก keys ลง repository หรือส่งผ่าน browser

```powershell
$env:ENABLE_LOCAL_IMAGE_SEARCH='true'
npm run dev -- --hostname 127.0.0.1 --port 3108
```

ปิดด้วยการหยุดเซิร์ฟเวอร์ หรือเอา flag ออกแล้วเริ่มใหม่
โค้ดยอมเปิดเฉพาะ NODE_ENV=development และ backend kit6y4pj เท่านั้น
Production build ไม่เปิดฟีเจอร์นี้ แม้ flag เป็น true

## การทำงานและข้อจำกัด

- ใช้ existing OpenRouter/InsForge gateway กับ `voyageai/voyage-multimodal-3.5`, 1024 float dimensions
- ตรวจ canonical revision `voyageai/voyage-multimodal-3.5-20260727` ก่อนคิดค่าค้นหา ถ้า alias เปลี่ยนให้หยุดแทนเทียบคนละโมเดล
- Normalize รูป: auto-rotate, inside 768×768, ไม่ขยายภาพ, flatten white, JPEG 88 และลบ metadata
- Gallery/query ใช้ input_type omitted ตาม benchmark เดิม Cache ของ gallery นำกลับมาใช้ ไม่มีค่า embedding ภาพสินค้าเพิ่ม
- ค้นหาและเรียงคะแนนบน server; vector/credentials/storage keys ไม่ส่งไป browser
- อ่าน `member_catalog` ด้วย session สมาชิก กรอง category และตรวจ media/file linkage ก่อนรับผล
- ตรวจสิทธิ์การเห็นสินค้า/ราคาปัจจุบันซ้ำก่อนสร้าง signed media URLs; ใช้ serializer สมาชิกเดิม
- ใช้รูปที่สร้างดัชนีจริงเป็นรูปบนการ์ด ไม่ใช้รูปแรกจากลำดับการสร้าง signed URL ที่ไม่แน่นอน
- Query image อยู่ใน memory ไม่บันทึกลง storage/dataset/log; ส่งให้ provider ด้วย `only: voyageai`, `allow_fallbacks: false`, `data_collection: deny`
- ไม่อ้างว่า provider เป็น zero retention; นโยบาย no-training routing ไม่เท่ากับไม่เก็บข้อมูล
- โควตารอบทดลอง: 30 requests ต่อ organization (หรือ user ถ้าไม่มี organization), รวม 200 requests ตลอดรอบทดลอง
- สร้าง quota tickets ด้วย exclusive file creation ใน `output/image-search-preview-quota` ก่อน API call เพื่อกันการค้นหาพร้อมกันและเก็บจำนวนหลัง restart
- เก็บ reservation แม้บริการล้มเหลว ไม่ retry คำขอที่อาจคิดเงินอัตโนมัติ และไม่ลบ/reset quota เพื่อข้ามเพดาน
- หากคิดเผื่อ $0.0013/ภาพตาม experiment เดิม เพดานรอบ preview คือ $0.26 (ค่าประมาณเผื่อ ไม่ใช่ค่าใช้จริงจาก invoice)
- ยังไม่มี background sync/reindex; รูปที่เพิ่มใหม่ไม่เข้าดัชนีอัตโนมัติ เปลี่ยน file reference หรือลบ media แล้วตัด candidate เดิมออก
- การแก้ bytes ใน storage key เดิมยังตรวจความสดไม่ได้ ต้องมี content/version lifecycle ในรุ่นออนไลน์
- ต้องย้าย quota ไป atomic DB และ vector ไป pgvector ก่อนเปิดหลาย instance/ออนไลน์

## หลักฐานตรวจสอบ

- TypeScript และ lint ไฟล์ที่แก้ผ่าน
- Vitest: 44 files / 178 tests ผ่าน รวม decode/pixel limit/EXIF orientation/vector validation และ quota concurrency/persistence
- Production build ผ่าน โดยไม่มีการ deploy
- เปิด production build บน loopback อีก port และยืนยัน API ตอบ 404 แม้ตั้ง ENABLE_LOCAL_IMAGE_SEARCH=true
- `preview-smoke.mjs --paid`: anonymous และ non-member staff ถูกปฏิเสธ, cross-origin ถูกปฏิเสธ, ไฟล์เสีย 400, body ใหญ่ 413
- เรียก Voyage จริงด้วยภาพสินค้า พบสินค้าต้นฉบับใน 12 ผล ไม่มีสินค้าซ้ำ response ไม่มี field ภายใน และ Cache-Control=no-store
- เปิด API รายละเอียดสินค้าจากผลได้ และมี signed image URLs
- Browser จริง: อัปโหลด → ค้นหา → ผล 12 รายการ → เปิดรายละเอียดสินค้า → กลับ Catalog และปุ่มค้นหาภาพ ทำงาน
- Mobile viewport 390×844: scrollWidth=390, ไม่มี error overlay; ตรวจ console ไม่พบ errors
- รูปทดสอบขนาด 4,328,928 bytes ถูกย่อก่อนอัปโหลดเหลือ JPEG 1,117,109 bytes; API จริงตอบ 200 และผลทั้ง 12 รายการอยู่ในหมวดเก้าอี้/สตูลที่เลือก
- กดล้างรูปแล้ว preview และการ์ดผลลัพธ์เหลือ 0 ไม่แสดงผลเก่าค้าง
- Local artifacts: `preview-smoke.json`, `app-search-desktop.png`, `app-search-mobile.png`
- `preview-auth.json` เป็น session สำหรับทดสอบอยู่ใน gitignored output เท่านั้น ห้ามเผยแพร่หรือ commit

หลักฐานนี้เป็นการทดสอบ flow ด้วยภาพใน Catalog ไม่ใช่การรับรองความแม่นยำกับภาพถ่ายลูกค้าจริง
เวลาจาก smoke เพียงหนึ่งครั้งไม่ใช่ p95 หรือผล load test

## ผลการยืนยันจากเจ้าของงาน

วันที่ 9 กันยายน 2569 ผู้ใช้ยืนยันหลังส่งมอบ Local Preview ว่า “ทดสอบแล้ว ผ่าน”
สถานะ Owner UAT สำหรับหน้าค้นหาภาพรุ่น Local Preview: **PASS**
ผู้ใช้ไม่ได้ระบุจำนวนหรือชนิดภาพที่ทดสอบ จึงไม่แปลงการยืนยันนี้เป็นสถิติความแม่นยำหรือผลทดสอบโหลด
การยืนยันนี้ปิดขั้นตอนทดลองรุ่น Local; การตรวจกรณีขอบและคุณภาพเพิ่มเติมรวมอยู่ในการตรวจรุ่นออนไลน์

## งานที่ยังเหลือเพื่อปิด Slice Image Search: 2 ขั้นตอน

1. ระบบดัชนี/อัปเดตภาพ/โควตาบนฐานข้อมูลสำหรับออนไลน์
2. เปิด Development Preview ออนไลน์ ตรวจ regression/load/security และกรณีภาพที่ไม่มีสินค้า พร้อมยืนยันการใช้งานรุ่นออนไลน์
