# Approval Matrix

## Risk tiers

| Tier | ขอบเขต | เส้นทางขั้นต่ำ |
|---|---|---|
| T0 Read-only | อ่าน วิเคราะห์ วางแผน รายงาน | Primary/Lead; ไม่มี Builder หรือ QA |
| T1 Lean | งานแยกส่วน ย้อนกลับง่าย ไม่มี Sensitive trigger, API/Integration contract change หรือ persisted-data behavior | Lean Task Record → Builder → QA แบบเบาหรือรวมตรวจ candidate |
| T2 Product | เปลี่ยนพฤติกรรมหรือ User Flow แบบจำกัด แต่ไม่เปลี่ยน Contract หรือ persisted-data behavior | Lead → Builder → QA เฉพาะจุด; Architect เมื่อมี material impact |
| T3 Sensitive | Auth/RLS/Privacy/Audit, ราคา/Payment/สูตร, Schema/Migration/ข้อมูล, API/Integration contract, persisted-data behavior/lifecycle, External write/ค่าใช้จ่าย/Secret | Lead → Architect → Builder → QA |
| T4 Production | Deploy, Production config/data, เปิด feature หรือ Rollback | Release workflow + explicit Release Authorization |

การเปลี่ยน request/response, public/internal API consumed by another component, event/webhook contract หรือวิธีสร้าง ตีความ แก้ไข ลบ และกำหนดวงจรชีวิตของข้อมูลที่บันทึกถาวร เป็น T3 แม้ Schema ไม่เปลี่ยน เมื่อพบ Trigger เหล่านี้ให้หยุดก่อนส่วนนั้น จัด Tier ใหม่ และขออนุมัติเพิ่ม

## Approval Record บังคับ

ก่อน Builder เริ่มงาน ก่อนเปลี่ยนข้อมูล และก่อน Release ต้องมีข้อมูลครบ:

- `approval_level`: Scope / Implementation / Scope + Implementation / Release
- `approved_by`: ชื่อผู้อนุมัติ
- `approval_text_or_reference`: ข้อความอนุมัติหรือลิงก์/ไฟล์อ้างอิง
- `scope_document_version`: ขอบเขตหรือเอกสารพร้อมเวอร์ชัน
- `environment`: Local / Test / Staging / Production
- `data_migration_authorized`: Yes / No พร้อมขอบเขต
- `production_allowed`: Yes / No
- `approved_at`: วันและเวลา

หากข้อมูลที่เกี่ยวข้องกับงานไม่ครบ Agent ต้องหยุดและขอให้ยืนยัน ห้ามตีความคำทั่วไป เช่น `ทำต่อได้เลย` ให้ครอบคลุม Production

สำหรับ Slice ที่มีขอบเขตชัดและไม่ใช่ Production เจ้าของอาจอนุมัติ Scope + Implementation ใน Record เดียวได้ แต่ต้องมีข้อมูลบังคับครบและไม่ข้าม Trigger ด้านข้อมูล สิทธิ์ เงิน หรือระบบภายนอก สำหรับ T1 ใช้ Lean Task Record สั้น ๆ ที่ระบุ goal, tier, in/out scope, file scope, acceptance check, Approval Record และ remaining risk ได้

## ข้อมูลทดสอบใน Development

เจ้าของแจ้งว่าข้อมูลใน App ปัจจุบันเป็นข้อมูลทดสอบและยอมให้แก้หรือลบเพื่อเร่งความพร้อม Go Live ข้อความนี้ใช้ระบุสถานะข้อมูล ไม่ใช่สิทธิ์ลบทุกฐานข้อมูลโดยไม่ตรวจเป้าหมาย ก่อนเขียนข้อมูล ให้ยืนยัน Project/Environment จริง, ระบุชุดข้อมูลหรือเงื่อนไขค้นหา, ผลกระทบต่อข้อมูลที่อ้างอิงกัน, วิธีตรวจผล และบันทึกอำนาจแก้/ลบใน Implementation Approval Record ที่มีข้อมูลบังคับด้านบน Record หนึ่งฉบับอนุมัติ batch ที่ระบุชัดได้; เมื่อยังอยู่ใน batch และ environment เดิมไม่ต้องขออนุมัติซ้ำรายแถว ห้ามขยายไป Production หรือ Migration ที่อยู่นอก Record

## Agent ดำเนินการได้โดยไม่ต้องขออนุมัติเพิ่ม

- อ่านโค้ด เอกสาร Log และผลทดสอบที่อยู่ในขอบเขตงาน
- วิเคราะห์ปัญหา จัดทำทางเลือก และประเมินผลกระทบ
- รันทดสอบแบบไม่เปลี่ยนข้อมูลจริง
- แก้โค้ดใน Workspace เฉพาะเมื่อได้รับ Implementation Authorization และไม่เกินขอบเขต

การจัด Tier ไม่ได้เพิ่มอำนาจ: ทุกการเขียนยังต้องมี Implementation Authorization และทุก Production action ยังต้องมี Release Authorization

## ต้องขอ Scope Approval

- เพิ่มหรือตัดฟีเจอร์ เปลี่ยน User Flow หรือ Acceptance Criteria
- เปลี่ยนกฎธุรกิจ กฎการผลิต ราคา สูตรคำนวณ หรือเอกสารอนุมัติเดิม
- เพิ่ม Integration ค่าใช้จ่าย หรือ Dependency สำคัญ

## ต้องขอ Implementation Authorization

- เริ่มแก้โค้ดหรือสร้าง Migration
- เปลี่ยน Schema ฐานข้อมูล การ Mapping หรือข้อมูลจำนวนมาก
- เปลี่ยน Authentication บทบาท สิทธิ์ ความเป็นส่วนตัว หรือ Audit Log
- ใช้ Credential หรือเชื่อมระบบภายนอกเพื่อเขียนข้อมูล

## ต้องขอ Release Authorization

- Deploy หรือ Promote ไป Production
- รัน Migration หรือ Script กับข้อมูลจริง
- เปิดฟีเจอร์ให้ผู้ใช้จริง เปลี่ยน Secret หรือ Production Configuration
- ลบ ย้อนคืน หรือแทนที่ข้อมูลจริง

เมื่อ Approval Record ครบ Primary Codex Thread เป็นผู้ดำเนินการ Release ตาม Checklist, Backup, Rollback และ Post-release verification ส่วน Project Lead, Architect, Builder และ QA ไม่มีสิทธิ์อนุมัติหรือขยายขอบเขต Release

## การจัดการผล QA

- `Blocker`: ห้าม Release จนแก้และ QA ตรวจใหม่
- `Major`: ต้องแก้ หรือเจ้าของโครงการยอมรับความเสี่ยงที่ระบุเป็นลายลักษณ์อักษร
- `Minor`: เลื่อนได้เมื่อมีผู้รับผิดชอบ กำหนดเสร็จ และการยอมรับจากเจ้าของโครงการ
- `PASS WITH CONDITIONS`: ไม่เท่ากับ Release Authorization
- Builder และ QA ไม่มีสิทธิ์ยอมรับความเสี่ยงหรือเงื่อนไขแทนเจ้าของ

## หยุดทันที

หยุดและรายงานเมื่อเป้าหมายไม่ชัด หลักฐานขัดแย้ง Test สำคัญไม่ผ่าน ไม่มี Backup/Rollback สำหรับการเปลี่ยนข้อมูล หรือการทำต่อจะขยายอำนาจ ค่าใช้จ่าย และความเสี่ยงอย่างมีนัยสำคัญ
