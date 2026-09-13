# PDF Catalog Excel Round-trip v1.0 — Approval Evidence

- Approval level: Scope + Implementation Authorized
- Approved by: ภคภพ ช.เจริญยิ่ง
- Approval reference: ข้อความล่าสุดของเจ้าของระบบที่อนุมัติ Scope/Implementation ตามแผน `PDF Catalog Excel Round-trip v1.0` ซึ่งเป็น source of truth ของ Slice นี้
- Scope document version: PDF Catalog Excel Round-trip v1.0 (`PXR-REQ-001..014` และ Acceptance Criteria ใน approved handoff)
- Approved at: 2026-09-13T12:08:36+07:00 (message-time capture, Asia/Bangkok)
- Environment: Development — isolated local worktree and InsForge Full Backend Branch only
- Data/migration authority: additive schema, RLS, trusted RPC, Confidential Storage, schema/test data, test Product Draft update and test Cost Version
- Dependency authority: pin `fflate@0.8.3`; continue using existing `read-excel-file`; do not add ExcelJS
- Production allowed: No

## Locked behavior

The authorized flow is `PDF Import → Export real .xlsx → edit multiple rows → upload → staged Preview/Diff → separately apply Product details or Factory Cost`. It works before a Product Draft exists and after a PDF row is linked to a Draft. Blank cells preserve current values; `#CLEAR` is limited to optional Product fields. Cost changes create a version through the existing Pricing Engine and show a price preview, but never activate Member Price.

The workbook contains `Instructions`, `Products`, optional `Costs`, hidden `Lists`, and hidden `__Meta`. IDs and hashes inside the workbook are untrusted and revalidated. Actual formulas, macros, external links, encrypted/malformed archives, unsafe ZIP paths/duplicate parts, decompression limits, files above 10 MiB and more than 1,000 Product rows are rejected.

No new permission code is introduced. The Slice reuses `catalog.import`, `catalog.manage`, `catalog.cost.read` and `catalog.cost.manage`; Purchasing receives no new access. All files stay in `gisp-confidential` for Import History. Feature flag `ENABLE_CATALOG_EXCEL_ROUNDTRIP` defaults to `false`. Rollback is flag-off while additive history remains. Production is outside this approval.
