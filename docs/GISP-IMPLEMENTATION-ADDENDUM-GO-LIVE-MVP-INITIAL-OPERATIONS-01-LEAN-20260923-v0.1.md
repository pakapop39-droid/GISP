# GO-LIVE-MVP-INITIAL-OPERATIONS-01 — Lean Local Implementation Addendum v0.1

## 1. Document Control

| Field | Value |
| --- | --- |
| Addendum ID | `GO-LIVE-MVP-INITIAL-OPERATIONS-01-LEAN-LOCAL-IMPLEMENTATION` |
| Version | `v0.1` |
| Date | 2026-09-23 (Asia/Bangkok) |
| Status | **Proposed — Awaiting Local Implementation Authorization** |
| Approved parent Scope | `GO-LIVE-MVP-INITIAL-OPERATIONS-01 v0.2 — LEAN Scope Amendment` |
| Parent Scope SHA-256 | `E13B4F5260A7234006EFD6A8042FB4441C153C5A4B8EF95639C0FD5600A94B5A` |
| Scope Approval Record | `docs/GISP-APPROVAL-GO-LIVE-MVP-INITIAL-OPERATIONS-01-LEAN-SCOPE-20260923.md` |
| Target worktree | `C:\Users\ASUS\.codex\worktrees\full-flow-go-live-01\GISP` |
| Branch | `codex/full-flow-go-live-01` |
| Code baseline commit | `88b8b6d992cc2e91b3526312dc21cbc96f05b97d` |
| Code baseline tree | `71b80afb5c328a9be521af34129f3c82e8101053` |
| Environment proposed | Local isolated worktree only |
| `data_authority` proposed | Local in-memory/file synthetic fixtures only |
| `migration_authority` proposed | Create exactly one named canonical forward migration and its candidate mirror; copy 11 hash-pinned immutable migrations into the new candidate package; no Apply |
| Backend/network write | No |
| Network read proposed | Package registry advisory lookup only; no download/install/update and no external write |
| Staging authority | No |
| `production_allowed` | `No` |

เอกสารนี้แปลง Lean Scope ที่อนุมัติแล้วเป็นขอบเขตการแก้ Local ที่ตรวจสอบได้ การมีเอกสารนี้ยังไม่อนุญาตให้เริ่มแก้โค้ดหรือสร้าง Migration ต้องได้รับ `Local Implementation Authorization` ที่อ้างเอกสารและ checksum companion ก่อน

## 2. Ownership and Authority Boundary

- ใช้ Builder หนึ่งรายใน worktree นี้ และต้องทราบว่ามีงานของผู้อื่นใน repository
- Existing untracked documents เป็นของ Primary; Builder อ่านได้แต่ห้ามแก้ ลบ ย้าย หรือ commit ทับ
- `.codex-tmp/**` เป็น ignored UAT/Auth-reset artifacts จากงานเดิม ห้ามอ่าน credential, แก้, reseal, ลบ หรือรวมใน Candidate
- Historical migrations และ `release-candidates/full-flow-go-live-01/**` เป็น read-only source เท่านั้น
- ไฟล์นอก Exact File Allow-list เป็น read-only หากจำเป็นต้องแก้ต้องหยุดและขอ Amendment
- ไม่มีสิทธิ์ใช้ InsForge CLI/SDK เพื่อเขียน, Apply Migration, สร้าง Backend branch, ส่ง Email, Invoke processor, Deploy หรือเปลี่ยน Backend/Staging/Production

## 3. Confirmed Current-state Gaps

1. `src/lib/api/rpc-route.ts` enqueue Notification/Email job หลัง RPC สำเร็จ
2. `src/app/api/internal/notifications/process/route.ts` อ่าน queue และส่ง Email ได้เมื่อเรียกตรง แม้ Schedule เป็น 0
3. `functions/notification-retry.ts` เป็นเส้นทาง retry/send อีกทางหนึ่ง
4. `src/app/api/admin/payment-transfers/[id]/verify/route.ts` เรียก enqueue notification โดยตรงหลัง Finance verify
5. Release C route gate ยังเปิด Supplier Payment, Payment Adjustment และ Financial Hold routes
6. Order server/UI และ admin capability projection ยัง query/แสดงสิทธิ์ Supplier Payment, Adjustment และ Hold ที่ถูกเลื่อนออกจาก Lean Scope
7. Custom RFQ upload ยังรับ DWG/DXF และยังไม่ตรวจ declared MIME/magic bytes ก่อน upload
8. Generic file download อาจออก signed URL จาก `file_metadata` โดยไม่ยืนยัน Custom Request binding
9. Dispatch gate เดิมพึ่ง `supplier_balance_paid`; Completion เดิมนับ `DELIVERED_WITH_ISSUE` ว่าส่งสำเร็จ

