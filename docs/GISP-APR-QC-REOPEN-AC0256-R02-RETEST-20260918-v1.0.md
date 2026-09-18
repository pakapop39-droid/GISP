# GISP QC Reopen AC-02/05/06 — Development R02 Retest Authorization v1.0

วันที่บันทึก: 2026-09-18 (Asia/Bangkok) · สถานะ: อนุมัติการทดสอบ ไม่ใช่ Production Release

| รายการ | รายละเอียด |
|---|---|
| `approval_level` | Development transaction retest authorization |
| `approved_by` | ภคภพ ช.เจริญยิ่ง |
| `approval_text_or_reference` | ข้อความใน Codex Task: “อนุมัติและทดสอบกรณี AC-02/05/06 ที่ยังขาดด้วยชุดทดสอบที่เหมาะสม” ต่อจากผล UAT AC-04 และข้อกำหนดให้ใช้ `pakapop39@hotmail.com` ทดสอบงานภายใน ยกเว้น Member |
| `scope_document_version` | `GISP-PLAN-QC-REOPEN-DR024-R02-20260918-v0.1.md` AC-02/05/06 และ `GISP-UAT-QC-REOPEN-DR024-R02-20260918-v0.1.md` |
| `environment` | GISP Development เท่านั้น (`gisp-mvp-development`; project ID `db09b94e-fc37-4f90-9530-3289afef0b79`) |
| `transaction_data_authority` | ตีความอย่างแคบที่สุด: ใช้เฉพาะ R02 `ORD-2026-000011` / `SHP-2026-000005` และผล QC/Audit/Event ที่ App สร้างจากการทดสอบตาม AC เหล่านี้; อาจมีการบันทึก Reinspection PASS, Reopen ซ้ำ, และ Dispatch จำลองหากจำเป็นเพื่อพิสูจน์ AC-05/06; **ไม่ใช้ R01 หรือธุรกรรมอื่น** |
| `data_migration_authorized` | No; ไม่แก้ DB โดยตรง, ไม่สร้าง/Apply migration, ไม่ลบ/ย้อนข้อมูลเดิม |
| `code_deploy_authorized` | No; ไม่แก้ Source Code, Role, Permission หรือ Deploy เพิ่มจากข้อความนี้ |
| `production_allowed` | No |
| `approved_at` | 2026-09-18 ก่อน 12:51 ICT; ไม่มี timestamp ของข้อความเจ้าของที่แม่นยำกว่า |

## Test guardrails

- ก่อนแต่ละการเปลี่ยนสถานะ ตรวจว่าบัญชีใน App เป็น `pakapop39@hotmail.com` / `bobady` และ R02 ยังเป็นชุดข้อมูลจำลองใน Development
- บันทึกผลก่อน–หลังและจำนวน Audit/Inspection; ห้ามกดซ้ำเมื่อผลคำสั่งไม่แน่ชัด
- การทดสอบคำสั่งแข่งกับ Dispatch อาจทำให้ Shipment R02 เปลี่ยนเป็น `DISPATCHED` ซึ่งเป็นสถานะจำลองใน App ไม่ใช่การเคลื่อนย้ายสินค้า; ถ้า App มี external shipping integration ที่ไม่ได้อยู่ในแผน ให้หยุดก่อน
- AC-05 “ไม่มีสิทธิ์/ต่างองค์กร” ไม่อาจพิสูจน์ด้วยบัญชีรวมสิทธิ์ `bobady`; ต้องใช้บัญชีทดสอบที่มีอยู่และสิทธิ์จำกัด/ต่างองค์กร โดยเจ้าของเป็นผู้สลับบัญชีเอง ห้ามสร้างบัญชีหรือแก้ Role เพื่อให้ผลทดสอบผ่าน
- Member Custom approval ใน AC-06 ต้องใช้ Member account แยก; หากไม่มีชุด Custom test ที่ได้รับอนุมัติ ให้บันทึก NOT TESTED ไม่สร้างข้อมูลใหม่เอง
- ผล automated tests หรือการอ่านโค้ดไม่เท่ากับ Hosted UAT PASS; รายงานแยกกัน
