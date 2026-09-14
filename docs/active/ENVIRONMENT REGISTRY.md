# GISP — ENVIRONMENT REGISTRY

**Version:** ENV2-v0.1  
**Status:** Approved source of truth for owner-facing environment names and links  
**Approved at:** 2026-09-13T10:34:04.756+07:00  
**Approval-time basis:** Owner-authorized ratification receipt time for both pre-existing Scope and Implementation approvals  
**Owner:** ภคภพ ช.เจริญยิ่ง

เอกสารนี้ตอบคำถามว่า “ต้องใช้ลิงก์ไหน” และ “งานอยู่ระบบใด” หากเอกสาร Active ฉบับอื่นแสดง Demo, Preview, deployment URL หรือ branch เก่า ให้ถือเป็นหลักฐานเชิงประวัติหรือชื่อทางเทคนิค ไม่ใช่ระบบถาวรที่เจ้าของต้องเลือก

## ระบบถาวรที่เจ้าของใช้

| ระบบ | ลิงก์หลัก | Git branch หลัก | หน้าที่ |
| --- | --- | --- | --- |
| Production | https://m8ugbyak.insforge.site | `main` | ระบบใช้งานจริง การเปลี่ยนแปลงต้องมี Release Authorization ที่ระบุ Production โดยตรง |
| Development | https://gisp-mvp-development.insforge.site | `development` | พัฒนาและทดสอบก่อนขออนุญาตนำขึ้น Production |

มีเพียงสองแถวข้างต้นที่เป็นตัวเลือกถาวรสำหรับเจ้าของระบบ

## ชื่อทางเทคนิคและพื้นที่ชั่วคราว

- `kit6y4pj` และ URL ที่ขึ้นต้นด้วยชื่อนี้เป็นรหัส/alias ทางเทคนิคของ Development ไม่ใช่ระบบที่สาม
- Demo และ Preview ที่ปรากฏในหลักฐานเดิมเป็นของสาธิตหรือผลทดสอบเชิงประวัติ ไม่ใช่ตัวเลือกใช้งานหลัก
- Git feature branch, InsForge backend branch และ rehearsal/preview ใช้เป็น sandbox ชั่วคราวภายใต้ Development ได้ ต้องระบุงาน ผู้รับผิดชอบ และหลักฐานก่อนใช้งาน
- Sandbox ชั่วคราวไม่เปลี่ยนเป็น Production เอง การ merge, deploy, เปลี่ยนฐานข้อมูล หรือลบทรัพยากรต้องใช้อำนาจอนุมัติของงานนั้นโดยเฉพาะ
- ENV2-v0.1 ไม่อนุญาตให้ลบ branch, project, worktree, deployment, link หรือหลักฐานเดิม

## สถานะปัจจุบันที่เกี่ยวข้อง

- Local Git branch `development` สร้างจาก `94506d3ae5d4a215616bc03c0cdbed8a905b1f42` เมื่อ 13 กันยายน 2569 โดยยังไม่ push และไม่แก้ `main`
- งานค้างและไฟล์ใหม่ใน workspace ถูกเก็บไว้ครบระหว่างเปลี่ยน branch; ENV2-v0.1 ไม่ได้รับรองว่างานค้างเหล่านั้นพร้อม merge หรือ deploy
- PDF Catalog Import ใช้ InsForge Full Backend Branch `pdf-catalog-import-v1` ใต้ `gisp-mvp-development`; ตรวจแบบอ่านอย่างเดียวพบสถานะ `ready` เมื่อ 13 กันยายน 2569
- หลักฐาน live ที่ QA ตรวจพบยืนยันว่า migration `20260912122859`, `20260912234654`, `20260913075421` และ `20260913091000` ถูก apply บน PDF branch แล้ว ห้าม re-apply; Runtime/RLS/Config/Worker/QA/UAT/merge/deployment ยังต้องตรวจตามเอกสารส่งต่อ PDF

## Approval records

### Scope Approval

- `approval_level`: Scope
- `approved_by`: ภคภพ ช.เจริญยิ่ง
- `approval_text_or_reference`: “ผมอนุมัติแนวทาง ENV2-v0.1 ให้มี Production และ Development เป็นสองระบบถาวร อนุญาตให้มีพื้นที่ทดลองชั่วคราวภายใต้ Development แต่ยังไม่อนุญาตให้ลบทรัพยากรหรือเปลี่ยน Production”
- `ratification_text_or_reference`: ข้อความรับรองของเจ้าของใน primary Codex thread ซึ่งยืนยัน Scope + Implementation ของ ENV2-v0.1 และอนุญาตให้ใช้เวลารับข้อความรับรองเป็น `approved_at` ของการอนุมัติเดิมทั้งสองระดับ
- `scope_document_version`: ENV2-v0.1
- `environment`: Local / Development; Production เป็นข้อมูลอ้างอิงเท่านั้น
- `data_migration_authorized`: No
- `production_allowed`: No
- `approved_at`: 2026-09-13T10:34:04.756+07:00
- `approval_time_status`: Ratified — เป็นเวลารับข้อความรับรองที่เจ้าของอนุญาตให้ใช้กับ Scope Approval เดิม

### Implementation Authorization

