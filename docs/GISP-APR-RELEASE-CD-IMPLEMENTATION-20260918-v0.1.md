# GISP Release C/D — Implementation Authorization Record v0.1

- Approval level: `Implementation Authorized` only; **not** Release Authorization.
- Approved by: ภคภพ ช.เจริญยิ่ง (owner, per conversation).
- Approval text: “อนุญาตให้แก้ Source Code และ Automated Tests เฉพาะ Gate C/D, หน้าจอขนส่งที่มีข้อมูลทดสอบ, การตรวจหลักฐาน Payment และสร้าง Migration สิทธิ์ C/D พร้อมซ้อมด้วยข้อมูลจำลองใน Development/พื้นที่ซ้อม โดยยังไม่ Apply หรือ Deploy ไป Production ได้”
- Scope reference/version: แผนเร่งเปิด GISP Production แบบครบถึงส่งมอบ (ข้อความในแชท ไม่ระบุเลขเวอร์ชัน) และการอนุมัติขอบเขตล่าสุดข้างต้น.
- Environment: Local workspace, GISP Development หรือพื้นที่ซ้อมที่ตรวจสอบแยกแล้วเท่านั้น.
- Data/migration authority: สร้าง Migration สิทธิ์ C/D และซ้อมกับข้อมูลจำลองใน Development/พื้นที่ซ้อมได้; ไม่อนุญาต Apply Production, เปลี่ยนข้อมูล Production หรือ Data Migration จริง.
- Production allowed: **No**. No Production deploy/config change/transaction activation.
- Approval time: บันทึกข้อความอนุมัตินี้ในงานวันที่ 2026-09-18 เวลา 20:30 น. Asia/Bangkok; ไม่ใช่เวลาส่งข้อความที่พิสูจน์จากระบบ.

## Implementation boundary

1. Gate C opens only C routes. Gate D requires contiguous `RELEASE_D_ENABLED_SLICES=7`, then `7,8`, then `7,8,9`, then `7,8,9,10`, under separate DEC-049 approvals. Missing/invalid D configuration opens no D routes. Hosted Production with missing/invalid `RELEASE_STAGE` fails closed, but this record does not authorize setting any Production flag.
2. Finance evidence route reads actual stored bytes only after transfer, schedule, order, organization, Member, metadata type/visibility, size and file signature match. Approval API rejects unverified evidence; rejection remains available. Shared Member/Finance Payment routes block Freight schedules until D8. This is not human verification that a bank transfer occurred.
3. Logistics UI removes simulated shipment/contact/driver/POD/amount/date defaults. Existing VAT rate and freight/payment business rules are not changed.
4. Permission migrations are drafts for C and D7–D10, with exact function signatures and no table/schema/data changes. `reopen_qc_inspection` does not exist in the Production B baseline and its D7 grant requires the approved QC Reopen function migration first. Before any apply, compare candidate signatures and ACLs to the exact target environment and test negative direct-RPC calls.

## Unresolved Production blockers

- Direct RPC `submit_payment_transfer` currently checks organization, Member and visibility but not `entity_type`; `verify_payment_transfer` currently does not validate file binding. The new HTTP guards (including Freight schedule gating) do not cover direct RPC. The current function also allows the same evidence ID to be referenced by more than one transfer; whether this is valid for split payments needs an owner policy decision. Function hardening requires a separately approved bounded migration; do not claim Payment Evidence Integrity UAT PASS until that and actual stored-file inspection pass.
- This record does not endorse or authorize Production Release C/D. Independent QA, rehearsal, Backup/rollback, real Member/business readiness and separate owner Release Authorizations remain required.
