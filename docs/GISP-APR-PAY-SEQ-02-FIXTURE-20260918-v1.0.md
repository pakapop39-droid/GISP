# GISP-APR-PAY-SEQ-02-FIXTURE-20260918 v1.0

- `approval_level`: Implementation Authorization (test accounts and bounded fixture data only)
- `approved_by`: ภคภพ ช.เจริญยิ่ง
- `approval_text_or_reference`: ผู้ใช้ยืนยันในแชตว่าอนุมัติให้ใช้อีเมลทดสอบที่ควบคุมเพื่อรับเมลยืนยัน และสร้าง Role/Permission จำลองขั้นต่ำเฉพาะ Branch ซ้อม; ต่อมายืนยันว่าใช้ Gmail ของตนแบบ `+aliases` และรับรหัสได้
- `scope_document_version`: PAY-SEQ-02 rehearsal ตาม `GISP-APR-PAY-SEQ-02-REHEARSAL-20260918-v1.0.md` และสถานะ `GISP-PAY-SEQ-02-REHEARSAL-STATUS-20260918-v0.1.md`
- `environment`: InsForge child `pay-seq-02-rehearsal-20260918`, ID `e902393a-ffe7-433d-96d8-a37256948959`, parent Production B ID `865860c2-49fa-4e53-908f-9396b2f75233`
- `data_migration_authorized`: No. อนุญาตเฉพาะการสร้างข้อมูลทดสอบใหม่ที่ติดป้าย `REH-PAY-RPC-001` บน child: 2 องค์กร, บัญชี Member A/Member B/Finance A, Role/Permission เท่าที่ทดสอบสิทธิ์, Order/Payment/File/Audit จำลองตามกรณีทดสอบ. ไม่แก้ข้อมูลเดิมหรือย้ายข้อมูลจาก Production.
- `production_allowed`: No
- `approved_at`: 2026-09-18 16:28 UTC (เวลาบันทึกหลังคำยืนยัน; ไม่ใช่เวลาประทับจากระบบอนุมัติ)

## ขอบเขตการส่งอีเมล

ใช้เฉพาะอีเมล `pakapop39@gmail.com` ของบัญชีเจ้าของโครงการใน InsForge พร้อม 3 `+aliases` เพื่อรับอีเมลยืนยันของ Branch ซ้อม. ไม่ส่งถึงบุคคลอื่น ไม่ส่งข้อความการค้า และไม่เปลี่ยน Auth/SMTP configuration. หากอีเมลไม่ถึงหรือระบบต้องให้ผู้ใช้ทำขั้นตอนยืนยัน ให้หยุดและขอรหัส/การยืนยันจากเจ้าของโดยไม่เปิดเผยรหัสผ่านในแชต.

เจ้าของยืนยันเพิ่มในแชต ณ 2026-09-18 16:30 UTC ว่าอนุญาตให้อีเมลแจ้งเตือนธุรกรรมที่ App สร้างอัตโนมัติส่งได้ **เฉพาะ 3 aliases ทดสอบเดิมใน Branch ซ้อม**. การอนุมัตินี้ไม่ครอบคลุมอีเมลอื่น ผู้ใช้จริง หรือ Production.

## ขอบเขตงานที่ยังไม่อนุญาต

ไม่แก้ App Source Code, Schema, ราคา, สูตร, ภาษี, Payment Term, Production, Branch อื่น หรือใช้เงินจริง; ไม่ Deploy/Promote Release C/D. การตั้ง Role/Permission ในที่นี้เป็น fixture บน child เท่านั้น ไม่ใช่การเปลี่ยนนโยบายสิทธิ์ของ App.
