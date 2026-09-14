# Delivery Workflow

## 1. Intake and baseline

Project Lead สรุปเป้าหมาย ตรวจ Source of Truth และแยกสถานะข้อมูล หากเป็นแอปเดิมให้บันทึก Current behavior, Tech stack, Test commands, Environments และ Working tree ก่อน

## 2. Scope

จัดทำ Requirements, Acceptance Criteria, In scope, Out of scope, Dependencies และ Risks แล้วรอ `Scope Approved`

## 3. Architecture and impact

Architect ตรวจเส้นทางโค้ดจริง จัดทำ Reuse/Modify/New และประเมิน Data, Permission, Integration, Migration, Compatibility, Security และ Rollback

## 4. Implementation authorization

ระบุขอบเขตไฟล์/Component สภาพแวดล้อม Migration และการทดสอบให้ชัด แล้วรอ `Implementation Authorized`

## 5. Incremental build

Builder ทำเป็น Vertical Slice ที่ใช้งานได้ครบตั้งแต่ UI/Service/Data/Permission/Error handling/Test โดยไม่แตะงานนอกขอบเขต

## 6. Independent QA

QA ตรวจ Acceptance Criteria, Boundary, Regression, Permission, Security และ Data integrity ด้วยหลักฐานจริง หากไม่ผ่าน ส่งกลับ Builder เฉพาะ Findings ที่ต้องแก้

## 7. Owner UAT

นำเสนอสิ่งที่เปลี่ยน วิธีทดสอบ ข้อจำกัด และผล QA ให้เจ้าของทดสอบหรืออนุมัติผล

## 8. Release readiness

ยืนยัน Backup, Migration, Rollback, Monitoring, Owner, Release window และ Known risks แล้วรอ Approval Record ระดับ `Release Authorized` ที่ระบุ Production โดยตรง

## 9. Release and verify

Primary Codex Thread เป็น Release Executor และ Deploy ได้เฉพาะเมื่อ Approval Record ครบ ตรวจ Smoke test/Monitoring และรายงานผล หากผิดปกติให้ใช้แผน Rollback ที่อนุมัติ Agent ผู้เชี่ยวชาญทั้งสี่ไม่มีสิทธิ์อนุมัติหรือขยายขอบเขต Release

## Definition of Done

งานเสร็จเมื่อขอบเขตและ Acceptance Criteria ผ่าน, Test ที่เกี่ยวข้องผ่าน, QA ให้ PASS หรือเจ้าของโครงการยอมรับเงื่อนไขตามระดับความเสี่ยงเป็นลายลักษณ์อักษร, เอกสารและ Change log สอดคล้อง, ไม่มี Blocker และระบุสถานะ Release อย่างชัดเจน `PASS WITH CONDITIONS` ไม่อนุญาตให้ Release โดยอัตโนมัติ
