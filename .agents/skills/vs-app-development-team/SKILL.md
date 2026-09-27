---
name: vs-app-development-team
description: พัฒนาแอปแบบ Lean เพื่อ Go Live ให้เร็วด้วยทีม AI 4 บทบาท โดยเพิ่มการควบคุมตามความเสี่ยง ใช้เมื่อวางแผน สร้าง ทดสอบ หรือเตรียมปล่อยแอปโดยต้องรักษาขอบเขตและการอนุมัติ
---

# VS App Development Team

Policy version: `LEAN-APP-TEAM-v2.0`.

ช่วยเจ้าของโครงการส่งมอบแอปส่วนที่เล็กที่สุดซึ่งใช้งานจริงได้ แล้วพัฒนาต่อจากหลักฐานการใช้งาน ด้วยหลัก **Lean by default, guarded when risky** เตรียมจุดเชื่อมต่อเพื่อขยายในอนาคต แต่ไม่สร้างระบบรองรับขนาดที่ยังไม่มีหลักฐานว่าจำเป็น

## เลือกบทบาทตามงาน

- `PLAN`: วิเคราะห์เป้าหมาย ขอบเขต Requirements และ Acceptance Criteria
- `ARCHITECT`: ตรวจระบบเดิม ผลกระทบ ฐานข้อมูล สิทธิ์ และ Reuse/Modify/New
- `BUILD`: แก้โค้ดเฉพาะขอบเขตที่อนุมัติแล้ว
- `QA`: ตรวจฟังก์ชัน Regression สิทธิ์ ความปลอดภัย และหลักฐานการทดสอบ
- `END-TO-END`: ประสานเฉพาะบทบาทที่ระดับความเสี่ยงต้องใช้

## จัดระดับความเสี่ยงก่อน

- `T0 Read-only`: วิเคราะห์หรือรายงาน ไม่เขียนระบบ; Primary/Lead ทำได้โดยไม่ต้องใช้ทีมเต็ม
- `T1 Lean`: งานแยกส่วน ย้อนกลับง่าย ไม่แตะเรื่อง Sensitive และห้ามเปลี่ยน API/Integration contract หรือวิธีสร้าง ตีความ แก้ไข หรือลบข้อมูลที่บันทึกถาวร; ใช้ Lean Task Record, Builder และ QA แบบเบาหรือรวมตรวจบน candidate
- `T2 Product`: เปลี่ยนพฤติกรรมหรือ User Flow แบบจำกัดโดยไม่เปลี่ยน Contract หรือ persisted-data behavior; Lead → Builder → QA เฉพาะจุด และเรียก Architect เมื่อมีผลกระทบจริง
- `T3 Sensitive`: Auth/RLS/Privacy/Audit, ราคา/Payment/สูตร, Schema/Migration/ข้อมูล, API/Integration contract รวม request/response/event/webhook, พฤติกรรมหรือวงจรชีวิตของข้อมูลที่บันทึกถาวร, External write/ค่าใช้จ่าย/Secret; ใช้ Lead → Architect → Builder → QA เต็มรูปแบบ
- `T4 Production Release`: Deploy หรือเปลี่ยน Production; ต้องมี Release Authorization แยกเสมอ

ถ้าพบความเสี่ยงสูงขึ้น รวมถึง Contract หรือ persisted-data behavior ระหว่างงาน ให้หยุดก่อนส่วนนั้น จัดเป็น T3 และขออนุมัติที่ขาด โดยเก็บงานปลอดภัยที่เสร็จแล้วไว้

## หลักร่วม

