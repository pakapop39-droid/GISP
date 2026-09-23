# Scope Clarification Record — GO-LIVE-MVP-INITIAL-OPERATIONS-01

## Record

| Field | Value |
| --- | --- |
| `approval_level` | `Scope Clarification` |
| `approved_by` | ภคภพ ช.เจริญยิ่ง |
| `approval_text_or_reference` | Owner reply `confirm 2`, referring to Option 2 in the immediately preceding explanation |
| `scope_document_version` | `GO-LIVE-MVP-INITIAL-OPERATIONS-01 v0.1` |
| Approved document SHA-256 | `D4007297B2CF34B538A022526D4A272910248D726C3A44F0C7D7B1045B3C96CF` |
| Environment | Planning / Local documentation only |
| `data_authority` | `None` |
| `migration_authority` | `None` |
| `data_migration_authorized` | `No` |
| `production_allowed` | `No` |
| `approved_at` | `2026-09-23T07:22:40.997+07:00` (Asia/Bangkok; เวลาบันทึกคำยืนยัน) |
| Record status | Effective for Scope interpretation only |

## Approved Interpretation — Option 2

1. `MVP_SCOPE=INITIAL_OPERATIONS` ควบคุม Hosted UI, Hosted API, outbox enqueue และ Notification processors/send
2. เมื่อ `MVP_SCOPE` หายหรือค่าไม่ถูกต้อง ช่องทางในข้อ 1 ต้อง Fail Closed โดย health และ read-only reconciliation ยังคงทำได้
3. Direct RPC ต้องถูกปิดด้วย ACL เฉพาะ Disabled capabilities ของ Candidate นี้ ได้แก่ Supplier Payment, Claims และ Advanced Reports
4. Direct RPC ที่อยู่ใน C/D7/D8 และ Release B คงสิทธิ์เดิมตาม role/organization enforcement เว้นแต่เอกสาร Scope ระบุการเปลี่ยน signature โดยตรง เช่น Order idempotency และ Delivery Issue Resolution
5. Release B ต้อง no-regression และ migration ใหม่ห้ามเปลี่ยน ACL ของ Showroom, Shared Catalog และ Sourcing
6. คำยืนยันนี้ไม่อนุญาตให้แก้โค้ด สร้างหรือ Apply Migration, เขียนข้อมูล, Deploy หรือเปลี่ยน Backend/Staging/Production

## Exact Owner Confirmation Chain

ข้อเสนอที่เจ้าของยืนยัน:

> ข้อ 2: ให้ `MVP_SCOPE` ปิดหน้าจอ, API และตัวส่ง Notification ส่วน Direct RPC ให้ปิดเฉพาะ Supplier Payment, Claims และ Advanced Reports ขณะที่ Release B และ RPC ที่อยู่ใน Scope คง ACL เดิม

คำยืนยันของเจ้าของ:

> confirm 2

