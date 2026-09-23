# GO-LIVE-MVP-INITIAL-OPERATIONS-01 v0.2 — LEAN Scope Amendment

## 1. Document Control

| Field | Value |
| --- | --- |
| Document ID | `GO-LIVE-MVP-INITIAL-OPERATIONS-01` |
| Version | `v0.2 — LEAN Scope Amendment` |
| Date | 2026-09-23 (Asia/Bangkok) |
| Status | **Proposed — Awaiting Owner Scope Approval** |
| Product owner / intended approver | ภคภพ ช.เจริญยิ่ง |
| Parent document | `GO-LIVE-MVP-INITIAL-OPERATIONS-01 v0.1` |
| Parent SHA-256 | `D4007297B2CF34B538A022526D4A272910248D726C3A44F0C7D7B1045B3C96CF` |
| Target worktree | `C:\Users\ASUS\.codex\worktrees\full-flow-go-live-01\GISP` |
| Branch | `codex/full-flow-go-live-01` |
| Source commit | `88b8b6d992cc2e91b3526312dc21cbc96f05b97d` |
| Source tree | `71b80afb5c328a9be521af34129f3c82e8101053` |
| Data authority | None |
| Migration authority | None; planning only |
| Staging authority | No |
| `production_allowed` | `No` |

เอกสารนี้ลด Scope v0.1 ให้เป็น Startup MVP ที่ง่ายที่สุดโดยยังทำงานหลักได้ครบ การอนุมัติเอกสารนี้เป็น Scope Approval เท่านั้น ยังไม่อนุญาตให้แก้โค้ด สร้างหรือ Apply Migration, เขียนข้อมูล, Deploy หรือเปลี่ยน Backend/Staging/Production

## 2. Lean Principle

1. ใช้ของที่สร้างและทดสอบไว้แล้วก่อนสร้างของใหม่
2. สิ่งที่ทีมทำ Manual ได้ในช่วงสมาชิกประมาณ 20 คน ให้ทำ Manual ก่อน
3. ไม่สร้าง Worker, Schedule, Queue, Automation หรือ Workflow ใหม่ถ้ายังไม่จำเป็นต่อการรับ Order และส่งมอบ
4. เก็บเฉพาะ Security/Financial controls ขั้นต่ำที่ป้องกันข้อมูลข้ามองค์กร, เงินผิดยอด และการส่งของก่อนเงื่อนไขพร้อม
5. ฟังก์ชันที่เลื่อนต้องปิดหรือไม่เปิดให้ผู้ใช้เข้าใจผิดว่าใช้งานได้
6. เมื่อจำนวนผู้ใช้หรือปริมาณงานเพิ่ม จึงใช้ข้อมูลจริงตัดสินใจว่าควรพัฒนา Automation ใดต่อ

## 3. Effect on Earlier Documents

เมื่อ v0.2 ได้รับ Scope Approval:

- v0.2 เป็น Source of Truth สำหรับ Go-live รุ่นเริ่มต้นแทนขอบเขตที่ขัดกันใน v0.1
- Scope v0.1 และ Approval/Clarification เดิมเก็บเป็นประวัติ ไม่ถูกลบหรือแก้ย้อนหลัง
- Draft `GO-LIVE-MVP-INITIAL-OPERATIONS-01 — Local Implementation Addendum v0.1` ห้ามนำไปอนุมัติหรือใช้ Implement
- ต้องจัดทำ Lean Local Implementation Addendum ฉบับใหม่หลัง Scope Approval
- การลด Scope ไม่ถือว่าฟังก์ชันที่เลื่อนผ่าน UAT หรือเปิดใช้งานแล้ว

## 4. Lean Go-live Outcome

สมาชิกประมาณ 20 คนสามารถใช้งาน Flow หลัก:

`Catalog/Project หรือ Custom RFQ → Quotation → Order → แนบสลิปโอนเงิน → Finance Verify/Reject → PO → Production/QC → Warehouse → Shipment → Delivery`

ทีมงานสามารถเพิ่ม แก้ และเผยแพร่สินค้าใน Catalog ได้ต่อเนื่องตาม permission เดิม Order เก่าต้องเก็บ snapshot สินค้าและราคาเดิม

## 5. Must Have — อยู่ในแอปวันเปิดใช้

### 5.1 Catalog, Project and Custom RFQ

