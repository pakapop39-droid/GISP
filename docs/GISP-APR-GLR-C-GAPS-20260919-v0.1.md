# GISP GLR-C Gap Closure — bounded implementation authority v0.1

- `approval_level`: Scope Approved and Implementation Authorized for the bounded Local/isolated-rehearsal continuation below; not Release Authorized.
- `approved_by`: ภคภพ ช.เจริญยิ่ง, owner.
- `approval_text_or_reference`: latest request “ทำขั้นต่อไปคือปิดช่องว่างข้างต้น พร้อมตรวจ Backup/แผนย้อนกลับและ Member จริง แล้วเสนอผลให้คุณอนุมัติ Production C และ D แยกกัน”; prior explicit implementation text in `GISP-APR-RELEASE-CD-IMPLEMENTATION-20260918-v0.1.md` authorizes Source Code/Automated Tests for Payment evidence and rehearsal with simulated data; `GISP-APR-PAY-SEQ-02-REHEARSAL-20260918-v1.0.md` authorizes `REH-PAY-RPC-001` synthetic payment/evidence/authorization tests on a verified isolated child.
- `scope_document_version`: this gap-closure v0.1, `GISP-PAY-SEQ-02-REHEARSAL-STATUS-20260918-v0.1.md`, and `PAY-RPC-GATE-001` package.
- `environment`: Local source and exact isolated child `pay-seq-02-rehearsal-20260918`, project ID `e902393a-ffe7-433d-96d8-a37256948959`, parent Production B `865860c2-49fa-4e53-908f-9396b2f75233`.
- `data_migration_authorized`: No. New clearly marked synthetic `REH-PAY-RPC-001-GAP-*` orders, schedules, transfers, files and their automatic audit/notification may be created only in the child for stale-preview, missing/corrupt evidence, partial and overpayment tests. Do not delete, alter, or reuse prior synthetic records or files; no SQL Apply, schema or function change.
- `production_allowed`: No Production writes, backup creation/restore, migration, deploy, role/permission change, real Member creation or real money.
- `approved_at`: recorded `2026-09-19T06:27:37+07:00` from tool clock; record time, not a claim about message-send time.

## Implementation boundary

1. Correct only the Payment Verify API's presentation of `EVIDENCE_PREVIEW_REQUIRED` from generic HTTP 500 to explicit HTTP 409, with focused automated test; do not alter the financial rule, SQL function, payment amount, price, tax or term.
2. Test the four outstanding negative/amount scenarios on the isolated child with the existing test aliases, exact stored-file checks, permission/actor/audit checks and notification recipient allowlist. Stale preview must use actual elapsed database time, not a forged Audit timestamp. Missing/corrupt tests must use new fixtures and must not delete old objects.
3. Re-freeze source/hash inventory and run relevant tests after source change; QA must independently verify. This is not authority to change Production or accept residual risk.

## Stop conditions

Stop before any child write if the verified project ID, lineage, current fixture state or local-App environment differs. Stop and ask the owner if testing requires a new business rule, changed payment formula, credentials outside the approved aliases, deletion of prior data, or a Production operation. The latest request asks for a readiness proposal, not a Production Release Authorization.
