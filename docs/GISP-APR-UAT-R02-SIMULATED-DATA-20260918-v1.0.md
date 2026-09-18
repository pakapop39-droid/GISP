# GISP UAT R02 — Simulated Test Data Authorization v1.0

- `approval_level`: Scope Approved + Implementation Authorized (เฉพาะข้อมูลทดสอบใหม่ใน Development)
- `approved_by`: ภคภพ ช.เจริญยิ่ง
- `approval_text_or_reference`: ข้อความล่าสุดของเจ้าของ: “ในขั้นตอนทดสอบหลังจากนี้อนุญาตให้ใช้ขอมูลจำลองทั้งหมดเพื่อให้การทดสอบพิสูจน์ว่าใช้งานได้ผ่าน ง”
- `scope_document_version`: GISP Development UAT DRYRUN-R02 ตาม `GISP-APR-UAT-R02-DEVELOPMENT-20260917-v1.0.md` และ Checklist v0.4
- `environment`: GISP Development เท่านั้น
- `data_migration_authorized`: No
- `production_allowed`: No
- `approved_at`: 2026-09-18 ประมาณ 07:13 ICT (เวลาบันทึกคำอนุญาต; ไม่มี timestamp ของข้อความที่แม่นยำกว่า)

## การตีความขอบเขตอย่างระมัดระวัง

- อนุญาตให้สร้างข้อมูลและไฟล์หลักฐาน **จำลองที่ระบุชัดว่าเป็น Development Test** เพื่อทดลองรายการใหม่ในชุด `DRYRUN-R02` ผ่านหน้าจอ App ด้วย Member/Supplier/SKU ทดสอบเดิม จำนวน 1 ชิ้น และค่าปัจจุบันที่ระบบคำนวณ
- เอกสารจำลองไม่ใช่ใบโอนเงินจริง หลักฐานรับเงินจริง คำตอบรับของ Supplier จริง หรือเอกสารสำหรับการเงิน/กฎหมาย/ศุลกากรจริง; ต้องไม่ระบุว่าเกิดเหตุการณ์จริง
- การสร้างหลักฐานจำลองมีไว้พิสูจน์การทำงานของระบบเท่านั้น ผล UAT ต้องบันทึกตามพฤติกรรมที่สังเกตได้จริง ห้ามแก้ผลให้ PASS หากไม่ผ่าน
- การอนุญาตนี้ไม่ครอบคลุมการแก้ `DRYRUN-R01`, Master Data, ราคา สูตร ภาษี Payment Term, Source Code, Schema, Role, Permission, Authentication, ข้อมูลเดิมอื่น, Data Migration, Deployment หรือ Production
- การสื่อสารหรือยืนยันแทน Supplier จริงไม่อยู่ในขอบเขต; ถ้าทำ Supplier Acknowledgement จำลอง ต้องระบุว่าเป็นการจำลองบทบาททดสอบ ไม่ใช่การตอบรับจาก Supplier จริง

## เงื่อนไขหยุด

หาก App ต้องใช้ข้อมูลการชำระเงินจริง, ต้องติดต่อบุคคลภายนอก, ต้องแก้รายการ R01, หรือทำต่อไม่ได้โดยไม่ขยายขอบเขต ให้หยุดและรายงานก่อน