- Member ดู Published Catalog item ที่มี Active Member Price
- ผู้มี `catalog.manage` เพิ่ม/แก้สินค้า และผู้มี `catalog.publish` เผยแพร่/หยุดเผยแพร่
- Member เลือก Catalog item เข้า Project
- สินค้านอก Catalog ใช้ Custom RFQ → Admin Quotation → Member Accept → Ready to Order
- Custom attachment รับเฉพาะ PDF/JPEG/PNG สูงสุด 10 ไฟล์ต่อ Request และ 25 MB ต่อไฟล์
- ตรวจ extension, declared MIME และ magic bytes ก่อน upload; DWG/DXF ไม่รับใน Lean launch
- ไฟล์และสลิปเป็น Private, ตรวจ Organization/ownership และใช้ signed access ตามระบบเดิม
- ถ้า upload แล้วผูก metadata ไม่สำเร็จ ให้ cleanup ทันทีแบบ best effort; อาจเหลือ Private object หรือ metadata แต่ต้องไม่มี valid Custom Request binding และ route ต้องไม่ออก signed URL ให้รายการที่ไม่มี binding; ตรวจแบบ Manual

### 5.2 Order

- สร้าง Order จาก Project item/accepted Custom Quotation ตามกฎเดิม
- เก็บ immutable snapshot ของชื่อ, SKU, spec, quantity, unit price, VAT และยอด Order
- ใช้ Database row locks และ status transition เดิมป้องกัน Order ซ้ำ
- หน้าแอป disable ปุ่มระหว่างส่งคำขอ; ถ้ากดซ้ำ Request หนึ่งอาจได้ conflict/error ที่อ่านง่ายและให้ Reload
- ไม่สร้าง idempotency table หรือเปลี่ยน RPC signature ในรอบนี้

### 5.3 Customer Payment and PO

- ใช้ Deposit/Balance 50/50, VAT และสูตรราคาเดิมทุกประการ
- คง behavior เดิมของการรับชำระแบบ partial, exact, reject และ overpayment review โดยไม่สร้าง Payment flow หรือสูตรใหม่
- Member โอนเงินภายนอกแอปและแนบสลิป Private
- Finance ดูหลักฐานและ Verify/Reject แบบ Manual
- Verified transfer immutable; ห้ามแก้หรือลบโดยตรง
- PO ออกได้ตาม financial gate เดิม
- Cancellation เก็บ request/decision/refund amount/deduction/audit เท่าที่ระบบเดิมรองรับ
- การคืนเงินจริงและการสื่อสารเรื่องคืนเงินทำภายนอกแอป

### 5.4 Basic Production, QC, Warehouse, Shipment and Delivery

- Production: อัปเดตสถานะ, note และหลักฐานขั้นต่ำ
- QC: pass/fail/rework outcome และหลักฐานตามระบบเดิม
- Warehouse: รับเข้าและบันทึกจำนวน
- Shipment: สร้าง Shipment, tracking number, dispatch และสถานะพื้นฐาน
- Delivery: นัดหมาย, บันทึก POD และสถานะ `DELIVERED` หรือ `DELIVERED_WITH_ISSUE`
- Dispatch ต้องมี Customer Balance `VERIFIED`, PO, QC, quantity พร้อม และไม่มี gate ที่ปิดอยู่
- Supplier payment ตรวจโดย `PURCHASING` นอกแอป แอปไม่เก็บหรืออ้างว่าพิสูจน์แล้ว และ Dispatch ไม่พึ่ง Supplier Payment record
- `DELIVERED_WITH_ISSUE` ต้องไม่ทำให้ Order เป็น `COMPLETED`

### 5.5 Existing Freight Capability — Reuse Only

- ไม่สร้าง Freight formula หรือ Workflow ใหม่
- หากทีมใช้ Actual Freight Invoice เดิม สมาชิกชำระภายนอกและ Finance Verify แบบ Manual ในแอป
- Freight ไม่อยู่ใน Product Deposit/Balance 50/50 และห้ามเปลี่ยน Product Order snapshot
- ถ้าไม่มี Freight Invoice, Operational endpoint ของ Lean launch คือ `DELIVERED`; ไม่บังคับให้ Order ต้องเป็น `COMPLETED`
- ถ้ามี Freight Invoice, Completion ใช้กฎ verified freight เดิม

### 5.6 Security and Release Minimum

