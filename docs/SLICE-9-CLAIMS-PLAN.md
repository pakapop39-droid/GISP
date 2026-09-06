# Slice 9 — Claims

## เป้าหมาย

ทำเส้นทาง Claim หลังการส่งมอบให้ใช้งานจริงบน Backend Branch `slice-9-claims` โดยไม่แตะ Production และส่งมอบ Preview สำหรับ Human UAT ก่อน Merge เข้า Development

## Workflow ที่ยืนยัน

1. Member เปิด Claim จากรายการสินค้าที่ส่งมอบแล้วและแนบหลักฐาน
2. ระบบเก็บ Warranty Snapshot และแนะนำผู้รับผิดชอบจากประเภทปัญหา
3. Order Admin เริ่มตรวจ ขอข้อมูลเพิ่ม และยืนยันผู้รับผิดชอบ
4. Order Admin เสนอแนวทางแก้ไข โดยไม่มีการชดเชยอัตโนมัติ
5. ทีมงานบันทึกผลดำเนินการและหลักฐาน
6. Member ยืนยันว่าแก้ไขแล้วหรือแจ้งว่ายังมีปัญหา
7. Order Admin ตรวจทานและปิด Claim

## Business Rules

- Claim ต้องผูกกับ Delivered Item ของ Member Profile เจ้าของรายการเท่านั้น
- จำนวนที่เคลมต้องมากกว่า 0 และไม่เกินจำนวนที่ส่งมอบจริง
- ต้องมีหลักฐานอย่างน้อย 1 ไฟล์ก่อนส่ง Claim
- Warranty Snapshot ถูกเก็บตอนเปิด Claim และแก้ย้อนหลังไม่ได้
- ระบบแนะนำผู้รับผิดชอบ: ปัญหาการผลิต/สเปก → Supplier, ขนส่ง → Logistics/Insurance, ติดตั้ง → Installer
- Order Admin ต้องยืนยันผู้รับผิดชอบก่อนเสนอ Resolution
- การปฏิเสธต้องมีเหตุผล
- ไม่มี Automatic Compensation
- การปิด Claim ต้องมี Resolution, หลักฐานผลดำเนินการ และ Member Confirmation/Admin Review ตามสถานะเคส
- Member เห็นเฉพาะ Claim ของตนเอง และไม่เห็นต้นทุนภายในหรือชื่อ Supplier ก่อนสิทธิ์เปิดเผย
- ทุก Action สำคัญลง Timeline และ Audit Trail

## ขอบเขต UI

- Member: รายการ Claim, เปิด Claim, ดูรายละเอียด/Timeline, เพิ่มหลักฐาน, ตอบคำขอข้อมูล, ยืนยันผลแก้ไข
- Admin: Claim Queue, รายละเอียด, เริ่มตรวจ, ขอข้อมูล, ยืนยันผู้รับผิดชอบ, เสนอ Resolution, บันทึกผลดำเนินการ, ปฏิเสธ, ปิด และ Reopen พร้อมเหตุผล

## Definition of Done ก่อน Human UAT

- Migration/RLS/RPC ผ่านบน Branch
- Automated tests, typecheck และ production build ผ่าน
- UAT fixture ครบ Claim หลักอย่างน้อย 1 เคส
- Branch Preview deploy สำเร็จและ Smoke test ผ่าน
- มีบัญชีและคู่มือ UAT ภาษาไทยพร้อมลิงก์ตรง

## Owner Sign-off และ Development Release

- Human UAT ผ่านและ Owner อนุมัติ Slice 9 เมื่อ 31 สิงหาคม 2569
- ผลตรวจรับ: `SLICE_9_ACCEPTED`
- Automated Test 26 Test Files / 111 Tests และ Branch Integration 9/9 ผ่าน
- Backend Branch Merge สำเร็จ `12 added, 2 modified, 0 conflicts`; Branch เป็น `merged`
- Development Deployment `d46f280c-1afb-4bef-993b-623d336d84ef` เป็น `READY`
- Post-merge Schema/RLS/RPC, Admin/Member Browser Smoke และ Notification Schedule HTTP 200 ผ่าน
- เหลือ 0 ขั้นตอนเพื่อปิด Slice 9 บน Development
- Production ไม่ถูกเปลี่ยนในรอบนี้