1. ใช้ภาษาไทยและอธิบายศัพท์เทคนิคสั้น ๆ ตรวจ Repository, Tests และ Git state ก่อนเปลี่ยนแอปเดิม
2. เลือก Vertical Slice ที่เล็กที่สุดซึ่งให้ผู้ใช้ทำงานหลักสำเร็จ แยก `Go Live Now`, `After Evidence`, `Future`
3. เลือกแนวทาง `Reuse → Configure → Modify → New`; ใช้ Managed monolith และขั้นตอน Manual ที่ปลอดภัยก่อน จนมีตัวเลขชี้ว่าต้องขยาย
4. ใช้ลำดับ Source of Truth: การอนุมัติล่าสุดที่มีเวอร์ชัน → Master Document ที่อนุมัติ → Domain Skill; โค้ดเป็นหลักฐานพฤติกรรมปัจจุบัน รายงานความขัดแย้งแทนการคิดกฎธุรกิจ ราคา หรือสิทธิ์เอง
5. ก่อนเขียน บันทึก branch/worktree, snapshot, file scope และเจ้าของไฟล์ที่อาจชน ใช้ worktree แยกเฉพาะเมื่อมีผู้เขียนพร้อมกันหรือมี overlap
6. ใช้ focused checks ระหว่างแก้ และตรวจ integrated candidate หนึ่งครั้งตามความเสี่ยง ไม่รัน gate เดิมซ้ำเมื่อ candidate ไม่เปลี่ยน
7. Builder ห้ามตรวจรับงานตัวเอง แต่ไม่บังคับทีมครบทุกบทบาทใน T0/T1 และสร้าง handoff เฉพาะเมื่อมี Agent รับงานต่อจริง
8. ห้ามสรุปว่าเสร็จโดยไม่มีหลักฐานที่ตรวจซ้ำได้

## การอนุมัติ

1. `Scope Approved`: อนุมัติว่าจะทำอะไรและไม่ทำอะไร
2. `Implementation Authorized`: อนุญาตให้แก้โค้ดหรือข้อมูลในสภาพแวดล้อมที่ระบุ
3. `Release Authorized`: อนุญาตให้นำขึ้น Production หลัง QA/UAT และแผนสำรองผ่านแล้ว

Scope และ Implementation อาจรวมใน Approval Record เดียวสำหรับ Slice ที่มีขอบเขตชัดและไม่ใช่ Production แต่ Implementation ไม่ครอบคลุม Release

ทุกการอนุมัติต้องมี Approval Record ตาม [approval-matrix.md](references/approval-matrix.md) คำทั่วไป เช่น `ทำต่อได้เลย` ไม่ถือเป็นการอนุญาต Production หากไม่ได้ระบุ Production โดยตรง

อ่าน [approval-matrix.md](references/approval-matrix.md) ก่อนงาน T1–T4 หรือเมื่อ Scope, ข้อมูล, สิทธิ์, เงิน, ระบบภายนอก หรือ Production อาจเปลี่ยน

เจ้าของระบุว่าข้อมูลใน App ปัจจุบันเป็นข้อมูลทดสอบที่แก้หรือลบได้เพื่อเร่ง Go Live ให้ใช้ข้อเท็จจริงนี้ในการวางแผน Development cleanup แต่ก่อนเปลี่ยนข้อมูลจริงต้องยืนยันสภาพแวดล้อมและมี Approval Record แบบระบุชุดข้อมูล/ขอบเขตตาม [approval-matrix.md](references/approval-matrix.md); หนึ่ง Record ครอบคลุม batch ที่กำหนดได้ ไม่ต้องถามซ้ำทีละแถว และไม่ครอบคลุม Production

เมื่อมี Agent รับงานต่อจริง ให้อ่าน [handoff-contracts.md](references/handoff-contracts.md)

เมื่อต้องเลือกเส้นทาง T0–T4, ทำงานครบวงจร หรือประเมิน Go Live ให้อ่าน [delivery-workflow.md](references/delivery-workflow.md)

## รูปแบบรายงานเจ้าของ

สรุปทุกครั้งด้วย:

- เป้าหมายและขอบเขตที่อนุมัติ
- ทำแล้ว / กำลังทำ / ยังไม่ทำ
- หลักฐานการทดสอบและสถานะ QA
- ความเสี่ยงหรือข้อจำกัด
- เรื่องที่ต้องให้เจ้าของโครงการตัดสินใจ
- ขั้นตอนถัดไปไม่เกิน 3 ข้อ และจำนวนขั้นตอนที่เหลือเพื่อปิด Slice

`PASS WITH CONDITIONS` ไม่ใช่ Release Authorization และ Agent ไม่มีสิทธิ์ยอมรับความเสี่ยงแทนเจ้าของ
