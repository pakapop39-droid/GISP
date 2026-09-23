# GO-LIVE-MVP-INITIAL-OPERATIONS-01 — Local Implementation Addendum v0.1

## 1. Document Control

| Field | Value |
| --- | --- |
| Addendum ID | `GO-LIVE-MVP-INITIAL-OPERATIONS-01-LOCAL-IMPLEMENTATION` |
| Version | `v0.1` |
| Date | 2026-09-23 (Asia/Bangkok) |
| Status | **Proposed — Awaiting Local Implementation Authorization** |
| Parent Scope | `GO-LIVE-MVP-INITIAL-OPERATIONS-01 v0.1` |
| Parent Scope SHA-256 | `D4007297B2CF34B538A022526D4A272910248D726C3A44F0C7D7B1045B3C96CF` |
| Scope Approval | `docs/GISP-APPROVAL-GO-LIVE-MVP-INITIAL-OPERATIONS-01-SCOPE-20260923.md` |
| Scope Clarification | Option 2, `docs/GISP-APPROVAL-GO-LIVE-MVP-INITIAL-OPERATIONS-01-SCOPE-CLARIFICATION-20260923.md` |
| Target worktree | `C:\Users\ASUS\.codex\worktrees\full-flow-go-live-01\GISP` |
| Branch | `codex/full-flow-go-live-01` |
| Code baseline commit | `88b8b6d992cc2e91b3526312dc21cbc96f05b97d` |
| Code baseline tree | `71b80afb5c328a9be521af34129f3c82e8101053` |
| Environment | Local isolated worktree only |
| `data_authority` proposed | Local in-memory/file synthetic fixtures only |
| `migration_authority` proposed | Create the 14 listed forward Migration files only; no Apply |
| Backend/network write | No |
| Staging authority | No |
| `production_allowed` | `No` |

เอกสารนี้เสนอขอบเขตการแก้ Local อย่างละเอียด การมีเอกสารนี้ยังไม่ใช่สิทธิ์เริ่มแก้โค้ด ต้องได้รับข้อความ Local Implementation Authorization ที่อ้างเอกสารและ checksum companion ก่อน

## 2. Authority and Ownership

- Writer: `vs_app_builder` เพียงหนึ่งรายใน worktree นี้
- Builder ต้องทราบว่ามีงานของผู้อื่นใน repository และห้าม revert/overwrite งานที่ไม่อยู่ใน allow-list
- เอกสาร Scope, checksum, Scope Approval, Scope Clarification และ Addendum เป็นเจ้าของโดย Primary/Project Lead; Builder อ่านได้แต่ห้ามแก้
- `.codex-tmp/**` เป็น ignored artifacts จาก UAT/Auth-reset เดิม ห้ามอ่าน secret, แก้, reseal, ลบ หรือรวมใน Candidate
- ไฟล์นอก Exact File Allow-list เป็น read-only หากจำเป็นต้องแก้ต้องหยุดและขอ Amendment
- ไม่มีสิทธิ์ใช้ InsForge CLI/SDK เพื่อเขียน, สร้าง Backend branch, ส่ง Email, Invoke processor, Apply Migration หรือ Deploy

## 3. Approved Scope Interpretation

ตาม Owner confirmation `confirm 2`:

1. Exact value คือ `MVP_SCOPE=INITIAL_OPERATIONS`
2. `MVP_SCOPE` ควบคุม Hosted UI/API, outbox enqueue และ Notification process/send
3. missing/invalid value ต้องปิด Hosted domain writes, enqueue, process และ send; อนุญาต health และ read-only reconciliation
4. Direct RPC ปิดผ่าน ACL เฉพาะ Supplier Payment, Claims และ Advanced Reports
5. C/D7/D8 RPC ที่อยู่ใน Scope และ Release B RPC คง ACL เดิม เว้นแต่ signature ใหม่ที่ระบุในเอกสารนี้
6. Environment variable ไม่ถูกใช้เป็น Database ACL และห้ามสร้าง Database config/secret เพื่อส่งค่า Scope เข้า PostgreSQL

**Pending Owner Clarification ก่อน seal:** สำหรับ in-scope Direct RPC ที่ role/organization อนุญาต ให้ domain transition และ atomic outbox enqueue ทำงานได้แม้ `MVP_SCOPE` ของ Hosted app หาย/ผิด แต่ Notification processor/send ยังคงปิดอยู่ การเรียกผ่าน Hosted UI/API ยังคงถูกปิดก่อนถึง RPC ข้อนี้เป็น interpretation ที่แนะนำเพื่อรักษาทั้ง Option 2 และ atomic outbox โดยไม่เปลี่ยน in-scope RPC เป็น private executor

