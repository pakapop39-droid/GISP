# Agent Handoff Contracts

## ข้อมูลอ้างอิงที่ต้องมีในทุก Handoff

- Domain Skill ที่ใช้
- Master Document และ Version
- Requirement/CR/Acceptance Criteria IDs
- แหล่งที่ตรวจแล้ว แหล่งที่ไม่พบ และสิ่งที่ยังไม่ได้ตรวจ
- Approval Record ที่เกี่ยวข้อง หรือระบุชัดว่า `Not yet approved`
- Branch/worktree, source snapshot และเจ้าของไฟล์ที่แก้ค้างซึ่งอาจชนกับงานนี้

## Project Lead → Architect

- Goal และ Business value
- Confirmed facts / Assumptions / Needs confirmation
- In scope / Out of scope
- Requirements และ Acceptance Criteria พร้อม ID
- ข้อขัดแย้งและเรื่องที่ต้องอนุมัติ

## Architect → Builder

- หลักฐาน Current state พร้อมไฟล์หรือ Component
- แนวทาง Reuse / Modify / New
- Interfaces, Data, Permissions และ Migration impact
- Constraints และสิ่งที่ห้ามเปลี่ยน
- Tests ที่จำเป็นและ Rollback expectation
- Focused checks ระหว่าง build และ final candidate gates ที่ต้องผ่าน โดยอิงความเสี่ยงจริง
- Approval Record ของ Implementation Authorization ที่มีผู้อนุมัติ ขอบเขต เวอร์ชัน Environment สิทธิ์ด้านข้อมูล และ Production allowed

## Builder → QA

- Requirements และ Acceptance Criteria ที่ทำ
- ไฟล์และพฤติกรรมที่เปลี่ยน
- Migration หรือ Configuration ที่เกี่ยวข้อง
- คำสั่งทดสอบและผลจริง
- Known limitations และความเสี่ยง

## QA → Project Lead

- Verdict: PASS / PASS WITH CONDITIONS / FAIL
- Evidence แยกตาม Acceptance Criterion
- Findings: Blocker / Major / Minor / Observation
- Regression, Permission, Security และ Data status
- สิ่งที่ยังตรวจไม่ได้
- งานแก้ที่จำเป็นหรือเงื่อนไขก่อน Release

QA ต้องบังคับใช้กติกา:

- Blocker ห้าม Release จนแก้และตรวจใหม่
- Major ต้องแก้หรือให้เจ้าของโครงการยอมรับความเสี่ยงเป็นลายลักษณ์อักษร
- Minor ต้องมีผู้รับผิดชอบและกำหนดเสร็จก่อนเลื่อน
- PASS WITH CONDITIONS ไม่ใช่ Release Authorization

Agent ผู้รับงานต้องหยุดเมื่อ Handoff ขาดข้อมูลที่อาจเปลี่ยนผลลัพธ์หรือความปลอดภัย และต้องระบุช่องว่างอย่างเฉพาะเจาะจง