## 4. Reuse / Modify / New

### Reuse unchanged

- Catalog, Project, Custom RFQ/Quotation และ immutable Order snapshot เดิม
- Customer Deposit/Balance 50/50, VAT, partial/exact/reject/overpayment arithmetic, private evidence และ Finance Verify/Reject เดิม
- PO, Cancellation record, Production, QC, Warehouse, Shipment, Delivery, POD และ Actual Freight เดิม
- Existing row locks/status transitions ใน `create_customer_order(UUID,JSONB)`; ไม่เปลี่ยน signature และไม่สร้าง idempotency table
- Release B Shared Catalog, Sourcing, Showroom, Member flow และ Auth email
- 11 immutable C/D7/D8 migration files ในข้อ 7

### Modify minimally

- Hosted release gate และ deferred financial routes ให้ Fail Closed
- เอา generic actor-side notification enqueue ออกจาก shared RPC route
- ปิด Hosted notification processor และ Edge retry/send function แบบ Fail Closed
- เอา Supplier Payment, Adjustment และ Hold query/UI/projection ออกจาก Lean Order flow
- Custom RFQ file pre-upload validation และ Custom Request binding guard
- Duplicate/race error ให้เป็นข้อความ Reload ที่เข้าใจง่าย โดยยังใช้ lock/status เดิม
- Dispatch gate ไม่พึ่ง Supplier Payment แต่ยังบังคับ Customer Balance, PO, QC และ quantity
- Completion ไม่นับ `DELIVERED_WITH_ISSUE` เป็น Order ที่เสร็จ
- สร้าง Lean candidate/recovery package ใหม่

### New only

- `src/lib/files/content-signature.ts` และ tests
- Forward guard migration หนึ่งไฟล์
- Lean-specific contract/package/emergency tests และ Local static runner
- Lean candidate/recovery package หนึ่ง directory

ห้ามสร้าง table, role, permission, price/formula, queue, worker, schedule, Delivery Issue module, payment gateway หรือ dependency ใหม่

## 5. Exact Source and Test File Allow-list

### 5.1 Release gate and deferred Hosted routes

Modify:

- `src/lib/release-stage.ts`
- `src/lib/release-stage.test.ts`
- `src/proxy.release-gate.test.ts`
- `src/app/api/health/release-attestation/route.ts`
- `src/app/api/health/release-attestation/route.test.ts`
- `src/app/api/admin/supplier-payments/route.ts`
- `src/app/api/admin/supplier-payments/[id]/review/route.ts`
- `src/app/api/admin/supplier-payments/[id]/mark-paid/route.ts`
- `src/app/api/admin/supplier-payments/[id]/mark-paid/route.test.ts`
- `src/app/api/admin/payment-transfers/[id]/adjustments/route.ts`
- `src/app/api/admin/payment-transfers/[id]/adjustments/route.test.ts`
- `src/app/api/admin/payment-adjustments/[id]/review/route.ts`
- `src/app/api/admin/payment-adjustments/[id]/review/route.test.ts`
- `src/app/api/admin/payment-workflow-holds/[id]/confirm/route.ts`
- `src/app/api/admin/payment-workflow-holds/[id]/confirm/route.test.ts`

การแก้ route ในส่วนนี้อนุญาตเฉพาะ early fail-closed response; ห้ามแก้หรือเปิด business logic เดิม

Release attestation ต้องรับ valid combinations เฉพาะ `RELEASE_STAGE=C` + slices `[]`, `RELEASE_STAGE=D` + slices `[7]` ระหว่าง staged rollout และ `RELEASE_STAGE=D` + slices `[7,8]` สำหรับ Production target สุดท้าย ค่าอื่นทั้งหมดต้อง Fail Closed รวม 9/10, duplicate, gap, ลำดับผิด และค่าผิดรูปแบบ ห้ามใช้เพียงเงื่อนไขว่ามี slice อย่างน้อยหนึ่งรายการ

### 5.2 Notification closure

Modify:

- `src/lib/api/rpc-route.ts`
- `src/app/api/admin/payment-transfers/[id]/verify/route.ts`
- `src/app/api/admin/payment-transfers/[id]/verify/route.test.ts`
- `src/app/api/internal/notifications/process/route.ts`
- `functions/notification-retry.ts`