## 4. Reuse / Modify / New

### Reuse

- Catalog, Project, Custom RFQ/Quotation และ Order snapshot เดิม
- Customer transfer/evidence/private verification, Adjustment/Reversal/Hold และ Cancellation เดิม
- D7 Production/QC และ D8 Warehouse/Shipment/Delivery/Freight
- Audit/status events, private Storage และ signed URL
- Release B Shared Catalog, Sourcing และ Showroom โดยไม่แก้พฤติกรรม/ACL

### Modify

- MVP/Release route gate และ release attestation
- Order durable idempotency
- Supplier Payment UI/API/projection closure
- Dispatch และ Completion gates
- Custom RFQ file validation/quarantine/cleanup
- Notification outbox/processor และ event ownership
- Order/logistics projections สำหรับ Delivery Issue Resolution

### New

- `MVP_SCOPE` helper
- Atomic event-specific outbox
- Durable private storage-cleanup queue
- Minimal Delivery Issue Resolution และ Member Order Owner confirmation
- 14 scoped forward migrations
- Dedicated Candidate manifest, allow-list, staging/recovery/emergency package

## 5. Exact Source and Test File Allow-list

### 5.1 Gate and Attestation

Modify:

- `src/lib/release-stage.ts`
- `src/lib/release-stage.test.ts`
- `src/proxy.ts`
- `src/proxy.test.ts`
- `src/proxy.release-gate.test.ts`
- `src/app/api/health/release-attestation/route.ts`
- `src/app/api/health/release-attestation/route.test.ts`
- `src/components/production-shell.tsx`

New:

- `src/lib/mvp-scope.ts`
- `src/lib/mvp-scope.test.ts`

### 5.2 Orders, Customer Finance and Supplier Closure

Modify:

- `src/app/api/member/orders/route.ts`
- `src/app/api/member/orders/route.test.ts`
- `src/app/api/member/orders/[id]/cancel/route.ts`
- `src/app/api/admin/orders/[id]/issue-po/route.ts`
- `src/app/api/admin/cancellations/[id]/decision/route.ts`
- `src/app/api/member/payment-transfers/route.ts`
- `src/app/api/member/payment-transfers/route.test.ts`
- `src/app/api/payment-evidence/route.ts`
- `src/app/api/payment-evidence/route.test.ts`
- `src/app/api/admin/payment-transfers/[id]/verify/route.ts`
- `src/app/api/admin/payment-transfers/[id]/verify/route.test.ts`
- `src/app/api/admin/payment-transfers/[id]/evidence/route.ts`
- `src/app/api/admin/payment-transfers/[id]/evidence/route.test.ts`
- `src/app/api/admin/payment-transfers/[id]/adjustments/route.ts`
- `src/app/api/admin/payment-transfers/[id]/adjustments/route.test.ts`
- `src/app/api/admin/payment-adjustments/[id]/review/route.ts`
- `src/app/api/admin/payment-adjustments/[id]/review/route.test.ts`
- `src/app/api/admin/payment-workflow-holds/[id]/confirm/route.ts`
- `src/app/api/admin/payment-workflow-holds/[id]/confirm/route.test.ts`
- `src/app/api/admin/supplier-payments/route.ts`
- `src/app/api/admin/supplier-payments/[id]/review/route.ts`
- `src/app/api/admin/supplier-payments/[id]/mark-paid/route.ts`
- `src/app/api/admin/supplier-payments/[id]/mark-paid/route.test.ts`
- `src/lib/api/rpc-route.ts`
- `src/lib/payments/bound-evidence.ts`
- `src/lib/payments/bound-evidence.test.ts`
- `src/lib/payments/finance-access.ts`
- `src/lib/payments/finance-access.test.ts`
- `src/lib/orders/server.ts`
- `src/lib/orders/types.ts`
- `src/lib/orders/release-projection.ts`
- `src/lib/orders/release-projection.test.ts`
- `src/lib/orders/admin-access.ts`
- `src/lib/orders/admin-access.test.ts`
- `src/components/admin-order-detail.tsx`
- `src/components/admin-order-workspace.tsx`
- `src/components/member-order-detail.tsx`
- `src/components/member-order-list.tsx`

Supplier Payment routes แก้ได้เฉพาะ early fail-closed response; ห้ามแก้ business logic เดิมเพื่อเปิดทางอื่น

### 5.3 Disabled Hosted Route Defense-in-depth

แก้ได้เฉพาะ early fail-closed guard และ tests; ห้ามแก้ domain logic:

