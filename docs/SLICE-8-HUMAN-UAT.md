# Slice 8 — Human UAT

สถานะ: `PASSED — OWNER SIGN-OFF`  
วันที่เตรียมชุดทดสอบ: 30 สิงหาคม 2569  
Environment: Hosted Preview `https://kit6y4pj-gug.insforge.site` + InsForge Backend Branch `slice-8-shipment-delivery`  
Production: ไม่ได้แตะต้อง

ผลตรวจรับ: เจ้าของระบบแจ้ง “ทำครบหมดแล้ว” เมื่อ 30 สิงหาคม 2569 พร้อมหลักฐาน Order `ORD-S8-HUAT-1788091968175` สถานะเสร็จสิ้น, เงินค่าขนส่ง 10,700 บาทตรวจครบ และหลักฐานการโอนผ่านแล้ว

## ชุดข้อมูลสำหรับทดสอบ

- Project: `PRJ-S8-HUAT-1788091968175`
- Order: `ORD-S8-HUAT-1788091968175`
- สินค้า: โต๊ะรับรอง 2 ตัว
- Admin: `uat-admin-all@gisp.example.com`
- Member: `uat-member-all@gisp.example.com`
- Password: ใช้รหัส UAT เดิม
- Admin URL: `https://kit6y4pj-gug.insforge.site/admin/orders/77f597e7-30f0-4d0a-b00a-6ba454499993`
- Member URL: `https://kit6y4pj-gug.insforge.site/member/orders/77f597e7-30f0-4d0a-b00a-6ba454499993`

## วิธีสลับบทบาท

แต่ละช่วงให้กด **ออกจากระบบ** ก่อน แล้วเข้าสู่ระบบด้วยบัญชีของช่วงถัดไป เพื่อยืนยันว่า Admin และ Member เห็นข้อมูลคนละระดับจริง

Chrome หนึ่งโปรไฟล์เก็บ Session ได้ครั้งละหนึ่งบัญชีเท่านั้น หากต้องเปิด Admin และ Member พร้อมกัน ให้ใช้ Chrome ปกติสำหรับบัญชีหนึ่ง และหน้าต่างไม่ระบุตัวตน (Incognito) หรือ In-app Browser สำหรับอีกบัญชี ห้ามเปิดสองบัญชีพร้อมกันคนละแท็บใน Chrome โปรไฟล์เดียวกัน

## Scenario UAT

### 1. Admin — Warehouse และ Consolidation

1. เปิด Admin URL
2. ตรวจว่ามี Warehouse Receipt `READY_FOR_CONSOLIDATION` จำนวน 2 และ Consolidation แบบ `PARTIAL`
3. กด **สร้าง Partial Shipment สำหรับ UAT**
4. ผลที่คาดหวัง: Shipment ถูกสร้าง แต่ยัง Dispatch ไม่ได้จนกว่า Member จะรับทราบค่าใช้จ่ายเพิ่ม

### 2. Member — รับทราบ Partial Shipment

1. เข้าด้วยบัญชี Member แล้วเปิด Member URL
2. ตรวจว่าเห็นเหตุผล Partial และค่าใช้จ่ายเพิ่ม แต่ไม่เห็นต้นทุนภายในของ GISP
3. กด **รับทราบค่าใช้จ่าย Partial**
4. ผลที่คาดหวัง: สถานะผ่าน Dispatch Gate

### 3. Admin — ออกเดินทางและติดตามสถานะ

1. กลับเข้า Admin URL
2. กด **ยืนยันออกเดินทาง**
3. กดเพิ่มสถานะติดตามตามลำดับจนถึง **พร้อมนัดส่ง**:
   - ออกจากจีน
   - อยู่ระหว่างขนส่ง
   - ถึงประเทศไทย
   - พิธีการศุลกากร
   - ถึงคลังไทย
   - พร้อมนัดส่ง
4. ผลที่คาดหวัง: Dropdown เลื่อนไปสถานะถัดไปเองและไม่ยอมให้บันทึก Milestone เดิมซ้ำ
5. กด **เสนอนัดส่งพรุ่งนี้**