- Organization/role/RLS และ private file enforcement ต้องคงอยู่
- Payment evidence binding และ private verifier ต้องคงอยู่
- Supplier Payment, Claims และ Advanced Reports ต้องปิดทั้ง Hosted routes และ Direct RPC
- Release B Shared Catalog, Sourcing, Showroom และ Member flow ต้อง no-regression ด้าน UI/API/domain data/ACL โดยยกเว้น generic actor-side business notification ซึ่งยกเลิกใน Lean launch; Auth verification/password-reset email ยังคงเดิม
- ใช้ `RELEASE_STAGE` และ `RELEASE_D_ENABLED_SLICES=7,8` เดิม ไม่สร้าง `MVP_SCOPE`
- มี exact candidate/migration hashes, Backup, Emergency Stop, SELECT-only Reconcile, Independent QA และ Staging UAT ก่อน Production

## 6. Manual at Launch

รายการต่อไปนี้ทำภายนอกแอปในรอบแรก:

- แจ้ง Payment, PO, Shipment และ Delivery ผ่าน LINE, โทรศัพท์ หรือ Manual email
- ยืนยันการจ่าย Supplier/โรงงานก่อน Dispatch โดย `PURCHASING`
- แก้ Delivery issue และยืนยันกับ Member; ในแอปเก็บเพียง status/note/evidence เดิม
- Compensation/Claim/refundเงินจริง
- ตรวจ Storage orphan รายสัปดาห์และขอ Cleanup authorization แยกเมื่อพบ
- เมื่อ Finance Verify ผิด ระบบ Lean แก้ Verified transfer ในแอปไม่ได้ ต้องหยุด Order ทันที ห้ามออก PO หรือ Dispatch ต่อ บันทึก incident และ reconcile แบบ Manual; Order เดิมอาจต้องยกเลิกและสร้างใหม่ แล้วคืนเงินจริงภายนอกแอปตามผล reconcile
- Customs, consolidation, partial shipment, reschedule และ exception coordination ที่เกิน basic happy path ใช้ความสามารถเดิมเท่าที่จำเป็นหรือประสาน Manual โดยไม่สร้าง Automation ใหม่

## 7. Deferred / Future

- Automatic business notification ทั้ง 9 เหตุการณ์
- Notification outbox, recipient snapshot, retry/dead-letter Worker และ Notification Schedule
- Durable storage-cleanup queue/processor/schedule
- Minimal Delivery Issue Resolution table/RPC/UI และ in-app Member confirmation
- Supplier Payment UI/RPC/workflow
- Claims และ Claim compensation/adjudication
- Advanced Reports
- New Order idempotency table/signature
- New Adjustment/Reversal/dual-control Hold package
- Automatic payment gateway, bank API, card หรือ QR integration
- Advanced logistics automation และ hosted load harness ใน Local

Auth verification/password-reset email เป็นระบบ Auth เดิมและไม่ใช่ business notification ที่ถูกเลื่อน

## 8. Lean Requirements

- `LEAN-REQ-001` Member ต้องสมัคร/เข้าใช้และเห็นเฉพาะ Organization ที่มีสิทธิ์
- `LEAN-REQ-002` Member ต้องดู Published Catalog item ที่มี Active price ได้
- `LEAN-REQ-003` ทีมต้องเพิ่ม/แก้/เผยแพร่ Catalog ได้ตาม `catalog.manage`/`catalog.publish`
- `LEAN-REQ-004` Order ต้องเก็บ immutable commercial snapshot
- `LEAN-REQ-005` Custom RFQ/Quotation ต้องไปถึง Ready to Order พร้อม Private PDF/JPEG/PNG ที่ตรวจชนิดก่อน upload
- `LEAN-REQ-006` Order creation ใช้ lock/status เดิมและ UI double-submit guard; request ซ้ำต้องไม่สร้าง Order ซ้ำแม้อีก request อาจ error
- `LEAN-REQ-007` Member ต้องแนบสลิป และ Finance Verify/Reject Deposit/Balance แบบ Manual ได้
- `LEAN-REQ-008` PO ต้องออกได้เมื่อ customer financial gate ผ่าน
- `LEAN-REQ-009` Basic Production/QC ต้องบันทึกสถานะและหลักฐานได้
- `LEAN-REQ-010` Basic Warehouse/Shipment/Delivery/POD ต้องติดตามถึง `DELIVERED` หรือ `DELIVERED_WITH_ISSUE`
- `LEAN-REQ-011` Dispatch ต้องรอ Customer Balance VERIFIED, PO, QC และ quantity โดยไม่พึ่ง Supplier Payment record
- `LEAN-REQ-012` `DELIVERED_WITH_ISSUE` ต้องไม่ auto-complete และแก้ Manual ภายนอกแอป
- `LEAN-REQ-013` Automatic business notification ต้องไม่ enqueue/process/send; ทีมใช้ Manual contact
- `LEAN-REQ-014` Supplier Payment, Claims และ Advanced Reports ต้อง Fail Closed ทั้ง Hosted route และ Direct RPC
- `LEAN-REQ-015` Release B UI/API/domain data/ACL ต้องไม่ถดถอย โดยยกเว้น generic actor-side business notification ที่ยกเลิกตาม Lean scope
- `LEAN-REQ-016` Private files, organization/role boundaries และ audit ต้องผ่าน negative tests
- `LEAN-REQ-017` Actual Freight ใช้ existing capability เท่านั้น; ไม่มีสูตรหรือ Automation ใหม่
- `LEAN-REQ-018` Emergency Stop ต้องหยุด C/D7/D8 entry writes และ Reconcile ต้อง SELECT-only