- `approval_level`: Implementation
- `approved_by`: ภคภพ ช.เจริญยิ่ง
- `approval_text_or_reference`: “ผม ภคภพ ช.เจริญยิ่ง อนุญาตให้ดำเนินการ ENV2-v0.1 บน Local และ Development ได้แก่ รักษาและจัดหมวดงานค้าง สร้าง Git branch `development` ปรับเอกสารให้แสดงสองระบบหลัก และปรับเอกสารสถานะ PDF ให้ตรงกับสถานะจริง ไม่อนุญาตลบทรัพยากร เปลี่ยนฐานข้อมูล Deploy หรือเปลี่ยน Production และให้ใช้เวลาข้อความนี้เป็นเวลาอนุมัติ”
- `ratification_text_or_reference`: ข้อความรับรองของเจ้าของใน primary Codex thread ซึ่งยืนยัน Scope + Implementation ของ ENV2-v0.1 และอนุญาตให้ใช้เวลารับข้อความรับรองเป็น `approved_at` ของการอนุมัติเดิมทั้งสองระดับ
- `scope_document_version`: ENV2-v0.1
- `environment`: Local / Development
- `data_migration_authorized`: No
- `production_allowed`: No
- `approved_at`: 2026-09-13T10:34:04.756+07:00
- `approval_time_status`: Ratified — เป็นเวลารับข้อความรับรองที่เจ้าของอนุญาตให้ใช้กับ Implementation Authorization เดิม
- `implementation_started_at`: 2026-09-13T09:33:14+07:00 (Git reflog; ไม่ใช่เวลาอนุมัติ)

## กติกาวงจรงาน

1. งานใหม่เริ่มจาก Local หรือ sandbox ชั่วคราวภายใต้ Development
2. รวมงานเข้า `development` และเผยแพร่ Development ได้เฉพาะเมื่อขอบเขตของงานนั้นอนุญาตและผ่านการตรวจที่กำหนด
3. ให้ QA ตรวจอย่างอิสระก่อนขอ Owner UAT หรือ Release Authorization
4. การนำขึ้น Production ต้องมี Release Authorization ใหม่ที่ระบุรุ่น ปลายทาง ข้อมูล/ฐานข้อมูล แผนสำรอง และเวลาปล่อยอย่างชัดเจน
5. การลบหรือเก็บกวาดทรัพยากรต้องเสนอรายการและผลกระทบ แล้วขออนุมัติแยกก่อนทุกครั้ง

## หลักฐานตรวจแบบไม่เปลี่ยนข้อมูล

- 2026-09-13: HTTP GET smoke check ไปยัง Production ตอบ `200` และปลายทางสุดท้ายคือ `https://m8ugbyak.insforge.site/`
- 2026-09-13: HTTP GET smoke check ไปยัง Development ตอบ `200` และปลายทางสุดท้ายคือ `https://gisp-mvp-development.insforge.site/`
- การตรวจทั้งสองรายการดาวน์โหลดหน้าเว็บสาธารณะเท่านั้น ไม่ login, ไม่ส่งฟอร์ม และไม่เรียกคำสั่งเปลี่ยนข้อมูล

## การเชื่อมโยง Acceptance Criteria

| เกณฑ์ | ข้อกำหนดที่อนุมัติ (verbatim) | หลักฐาน/สถานะ |
| --- | --- | --- |
| `ENV2-AC-001` | เอกสาร Active สำหรับเจ้าของแสดงเพียง Production และ Development พร้อมวัตถุประสงค์ชัดเจน | ตารางระบบถาวรในเอกสารนี้และเอกสาร Active ที่เชื่อมโยง |
| `ENV2-AC-002` | ลิงก์ Production และ Development ผ่าน smoke check โดยไม่มีการเปลี่ยนข้อมูล | HTTP GET แบบ read-only ตอบ `200` ทั้งสองลิงก์; รอ QA ยืนยันอิสระ |
| `ENV2-AC-003` | งาน PDF และข้อมูลที่ยังไม่ commit ไม่สูญหายระหว่างจัดโครงสร้าง | Git status ก่อน/หลังเปลี่ยน branch เท่ากัน 159 รายการ; diff 0 |
| `ENV2-AC-004` | branch/preview ชั่วคราวถูกระบุว่าเป็นส่วนภายใน Development ไม่ใช่ตัวเลือกใช้งานถาวร | นโยบาย “ชื่อทางเทคนิคและพื้นที่ชั่วคราว” ในเอกสารนี้ |
| `ENV2-AC-005` | URL และหลักฐานย้อนหลังยังค้นคืนได้ แต่ไม่ถูกนำเสนอเป็นลิงก์หลัก | Registry เชื่อมเอกสารย้อนหลัง; URL เก่ามีป้าย historical/technical |
| `ENV2-AC-006` | QA ยืนยันว่า Production ไม่เปลี่ยนก่อนปิดงานจัดระเบียบ | รอ QA ตรวจอิสระ; ENV2-v0.1 ระบุ Production=No |

## เอกสารและหลักฐานที่เกี่ยวข้อง

- [Development Handoff Summary](DEVELOPMENT%20HANDOFF%20SUMMARY.md)
- [Decision Log](DECISION%20LOG.md) — DEC-069
- [Current Project Status](CURRENT%20PROJECT%20STATUS.md)
- [Production Operations Runbook](PRODUCTION%20OPERATIONS%20RUNBOOK.md)
- [Demo Story and Mock Data](DEMO%20STORY%20AND%20MOCK%20DATA.md) — หลักฐาน Demo เชิงประวัติ
- [Image Search online preview evidence](../evidence/2026-09-09-image-search-online-preview.md) — หลักฐาน Preview เชิงประวัติ
- [PDF Catalog Import approval](../evidence/2026-09-12-pdf-catalog-import-v1-approval.md)
- [PDF Catalog Import builder handoff](../evidence/2026-09-12-pdf-catalog-import-v1-builder-handoff.md)