New:

- `src/lib/api/rpc-route.test.ts`
- `src/app/api/internal/notifications/process/route.test.ts`
- `src/lib/lean-initial-operations-notification-contract.test.ts`

ผลที่ต้องได้คือไม่มีการอ่าน queue, update job, process, retry หรือส่ง business email แม้ endpoint/function ถูกเรียกตรง Auth verification/password-reset email ไม่อยู่ในขอบเขตการแก้

### 5.3 Order projection, Manual Supplier control and duplicate handling

Modify:

- `src/lib/orders/server.ts`
- `src/lib/orders/types.ts`
- `src/lib/orders/admin-access.ts`
- `src/lib/orders/admin-access.test.ts`
- `src/lib/orders/release-projection.ts`
- `src/lib/orders/release-projection.test.ts`
- `src/components/admin-order-detail.tsx`
- `src/components/production-qc-panels.tsx`
- `src/components/production-qc-panels.test.ts`
- `src/components/member-project-detail.tsx`
- `src/app/api/member/orders/route.ts`
- `src/app/api/member/orders/route.test.ts`
- `src/lib/api/response.ts`

New:

- `src/lib/api/response.test.ts`
- `src/lib/lean-initial-operations-order-contract.test.ts`

Order UI อาจแสดง Supplier Order/PO เพื่อทำงานต่อ แต่ห้าม query/แสดง Supplier Payment schedules/payments, Adjustment, Reversal หรือ Hold และต้องแสดงชัดว่า `PURCHASING` ตรวจการจ่าย Supplier นอกระบบ

### 5.4 Custom RFQ file safety

Modify:

- `src/app/api/member/custom-requests/[id]/files/route.ts`
- `src/app/api/files/[id]/download/route.ts`
- `src/components/member-custom-request-detail.tsx`

New:

- `src/lib/files/content-signature.ts`
- `src/lib/files/content-signature.test.ts`
- `src/app/api/member/custom-requests/[id]/files/route.test.ts`
- `src/app/api/files/[id]/download/route.test.ts`
- `src/components/member-custom-request-detail.test.ts`

ไฟล์เฉพาะ PDF/JPEG/PNG, ไม่เกิน 25 MB, ไม่เกิน 10 ไฟล์ต่อ Request ต้องตรวจ extension + declared MIME + magic bytes ก่อน upload และ generic `/api/files/[id]/download` ต้องปฏิเสธ `entity_type=CUSTOM_REQUEST` ทุกกรณี โดยออก signed URL สำหรับ Custom Request ได้เฉพาะ dedicated member/admin route ที่ตรวจ valid link, ownership และ Organization binding แล้วเท่านั้น

### 5.5 Migration, candidate and recovery contracts

New:

- `migrations/20260923090000_startup_initial_operations_guard.sql`
- `src/lib/lean-initial-operations-migration-contract.test.ts`
- `src/lib/lean-initial-operations-acl-contract.test.ts`
- `src/lib/lean-initial-operations-candidate-package.test.ts`
- `src/lib/lean-initial-operations-emergency-package.test.ts`
- `src/lib/lean-initial-operations-dependency-security.test.ts`
- `scripts/lean-initial-operations-local-test.mjs`

Builder อาจเพิ่ม `*.test.ts` หรือ `*.test.tsx` ได้เฉพาะข้างไฟล์ในข้อ 5 เมื่อจำเป็นต่อ Acceptance Criterion โดยห้ามเพิ่ม production source อื่น หาก production source เพิ่มนอก allow-list ต้องหยุดขอ Amendment

## 6. Exact Lean Database Contract

Migration ใหม่ต้องเป็น forward-only, existence-safe และไม่มี top-level/apply-time business-row DML โดยทำเฉพาะ:

1. ทำ Supplier Payment outer RPCs ต่อไปนี้เป็น fail-closed stubs และ revoke exact signatures จาก `PUBLIC`, `anon`, `authenticated`, `project_admin` โดยไม่ให้ runtime grant ใหม่:
   - `create_supplier_payment(UUID,TEXT,NUMERIC,TEXT)`
   - `review_supplier_payment(UUID,BOOLEAN,TEXT)`
   - `mark_supplier_payment_paid(UUID,UUID)`