### 4. Member/Admin — ขอเลื่อนนัด

1. Member เปิด Order แล้วกด **ขอเลื่อน 2 วัน**
2. ผลที่คาดหวัง: เป็นคำขอรอตรวจ ไม่เปลี่ยนวันนัดเอง
3. Admin เปิด Order แล้วกด **อนุมัติวันใหม่**
4. ผลที่คาดหวัง: นัดเปลี่ยนเป็นยืนยันแล้ว และมีปุ่ม **เริ่มนำส่ง**

### 5. Admin — ส่งครั้งแรกแบบบางส่วน

1. กด **เริ่มนำส่ง**
2. ใน Proof of Delivery เปลี่ยนจำนวนส่งจริงเป็น `1`
3. กรอกแผนส่งครั้งถัดไป เช่น `ส่งตัวที่เหลือพรุ่งนี้`
4. แนบภาพหรือ PDF อย่างน้อยหนึ่งไฟล์ แล้วกด **บันทึก POD**
5. ผลที่คาดหวัง: แสดงส่งแล้ว 1/2 เหลือ 1 และเปิดให้สร้างนัดครั้งถัดไป

### 6. Member/Admin — ส่งครั้งที่สองให้ครบ

1. Admin กด **เสนอนัดส่งพรุ่งนี้**
2. Member กด **ยืนยันนัด**
3. Admin กด **เริ่มนำส่ง**
4. กรอกจำนวนส่งจริง `1`, แนบหลักฐาน แล้วกด **บันทึก POD**
5. ผลที่คาดหวัง: Shipment แสดงส่งมอบครบ 2/2 และ Member เปิดดูหลักฐานได้

### 7. Admin — Actual Freight และ Invoice

1. ที่ Actual Freight ใช้ต้นทุนภายใน `8000` และยอดเรียกเก็บ Member `10000`
2. กด **บันทึก Actual Cost**
3. กด **ฝ่ายการเงินยืนยันต้นทุน**
4. กด **ออกใบแจ้งหนี้ค่าขนส่ง**
5. ผลที่คาดหวัง: Invoice รวม VAT 7% เป็น `10,700 บาท`

### 8. Member/Admin — ชำระค่าขนส่งและปิด Order

1. Member เลือกงวด **ค่าขนส่ง** กรอกยอด `10700`, วันเวลาโอน และแนบสลิป
2. กด **ส่งให้ Finance ตรวจ**
3. ผลที่คาดหวัง: ขึ้นข้อความส่งสำเร็จโดยไม่มี Error และ Transfer เป็น `รอตรวจ`
4. Admin เปิด Order ดูสลิป แล้วกด **ยืนยัน**
5. ผลที่คาดหวัง: Freight Invoice เป็น `PAID`, ค่าขนส่งตรวจครบ และ Order เป็น `เสร็จสิ้น`

## Acceptance Checklist

- [x] Admin เห็น Warehouse/Consolidation/Internal Cost
- [x] Member ไม่เห็น Supplier/Internal Cost
- [x] Partial Shipment รอ Member Acknowledgement ก่อน Dispatch
- [x] Tracking เรียงลำดับและไม่บันทึก Milestone ซ้ำ
- [x] Reschedule รอ Admin พิจารณา
- [x] Partial Delivery คง Remaining Quantity ถูกต้อง
- [x] POD ต้องมีไฟล์และ Member เปิดดูได้
- [x] Freight Invoice Snapshot ถูกต้อง รวม VAT 10,700 บาท
- [x] ส่งสลิปแล้วไม่มีข้อความ Error
- [x] Order เป็นเสร็จสิ้นหลังส่งครบและ Finance ตรวจ Freight ครบเท่านั้น

Human UAT ผ่านครบและได้รับ Owner Sign-off แล้ว Backup, Merge Resolution, Development Deploy และ Post-merge Smoke ผ่านครบเมื่อ 30 สิงหาคม 2569 เหลือ 0 ขั้นตอนเพื่อปิด Slice 8