## 9. Lean Acceptance Criteria

### Local Candidate

- `LEAN-AC-L01` Typecheck, lint policy, full tests และ production build ผ่าน
- `LEAN-AC-L02` Published/active Catalog, manage/publish separation และ immutable Order snapshot ผ่าน
- `LEAN-AC-L03` Custom RFQ PDF/JPEG/PNG ผ่าน; spoofed MIME/signature, DWG/DXF, >25 MB, >10 files และ cross-org ถูกปฏิเสธ
- `LEAN-AC-L04` Order double-submit model/route test สร้างได้ไม่เกินหนึ่ง Order และ error message ของ request ซ้ำอ่านง่าย
- `LEAN-AC-L05` Deposit/Balance evidence, Verify/Reject, private access, partial/exact/overpayment arithmetic/status เดิม และ PO gate ผ่าน
- `LEAN-AC-L06` Basic Production/QC/Warehouse/Shipment/Delivery/POD path ผ่าน
- `LEAN-AC-L07` Dispatch ไม่ดู Supplier paid แต่ยังบังคับ Balance/PO/QC/quantity
- `LEAN-AC-L08` `DELIVERED_WITH_ISSUE` ไม่ทำให้ Order Completed
- `LEAN-AC-L09` ไม่มี business notification job ใหม่และ generic notification-to-actor ถูกปิด
- `LEAN-AC-L10` Supplier Payment/Claims/Advanced Reports Hosted routes และ Direct RPC ถูกปิด
- `LEAN-AC-L11` Release B UI/API/domain data/ACL no-regression โดย generic actor-side business notification ไม่ถูก enqueue/process/send
- `LEAN-AC-L12` Organization/role/private-file/cross-org negative tests และ audit ผ่าน
- `LEAN-AC-L13` Migration allow-list/hash/order และ Emergency Stop/Resume/Reconcile package contract ผ่าน
- `LEAN-AC-L14` Dependency audit ไม่มี unaccepted High/Critical

Local test ใช้ in-memory/file synthetic fixtures เท่านั้น ไม่อ้างว่าเป็น hosted concurrency proof

### Temporary Staging

- Identity/region/host/schedule/backup/baseline ตรงกับ Staging Authorization แยก
- Apply เฉพาะ allow-list ทีละไฟล์ ห้าม `up --all`
- Deploy exact commit/tree
- UAT: Catalog/Custom → Order → Deposit/Balance Verify → PO → Basic Production/QC → Warehouse → one Shipment → Delivery/POD
- Negative UAT: cross-org, wrong role, private files, Supplier Payment/Claims/Reports direct call
- 20 synthetic members × 2 simultaneous Order requests เป็น Staging evidence ไม่ใช่ Local gate
- Notification Schedule ต้อง Active = 0 และต้องไม่ส่ง business email
- Backup/Restore/Emergency Stop rehearsal ต้องมี Authorization แยกตามความเสี่ยง

### Production