2. Revoke `PUBLIC`, `anon`, `authenticated`, `project_admin` แบบ existence-safe จาก Supplier Payment implementation functions ที่มีอยู่จริง โดย exact signature และห้ามมี direct runtime grant:
   - `create_supplier_payment_rlc_impl(UUID,TEXT,NUMERIC,TEXT)`
   - `review_supplier_payment_rlc_impl(UUID,BOOLEAN,TEXT)`
   - `mark_supplier_payment_paid_rlc_impl(UUID,UUID)`
   Revoke `project_admin` ได้เฉพาะ Supplier Payment functions ที่ระบุชื่อและ signature ตรงในข้อ 1–2 และ generic notification function ในข้อ 6 เท่านั้น ห้ามแตะ grant ของ `verify_payment_transfer_private` หรือ Customer Payment/Finance RPC อื่น และ tests ต้องยืนยัน private verifier grants เดิมยังอยู่
3. Revoke runtime execute จาก Claims RPCs ที่มีอยู่จริง โดย exact signature:
   - `open_claim(UUID,TEXT,TEXT,UUID)`
   - `resolve_claim(UUID,TEXT,TEXT)`
   - `create_claim(UUID,TEXT,TEXT,TEXT,NUMERIC,TEXT,TIMESTAMPTZ,TEXT,TEXT,UUID)`
   - `member_claim_action(UUID,TEXT,TEXT,UUID)`
   - `admin_claim_action(UUID,TEXT,TEXT,TEXT,TEXT,UUID,UUID,TIMESTAMPTZ)`
   - `record_claim_internal_cost(UUID,TEXT,NUMERIC,TEXT,TEXT)`
   - `append_claim_event(UUID,UUID,TEXT,TEXT,BOOLEAN)`
4. Revoke runtime execute จาก Advanced Reports RPCs:
   - `get_executive_dashboard(DATE,DATE)`
   - `get_fixed_report(TEXT,DATE,DATE,TEXT,INTEGER,INTEGER)`
   - `record_fixed_report_export(TEXT,JSONB,INTEGER)`
5. ห้าม revoke basic dashboards: `get_member_dashboard()`, `get_admin_operations_dashboard()`, `get_basic_dashboard_summary()`
6. Revoke generic enqueue RPC `queue_current_user_notification(TEXT,TEXT,TEXT,TEXT,TEXT)` จาก `PUBLIC`, `anon`, `authenticated`, `project_admin` โดย exact signature
7. ป้องกัน C/D7/D8 automatic in-app business notifications ที่ Scope เลื่อนออก โดยจำกัดเฉพาะ event types ของ Lean transaction flow; ห้ามกระทบ Auth email หรือ Release B domain data/ACL
8. Redefine `get_dispatch_gate(UUID)`/`can_dispatch_order_item(UUID)` ให้ aggregate Supplier Orders ทั้งหมดที่ผูกกับ Order; ทุก Supplier Order ต้องมี `po_issued_at` และ `po_number` ที่ไม่ว่าง, Customer Balance ต้อง `VERIFIED`, QC/Member approval ต้องผ่าน และ `quantity_ready` หมายถึงจำนวนบวกที่ถูก release/allocate ใน consolidation สถานะ `CONFIRMED` หรือ `SHIPMENT_CREATED` ไม่ใช่จำนวนเต็มทั้ง Order เพื่อคง partial shipment โดยใช้ D8 constraints เดิมป้องกัน over-allocation
9. Redefine `maybe_complete_order(UUID)` ให้ `DELIVERED` และ `DELIVERED_WITH_ISSUE` นับต่อ delivery progress ได้ แต่ถ้ามี delivery ใด `has_issue`/`DELIVERED_WITH_ISSUE` ต้อง block `COMPLETED` จนกว่าจะมี Scope แก้ Issue ในอนาคต
10. Preserve owner, `SECURITY DEFINER`, safe `search_path`, exact grants ของ C/D7/D8 functions ที่ยังอยู่ใน Scope รวมทั้ง DML ภายใน preserved function body เฉพาะที่จำเป็นต่อ runtime contract; ห้ามมี DML ที่ทำงานขณะ Apply migration
11. ไม่แก้ price, VAT, Deposit/Balance 50/50, Freight formula, Customer Payment arithmetic หรือ immutable evidence behavior

ห้ามใช้ wildcard revoke, `DROP ... CASCADE`, table/schema creation, top-level/apply-time business-row `UPDATE/DELETE/INSERT`, raw apply หรือ `up --all`

## 7. Migration Allow-list and Hashes

### 7.1 Reused immutable files — copy unchanged into new Lean package

Source: `release-candidates/full-flow-go-live-01/migrations/` แบบ read-only

