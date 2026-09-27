# Delivery Workflow

## 1. Classify and choose the shortest safe path

ตรวจเป้าหมาย Source of Truth ระบบเดิม Tests และ Git state เท่าที่จำเป็น แล้วจัด Tier:

- `T0`: Primary/Lead วิเคราะห์และรายงาน
- `T1`: Lean Task Record → Builder → QA แบบเบาหรือรวมตรวจบน candidate
- `T2`: Lead scope → Builder → QA เฉพาะจุด; ใช้ Architect เมื่อมี material impact
- `T3`: Lead → Architect → Builder → QA เต็มรูปแบบ สำหรับ Auth/RLS/Privacy/Audit, เงิน/สูตร, Schema/Migration/ข้อมูล, API/Integration contract, persisted-data behavior/lifecycle, External write/ค่าใช้จ่าย/Secret
- `T4`: Release readiness → explicit Production Release Authorization → Primary thread executes

ก่อนเขียนให้ระบุ branch/worktree, snapshot, file scope และเจ้าของไฟล์ค้าง ใช้ worktree แยกเฉพาะเมื่อมีผู้เขียนพร้อมกันหรือไฟล์ชนกัน ห้ามทิ้งหรือทับงานอื่น

## 2. Define the smallest usable slice

ระบุผู้ใช้หลักหนึ่งกลุ่ม งานหลักหนึ่งอย่าง In/Out scope และ Acceptance Criteria เท่าที่พิสูจน์ผลลัพธ์ได้ แบ่ง `Go Live Now`, `After Evidence`, `Future` และแยก Go Live blocker ออกจาก Backlog

T1 ใช้ Lean Task Record แบบย่อได้ T2–T4 ใช้ Requirements/Risks ที่เหมาะกับผลกระทบ Scope และ Implementation อาจอนุมัติพร้อมกันใน Record เดียวสำหรับ bounded non-Production slice

## 3. Design only as much as risk requires

เลือก `Reuse → Configure → Modify → New` และ Vertical Slice ที่เล็กที่สุด ใช้ managed monolith และ manual-first จนมีปริมาณใช้งาน ความล่าช้า ค่าใช้จ่าย หรือความเสี่ยงที่วัดได้เป็น trigger ให้ขยาย

Architect ใช้เส้นทาง FAST สำหรับ impact เล็กและย้อนกลับง่ายที่ไม่เปลี่ยน Contract หรือ persisted data; ใช้ ARCHITECTURE review เมื่อกระทบหลาย Component, API/Integration contract, persisted-data behavior/lifecycle, Permission, Integration, Compatibility, Scale trigger หรือ Rollback

## 4. Build and verify proportionately

Builder ทำเป็น Vertical Slice ที่ใช้งานได้ครบตั้งแต่ UI/Service/Data/Permission/Error handling/Test โดยไม่แตะงานนอกขอบเขต

ระหว่างแก้ให้รัน focused checks ที่ตรวจพฤติกรรมที่เปลี่ยนจริง เพิ่ม Test เมื่อพฤติกรรม Validation, Permission หรือ Regression risk เปลี่ยน ไม่สร้าง Test เชิงพิธีการสำหรับ Copy/CSS/Docs ที่ตรวจตรงได้

ตรวจ integrated release candidate หนึ่งครั้งตามความเสี่ยงและส่ง QA อิสระตาม Tier ผล gate เดิมใช้ซ้ำได้เมื่อ candidate และ risk ไม่เปลี่ยน หลังแก้ Finding ให้ตรวจเฉพาะส่วนที่เปลี่ยนและ gate ที่อาจล้าสมัย

## 5. Lean Go Live gate

พร้อมให้เจ้าของตัดสินใจ Go Live เมื่อมี:

- `Value`: ผู้ใช้ทำ Core flow สำเร็จ
- `Safety`: ขอบเขตข้อมูล สิทธิ์ เงิน และ Input สำคัญปลอดภัย
- `Operable`: เจ้าของดูสถานะ ช่วยผู้ใช้ และเห็น Error ได้
- `Reversible`: ปิด feature, rollback หรือ restore ได้เหมาะกับความเสี่ยง
- `Evidence`: exact candidate ผ่าน Tests/QA ที่เหมาะสม

ห้ามเลื่อนเมื่อเกี่ยวข้องกับ Auth/tenant isolation, server validation, ราคา/Order/Payment, Migration/Backup/Rollback, Secret, Upload safety, Webhook integrity หรือ Production monitoring/recovery ส่วน Cosmetic polish, advanced report, speculative performance และ automation ที่มี manual fallback ปลอดภัยอาจอยู่ Backlog ได้

## 6. Release and learn

Project Lead สรุปหน้าเดียว: scope/version, candidate/environment, Value/Safety/Operable/Reversible/Evidence, blocker/open risk, data/migration, rollback/monitoring และ owner decisions การสรุปนี้ไม่ใช่ Release Authorization

ใช้ controlled canary หรือ invite-only เมื่อทำได้ Primary thread Deploy เฉพาะเมื่อมี Approval Record ระดับ `Release Authorized` ที่ระบุ Production โดยตรง แล้วตรวจ Smoke/Monitoring/Rollback readiness เก็บหลักฐานใช้งานจริงก่อนขยาย Scale หรือ Backlog

## Definition of Done

Slice เสร็จเมื่อขอบเขตและ Acceptance Criteria ผ่าน, หลักฐานตาม Tier ผ่าน, ไม่มี Blocker ที่เกี่ยวข้อง และระบุสถานะ Release ชัดเจน `PASS WITH CONDITIONS` ไม่อนุญาตให้ Release โดยอัตโนมัติ