- `src/app/api/member/claims/route.ts`
- `src/app/api/member/claims/[id]/route.ts`
- `src/app/api/member/claims/[id]/actions/route.ts`
- `src/app/api/member/claims/eligible-items/route.ts`
- `src/app/api/admin/claims/route.ts`
- `src/app/api/admin/claims/[id]/route.ts`
- `src/app/api/admin/claims/[id]/resolve/route.ts`
- `src/app/api/admin/claims/[id]/actions/route.ts`
- `src/app/api/admin/claims/[id]/internal-costs/route.ts`
- `src/app/api/claims/evidence/route.ts`
- `src/app/api/claims/evidence/[id]/route.ts`
- `src/app/api/member/reports/route.ts`
- `src/app/api/member/reports/summary/route.ts`
- `src/app/api/admin/reports/route.ts`
- `src/app/api/admin/executive/dashboard/route.ts`

New tests may be added only under the same route directory using `route.test.ts`.

### 5.4 Custom RFQ Files and Cleanup

Modify:

- `src/app/api/member/custom-requests/[id]/files/route.ts`
- `src/app/api/member/custom-requests/[id]/files/[fileId]/route.ts`
- `src/app/api/admin/custom-requests/[id]/files/[fileId]/route.ts`
- `src/components/member-custom-request-form.tsx`
- `src/components/member-custom-request-detail.tsx`

New:

- `src/lib/files/content-signature.ts`
- `src/lib/files/content-signature.test.ts`
- `src/lib/files/storage-cleanup.ts`
- `src/lib/files/storage-cleanup.test.ts`
- `src/app/api/internal/storage-cleanup/process/route.ts`
- `src/app/api/internal/storage-cleanup/process/route.test.ts`
- `src/app/api/member/custom-requests/[id]/files/route.test.ts`

### 5.5 D7/D8 Operations and Delivery Issue

Modify:

- `src/app/api/admin/production-updates/route.ts`
- `src/app/api/admin/qc-inspections/route.ts`
- `src/app/api/admin/qc-inspections/reopen/route.ts`
- `src/app/api/admin/qc-inspections/reopen/route.test.ts`
- `src/app/api/admin/operations-media/route.ts`
- `src/app/api/admin/operations-media/route.test.ts`
- `src/app/api/admin/logistics/actions/route.ts`
- `src/app/api/admin/logistics/actions/route.test.ts`
- `src/app/api/member/logistics/actions/route.ts`
- `src/app/api/admin/shipments/route.ts`
- `src/app/api/admin/shipments/[id]/dispatch/route.ts`
- `src/app/api/admin/deliveries/route.ts`
- `src/app/api/member/order-items/[id]/qc-decision/route.ts`
- `src/app/api/member/order-items/[id]/approve-qc/route.ts`
- `src/components/production-qc-panels.tsx`
- `src/components/production-qc-panels.test.ts`
- `src/components/logistics-panels.tsx`
- `src/components/logistics-panels.test.ts`

New:

- `src/app/api/member/logistics/actions/route.test.ts`
- `src/lib/orders/delivery-issue.ts`
- `src/lib/orders/delivery-issue.test.ts`

### 5.6 Notifications

Modify:

- `src/lib/api/rpc-route.ts`
- `src/app/api/internal/notifications/process/route.ts`
- `functions/notification-retry.ts`

New:

- `src/app/api/internal/notifications/process/route.test.ts`
- `src/lib/notifications/event-types.ts`
- `src/lib/notifications/event-types.test.ts`
- `src/lib/notifications/recipient.ts`
- `src/lib/notifications/recipient.test.ts`
- `src/lib/notifications/retry-policy.ts`
- `src/lib/notifications/retry-policy.test.ts`

### 5.7 Local Contract and Candidate Tests

Modify only if directly required by the new Candidate contract:

- `src/lib/full-flow-candidate-package.test.ts`
- `src/lib/full-flow-emergency-package.test.ts`
- `src/lib/full-flow-reconcile-runner.test.ts`
- `src/lib/full-flow-production-baseline-package.test.ts`
- `src/lib/full-flow-dependency-security.test.ts`
- `src/lib/payments/full-flow-financial-controls-migration.test.ts`

New:

- `src/lib/mvp-initial-operations-migration-contract.test.ts`
- `src/lib/mvp-initial-operations-acl-contract.test.ts`
- `src/lib/mvp-initial-operations-candidate-package.test.ts`
- `src/lib/mvp-initial-operations-emergency-package.test.ts`
- `scripts/mvp-initial-operations-branch-test.mjs`

## 6. Exact Direct RPC and ACL Contract

### 6.1 Disabled Supplier Payment — revoke from runtime

