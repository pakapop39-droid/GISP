# Delivery Workflow

## 1. Intake and baseline

Project Lead สรุปเป้าหมาย ตรวจ Source of Truth และแยกสถานะข้อมูล หากเป็นแอปเดิมให้บันทึก Current behavior, Tech stack, Test commands, Environments และ Working tree ก่อน

เมื่อหลายแชตทำงานใน repo เดียวกัน ให้ระบุ branch/worktree และเจ้าของไฟล์ที่แก้ค้าง งานอ่านทำคู่ขนานได้; งานเขียนอิสระต้องแยก worktree ก่อนเริ่ม และห้ามทิ้งหรือทับงานค้าง การรวมงานทำทีละ change set พร้อมตรวจ diff

## 2. Scope

จัดทำ Requirements, Acceptance Criteria, In scope, Out of scope, Dependencies และ Risks แล้วรอ `Scope Approved`

## 3. Architecture and impact

Architect ตรวจเส้นทางโค้ดจริง จัดทำ Reuse/Modify/New และประเมิน Data, Permission, Integration, Migration, Compatibility, Security และ Rollback

## 4. Implementation authorization

ระบุขอบเขตไฟล์/Component สภาพแวดล้อม Migration และการทดสอบให้ชัด แล้วรอ `Implementation Authorized`

## 5. Incremental build

Builder ทำเป็น Vertical Slice ที่ใช้งานได้ครบตั้งแต่ UI/Service/Data/Permission/Error handling/Test โดยไม่แตะงานนอกขอบเขต

ระหว่างแก้ให้รัน focused checks ที่ตรวจพฤติกรรมที่เปลี่ยนจริง บันทึกคำสั่ง ผล และข้อจำกัด QA เตรียมแผนตรวจจาก AC ระหว่างนั้นได้ แต่ต้องตรวจรับ candidate สุดท้ายอย่างอิสระหลัง Builder ส่งงาน

## 6. Independent QA

QA ตรวจ Acceptance Criteria, Boundary, Regression, Permission, Security และ Data integrity ด้วยหลักฐานจริง หากไม่ผ่าน ส่งกลับ Builder เฉพาะ Findings ที่ต้องแก้

สำหรับ release candidate ที่รวมงานแล้ว ให้รัน typecheck, regression tests ที่เกี่ยวข้อง, build และ smoke/user-flow ตามความเสี่ยงบน source snapshot เดียวกัน บันทึก commit/diff และ environment ที่ตรวจ ผลเดิมใช้ซ้ำได้เมื่อ candidate ไม่เปลี่ยนและความเสี่ยงเดิมถูกครอบคลุม; เมื่อแก้หลัง QA ให้ทดสอบส่วนที่เปลี่ยนและ gate ที่ผลอาจล้าสมัยอีกครั้ง

## 7. Owner UAT

นำเสนอสิ่งที่เปลี่ยน วิธีทดสอบ ข้อจำกัด และผล QA ให้เจ้าของทดสอบหรืออนุมัติผล

## 8. Release readiness

ยืนยัน Backup, Migration, Rollback, Monitoring, Owner, Release window และ Known risks แล้วรอ Approval Record ระดับ `Release Authorized` ที่ระบุ Production โดยตรง

Project Lead จัดทำสรุป Go Live หน้าเดียว: scope/version, candidate, environment, ผล QA/UAT ต่อ AC, blocker/open risk, data/migration status, backup/rollback, monitoring และเรื่องที่เจ้าของต้องตัดสินใจ รวมคำถามที่เกี่ยวข้องเป็นชุดเดียว และระบุชัดว่า `Ready for owner decision` หรือ `Not ready` สรุปนี้ไม่ใช่ Release Authorization

## 9. Release and verify

Primary Codex Thread เป็น Release Executor และ Deploy ได้เฉพาะเมื่อ Approval Record ครบ ตรวจ Smoke test/Monitoring และรายงานผล หากผิดปกติให้ใช้แผน Rollback ที่อนุมัติ Agent ผู้เชี่ยวชาญทั้งสี่ไม่มีสิทธิ์อนุมัติหรือขยายขอบเขต Release

## Definition of Done

งานเสร็จเมื่อขอบเขตและ Acceptance Criteria ผ่าน, Test ที่เกี่ยวข้องผ่าน, QA ให้ PASS หรือเจ้าของโครงการยอมรับเงื่อนไขตามระดับความเสี่ยงเป็นลายลักษณ์อักษร, เอกสารและ Change log สอดคล้อง, ไม่มี Blocker และระบุสถานะ Release อย่างชัดเจน `PASS WITH CONDITIONS` ไม่อนุญาตให้ Release โดยอัตโนมัติ