| Order | File | SHA-256 |
| --- | --- | --- |
| 1 | `20260920010000_pay-close-legacy-entry.sql` | `638E76E102E05E9F03CCB93357B74DC496DB50E398DE030C0A057F3021D73993` |
| 2 | `20260920010100_pay-evidence-binding.sql` | `01D0786DE19094572467E2DCAEB347E3FD6D672D91146B596643A54D185DEA1B` |
| 3 | `20260920010200_pay-private-executor.sql` | `448A6A37BCB13372BEAA9CEE59EF01E5B9D4F4436DE2C6F7208030233E511CF7` |
| 4 | `20260920010250_release-c-org-scope-hardening.sql` | `A0757E88DC351F361E89AD0048158E8F89D064D5A9B1FC0BA953E2A587DB7D8E` |
| 5 | `20260920010300_release-c-privileges.sql` | `4120E34C2CD7B590DFD4FF671FD9AF57DBD5601B45441B8920751AC9220F0593` |
| 6 | `20260920010400_d7-qc-reopen-prerequisite.sql` | `7D250449DF315AA100F929AC5499333DA3719D5AEFADC616A88981B1EBD463C1` |
| 7 | `20260920010500_release-d7-privileges.sql` | `403D71930043C356BB0A61CD6ABF704EF247C5FD4CE1F70F7A8262C95D17D309` |
| 8 | `20260920010600_d8-consolidation-prerequisite.sql` | `E6E97E5949598C443278ABC878E7853802367A84ACA50AA7E339B86F0635D135` |
| 9 | `20260920010700_d8-customs-prerequisite.sql` | `7A5075F3455B146F3A74983AB37A4D14C3691D618AAC0A02D30D572629F42D69` |
| 10 | `20260920010800_release-d8-privileges.sql` | `832C2E55B87355BA498758C33E3C410200AADFFC103D892A11F2FF66D02841B7` |
| 11 | `20260920010900_d8-freight-payment-enable.sql` | `DC2A9008FB506AF84EF1591A1420F632045778FA6907A8EACDC899C3D2FBE00A` |

### 7.2 New file — create only after Implementation Authorization

| Order | File | Pre-implementation hash |
| --- | --- | --- |
| 12 | `20260923090000_startup_initial_operations_guard.sql` | `TBD — file does not yet exist; candidate hash must be sealed after implementation and independently verified` |

Dependency order is exactly 1–12 ห้าม Apply ซ้ำบางส่วน, เปลี่ยนชื่อ, แทรก migration อื่น หรือใช้ `up --all` ภายใต้ Authorization นี้ การ Apply ต้องรอ Staging/Production Authorization แยก

Production-B baseline ไม่ต้อง copy เข้า Lean directory แต่ `CANDIDATE-MANIFEST.md` และ `STAGING-RUNBOOK.md` ต้อง pin แหล่ง `release-candidates/full-flow-go-live-01/production-b-baseline/MANIFEST.md` SHA-256 `71AFD16B32D952D3632ACF310663A9287F590A48E5E5870DFE6CF09F071790D0` และกำหนด preflight ให้ยืนยัน baseline 26 files ก่อน delta 12 files เสมอ ห้ามใช้ migration tree รวมแทน allow-list นี้

ไม่ใช้ D9/D10, sourcing hardening, pre/post-D financial controls หรือ corrective private executor #17

## 8. Candidate and Recovery Artifact Allow-list

Create new directory only: `release-candidates/go-live-mvp-initial-operations-01-lean/`

Allowed files:

- `README.md`
- `CANDIDATE-MANIFEST.md`
- `MIGRATION-ALLOWLIST.md`
- `DEPENDENCY-SECURITY-EVIDENCE.md`
- `INCIDENT-RUNBOOK.md`
- `STAGING-RUNBOOK.md`
- `migrations/` containing exactly the 11 hash-pinned reused files plus the mirror of migration #12
- `emergency/README.md`
- `emergency/function-snapshot.sql`
- `emergency/stop-c.sql`
- `emergency/stop-d7.sql`
- `emergency/stop-d8.sql`
- `emergency/resume-c.sql`
- `emergency/resume-d7.sql`
- `emergency/resume-d8.sql`
- `emergency/reconcile.sql`
- `emergency/run-reconcile.mjs`