Expected: `PUBLIC=no`, `anon=no`, `authenticated=no`, no Hosted route. `project_admin` ไม่มี direct grant; function owner ใช้เฉพาะ maintenance ตาม runbook

- `create_supplier_payment(UUID,TEXT,NUMERIC,TEXT)`
- `review_supplier_payment(UUID,BOOLEAN,TEXT)`
- `mark_supplier_payment_paid(UUID,UUID)`
- implementation functions ที่ลงท้าย `*_rlc_impl` ต้อง private

### 6.2 Disabled Claims — revoke from runtime

- `open_claim(UUID,TEXT,TEXT,UUID)`
- `resolve_claim(UUID,TEXT,TEXT)`
- `create_claim(UUID,TEXT,TEXT,TEXT,NUMERIC,TEXT,TIMESTAMPTZ,TEXT,TEXT,UUID)`
- `member_claim_action(UUID,TEXT,TEXT,UUID)`
- `admin_claim_action(UUID,TEXT,TEXT,TEXT,TEXT,UUID,UUID,TIMESTAMPTZ)`
- `record_claim_internal_cost(UUID,TEXT,NUMERIC,TEXT,TEXT)`
- `append_claim_event(UUID,UUID,TEXT,TEXT,BOOLEAN)` ต้อง private

Expected: `PUBLIC=no`, `anon=no`, `authenticated=no`; ไม่มี Claims route ที่ทำงานได้ใน Candidate

### 6.3 Disabled Advanced Reports — revoke from runtime

- `get_executive_dashboard(DATE,DATE)`
- `get_fixed_report(TEXT,DATE,DATE,TEXT,INTEGER,INTEGER)`
- `record_fixed_report_export(TEXT,JSONB,INTEGER)`

ห้ามปิด basic dashboards:

- `get_member_dashboard()`
- `get_admin_operations_dashboard()`
- `get_basic_dashboard_summary()`

### 6.4 In-scope/New RPC

- `create_customer_order(project_id_input UUID,selections_input JSONB,idempotency_key_input TEXT) RETURNS UUID` — same owner+key+payload คืน Order เดิม; same owner+key+different payload conflict; `PUBLIC=no`, `anon=no`, `authenticated=yes`, `project_admin=yes`; signature เดิม `create_customer_order(UUID,JSONB)` ต้อง revoke จาก `authenticated`
- `record_delivery_issue_resolution(delivery_item_id_input UUID,resolution_note_input TEXT,resolution_method_input TEXT,evidence_file_ids_input UUID[]) RETURNS UUID` — UUID แรกคือ `delivery_item_id`; ต้องเป็น item ที่ `DELIVERED_WITH_ISSUE`, evidence array ห้ามว่าง, หนึ่ง active resolution ต่อหนึ่ง issue-bearing item, permission `deliveries.manage`, organization check; `PUBLIC=no`, `anon=no`, `authenticated=yes`, `project_admin=no direct grant`
- `confirm_delivery_issue_resolution(resolution_id_input UUID) RETURNS UUID` — ตรวจ `auth.uid()` เป็น Member Order Owner ของ Order นั้น, Operations ยืนยันแทนไม่ได้; `PUBLIC=no`, `anon=no`, `authenticated=yes`, `project_admin=no direct grant`
- `enqueue_member_order_notification(event_type_input TEXT,customer_order_id_input UUID,entity_id_input UUID,event_version_input BIGINT,payload_json_input TEXT) RETURNS UUID` — resolve Member Order Owner/user/email ภายใน function และ validate payload; owner/function-internal execute only; `PUBLIC=no`, `anon=no`, `authenticated=no`, `project_admin=no`
- `claim_member_notification_jobs(worker_token_input TEXT,limit_input INTEGER) RETURNS TABLE(job_id UUID,event_type TEXT,entity_id UUID,event_version BIGINT,recipient_user_id UUID,recipient_email TEXT,subject TEXT,payload JSONB,attempts INTEGER,lease_token TEXT)` — `PUBLIC=no`, `anon=no`, `authenticated=no`, `project_admin=yes`
- `complete_member_notification_job(job_id_input UUID,worker_token_input TEXT,provider_message_id_input TEXT) RETURNS BOOLEAN` — token/lease ต้องตรง; `PUBLIC=no`, `anon=no`, `authenticated=no`, `project_admin=yes`
- `fail_member_notification_job(job_id_input UUID,worker_token_input TEXT,error_message_input TEXT) RETURNS TEXT` — คืนสถานะ `PENDING` หรือ `DEAD_LETTER`; `PUBLIC=no`, `anon=no`, `authenticated=no`, `project_admin=yes`
- `claim_storage_cleanup_jobs(worker_token_input TEXT,limit_input INTEGER) RETURNS TABLE(job_id UUID,bucket_name TEXT,object_key TEXT,attempts INTEGER,lease_token TEXT)` — `PUBLIC=no`, `anon=no`, `authenticated=no`, `project_admin=yes`
- `complete_storage_cleanup_job(job_id_input UUID,worker_token_input TEXT) RETURNS BOOLEAN` — `PUBLIC=no`, `anon=no`, `authenticated=no`, `project_admin=yes`
- `fail_storage_cleanup_job(job_id_input UUID,worker_token_input TEXT,error_message_input TEXT) RETURNS TEXT` — คืนสถานะ `PENDING` หรือ `DEAD_LETTER`; `PUBLIC=no`, `anon=no`, `authenticated=no`, `project_admin=yes`

