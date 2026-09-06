# GISP MVP Requirement Traceability

**Reconciled:** 1 August 2026  
**Authority:** `MVP BUSINESS MASTER PLAN.md` → `DECISION LOG.md` → เอกสารฉบับนี้

เอกสารนี้ใช้ตรวจว่า Approved Decision แต่ละข้อถูกนำไปวางไว้ตรงไหนในโค้ดและฐานข้อมูล ไม่ใช่เอกสารกำหนด Business Rule ฉบับใหม่

| Approved requirement | Implementation | Verification |
|---|---|---|
| Next.js + TypeScript บน InsForge Frontend Deployments | `src/app`, `next.config.ts`, InsForge deployment configuration | `npm run typecheck`, `npm run build`, InsForge deployment status |
| InsForge Auth แบบ Email + Password | `src/lib/insforge`, `/api/auth/*`, `proxy.ts` | Auth route และ SSR session check |
| App User ไม่เก็บ Password | `public.users` ใน Foundation Migration เชื่อม `auth.users` | Schema review และ RLS test เมื่อเชื่อม InsForge |
| Organization, Multi-role, Permission, RLS | Foundation Migration + Backend RPC Guard | Permission/RLS integration test บน InsForge Development |
| Public / Member-private / Confidential Storage | Storage Migration และ File Metadata | Signed URL และ cross-organization access test |
| Standard Product ข้าม RFQ | Catalog/Project RPC และ `READY_TO_ORDER` | Standard E2E scenario |
| Custom RFQ และ Versioned Quotation | Catalog/Quotation Migration + Member/Admin API | Custom quotation acceptance scenario |
| Accepted Quotation ล็อก Snapshot | `respond_custom_quotation` และ immutable trigger | Revision/immutability integration test |
| VAT Snapshot และ Decimal Round Half-up | Money helper + quotation/order/payment columns | Unit test และ snapshot integration test |
| Deposit/Balance 50/50 + Partial Payment | Order/Operations Migration + payment APIs | Unit test และ partial/reject/resubmit scenarios |
| Freight แยกภายหลัง | Payment Schedule Type และ Order workflow | Standard E2E scenario |
| PO Gate และ Dispatch Gate | Trusted action functions ใน Operations Migration | Direct status mutation denial + gate scenarios |
| In-App + Email Retry โดยไม่ Rollback งานหลัก | Notification Outbox + InsForge Schedule | Failure/retry/dead-letter integration test |
| Fixed Basic Reports | `get_basic_dashboard_summary` + report repository/API | Report permission and result test |
| Commission/Advanced BI/AI/Generic Task เป็น Post-MVP | Decision Log และไม่มี Core Migration/API/UI | Source/schema/API search |
| Demo Gate ใช้ Application Version 1.3 | `gisp-mvp-demo` ที่ใช้ Browser-local State Schema Version 3 | Human UAT 8 Scenario + GISP Admin Sign-off |
| Account Recovery/Suspension, Catalog Import และ Cancellation เป็น Core | Auth/Catalog/Order Slice ที่เกี่ยวข้อง | Integration/UAT ตาม Slice |
| Supplier Payment 50/50 และ Freight Verification เป็น Core | Finance/Operations Slice ที่เกี่ยวข้อง | Dispatch/Freight E2E |
| Canonical State/Number/Production Role | Decision Log + Implementation Plan Version 1.4 | Schema/API/UI contract review |

## สถานะการตรวจรับ

### ผ่านใน Local

- TypeScript Type Check
- Unit Test สำหรับ VAT, การปัดเศษ, Deposit/Balance และ Dispatch Gate
- Production Build
- ESLint
- Responsive Browser Check
- Accessibility Check ของหน้าหลักและ Workflow

### ผ่านบน InsForge Development

รายการในส่วนนี้เป็น Preliminary Baseline ตาม DEC-031 และยังไม่เท่ากับการผ่าน Demo Gate หรือ UAT

- Frontend Deployment และ Health Check
- Migration 8 ฉบับบน PostgreSQL
- ตาราง `public` 47 ตารางเปิด RLS ครบทุกตาราง
- Anonymous access ถูกปฏิเสธสำหรับ `public.users` และ `member_catalog`
- `member_catalog` อนุญาตเฉพาะ `SELECT` สำหรับผู้ใช้ที่ยืนยันตัวตน
- First Super Admin bootstrap ถูกจำกัดไว้ที่ Privileged operator
- Storage Bucket แบบ Public, Member-private และ Confidential
- Protected Notification Retry endpoint และ Schedule ทุก 10 นาที

### ต้องตรวจระหว่าง Integration/UAT

- Backup และ Restore บน Staging
- RLS/Permission ระหว่างหลาย Organization
- Email sender/domain และ retry
- Signed URL และ Confidential file access
- UAT Standard Flow และ Custom Flow ตั้งแต่ต้นจนจบ
- InsForge Staging และ Production Deployment
- Human UAT Demo Version 1.3 ครบ 8 Scenario และ GISP Admin Sign-off