Stop/Resume ต้อง idempotent และ hash-pinned; Resume ห้ามเปิด Supplier Payment, Claims, Advanced Reports หรือ generic notification อีกครั้ง Reconcile ต้อง SELECT-only และห้ามพึ่ง custom GUC หลัง guard migration ถูก Apply แล้ว ห้าม rollback เฉพาะ App กลับไป binary เก่าที่ query Adjustment/Hold/Supplier Payment หรือ enqueue notification เพราะ App/DB contract จะไม่ตรงกัน Recovery ที่อนุญาตให้เตรียมคือ Emergency Stop D8→D7→C, SELECT-only reconcile และ forward-fix/resume C→D7→D8 เท่านั้น Rollback ห้ามลบ business/audit data และ Restore backup ต้องมี Authorization แยก

## 9. Requirement and Test Traceability

| Scope requirements | Minimum Local evidence |
| --- | --- |
| `LEAN-REQ-001,016` | Existing auth/org/private-file tests + new ACL/binding negative tests |
| `LEAN-REQ-002..004` | Existing Catalog/Project/Order snapshot regression; no source change unless gate reveals blocker |
| `LEAN-REQ-005` | PDF/JPEG/PNG success; extension/MIME/magic mismatch, DWG/DXF, empty, >25 MB, 11th, locked request, cross-org and orphan binding rejected |
| `LEAN-REQ-006` | Existing SQL row-lock/status contract + route/UI busy/conflict/reload tests; Local does not claim hosted concurrency |
| `LEAN-REQ-007,008` | Payment evidence/private verifier, partial/exact/reject/overpayment arithmetic and PO gate regression |
| `LEAN-REQ-009,010` | Existing D7/D8 production/QC/warehouse/shipment/delivery/POD regression |
| `LEAN-REQ-011` | Migration contract + panel test prove supplier-paid removed while Balance/PO/QC/quantity remain |
| `LEAN-REQ-012` | Migration contract proves issue delivery counts toward progress but any issue blocks Order completion |
| `LEAN-REQ-013` | Shared RPC, Finance verify route, processor, edge retry and DB enqueue/in-app notification closure tests; Auth email untouched |
| `LEAN-REQ-014` | Hosted Supplier/Adjustment/Hold fail closed; D9/D10 route gate closed; Supplier/Claims/Reports direct RPC ACL closed |
| `LEAN-REQ-015` | Release B UI/API/domain data/ACL snapshot no-regression except approved generic notification side effect |
| `LEAN-REQ-017` | Existing Freight regression and formula snapshot |
| `LEAN-REQ-018` | Candidate hashes/order, Stop/Resume and SELECT-only Reconcile contracts |

### Approved Local Acceptance Criteria — exact evidence map

