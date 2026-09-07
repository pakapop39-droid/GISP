# Slice 12.1 — Human UAT

วันที่เตรียม: 6 กันยายน 2569

## ระบบทดสอบ

- หน้าเริ่มต้น: `https://kit6y4pj-hm4.insforge.site`
- Member: `slice12-member-a.1788672844231@example.com`
- รหัสผ่าน: ใช้รหัสผ่าน UAT เดิม
- Backend: `slice-12-shared-catalog` แบบ schema-only
- Production Release A ไม่ถูกเปลี่ยน

## ลิงก์ลูกค้าตัวอย่าง

- สินค้ารายชิ้น: `https://kit6y4pj-hm4.insforge.site/catalog/share/2a562d7b48e74d0af9ee3edc1650104186d629392d8349ed`
- สินค้าในโครงการ: `https://kit6y4pj-hm4.insforge.site/catalog/share/8fe3005093f927bfa8c4c04c1b8af7e4586179374c45ebd0`
- Catalog ที่คัดเอง: `https://kit6y4pj-hm4.insforge.site/catalog/share/b93886fa4f91907a32af2d0d271e464067f11f26bcb991e6`
- สินค้าทั้งหมด: `https://kit6y4pj-hm4.insforge.site/catalog/share/2cb46e3125e0c857b3483a07548803c4899815b97ee02132`

## ขั้นตอนตรวจรับ

1. เปิดลิงก์ทั้ง 4 แบบโดยไม่ Login
   - ต้องเปิดได้ เห็นชื่อบริษัท/ช่องทางติดต่อ และไม่เห็นราคา
2. เปิดลิงก์ “สินค้าทั้งหมด” บนโทรศัพท์
   - ค้นหา เลือกหมวด และเปิดรายละเอียดสินค้าได้ โดยหน้าจอไม่ล้น
3. กด “สนใจ” อย่างน้อย 2 รายการ
   - แถบรายการที่สนใจต้องแสดงจำนวนถูกต้อง และ Reload แล้วยังอยู่ใน Browser เครื่องเดิม
4. กดนำสินค้าออกและล้างรายการ
   - จำนวนต้องลดลงและล้างได้
5. ตรวจปุ่มโทรศัพท์ อีเมล และ LINE
   - ช่องทางต้องตรงกับ Member และข้อความมีรายการสินค้าที่เลือก โดยไม่ส่งข้อมูลเข้าระบบอัตโนมัติ
6. Login บัญชี Member แล้วเปิด “Catalog ของฉัน”
   - สร้างลิงก์ได้ 4 แบบ Preview/Publish/Copy/Revoke/Rotate ทำงาน และทุก Flow ไม่มีช่องกำหนดราคาลูกค้า
7. สร้างลิงก์จากหน้าสินค้าและหน้า Project
   - ระบบต้องเลือก Scope/สินค้าหรือ Project ให้ล่วงหน้า และ Publish เป็นลิงก์ลูกค้าได้

## เกณฑ์ผ่าน

- ผ่านครบ 7 ขั้นตอน
- หน้า Public ทุกแบบไม่มีราคา Currency Supplier Factory Cost Formula Internal Note ชื่อลูกค้า Project หรือ Site Address
- หากพบปัญหา ระบุหมายเลขขั้นตอนและข้อความที่เห็นบนหน้าจอ

## สถานะ

`PASS 7/7 · OWNER ACCEPTED · DONE ON DEVELOPMENT`

- เจ้าของระบบยืนยันผลว่า **“ใช้ได้หมด”** เมื่อ 6 กันยายน 2569
- Development Deployment ล่าสุด: `526c7cf7-1354-42b1-92c6-e25cfad92f09` (`READY`)
- Post-merge Smoke: 54 Assertions ผ่านครบทั้ง Product, Project, Curated และ Full Catalog
- Production Release A ไม่ถูกเปลี่ยน

คงเหลือ 0 ขั้นตอนเพื่อปิด Slice 12.1
