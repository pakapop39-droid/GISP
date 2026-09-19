# GISP Security Advisor Triage — Release C/D v0.1

**สถานะ: Read-only snapshot / ยังไม่ใช่ Security clearance หรือ Production Authorization**

อ่าน Production project `865860c2-49fa-4e53-908f-9396b2f75233` ผ่าน temp read-only context ด้วย `diagnose advisor --json`. ไม่ได้สั่ง scan ใหม่, suppress, แก้ ACL, Apply หรือ Deploy.

## Snapshot

- Scan ID `f33db0a7-f5b6-4efd-81c2-801952d6d1ce`, completed, manual, `2026-09-08T22:16:40.953Z`
- Summary: 543 issues — Critical 142, Warning 310, Info 91
- Scan warning: rule `slow-query` failed
- CLI ส่งรายละเอียดกลับมา 50 รายการแรก ทั้งหมดเป็น Critical `dangerous-function`; จึงไม่สามารถถือว่า 543 รายการถูก triage ครบ
- เก็บรายละเอียดทั้ง 50 รายการที่ตอบกลับและ Matrix ใน `release-candidates/pay-rpc-gate-001/security/advisor-triage.json`

## สิ่งที่เกี่ยวกับ C/D ใน 50 รายการที่ตอบกลับ

พบ 11 รายการตรงกับ C/D signatures: `admin_claim_action`, `mark_supplier_payment_paid`, `can_dispatch_order_item`, `release_warehouse_receipt_item`, `record_delivery_v2`, `get_dispatch_gate`, `decide_order_cancellation`, `schedule_delivery`, `update_custom_quotation_draft`, `dispatch_shipment`, `confirm_consolidation`.

Advisor เตือนเพราะเป็น `SECURITY DEFINER` และ callable by `authenticated`; นี่เป็นสัญญาณให้ตรวจการตรวจสิทธิ์ภายใน Function, pinned `search_path`, tenant isolation และ ACL ไม่ใช่คำสั่งให้ปิด Function อัตโนมัติ. ห้าม suppress เพื่อทำให้รายงานสะอาด. ทุก Function C/D ต้องตรวจ definition/ACL บน exact Release Candidate อีกครั้ง แม้ไม่อยู่ใน 50 รายการที่ API ตอบกลับ.

## ACL expectation

- Release C Member: 9 signatures เปิด `authenticated` หลัง Gate C เท่านั้น
- C staff continuation: 9 signatures; read-only Production-B `routine_privileges` วันที่ 19 ก.ย. แสดง direct grantees เป็น `authenticated` และ `project_admin`, ไม่มี `anon`. Stop ถอน user-facing roles โดยคง trusted internal role และ resume คืน `authenticated` ตาม snapshot เท่านั้น; ต้องอ่าน ACL ซ้ำในเหตุการณ์จริง
- Payment private preview/verify: `project_admin` เท่านั้น; `PUBLIC`, `anon`, `authenticated` ต้องไม่มี EXECUTE
- D7/D8/D9/D10: D7 stop/resume แตะเฉพาะ 5 writes และคง 2 read helpers; D8/D9/D10 เปิดทีละ 17/4/3 signatures; D8 retired v1 สอง signaturesไม่เปิดกลับ
- Production actual state หลัง candidate: **UNVERIFIED** จนอ่าน `pg_proc`/ACL บน exact target และ QA ทดสอบ direct calls

## Verdict

Security Advisor readiness ยังเป็น **FAIL / Blocker สำหรับ Production authorization** เพราะ snapshot เก่า, แสดงรายละเอียดเพียง 50/543, slow-query rule ไม่สำเร็จ และ candidate C/D ยังไม่ถูกสแกน/ทดสอบ ACL บน Production-derived rehearsal. งานถัดไปคือ QA ตรวจแพ็กเกจ, ซ้อม stop/resume แบบไม่แตะ Production, แล้วขออำนาจ scan/triage exact Release Candidate แยกต่างหาก.
