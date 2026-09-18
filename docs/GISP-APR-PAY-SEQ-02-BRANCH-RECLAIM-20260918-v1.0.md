# PAY-SEQ-02 — Branch reclaim authorization record v1.0

- `approval_level`: Scope Approved + Implementation Authorized for conditional branch archival/deletion and replacement rehearsal branch only; not Production Release Authorized.
- `approved_by`: ภคภพ ช.เจริญยิ่ง, owner, in this conversation.
- `approval_text_or_reference`: “ข้าพเจ้า ภคภพ ช.เจริญยิ่ง อนุมัติให้ Codex เก็บสำเนาข้อมูลและไฟล์ออกนอก Branch `release-b-rehearsal-20260908` (ID `f0f9a36b-ec7d-4ceb-ae28-b2d5feef85f9`) ในที่เก็บจำกัดสิทธิ์ ตรวจความครบถ้วนและ Hash ก่อน แล้วลบเฉพาะ Branch นี้เพื่อคืนช่องสร้างพื้นที่ซ้อมใหม่จาก Production B สำหรับ PAY-SEQ-02 ข้าพเจ้ารับทราบว่าการลบ Branch ย้อนคืนไม่ได้ และสำเนาที่เก็บไม่ใช่การกู้ระบบอัตโนมัติ หากเก็บสำเนาไม่ครบหรือข้อมูลเปลี่ยน ให้หยุดก่อนลบ ห้ามแตะ Production และ Branch อื่น”
- `scope_document_version`: `docs/GISP-PLAN-PAY-SEQ-02-BRANCH-RECLAIM-20260918-v0.1.md`, plus previously approved `docs/GISP-APR-PAY-SEQ-02-REHEARSAL-20260918-v1.0.md` and provisional `release-candidates/pay-rpc-gate-001/README.md`.
- `environment`: only child branch `release-b-rehearsal-20260908` of Production parent `865860c2-49fa-4e53-908f-9396b2f75233`, a secure off-branch local archive, and a newly created schema-only child of that same parent. Shared repository remains linked to Development; use a separate temporary CLI context for branch operations.
- `data_migration_authorized`: No transfer of old branch data to Production or new branch. Off-branch archival of existing branch data/file bytes is authorized; irreversible deletion of the exact old branch is authorized **only after** complete archive/hash/inventory verification and no changed data. New branch may contain only the previously approved synthetic `REH-PAY-RPC-001` test batch and the exact reviewed 12 SQL files after PAY-SEQ-02 pre-apply checks.
- `production_allowed`: No. Do not write to Production parent, other child branches, Development transactions, or real money; no Production Release C/D or deployment.
- `approved_at`: recorded on receipt at `2026-09-18T22:42:55+07:00` (Asia/Bangkok); this is record time, not asserted send time.

## Mandatory stop conditions

Stop **before deleting** if exact name/ID/parent differs; branch activity or row/object inventory differs from the archive window; any database dump, Storage object, migration/config manifest or SHA-256 check is incomplete; archive permissions are not restricted; or any restore/readability check fails. Do not treat a provider-hosted backup alone as durable after branch deletion. This authorization does not waive loss of the old branch runtime or make the archive a one-click restore.
