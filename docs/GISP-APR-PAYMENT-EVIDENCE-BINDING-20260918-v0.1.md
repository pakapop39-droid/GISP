# GISP Payment Evidence Binding — Development Implementation Record v0.1

- ผู้อนุมัติขอบเขต: ภคภพ ช.เจริญยิ่ง
- ข้อความอนุมัติที่ได้รับ: “อนุมัติขอบเขตแก้คำสั่งฐานข้อมูล Payment และตัดสินว่า หลักฐาน 1 ไฟล์ใช้ได้กับ Payment เพียง 1 รายการหรือไม่ แล้วให้ QA ตรวจซ้ำ”
- เวลาที่จัดทำบันทึกการรับมอบหมาย: 2026-09-18 21:05 น. Asia/Bangkok (ไม่ใช่การอ้างว่าเป็นเวลาที่ผู้อนุมัติส่งข้อความ)
- ฐานขอบเขตก่อนหน้า: อนุญาต Source Code, Automated Tests และร่าง Migration สำหรับ Development/พื้นที่ซ้อมเท่านั้น ไม่อนุญาต Apply หรือ Deploy ไป Production
- การอนุญาตในรอบนี้: สร้าง Migration แบบ forward-only เพื่อแทนที่เฉพาะ `submit_payment_transfer(UUID,NUMERIC,TIMESTAMPTZ,UUID)` และ `verify_payment_transfer(UUID,BOOLEAN,TEXT)`, เพิ่ม focused tests, ปรับตัวตรวจไฟล์ใน App ให้สอดคล้อง และให้ QA ตรวจอิสระ
- ไม่อนุญาต: เปลี่ยน Table/Column, Role, Permission, ราคา, สูตร, ภาษี, Payment Term, ข้อมูลธุรกรรมเดิม, ลบข้อมูล, Data Migration, Apply Migration, Deploy หรือดำเนินการใน Production

## การตัดสินใจในขอบเขตที่ได้รับมอบหมาย

กำหนด **หลักฐาน 1 ไฟล์ใช้ได้กับ Customer Payment Transfer เพียง 1 รายการตลอดไป** แม้รายการนั้นถูกปฏิเสธ ต้องอัปโหลดหลักฐานใหม่สำหรับรายการใหม่ เหตุผลคือป้องกันการใช้สลิปเดียวกันรับเงินซ้ำ และทำให้เลข Payment–ไฟล์ตรวจสอบย้อนกลับได้แน่นอน นี่เป็นการตัดสินใจสำหรับ implementation ตามคำมอบหมาย ไม่ใช่การอ้างว่าผู้อนุมัติได้เลือกถ้อยคำนโยบายนี้แยกต่างหาก

Migration ใหม่ `20260918211000_payment-evidence-binding.sql` ล็อกแถวไฟล์ขณะส่ง Payment, ตรวจ Organization/Member/ชนิดหลักฐาน/พื้นที่จัดเก็บ/visibility/object key, ปฏิเสธไฟล์ที่เคยถูกอ้างโดย Transfer ใด ๆ ทุกสถานะ, สร้าง Transfer และผูก `file_metadata.entity_id` กับ Transfer ในธุรกรรมเดียวกัน การอนุมัติของ Finance ตรวจสิทธิ์กับ Organization ของ Transfer และตรวจ Schedule–Order–File–Transfer ให้ตรง รวมทั้งห้ามมี Transfer อื่นอ้างไฟล์เดียวกัน ยังคงการปฏิเสธ, การกระทบยอด Deposit/Balance/Freight, ประวัติ และ Audit จาก baseline ล่าสุด

หลักฐานเก่าที่ `entity_id` ว่าง **ไม่ผ่านการอนุมัติรับเงิน** โดยอัตโนมัติ แต่ Finance ยังปฏิเสธพร้อมเหตุผลได้ ไม่มีการแก้หรือย้ายข้อมูลเดิม หากต้องรับรองรายการเก่าเป็นกรณีพิเศษต้องขออนุมัติแยก ไม่ให้ผูกย้อนหลังโดยเงียบ ๆ

## จุดตรวจรับและข้อจำกัด

- Automated contract tests ตรวจขอบเขต Migration, การล็อก/ผูกไฟล์, สิทธิ์ราย Organization, การกันใช้ซ้ำทุกสถานะ และการคง Deposit/Balance/Freight
- App ต้องตรวจและเปิด **เนื้อหาไฟล์จริงที่เก็บบนเซิร์ฟเวอร์** ก่อน Finance อนุมัติ; Database Function เพียงลำพังตรวจ bytes ไม่ได้ ดังนั้นห้ามถือว่า direct-RPC ผ่าน UAT ตรวจไฟล์จริง
- ก่อน Apply ใน Development/พื้นที่ซ้อมต้องให้ QA ตรวจ Migration กับ function signature/ACL ของสภาพแวดล้อมเป้าหมาย, ทดสอบกรณีผ่านและกรณีปฏิเสธด้วยข้อมูลจำลองที่ได้รับอนุมัติแยก และยืนยันไม่มีผลกับข้อมูลเดิม
- ไม่มีการ Apply/Deploy หรือทดสอบธุรกรรมในบันทึกนี้; Production Release ต้องได้รับคำอนุมัติแยก