| Approved acceptance criterion | Named Local evidence / command |
| --- | --- |
| `LEAN-AC-L01` | `npm run typecheck`; `npm run lint`; `npm test`; `npm run build` |
| `LEAN-AC-L02` | `npm test -- src/lib/catalog/member-server.test.ts src/lib/projects/catalog-selection.test.ts src/app/api/admin/catalog/finishes/route.test.ts src/lib/lean-initial-operations-order-contract.test.ts`; ต้องยืนยัน Catalog เฉพาะ Published+Active, แยก `catalog.manage`/`catalog.publish`, และ Order snapshot ไม่เปลี่ยนตาม Catalog ภายหลัง |
| `LEAN-AC-L03` | `npm test -- src/lib/files/content-signature.test.ts src/app/api/member/custom-requests/[id]/files/route.test.ts src/app/api/files/[id]/download/route.test.ts src/components/member-custom-request-detail.test.ts` |
| `LEAN-AC-L04` | `npm test -- src/app/api/member/orders/route.test.ts src/lib/api/response.test.ts src/lib/lean-initial-operations-order-contract.test.ts`; ต้องยืนยัน duplicate/conflict เป็น `409` พร้อมข้อความ Reload และไม่แก้ row-lock RPC เดิม |
| `LEAN-AC-L05` | `npm test -- src/app/api/payment-evidence/route.test.ts src/app/api/member/payment-transfers/route.test.ts src/app/api/admin/payment-transfers/[id]/verify/route.test.ts src/lib/payments/bound-evidence.test.ts src/lib/payments/finance-access.test.ts src/lib/payments/pay-rpc-gate-migration.test.ts` |
| `LEAN-AC-L06` | `npm test -- src/lib/orders/production-progress.test.ts src/lib/orders/qc-result.test.ts src/lib/orders/qc-review-request.test.ts src/components/production-qc-panels.test.ts src/lib/lean-initial-operations-order-contract.test.ts` |
| `LEAN-AC-L07` | `npm test -- src/lib/lean-initial-operations-migration-contract.test.ts src/lib/lean-initial-operations-order-contract.test.ts`; ต้องยืนยัน Balance/PO/QC/positive released quantity และ partial shipment |
| `LEAN-AC-L08` | `npm test -- src/lib/lean-initial-operations-migration-contract.test.ts src/lib/lean-initial-operations-order-contract.test.ts`; issue delivery นับ progress แต่ block `COMPLETED` |
| `LEAN-AC-L09` | `npm test -- src/lib/api/rpc-route.test.ts src/app/api/admin/payment-transfers/[id]/verify/route.test.ts src/app/api/internal/notifications/process/route.test.ts src/lib/lean-initial-operations-notification-contract.test.ts` และ static assertion ต่อ `functions/notification-retry.ts`; ต้องไม่มี queue read/write/process/retry/send |
| `LEAN-AC-L10` | `npm test -- src/lib/release-stage.test.ts src/proxy.release-gate.test.ts src/app/api/health/release-attestation/route.test.ts src/lib/lean-initial-operations-acl-contract.test.ts` รวม deferred route tests ในข้อ 5.1 |
| `LEAN-AC-L11` | `npm test -- src/lib/shared-catalog/public-safe.test.ts src/lib/shared-catalog/schema.test.ts src/lib/auth/organization-scope.test.ts src/lib/lean-initial-operations-order-contract.test.ts`; Release B UI/API/domain/ACL ต้องไม่เปลี่ยนนอก approved notification side effect |
| `LEAN-AC-L12` | `npm test -- src/lib/auth/organization-scope.test.ts src/app/api/admin/users/[id]/roles/route.test.ts src/lib/payments/finance-access.test.ts src/lib/payments/bound-evidence.test.ts src/lib/lean-initial-operations-acl-contract.test.ts`; negative tests ต้อง assert ทั้ง denial และ audit evidence โดยไม่พิมพ์ข้อมูลลับ |
| `LEAN-AC-L13` | `npm test -- src/lib/lean-initial-operations-migration-contract.test.ts src/lib/lean-initial-operations-candidate-package.test.ts src/lib/lean-initial-operations-emergency-package.test.ts` และ `node scripts/lean-initial-operations-local-test.mjs` |
| `LEAN-AC-L14` | `npm test -- src/lib/lean-initial-operations-dependency-security.test.ts` และ `npm audit --package-lock-only --audit-level=high --ignore-scripts`; อนุญาตเฉพาะ read-only advisory lookup และห้าม install/download/update/write |

Focused checks during build:

1. Deferred Hosted routes and direct RPCs fail closed
2. Notification four-path closure passes without network/send
3. Supplier/Adjustment/Hold data absent from Lean Order query/projection/UI
4. Custom file signature, limit, binding and cleanup behavior passes
5. Duplicate/race response is readable and asks Reload; existing row lock/status unchanged
6. Dispatch/Completion/Freight contracts pass
7. Release B no-regression snapshot passes
8. Candidate/emergency parity and hashes pass

Final candidate gates on one exact commit/tree:

- `npm run typecheck`
- `npm run lint`
- full `npm test`
- `npm run build`
- dependency audit with no unaccepted High/Critical โดยใช้ read-only package-registry advisory lookup ตาม authority ในข้อ 13
- `git diff --check`
- secret scan limited to changed/candidate files without printing secret values
- Candidate migration #12 mirror bytes/hash equal canonical migration; 11 reused migration hashes equal the exact list in section 7; SHA-256 ที่บันทึกใน manifest ต้องตรงกับ actual bytes ของ emergency file ทุกไฟล์ใน package
- Independent `vs_qa_guardian` review; Builder cannot approve itself

## 10. Local Evidence Boundary

Local tests may use only in-memory/file synthetic fixtures and static SQL/package analysis Local evidence must not claim:

- real hosted database concurrency or RLS/ACL execution
- actual Migration apply/history
- SMTP/Schedule behavior
- Staging UAT, Backup/Restore or Production readiness
- actual email delivery, external payment or Supplier payment verification

20 members × 2 simultaneous Order requests, hosted negative ACL tests, Backup/Restore and full-flow UAT require Temporary Staging Authorization แยก

## 11. Explicit No-touch / Out of Authority