- ต้องมี Production Release Authorization แยกพร้อม exact candidate, migration hashes, backup, rollout, rollback และ monitoring
- เปิด `RELEASE_STAGE=D`, `RELEASE_D_ENABLED_SLICES=7,8` หลัง C/D7/D8 smoke ตามลำดับ
- Business Notification Schedule ต้องปิด
- เปิดสมาชิกประมาณ 20 คนเมื่อ smoke ผ่านและ monitor 24 ชั่วโมงแรก

## 10. Reuse-first Migration Direction

นี่เป็น Scope direction ไม่ใช่ Migration Authority รายการสุดท้ายต้องยืนยันใน Lean Implementation Addendum

เสนอ reuse exact immutable migration ที่มี test/evidence 11 ไฟล์:

1. `20260920010000_pay-close-legacy-entry.sql`
2. `20260920010100_pay-evidence-binding.sql`
3. `20260920010200_pay-private-executor.sql`
4. `20260920010250_release-c-org-scope-hardening.sql`
5. `20260920010300_release-c-privileges.sql`
6. `20260920010400_d7-qc-reopen-prerequisite.sql`
7. `20260920010500_release-d7-privileges.sql`
8. `20260920010600_d8-consolidation-prerequisite.sql`
9. `20260920010700_d8-customs-prerequisite.sql`
10. `20260920010800_release-d8-privileges.sql`
11. `20260920010900_d8-freight-payment-enable.sql`

เสนอสร้าง forward migration ใหม่เพียงหนึ่งไฟล์ เช่น `startup_initial_operations_guard.sql` เพื่อ:

- revoke Supplier Payment outer/implementation RPCs
- revoke Claims/Advanced Reports runtime RPCs ที่ยังเปิด
- revoke generic business notification enqueue entry
- เปลี่ยน Dispatch gate ให้ไม่พึ่ง Supplier paid แต่คง Balance VERIFIED/PO/QC/quantity
- เปลี่ยน Completion ให้ `DELIVERED_WITH_ISSUE` ไม่ถือว่าเสร็จ
- ไม่สร้าง table, role, permission, formula, queue, worker หรือ schedule ใหม่

ไม่ใช้:

- `full-flow-financial-controls-pre-c`
- D9/D10 privilege migrations
- sourcing hardening migration
- post-D financial holds
- corrective private executor #17 ซึ่งจำเป็นเฉพาะ financial-control wrapper ที่ถูกเลื่อน
- 14 rewritten migrations จาก Draft Addendum v0.1

## 11. Lean Application Direction

เสนอแก้ให้น้อยที่สุด:

1. Release gate: ใช้ stage/slice เดิมและปิด Supplier Payment, Claims, Reports
2. Generic notification: เอาการ queue ถึง actor ออก ไม่สร้าง outbox ใหม่
3. Notification processor endpoint: ต้อง Fail Closed แม้ถูกเรียกตรง เพื่อไม่ให้อ่าน queue เดิมหรือส่ง business email ขณะที่ Schedule ปิด
4. Order projection/UI: ไม่ query/แสดง Supplier Payment และ financial adjustment/hold ที่ไม่ Apply
5. Production/QC UI: ไม่แสดง Supplier paid เป็น dispatch gate และแจ้งว่า `PURCHASING` ตรวจนอกระบบ
6. Custom file: ตรวจ extension/MIME/magic bytes ก่อน upload, ใช้ immediate best-effort cleanup และออก signed access ได้เฉพาะ metadata ที่ผูกกับ Custom Request จริงและผู้เรียกผ่าน ownership/Organization guard
7. Order UI: disable ขณะ submit และแสดงข้อความ conflict/reload ที่เข้าใจง่าย
8. Candidate/recovery: สร้าง package ใหม่เฉพาะ Lean C/D7/D8 โดย reuse หลักฐานที่ยังไม่ stale

ไม่มี `MVP_SCOPE`, outbox, cleanup worker, Delivery Issue module, idempotency table หรือ dependency ใหม่

## 12. Explicit Risk Acceptance Required

Owner Scope Approval v0.2 ต้องยืนยันว่าเข้าใจและยอมรับ:

