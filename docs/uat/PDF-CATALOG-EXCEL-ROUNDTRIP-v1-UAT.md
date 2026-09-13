# คู่มือ UAT — PDF Catalog Excel Round-trip v1.0

เอกสารนี้ใช้กับ Development เท่านั้น และใช้ข้อมูลทดสอบ ห้ามใช้ Production

1. เปิด Catalog Import แล้วเลือกงาน PDF ที่อยู่สถานะพร้อมตรวจหรือเสร็จแล้ว
2. กด `Export Excel` แล้วเปิดไฟล์ `.xlsx` ที่ดาวน์โหลด
3. อ่าน Sheet `Instructions` ก่อนแก้ Sheet `Products`; ช่องว่างหมายถึง “คงค่าเดิม” และ `#CLEAR` ใช้ได้เฉพาะช่องสินค้าแบบไม่บังคับ
4. หากมีสิทธิ์ดูต้นทุน จะเห็น Sheet `Costs`; กรอก Factory Cost, สกุลเงิน 3 ตัว และอัตราแลกเปลี่ยนให้ครบ ห้ามใส่ Member Price
5. ห้ามแก้ `row_key`, Sheet `__Meta`, เพิ่มแถว, ใส่สูตร, Macro หรือลิงก์ภายนอก
6. กลับหน้าเดิม เลือกไฟล์ แล้วกด `Upload Excel กลับ` เพื่อตรวจ Preview
7. ตรวจสถานะและ Before/After ทีละรายการ จากนั้นเลือกเฉพาะ `READY`
8. กด `ยืนยันรายละเอียดสินค้า` และ `ยืนยันต้นทุน` แยกกัน ต้นทุนก่อนมี Product Draft จะรอจน PDF Confirm สร้าง Draft
9. ตรวจว่า Product ยังเป็น Draft/Not Reviewed, Cost Version ใหม่ Active, ราคา Member เดิมไม่เปลี่ยน และไม่มี Variant/Option/Publish เกิดขึ้น

หลักฐาน UAT ต้องบันทึกไฟล์ทดสอบที่ใช้ ผู้ทดสอบ เวลา ผลแต่ละกรณี และภาพหน้าจอ โดยไม่ใส่ข้อมูลลับลง Git
