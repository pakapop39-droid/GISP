# Slice 4 — Custom RFQ Human UAT

**ระบบทดสอบ:** https://kit6y4pj-gk5.insforge.site  
**สถานะระบบ:** `SLICE_4_ACCEPTED` / `DONE ON DEVELOPMENT`  
**หมายเหตุ:** ระบบนี้เป็น Branch Preview ไม่ใช่ Production

## ผลการตรวจรับ

- เจ้าของระบบตรวจ Human UAT ผ่านและแจ้ง **“อนุมัติปิด Slice 4”** เมื่อ 26 สิงหาคม 2569
- Backend Branch `slice-4-custom-rfq` รวมเข้า Development สำเร็จแบบ 0 Conflict
- Post-merge Automated Gate และ Smoke Test ผ่าน
- Development Deployment `57144683-37a7-420b-be7b-5fb3189095b9` เป็น `READY`
- Production ไม่อยู่ในขอบเขตการอนุมัติครั้งนี้
- เหลือ **0 ขั้นตอน** เพื่อปิด Slice 4

## วิธีตรวจแบบสั้น

### Member

1. Login ด้วยบัญชี Member สำหรับ UAT
2. เข้าเมนู **Custom RFQ**
3. เปิด `CRQ-2026-000004` และตรวจข้อมูล, ไฟล์ Version 1, สถานะ
   **พร้อมทำใบเสนอราคา** และ Timeline
4. ตรวจว่าไม่เห็น Supplier Candidate หรือหมายเหตุภายในของ Admin
5. หากต้องการตรวจวงจรใหม่ ให้สร้าง Draft ใหม่, แนบไฟล์ และกดส่งคำขอ

### Admin

1. Login ด้วยบัญชี Admin สำหรับ UAT
2. เข้าเมนู **Custom RFQ Queue**
3. เปิดคำขอใหม่ แล้วตรวจการรับงาน, ผู้รับผิดชอบ, กำหนดส่ง และการขอข้อมูลเพิ่ม
4. ตรวจการบันทึก Candidate และหมายเหตุภายใน
5. เปลี่ยนสถานะเป็น **พร้อมทำใบเสนอราคา** แล้วกลับไปตรวจผลใน Member Portal
6. ใช้คำขอแยกต่างหากตรวจการยกเลิกก่อน Convert

## เกณฑ์ผ่าน

- Member และ Admin เห็นเฉพาะข้อมูลตามสิทธิ์
- Workflow เปลี่ยนสถานะตามลำดับและไม่มีการข้าม Gate
- Upload/เปิดไฟล์ได้ และเลข Version ถูกต้อง
- Timeline อ่านเข้าใจง่ายและไม่เปิดเผย Internal Event แก่ Member
- ไม่มี Error ที่ขัดขวางงานหลัก

ขั้นตอนนี้ดำเนินการครบแล้ว: เจ้าของระบบแจ้ง **“อนุมัติปิด Slice 4”**, รวม Branch เข้า
Development และผ่าน Post-merge Smoke Test รอบสุดท้ายเมื่อ 26 สิงหาคม 2569