Payment private functions คง `PUBLIC/anon/authenticated=no`, `project_admin=yes`:

- `verify_payment_transfer_private(UUID,BOOLEAN,TEXT,TEXT,UUID,TEXT,BIGINT)`
- `create_payment_adjustment_private(UUID,TEXT,NUMERIC,TEXT,TEXT)`
- `review_payment_adjustment_private(UUID,BOOLEAN,TEXT,TEXT)`
- `confirm_payment_workflow_hold_private(UUID,TEXT,TEXT,TEXT)`

### 6.5 Table/RLS Contract for New State

- Order idempotency table: `PUBLIC/anon/authenticated/project_admin` direct INSERT/UPDATE/DELETE = no; `project_admin` SELECT = yes; function owner manages rows
- Delivery issue/resolution/evidence-link tables: `PUBLIC/anon` all = no; `authenticated` SELECT = yes through organization/order-owner RLS, direct INSERT/UPDATE/DELETE = no; `project_admin` SELECT = yes, direct DML = no; writes only through the two RPCs
- Member notification outbox/attempt tables: `PUBLIC/anon/authenticated` all = no; `project_admin` SELECT = yes for processor/reconciliation, direct DML = no; writes/claims/completion/failure only through private functions
- Storage cleanup queue/attempt tables: `PUBLIC/anon/authenticated` all = no; `project_admin` SELECT = yes for processor/reconciliation, direct DML = no; writes by function owner and processor RPC only
- ทุก table เปิด RLS และ policy ต้องไม่ใช้ recursive join ที่ทำให้ privilege escalation

### 6.6 Release B ACL No-regression

Migration ใหม่ห้าม `ALTER/REVOKE/GRANT` RPC ต่อไปนี้ และ tests ต้องเปรียบเทียบ ACL snapshot ก่อน/หลัง:

- Showroom: `request_showroom_visit`, `cancel_showroom_visit`, `review_showroom_visit`, `get_member_showroom_visits`, `get_showroom_visit_queue`
- Shared Catalog: `create_customer_browse_catalog_draft`, `save_shared_catalog`, `set_shared_catalog_logo`, `set_shared_catalog_item`, `remove_shared_catalog_item`, `publish_shared_catalog`, `revoke_shared_catalog`, `rotate_shared_catalog_link`
- Sourcing: `create_product_sourcing_draft`, `save_product_sourcing_request`, `submit_product_sourcing_request`, `cancel_product_sourcing_request`, `select_sourcing_candidate`, `reject_sourcing_options`, `save_sourcing_candidate`, `admin_product_sourcing_action`, `delete_sourcing_candidate`, `create_sourcing_product_draft`, `link_sourcing_product`

## 7. Exact Forward Migration Allow-list — Create Only, No Apply

Builder may create exactly these new canonical files under `migrations/` and mirrored copies under the new Candidate package:

1. `20260923080000_mvp_c_close_legacy_customer_payment.sql`
2. `20260923080100_mvp_c_payment_evidence_private_executor.sql`
3. `20260923080200_mvp_c_org_order_idempotency.sql`
4. `20260923080300_mvp_pre_c_financial_controls.sql`
5. `20260923080400_mvp_c_privileges_disabled_capabilities.sql`
6. `20260923080500_mvp_d7_qc_reopen_prerequisite.sql`
7. `20260923080600_mvp_d7_privileges.sql`
8. `20260923080700_mvp_d8_consolidation_prerequisite.sql`
9. `20260923080800_mvp_d8_customs_evidence_prerequisite.sql`
10. `20260923080900_mvp_d8_privileges_freight.sql`
11. `20260923081000_mvp_outbox_storage_cleanup.sql`
12. `20260923081100_mvp_dispatch_delivery_issue_completion.sql`
13. `20260923081200_mvp_post_d_financial_holds.sql`
14. `20260923081300_mvp_private_executor_forward_repair.sql`

Dependency order:

`Production-B baseline → C → pre-C controls → D7 → D8 → outbox/cleanup/issue/dispatch → post-D controls → private repair`

Rules:

- Forward-only; ห้ามแก้ชื่อ/เนื้อหา/hash ของ migration เดิม
- ห้ามใช้ `up --all`
- ห้าม Apply แม้แต่ Local/Development backend ใน Authorization นี้
- ห้ามรวม D9, D10 หรือ Sourcing migration
- Private executor ต้องเป็น full-body forward repair; ห้ามสร้าง wrapper ที่พึ่ง `_ffgl_impl`
- ห้าม `BEGIN`/`COMMIT` ใน migration file
- ห้าม `set_config`, custom GUC หรือเปลี่ยน SQL session configuration
- ทุก `SECURITY DEFINER` ต้อง schema-qualify object references และ pin safe `search_path`
- private helper ทุกตัวต้อง revoke `PUBLIC`, `anon`, `authenticated`
- Exact Supplier Payment implementation signatures ที่ต้อง private: `create_supplier_payment_rlc_impl(UUID,TEXT,NUMERIC,TEXT)`, `review_supplier_payment_rlc_impl(UUID,BOOLEAN,TEXT)`, `mark_supplier_payment_paid_rlc_impl(UUID,UUID)`
- Migration #11 สร้าง outbox/cleanup tables และ private helper contracts
- Migration #12 เชื่อม atomic outbox สำหรับ PO/D7/D8 delivery events หลัง #11
- Migration #14 ต้องสร้าง full-body `verify_payment_transfer_private` ที่รวม atomic `PAYMENT_VERIFIED`/`PAYMENT_REJECTED` outbox หลัง #11; migration #2/#4 ห้ามเรียก helper ที่ยังไม่ถูกสร้าง

## 8. Notification Contract

### 8.1 Exact Events and Recipient

ส่งให้ Member Order Owner ที่ Server resolve และ snapshot ไว้เท่านั้น:

1. `PAYMENT_VERIFIED` — Deposit, Balance และ Freight transfer ที่เปลี่ยนเป็น VERIFIED
2. `PAYMENT_REJECTED` — Deposit, Balance และ Freight transfer ที่เปลี่ยนเป็น REJECTED
3. `PO_ISSUED`
4. `SHIPMENT_DISPATCHED`
5. `DELIVERY_SCHEDULED`
6. `DELIVERY_RESCHEDULED`
7. `OUT_FOR_DELIVERY`
8. `DELIVERED`
9. `DELIVERED_WITH_ISSUE`

Domain transition และ outbox insert ต้องอยู่ใน Database transaction เดียวกัน Unique key อย่างน้อย:

`event_type + entity_id + event_version + recipient_user_id + recipient_email_snapshot`

ห้าม enqueue เมื่อ Order Owner/email/organization guard ไม่ผ่าน และห้ามส่งถึง actor โดยอนุมาน

### 8.2 Retry and Terminal Policy

- Initial send 1 ครั้ง และ retry ได้สูงสุด 5 ครั้ง รวมทั้งหมดไม่เกิน 6 attempts
- Retry backoff หลัง failure ครั้งที่ 1–5: 1, 5, 15, 60 และ 360 นาที
- Event TTL: 72 ชั่วโมงนับจาก domain event
- เมื่อครบ attempts หรือ TTL ให้เป็น `DEAD_LETTER`; ห้าม auto-resend
- Processor claim ต้อง atomic/lease-based เพื่อป้องกัน worker ซ้ำ
- Emergency Stop ใช้ cutover marker; งานก่อน marker ต้อง reconcile/quarantine ก่อน Resume
- Local tests ใช้ fake sender เท่านั้น ห้ามส่ง Email จริง

## 9. Custom File and Cleanup Contract

- รับเฉพาะ PDF/JPEG/PNG สูงสุด 10 ไฟล์ต่อ Request และ 25 MB ต่อไฟล์
- extension, declared MIME และ signature ต้องตรง: PDF `%PDF-`, JPEG `FF D8 FF`, PNG `89 50 4E 47 0D 0A 1A 0A`
- DWG/DXF ต้อง reject
- ไฟล์ที่ validation/binding ล้มเหลวต้องไม่ผูกกับ Request และต้องอ่านไม่ได้
- Quarantine/cleanup queue เป็น private; user runtime ไม่มี direct table/RPC access
- Initial cleanup 1 ครั้ง และ retry ได้สูงสุด 6 ครั้ง รวมทั้งหมดไม่เกิน 7 attempts
- Retry backoff หลัง failure ครั้งที่ 1–6: 1 นาที, 5 นาที, 30 นาที, 2 ชั่วโมง, 6 ชั่วโมง และ 24 ชั่วโมง
- หลัง retry ครั้งที่ 6 ล้มเหลวหรืออายุ 48 ชั่วโมงให้ terminal `DEAD_LETTER` และแสดงใน reconciliation evidence
- Local tests ใช้ mock storage only; ห้ามเรียก Storage จริง