| Risk | Level | Lean control |
| --- | --- | --- |
| Finance Verify ผิดและไม่มี in-app Adjustment/Reversal | High | Verified transfer แก้ในแอปไม่ได้; หยุด Order และห้าม PO/Dispatch ต่อ, evidence preview, แยกผู้ตรวจ, manual reconcile และอาจยกเลิก/สร้าง Order ใหม่พร้อมคืนเงินจริงภายนอก |
| ไม่มี technical financial hold | High | Operations หยุดงานตาม incident runbook และ Owner/Finance reconcile ก่อนทำต่อ |
| Request ซ้ำหนึ่งรายการอาจ error แทน replay | Medium | DB lock/status + UI busy + reload message |
| `DELIVERED_WITH_ISSUE` ค้างไม่ Completed | Medium | ตั้งใจ fail closed และประสานแก้ Manual |
| ไม่มี automatic status email | Low–Medium | LINE/โทรศัพท์/manual email |
| Private orphan object/metadata จาก partial failure | Low สำหรับประมาณ 20 users | ไม่มี valid Custom Request binding, route ไม่ออก signed URL และตรวจ Storage แบบ Manual รายสัปดาห์ |
| เปิดประมาณ 20 users โดยไม่มี pilot subgroup | Medium | staged C/D7/D8 smoke + monitoring 24h + emergency stop |

ความเสี่ยงเหล่านี้เป็นการแลกความซับซ้อนกับความเร็วและความง่ายของ Startup MVP ไม่ถือว่าแก้เสร็จถาวร

## 13. Future Trigger

พิจารณาพัฒนา Automation เมื่อเกิดอย่างใดอย่างหนึ่ง:

- สมาชิกหรือ Order เพิ่มจน Manual communication ตกหล่น
- มี Finance correction/incident จริงมากกว่าเกณฑ์ที่ Owner กำหนด
- Storage orphan เพิ่มจน manual audit ใช้เวลามาก
- Delivery issue เกิดซ้ำและต้องมี SLA/compensation
- ทีมต้องจัดการหลาย Shipment/customs/consolidation พร้อมกัน
- ต้องการ Reports สำหรับการบริหารที่ข้อมูลพื้นฐานไม่พอ

การพัฒนา Future ต้องมี Scope/Implementation/Release Approval แยก

## 14. Approval Boundaries

### Scope Approval v0.2

ข้อความอนุมัติที่เสนอ:

> ผม ภคภพ ช.เจริญยิ่ง อนุมัติ Lean Scope Amendment `GO-LIVE-MVP-INITIAL-OPERATIONS-01 v0.2` และ checksum companion ที่แนบ ให้ใช้แนวทาง reuse-first และ manual operations ตามเอกสาร ยอมรับ Lean risks เรื่อง Finance correction/hold, duplicate-request error, Delivery with Issue ค้าง, manual notifications, private storage orphan audit และการเปิดสมาชิกประมาณ 20 คนตามมาตรการในเอกสาร อนุมัติให้เลื่อน automatic notification/outbox, durable cleanup, Delivery Issue Resolution, Supplier Payment, Claims, Advanced Reports, new idempotency และ financial adjustment/hold package ออกไปก่อน การอนุมัตินี้เป็น Scope Approval เท่านั้น ยังไม่อนุญาตแก้โค้ด สร้างหรือ Apply Migration, เขียนข้อมูล, Deploy, เปลี่ยน Backend/Staging/Config/Schedule/Notification หรือ Production ให้ใช้เวลาของข้อความนี้เป็นเวลาอนุมัติ กำหนด `data_authority: None`, `migration_authority: None` และ `production_allowed: No`

### Local Implementation Authorization

ต้องจัดทำ Lean Addendum แยกพร้อม exact file allow-list, exact reused/new migration hashes, tests, worktree baseline และข้อห้าม แล้วขออนุมัติอีกครั้ง

### Staging and Production

ต้องขอแยกตาม exact candidate/environment ไม่มีสิทธิ์ใดอนุมานจาก Scope หรือ Local Implementation Approval

## 15. Definition of Done

Lean Go-live Slice ปิดเมื่อ:

1. Lean Scope v0.2 ได้รับ Owner Approval
2. Lean Implementation Addendum/Authorization ครบ
3. Local implementation และ candidate gates ผ่าน
4. Independent QA ให้ PASS
5. Temporary Staging UAT/recovery ผ่านตาม Authorization
6. Production Release Authorization และ rollout สำเร็จ
7. สมาชิกประมาณ 20 คนเปิดใช้งานและ monitoring 24 ชั่วโมงไม่มี Blocker ค้าง

ณ เวลาจัดทำเอกสาร เหลือ **7 ขั้นตอน** เพื่อปิด Lean Go-live Slice