- `.codex-tmp/**`
- Scope/checksum/Approval Records และ Addendum หลัง seal
- `.env*`, `.insforge/**`, credentials, secrets, config, schedules
- historical migrations ทุกไฟล์
- `release-candidates/full-flow-go-live-01/**` นอกจากอ่านและ copy 11 migration bytes ตาม hash
- `package.json`, lockfile และ dependencies
- Release B pages/routes/components/domain migrations
- `src/lib/claims/**`, `src/lib/reports/**`, `src/lib/sourcing/**`, `src/lib/shared-catalog/**`
- PDF Catalog import, image search, pricing/VAT/discount/50:50 formula, role/auth model
- outbox/queue/worker/new schedule, durable cleanup, Delivery Issue Resolution, Supplier Payment workflow, Claims, Advanced Reports, idempotency table, Adjustment/Reversal/Hold package
- Backend, Backend branch, Staging, Production, Apply Migration, Deploy/redeploy, Config/Secret/Schedule change, Notification send/retry, Restore, Cleanup/Delete หรือ external write
- current repository `C:\codex\GISP` และงานของ task อื่น

## 12. Stop Conditions

Builder ต้องหยุดก่อนแก้ต่อเมื่อ:

- ต้องแก้ production source นอก allow-list
- reused migration hash ไม่ตรงหรือจำเป็นต้องแก้ historical file
- exact RPC signature/owner/ACL หรือ migration dependency ไม่ตรงกับข้อ 6–7
- ต้องเปลี่ยน price/tax/50:50, role/auth, Release B behavior นอก notification exception หรือ business rule
- ต้องเพิ่ม dependency, table, queue, worker, schedule หรือ integration
- test ต้องใช้ Backend write, credential, actual email หรือ external mutation
- baseline/worktree ownership เปลี่ยนหรือมี writer อื่นชนไฟล์
- Local gate พบ Blocker/Major ที่ต้องขยาย Scope

## 13. Proposed Local Implementation Authorization

> ผม ภคภพ ช.เจริญยิ่ง อนุมัติ Local Implementation ตามเอกสาร `GO-LIVE-MVP-INITIAL-OPERATIONS-01 — Lean Local Implementation Addendum v0.1` และ checksum companion ที่แนบ โดยอ้างอิง Lean Scope v0.2 ที่อนุมัติแล้ว SHA-256 `E13B4F5260A7234006EFD6A8042FB4441C153C5A4B8EF95639C0FD5600A94B5A` อนุญาตให้ Builder หนึ่งรายแก้เฉพาะ Exact Source and Test File Allow-list ใน Local isolated worktree `C:\Users\ASUS\.codex\worktrees\full-flow-go-live-01\GISP` branch `codex/full-flow-go-live-01` baseline commit `88b8b6d992cc2e91b3526312dc21cbc96f05b97d` tree `71b80afb5c328a9be521af34129f3c82e8101053` อนุญาตให้สร้างเฉพาะ migration `20260923090000_startup_initial_operations_guard.sql` และ mirror หนึ่งชุด, copy 11 immutable migration ตาม exact hashes เข้า Candidate ใหม่โดยไม่แก้ source, สร้าง Candidate/recovery artifacts ตาม allow-list และใช้ Local in-memory/file synthetic fixtures เพื่อรัน Local tests/build/audit เท่านั้น อนุญาต network read-only เฉพาะ package registry advisory lookup เพื่อ `npm audit --package-lock-only --audit-level=high --ignore-scripts` โดยห้าม download/install/update package และห้าม external write ห้ามแตะ `.codex-tmp`, historical migrations, old candidate package, `.env`, Backend/Backend branch/Staging/Production ห้าม Apply Migration, Deploy, Config/Secret/Schedule change, Notification send/retry, Restore, Cleanup/Delete หรือ external write ให้ใช้เวลาของข้อความนี้เป็นเวลาอนุมัติ กำหนด `data_authority: Local in-memory/file synthetic fixtures only`, `migration_authority: Create exactly the one named canonical guard and its candidate mirror; copy 11 hash-pinned immutable migrations into the new candidate package; no apply`, `network_backend_authority: No`, `network_read_authority: Package registry advisory lookup only`, `staging_allowed: No` และ `production_allowed: No`

## 14. Remaining Steps

หลัง Local Implementation Authorization เหลือ **5 ขั้นตอน** เพื่อปิด Lean Go-live Slice:

1. Local implementation และ candidate gates
2. Independent QA
3. Temporary Staging Authorization และ UAT/recovery
4. Production Release Authorization และ rollout
5. เปิดสมาชิกประมาณ 20 คนและ monitoring 24 ชั่วโมง
