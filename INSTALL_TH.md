# วิธีติดตั้ง VS AI Development Team

แพ็กเกจนี้ใช้กับ Codex แบบ Project-scoped และควรติดตั้งใน Repository ของแต่ละแอป

## ไฟล์ที่จะติดตั้ง

- `AGENTS.md` — กติกากลางของโครงการและการประสาน Agent
- `.codex/config.toml` — เปิดการทำงานแบบ Multi-agent สูงสุด 4 subagents พร้อมกัน โดยไม่รวม Primary Agent
- `.codex/agents/*.toml` — Agent 4 บทบาท
- `.agents/skills/vs-app-development-team/` — Skill และมาตรฐานการส่งมอบ

## ขั้นตอน

1. สำรองหรือ Commit งานเดิมของ Repository
2. คัดลอกไฟล์และโฟลเดอร์ทั้งหมดจากแพ็กเกจไปที่ Root ของ Repository
3. ถ้ามี `AGENTS.md` หรือ `.codex/config.toml` อยู่แล้ว ให้รวมเนื้อหาโดยรักษากฎเดิม ห้ามเขียนทับทันที
4. เปิด Codex ที่ Root ของ Repository ใหม่
5. ทดสอบด้วยคำสั่งตัวอย่างด้านล่าง โดยยังไม่อนุญาตให้แก้โค้ด

ถ้ามีไฟล์เดิม ให้ใช้คำสั่งนี้ก่อนรวมไฟล์:

```text
ตรวจไฟล์เดิมกับแพ็กเกจ VS AI Development Team แบบอ่านอย่างเดียว
จัดทำ Merge Plan แยก Keep / Add / Conflict พร้อมผลกระทบ
ห้ามเขียนทับหรือแก้ไฟล์จนกว่าฉันจะอนุมัติ Merge Plan
```

## ตรวจหลังติดตั้ง

1. เปิดรายการ Skills หรือพิมพ์ `$` แล้วตรวจว่าพบ `vs-app-development-team`
2. ให้ Codex เรียก Agent ทั้งสี่ทำรายงาน Read-only สั้น ๆ โดยยังไม่แก้โค้ด
3. ถ้าไม่พบ Skill หรือ Agent ให้ปิดและเปิด Codex ใหม่ แล้วตรวจตำแหน่งไฟล์จาก Root ของ Repository

## คำสั่งทดสอบครั้งแรก

```text
ใช้ $vs-app-development-team ตรวจโปรเจกต์นี้แบบอ่านอย่างเดียว
ให้ vs_project_lead สรุปเป้าหมายและเอกสารหลัก
ให้ vs_system_architect ตรวจโครงสร้างและรายการ Reuse/Modify/New
ยังไม่ให้แก้โค้ด ไม่ให้เชื่อม Production และสรุปเรื่องที่ต้องให้ฉันอนุมัติ
```

## คำสั่งพัฒนาหลังอนุมัติ Scope

```text
ฉันอนุมัติขอบเขตตามเอกสาร [ชื่อเอกสาร/เวอร์ชัน]
อนุญาตให้ vs_app_builder แก้เฉพาะ [ขอบเขต] ใน Workspace ทดสอบ
หลังแก้ให้ vs_qa_guardian ตรวจอย่างอิสระและสรุปผลก่อน ห้าม Deploy Production
```

## การเพิ่มกฎเฉพาะแอป

เก็บกฎเฉพาะ MBDS, Built-in Studio, Smart BOQ หรือ Smart Project ไว้ใน Domain Skill หรือ Master Document ของแอปนั้น ไม่ควรใส่กฎเฉพาะทั้งหมดลงใน Skill กลางนี้