## 10. Order, Finance and Operations Contracts

- Order idempotency เป็น durable server/database key; same owner+key+same payload คืน Order เดิม, same key+different payload ต้อง conflict
- Local authority นี้พิสูจน์เฉพาะ deterministic idempotency model, static SQL unique/lock contract และ duplicate route behavior ด้วย in-memory/file fixtures
- การพิสูจน์จริง 20 synthetic members × 2 requests ด้วย key เดียวภายใน 60 วินาที ต้องทำใน Temporary Staging ภายใต้ Authorization แยก และต้องได้คนละ 1 Order, duplicate 0, cross-org leak 0, unexpected server error 0
- Dispatch ไม่ใช้ Supplier Payment record แต่ต้องมี Customer Balance VERIFIED, PO, QC, quantity และ no active Hold
- `PURCHASING` ตรวจ Supplier paid ภายนอกแอป; ห้าม Builder เพิ่ม checkbox/record/notification หรือทำให้แอปอ้างว่าตรวจแล้ว
- Product Order/VAT/50:50 formula ห้ามเปลี่ยน
- Actual Freight Invoice แยกจาก product 50:50, ชำระภายนอกและ Finance Verify ในแอป
- Completion ต้องมี Delivery/Freight ผ่าน, no active Hold และ Delivery issue ทุกเรื่องได้รับ Operations resolution/evidence กับ Member Order Owner confirmation
- Minimal Delivery Issue ไม่มี compensation/refund/Claim adjudication
- Cancellation เก็บ request/decision/refund amount/deduction/audit; การคืนเงินจริงภายนอกแอปและห้ามแสดงว่าโอนคืนแล้วโดยไม่มีหลักฐาน

## 11. Candidate and Recovery Artifact Allow-list

Create new directory only: `release-candidates/go-live-mvp-initial-operations-01/`

Allowed files:

- `CANDIDATE-MANIFEST.md`
- `MIGRATION-ALLOWLIST.md`
- `DEPENDENCY-SECURITY-EVIDENCE.md`
- `INCIDENT-RUNBOOK.md`
- `STAGING-RUNBOOK.md`
- `migrations/` containing mirrored copies of exactly 14 migrations in section 7
- `emergency/function-snapshot.sql`
- `emergency/stop-c.sql`
- `emergency/stop-d7.sql`
- `emergency/stop-d8.sql`
- `emergency/resume-c.sql`
- `emergency/resume-d7.sql`
- `emergency/resume-d8.sql`
- `emergency/reconcile.sql`
- `emergency/run-reconcile.mjs`
- `emergency/README.md`

Stop/Resume scripts ต้อง hash-pinned และ idempotent; Reconcile เป็น SELECT-only; Rollback ไม่ลบ business/audit data และ Restore ต้องมี Authorization แยก

## 12. Explicit No-touch / Out of Authority

- `.codex-tmp/**`
- เอกสาร Scope, checksum, Approval Records และ Addendum หลัง seal
- `.env*`, `.insforge/**`, secrets, config, schedules
- migration เดิมทุกไฟล์และ `release-candidates/full-flow-go-live-01/**`
- `src/lib/claims/**`, `src/lib/reports/**`, `src/lib/sourcing/**`, `src/lib/shared-catalog/**` นอกจากอ่านและ no-regression tests ที่สร้างใหม่
- Release B pages/routes/components/migrations
- PDF Catalog import/image-search
- role/permission/auth model, pricing/VAT/discount/50:50 formula
- `package.json` และ lockfile; implementation นี้ต้องไม่เพิ่ม dependency
- Backend, Backend branch, Staging, Production, deploy, migration apply, restore, cleanup/delete, notification send/retry ทุกชนิด
- Current repository `C:\codex\GISP` และงาน dirty ของ task อื่น

## 13. Requirement/Test Traceability

Builder ต้องจัดทำ matrix `MVP-REQ-001..019` → named tests → actual command/result. Minimum coverage:

- `001–004`: auth/org, catalog active/published, manage/publish separation, immutable Order snapshot
- `005`: file type/size/count/signature/ownership/quarantine/dead-letter
- `006`: durable Order idempotency/concurrency/conflict
- `007–008`: transfer/evidence/verify/reject/adjust/reverse/hold/PO gate
- `009–011`: D7/D8 workflows และ member-safe timeline
- `012`: 9-event atomic outbox, owner recipient, idempotency, claim/retry/dead-letter
- `013`: Supplier Payment/Claims/Advanced Reports UI/API/direct RPC fail closed
- `014`: cross-org and audit
- `015`: scope fail-close, Stop/Resume/Reconcile
- `016`: Cancellation/refund decision boundary
- `017`: Dispatch/Completion/Freight gates
- `018`: Release B ACL/schema/route no-regression
- `019`: Operations resolution/evidence + authenticated Member Order Owner confirmation; Operations/cross-org denied

## 14. Local Verification Gates

Focused checks during build:

1. Invalid/missing scope closes Hosted writes, enqueue/process/send; health/read-only reconciliation remains
2. Disabled pages/API/direct RPC return fail-closed result
3. Local deterministic idempotency model, static SQL unique/lock contract และ duplicate route tests ผ่าน; ห้ามอ้างว่าเป็น hosted concurrency PASS
4. Custom file spoof/oversize/11th/cross-org/binding failure and cleanup retry/dead-letter pass
5. Notification 9 types, owner snapshot, duplicate/concurrent claim/retry/dead-letter pass
6. Dispatch and Completion financial/operations gates pass
7. Delivery Issue actor/ownership/evidence/confirmation rules pass
8. Financial regression including Freight passes
9. Release B ACL/schema/route snapshots remain equal

Final candidate gates on exact commit/tree:

- `npm run typecheck`
- lint command defined by repository policy/package scripts
- full `npm test`
- `npm run build`
- dependency audit with no unaccepted High/Critical
- static SQL contract/ordering/hash tests
- Local synthetic branch runner only
- `git diff --check` and secret scan
- Candidate manifest hashes equal canonical migration/emergency files
- Independent `vs_qa_guardian` review; Builder cannot approve itself

20-member real database concurrency ไม่ใช่ Local gate และต้องรอ Temporary Staging Authorization

Existing evidence is supporting only when code/scope changes make it stale

## 15. Stop Conditions

Builder must stop before further edits if:

- required file is outside allow-list
- RPC signature/ACL or migration dependency differs materially from this Addendum
- business rule, pricing/tax/50:50, role/auth model or Release B behavior must change
- test requires external/backend write, real Email, Schedule or credential
- another writer changes an owned file or baseline becomes ambiguous
- historical migration/package would need modification
- Local gate exposes a Blocker/Major requiring scope expansion

## 16. Proposed Implementation Authorization Text

> ผม ภคภพ ช.เจริญยิ่ง อนุมัติ Local Implementation ตามเอกสาร `GO-LIVE-MVP-INITIAL-OPERATIONS-01 — Local Implementation Addendum v0.1` และ checksum companion ที่แนบ อ้างอิง Scope `GO-LIVE-MVP-INITIAL-OPERATIONS-01 v0.1` SHA-256 `D4007297B2CF34B538A022526D4A272910248D726C3A44F0C7D7B1045B3C96CF` และ Scope Clarification Option 2 อนุญาตให้ Builder หนึ่งรายแก้เฉพาะ exact file allow-list, สร้างเฉพาะ 14 forward Migration files โดยไม่ Apply, สร้าง Candidate/recovery artifacts ใน path ใหม่ และใช้ Local in-memory/file synthetic fixtures เพื่อรัน Local tests/build/audit ใน isolated worktree `C:\Users\ASUS\.codex\worktrees\full-flow-go-live-01\GISP` branch `codex/full-flow-go-live-01` baseline commit `88b8b6d992cc2e91b3526312dc21cbc96f05b97d` tree `71b80afb5c328a9be521af34129f3c82e8101053` เท่านั้น ห้ามแตะ `.codex-tmp`, historical migrations, old candidate package, `.env`, Backend/Backend branch/Staging/Production ห้าม Apply Migration, Deploy, Config/Secret/Schedule change, Notification send/retry, Restore, Cleanup/Delete หรือใช้ external write ให้ใช้เวลาของข้อความนี้เป็นเวลาอนุมัติ กำหนด `data_authority: Local in-memory/file synthetic fixtures only`, `migration_authority: Create the 14 listed forward files only, no apply`, `network_backend_authority: No` และ `production_allowed: No`

## 17. Remaining Steps

หลัง Implementation Authorization เหลือ 5 ขั้นตอนเพื่อปิด Go-live Slice:

1. Local implementation และ candidate evidence
2. Independent QA
3. Temporary Staging authorization/rehearsal
4. Production Release Authorization และ rollout
5. เปิดสมาชิกประมาณ 20 คนและ monitoring 24 ชั่วโมง
