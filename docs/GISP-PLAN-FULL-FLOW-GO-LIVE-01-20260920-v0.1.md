# GISP — FULL-FLOW-GO-LIVE-01

**Document Version:** `v0.1`  
**Date:** 20 September 2026 (พ.ศ. 2569)  
**Status:** `SCOPE APPROVED / IMPLEMENTATION AUTHORIZED — LOCAL ONLY`  
**Environment Authority:** Local documentation only; Temporary Staging ยังไม่ได้รับอนุญาตให้สร้าง, Apply Migration, Deploy หรือเขียนข้อมูลจนกว่าจะมี Scope Approval และ Implementation Authorization แยก  
**Production Allowed:** `No`  
**Data / Migration Authority:** `No` — เอกสารนี้ยังไม่อนุญาตให้ Apply Migration หรือเขียนข้อมูลใน Backend  
**Owner:** ภคภพ ช.เจริญยิ่ง  
**Current Repository Baseline:** branch `development`, commit `2bb809791ea809c6f5b8fc9472a2430240cb840c`

> เอกสารนี้กำหนดขอบเขตและลำดับงานให้ GISP ใช้งานได้ครบตั้งแต่ Member สมัครจนจบ Order
> โดยใช้การชำระเงินแบบโอนนอกระบบและตรวจโดย Finance เอกสารนี้ไม่ใช่ Production Release Authorization
> และไม่อนุญาตให้แก้ Production โดยอัตโนมัติ

---

## 1. คำตอบสำหรับเจ้าของระบบ

เมื่อ `FULL-FLOW-GO-LIVE-01` ผ่านทุก Gate และเปิด Production ถึง `D10` แล้ว ระบบจะพร้อมให้ Member จริง:

1. สมัครและผ่านการอนุมัติ
2. เลือกสินค้าจาก Catalog หรือส่งคำขอสินค้านอก Catalog
3. สร้าง Project และ Order
4. โอนเงินเข้าบัญชีบริษัท อัปโหลดสลิป และรอ Finance ยืนยัน
5. ให้ทีม GISP ออก PO ติดตามการผลิต QC ขนส่ง ส่งมอบ และ Claim
6. ปิด Order และดูรายงานตามสิทธิ์

คำว่า “เสร็จ” ในเอกสารนี้หมายถึง Production ผ่าน Release C → D7 → D8 → D9 → D10,
Smoke Test หลังปล่อยผ่าน และไม่มี Blocker ค้าง ไม่ได้หมายถึงเพียงเขียนโค้ดหรือทดสอบใน Local เสร็จ

Production และข้อมูลจริงไม่มีวันหมดอายุ 14 วัน ระยะเวลา 14 วันใช้กับ Temporary Staging หลัง Go Live เท่านั้น

---

## 2. เป้าหมายและหลักการ

### 2.1 เป้าหมาย

- เปิดเส้นทางธุรกิจครบวงจรโดยไม่ต้องพึ่ง Payment Gateway
- รองรับ Member เริ่มต้นประมาณ 20 คนโดยรักษาการแยกข้อมูลแต่ละองค์กร
- ทำ Full-flow UAT ใน Temporary Staging ที่แยกจาก Production จริง
- นำขึ้น Production ตามลำดับ Release ที่อนุมัติไว้ ไม่เปิด Transaction และ Operations พร้อมกันโดยไม่มี Gate
- เก็บหลักฐานที่ตรวจซ้ำได้สำหรับ Scope, Migration, QA, UAT, Backup, Rollback และ Release

### 2.2 หลักการที่ล็อกแล้วสำหรับ v0.1

- ใช้ Project-first flow: สินค้าต้องอยู่ใน Project และพร้อมสั่งก่อนสร้าง Order
- สินค้าใน Catalog และสินค้านอก Catalog ใช้คนละเส้นทางตามประเภทงาน
- การรับเงินใช้ Bank Transfer นอกระบบ แล้วบันทึกหลักฐานใน GISP
- Member เป็นผู้ส่งรายการโอนและหลักฐาน; Finance เป็นผู้ตรวจและยืนยัน
- ไม่ใช้ Stripe, Payment Gateway, Bank API หรือการตัดบัตรใน v0.1
- Production เปิดตามลำดับ `C → D7 → D8 → D9 → D10`
- ทุก Production Gate ต้องมี Release Authorization ที่ระบุ Production โดยตรง

---

## 3. สถานะเริ่มต้นที่ยืนยันแล้ว

- Production ปัจจุบันเป็น Release B Member Pilot และยังไม่เปิด Order/Payment จริง
- Slice 1–10 และ Slice 13 มี implementation/หลักฐาน Development เดิม แต่ยังไม่เท่ากับ Full-flow Production acceptance
- Release C candidate เดิมยังไม่พร้อม Production เพราะมี Security/Authorization hardening ที่ต้องรวมและ QA ใหม่
- Backend Child `rlc-harden-01-rehearsal-20260920` ID `41df0506-ef0a-4753-9426-b1c8ed4f9ff6` มี Ghost Schedule ID `aefecf8b-5b02-4649-a9b2-47aa448af0e8` ที่ยัง active และชี้ Production host `m8ugbyak` จึงห้ามใช้เป็น Full-flow Staging และห้าม Apply Migration/สร้างข้อมูลจนกว่า Independent QA จะยืนยันว่าปลอดภัย หลักฐาน `docs/evidence/2026-09-20-rlc-harden-01-backend-rehearsal.md` อยู่บน unmerged branch `codex/rlc-harden-01` commit `d1005f918e2824dee782cf64a8ded431730c30cb`; สถานะ backend ตรวจซ้ำแบบ read-only ใน automation `ghost-schedule`
- Working tree `development` มีงาน Admin Staff Rename ที่ยังไม่รวมและไม่ทราบเจ้าของ จึงห้ามนำ working tree ปัจจุบันไปสร้าง Release Candidate โดยตรง
- Environment Registry ปัจจุบันรับรองระบบถาวรเพียง Production และ Development; Staging ในแผนนี้จึงเป็น Temporary Sandbox ไม่ใช่ระบบถาวร

---

## 4. ขอบเขต

### 4.1 Must Have

1. **Member และองค์กร**
   - Signup, email verification, onboarding, approval, login, suspension และการปฏิเสธบัญชี inactive
   - Role และข้อมูลต้องแยกตามองค์กร; ผู้ใช้หนึ่งองค์กรห้ามอ่านหรือแก้ข้อมูลอีกองค์กร

2. **สินค้าใน Catalog**
   - Member เลือกสินค้าที่ Published และมี Active Member Price
   - เพิ่มสินค้าเข้า Project กำหนดจำนวน/ตัวเลือก และเปลี่ยนเป็น `READY_TO_ORDER`
   - สร้าง Order โดย Snapshot ราคา VAT สเปก ตัวเลือก และ Supplier ณ เวลาสั่ง

3. **สินค้านอก Catalog**
   - สินค้าสำเร็จรูปที่หาไม่พบ: ใช้ Product Sourcing Request พร้อมรูป/รายละเอียด; Candidate ที่เลือกต้องผ่าน Product Lifecycle ก่อนเข้า Catalog แล้วจึงเพิ่มเข้า Project
   - งานผลิตใหม่ ปรับแบบ หรือมี Drawing/เอกสารสเปก: ใช้ Custom RFQ พร้อมไฟล์แนบ → Admin Review → Versioned Quotation → Member Accept → Project/Order
   - ห้ามสร้าง Product Published จากไฟล์หรือภาพโดยข้าม Product Lifecycle

4. **Customer Order และ Supplier Order**
   - Order หนึ่งรายการรองรับหลายโรงงาน และแยก Supplier Order ตาม Supplier
   - ป้องกัน `project_item_id` ซ้ำและการสร้าง Order/PO ซ้ำแบบ atomic
   - ข้อมูลต้นทุน Supplier และ Internal Note ต้องไม่รั่วไปยัง Member

5. **การรับเงินจาก Member แบบ Manual/Offline**
   - ระบบสร้าง Deposit/Balance schedule ตามกฎ 50/50 และ Freight แยกต่างหาก
   - Member โอนเงินจริงนอกระบบและอัปโหลดหลักฐานผ่าน GISP
   - Finance เปิดหลักฐาน ตรวจยอดสะสม และกด Verify/Reject พร้อม Audit
   - Partial payment คงสถานะรอรับเพิ่ม; Overpayment เข้าคิวตรวจ; PO เปิดได้เมื่อ Deposit Verified ครบเท่านั้น
   - **Proposed gap requiring explicit Scope Approval:** Verified payment ห้ามแก้ตรง; หากบันทึกผิดให้ใช้ Adjustment/Reversal ที่เชื่อมกับรายการเดิมและมี Audit ตามข้อ 6.4

6. **Supplier Payment และ PO Gate**
   - Purchasing ออก PO ได้หลัง Deposit Gate ผ่าน
   - Supplier Deposit/Balance แยกจากยอด Member และเห็นเฉพาะผู้มีสิทธิ์
   - **Proposed gap requiring explicit Scope Approval:** ผู้สร้าง Supplier Payment กับผู้อนุมัติจ่ายต้องเป็นคนละคน พร้อมหลักฐานและประวัติที่ตรวจย้อนหลังได้

7. **Production, QC และ Member Approval**
   - ติดตาม Production status, QC result, Rework และหลักฐาน
   - Custom Product ต้องให้ Member อนุมัติตามกฎก่อน Dispatch
   - Dispatch Gate ต้องตรวจ QC, Member approval, Balance และเอกสารที่เกี่ยวข้องครบ

8. **Warehouse, Shipment, Delivery และ Freight**
   - รองรับ Consolidation, Customs, Shipment milestones, Delivery/POD และการปิด Order
   - Freight Invoice และ Freight Payment แยกจากราคาสินค้า
   - Order เสร็จสมบูรณ์ได้เมื่อ Gate การเงินและการส่งมอบผ่านครบ

9. **Claim และ Report**
   - Member เปิด Claim กับ Delivered Item ได้ พร้อมหลักฐานและ Warranty Snapshot
   - Admin ตัดสินความรับผิดชอบและ Resolution โดยไม่มี Automatic Compensation
   - Dashboard/Report ต้องใช้ข้อมูลจริงตามสิทธิ์และ Reconcile กับธุรกรรมต้นทางได้

10. **Security, Recovery และ Operations**
    - ปิดช่องโหว่ scoped staff, inactive staff, direct RPC และ cross-organization access
    - Private files ต้องเปิดผ่าน authorized server path และไม่เผย key/secret ใน log
    - Backup, restore rehearsal, emergency stop, resume และ reconciliation ต้องผ่านบน exact candidate

### 4.2 Should Have

- แจ้ง Member เมื่อ Finance Verify/Reject, Order เปลี่ยน milestone, ต้องอนุมัติ QC หรือมี Invoice ใหม่
- Warning เลขอ้างอิงธนาคารซ้ำ โดยไม่เปิดเผยข้อมูลข้ามองค์กร
- Operations dashboard สำหรับรายการค้างและ SLA ภายใน

### 4.3 Out of Scope สำหรับ v0.1

- Payment Gateway, Credit Card, Stripe หรือ Bank API
- Finance สร้าง payment transfer แทน Member เป็นช่องทางปกติ
- AI image search, AI quotation, PDF Catalog worker หรือ automation ที่ไม่จำเป็นต่อ Full Order Flow
- เปลี่ยนสูตรราคา Margin VAT Deposit/Balance หรือ Freight rules
- เปิด Public Marketplace หรือ Checkout สำหรับลูกค้าของ Member
- เปลี่ยน Staging เป็นระบบถาวร
- แก้หรือลบ Production ก่อนมี Production Release Authorization

---

## 5. User Flow ที่ต้องส่งมอบ

### Flow A — สินค้าใน Catalog

`Signup → Member Approval → Catalog → Project → READY_TO_ORDER → Order → Deposit Transfer + Slip → Finance Verify → PO → Production/QC → Balance Transfer + Slip → Finance Verify → Shipment/Delivery → Freight Payment → Completed`

### Flow B — สินค้าสำเร็จรูปที่หาไม่พบ

`Product Sourcing Request + รูป → GISP เสนอ Candidate → Member เลือก → Product Lifecycle/Publish → Project → Flow A`

### Flow C — งานผลิตใหม่หรือปรับแบบ

`Custom RFQ + เอกสาร → Review → Versioned Quotation → Member Accept → Project/Order → Deposit → PO → Production/QC/Rework → Member Approval → Balance → Shipment/Delivery → Freight Invoice → Freight Transfer + Slip → Finance Verify → Completed`

### Flow D — Claim หลังส่งมอบ

`Delivered Item → Member Claim + Evidence → Admin Review → Responsibility Decision → Resolution/Reject → Audit + Report`

---

## 6. การชำระเงินที่ใช้จริงใน v0.1

### 6.1 ช่องทาง

- เงินเคลื่อนผ่านบัญชีธนาคารบริษัทนอก GISP
- GISP ทำหน้าที่สร้าง Invoice/Schedule รับสลิป เก็บประวัติ และควบคุม Gate
- GISP ไม่ยืนยันจากธนาคารอัตโนมัติ; Finance ต้องตรวจเงินจริงก่อน Verify

### 6.2 ผู้รับผิดชอบ

- Member: เลือกงวด กรอกยอด/วันโอน และอัปโหลดหลักฐาน
- Finance: เปิดหลักฐาน ตรวจยอดเงินจริง และ Verify/Reject
- Purchasing: ออก PO หลัง Deposit Gate ผ่าน
- ระบบ: รวมยอด ป้องกันการใช้หลักฐานผิด Order เก็บ Audit และไม่เปิด Gate ก่อนเงื่อนไขครบ

### 6.3 กรณีผิดปกติ

- ไม่มี/เปิดไฟล์ไม่ได้/ไฟล์เปลี่ยน: ห้าม Verify
- ยอดไม่ครบ: คงสถานะ Partial และห้ามเปิด Gate
- ยอดเกิน: `OVERPAYMENT_REVIEW`; ห้ามถือว่า Gate ผ่านโดยอัตโนมัติ
- หลักฐานซ้ำหรือเลขอ้างอิงซ้ำ: แจ้งเตือนและให้ Finance ตรวจ; ห้าม Auto-merge
- Verify ผิด: ห้ามแก้ยอดหรือสถานะของรายการเดิมโดยตรง; ใช้กฎที่เสนอในข้อ 6.4 เมื่อได้รับ Scope Approval แล้ว

### 6.4 Proposed Financial Controls — ต้องอนุมัติพร้อม Scope

1. **Payment Adjustment/Reversal**
   - เก็บ Verified transaction เดิมแบบแก้ไขไม่ได้
   - สร้างรายการแก้กลับที่อ้างอิง transaction เดิม ระบุเหตุผล ผู้ดำเนินการ ผู้อนุมัติ และเวลา
   - คำนวณยอดสะสมและ Order Gate ใหม่จาก transaction เดิมรวมรายการแก้กลับ
   - หากออก PO หรือเข้าสู่ Production แล้ว ให้หยุด workflow และส่ง Finance + Order Admin ตัดสินตาม Incident Runbook ห้ามเปิด Gate ต่ออัตโนมัติ
   - ผู้ดำเนินการต้องมี permission เฉพาะ; Member และ Staff ที่ไม่มีสิทธิ์ต้องเรียก API/RPC นี้ไม่ได้
2. **Supplier Payment maker/checker**
   - ผู้สร้าง/แนบหลักฐาน Supplier Payment ห้ามเป็นผู้อนุมัติรายการเดียวกัน
   - ผู้อนุมัติต้องมี permission ในองค์กรของ Supplier Order และระบบต้องเก็บ Audit ทั้งสองคน
   - หากทีมจริงมีคนไม่พอ ต้องหยุดและขอ Owner เปลี่ยนกฎเป็นลายลักษณ์อักษร; ห้ามลด safeguard ระหว่างใช้งาน

---

## 7. Temporary Staging

### 7.1 รูปแบบ

- เสนอใช้ InsForge top-level project แบบชั่วคราวที่มี Auth, key, JWT, Storage, secrets, schedules และ deployment แยกจริง โดยถือเป็น Temporary Resource ภายใต้แผน Development ไม่ใช่ระบบถาวรระบบที่สามตาม ENV2-v0.1
- การสร้าง Project และค่าใช้จ่ายเป็นข้อยกเว้นที่ต้องระบุชื่อ Project, งบ/เพดานค่าใช้จ่าย, owner และอายุใช้งานใน Scope Approval + Implementation Authorization ก่อนดำเนินการ
- เมื่อได้รับอนุมัติให้สร้างแล้ว ต้องเพิ่มรายการ Temporary Resource พร้อมอายุและ owner ใน Environment Registry โดยไม่เพิ่มเป็นระบบถาวร
- ห้ามใช้ Child ที่มี Ghost Schedule เป็น Full-flow Staging
- ใช้ข้อมูลสังเคราะห์เท่านั้น ห้าม clone Production PII หรือข้อมูลการเงินจริง
- ใช้อีเมลทดสอบ/sink เท่านั้น; Schedule ต้องเริ่ม inactive และเปิดได้หลังตรวจ URL, host, secret และ recipient แล้ว
- Config ด้าน security/upload/password ต้องเทียบ Production แต่ใช้ redirect/domain ของ Staging เท่านั้น

### 7.2 อายุการใช้งาน

- เก็บ Staging ถึง 14 วันปฏิทินหลัง Production D10 Go Live เพื่อวิเคราะห์ปัญหาและตรวจหลักฐาน
- หากมี Incident ที่ยังไม่ปิด ให้ออก Extension Record ก่อนครบกำหนด
- เมื่อครบกำหนด ให้เสนอรายการทรัพยากรและผลกระทบเพื่อขอ Deletion Authorization แยกก่อนลบ
- การลบ Staging ไม่ลบ Production, Member, Project, Order, Payment หรือหลักฐาน Production

### 7.3 สิ่งที่ต้องตรวจเพื่อป้องกันชี้ข้ามระบบ

- Domain/host, project ID, API key/JWT, storage bucket, email recipient, function URL และ schedule target
- ตรวจทั้ง URL, header และ body ว่าไม่มี Production marker
- Fail closed เมื่ออ่าน schedule/config ไม่ครบ หรือ identity ไม่ตรง

---

## 8. แนวทาง Implementation

### Phase 0 — Baseline และ Approval

- ตรึง Source of Truth, Production/Development fingerprint และเจ้าของไฟล์ที่แก้ค้าง
- สร้าง isolated Git worktree จาก commit ที่อนุมัติ; ไม่รวม dirty Admin Staff Rename โดยอัตโนมัติ
- บันทึก Scope Approval และ Implementation Authorization ให้ครบก่อน Builder เริ่ม

### Phase 1 — Security และ Transaction Foundation

- รวม RLC-HARDEN: scoped staff authorization, inactive staff denial, duplicate order prevention และ direct-RPC protection
- รวม Payment Evidence Binding, private executor, tenant checks และ Audit; เพิ่ม Adjustment/Reversal และ Supplier maker/checker เฉพาะเมื่อ Scope Approval อนุมัติ Proposed Financial Controls ข้อ 6.4
- รักษากฎราคาและ Manual Payment เดิม; ไม่เพิ่ม Gateway

### Phase 2 — Full-flow Candidate

- ตรวจและเติมช่องว่างของ Catalog/Project, Sourcing, RFQ/Quotation, Order/Payment/PO, Production/QC, Shipment/Delivery, Claim และ Reports
- ทุกการเปลี่ยนต้องเป็น vertical slice พร้อม UI, API/service, data permission, error handling และ test
- สร้าง Candidate Manifest ระบุ commit/tree, migration allow-list พร้อม SHA-256, config allow-list และ feature flags

### Phase 3 — Provision Temporary Staging

- ขออนุมัติ Project/cost ก่อนสร้าง External Resource
- สร้าง isolated environment, apply เฉพาะ migration allow-list และ seed เฉพาะ synthetic fixture
- สร้าง backup ก่อน migration หลัง migration และก่อน/หลัง UAT ตาม runbook

### Phase 4 — Full-flow Staging UAT

- ทดสอบ Flow A–D ด้วยหลายองค์กรและทุกบทบาทที่เกี่ยวข้อง
- ทดสอบ negative boundary, direct API/RPC, confidential file, schedule isolation และ data reconciliation
- ซ้อม emergency stop → no-write delta → reconcile → resume และ restore

### Phase 5 — Exact Candidate QA และ Owner UAT

- รัน focused tests, full regression, typecheck, optimized build, migration/hash/ACL checks และ browser user flow บน candidate เดียวกัน
- Independent QA ต้องไม่มี Blocker; Major ต้องแก้หรือมี Owner Risk Acceptance เป็นลายลักษณ์อักษร
- Owner UAT ยืนยัน Flow หลักและ Known Risks ก่อนขอ Production Release

### Phase 6 — Production Staged Release

- สร้าง backup ใหม่และตรวจ restore/rollback ก่อนแต่ละ Production Gate
- เปิด Release C ก่อน แล้วติดตาม Transaction จริงตาม monitoring window ที่อนุมัติ
- เปิด D7 → D8 → D9 → D10 ตามลำดับ โดยแต่ละ Gate มี Release Authorization, smoke test และ rollback decision ของตัวเอง
- ห้าม `migrations up --all`; Apply เฉพาะ allow-list/hash ที่ตรงกับ exact candidate

### Phase 7 — Stabilization และ Staging Retirement

- ติดตาม error, permission denial, payment mismatch, duplicate, schedule, notification และ reconciliation
- ปิด Incident/Known Risk หรือบันทึก Owner Acceptance ตามระดับ
- หลัง Go Live 14 วัน ขออนุมัติลบ Temporary Staging และเก็บเฉพาะหลักฐานที่ไม่มี secret

---

## 9. Public Interface / Data Changes ที่คาดหมาย

Implementation ต้องพยายาม Reuse ของเดิมก่อน การเพิ่มจริงต้องยืนยันจาก Gap Analysis และอยู่ใน Candidate Manifest

- คง Member payment submission และ Finance verification interfaces เดิมเป็นหลัก
- Proposed: เพิ่ม Adjustment/Reversal interface แบบ append-only ตามข้อ 6.4 หลังได้รับ Scope Approval
- เพิ่ม organization-bound authorization ใน API/RPC ที่ใช้ Admin Client หรือ private executor
- เพิ่ม idempotency/uniqueness guard สำหรับ Customer Order, Supplier Order, PO และ payment action ที่เสี่ยงสร้างซ้ำ
- เพิ่ม release/config attestation เพื่อให้ route และ background job fail closed เมื่อ Release Stage หรือ Environment identity ไม่ตรง
- ห้ามเพิ่ม schema/permission/migration นอก allow-list และห้ามเปลี่ยนราคาหรือสูตรโดยปริยาย

---

## 10. Acceptance Criteria

| ID | เกณฑ์ผ่าน |
| --- | --- |
| `FFGL-AC-001` | Staging แยก URL, ID, key/secret, storage, email, schedule และข้อมูลจาก Production และไม่มี target ชี้ข้ามระบบ |
| `FFGL-AC-002` | Signup, verification, onboarding, approval, login และ suspension/inactive denial ผ่าน |
| `FFGL-AC-003` | Standard Catalog → Project → READY_TO_ORDER → Order พร้อม Snapshot ผ่าน และรายการซ้ำถูกปฏิเสธแบบ atomic |
| `FFGL-AC-004` | Product Sourcing และ Custom RFQ/Attachment → Versioned Quotation → Accept → Order ผ่านตามคนละเส้นทาง |
| `FFGL-AC-005` | Customer Order แยก Supplier Order ถูกต้อง ไม่สร้างซ้ำ และไม่รั่ว Supplier/cost/internal data |
| `FFGL-AC-006` | Manual Deposit/Balance รองรับ Partial, Exact, Overpayment และ Reject; หากอนุมัติ Proposed Financial Controls ต้องผ่าน Adjustment/Reversal แบบ append-only พร้อม Audit |
| `FFGL-AC-007` | PO เปิดไม่ได้ก่อน Deposit Verified ครบ; Supplier Payment แยกจาก Member และหากอนุมัติ Proposed Financial Controls ต้องผ่าน permission/maker-checker |
| `FFGL-AC-008` | Production, QC, Rework, Custom Member Approval และ Dispatch Gate ผ่านครบ |
| `FFGL-AC-009` | Warehouse, Customs, Shipment, Delivery/POD และ milestone reconciliation ผ่าน |
| `FFGL-AC-010` | Freight Invoice/Payment แยกจากราคาสินค้า และ Completed Gate ถูกต้อง |
| `FFGL-AC-011` | Claim และ Fixed Reports ผ่าน permission, confidentiality และ reconciliation |
| `FFGL-AC-012` | Cross-organization, scoped staff, inactive user, direct RPC และ confidential file tests ปฏิเสธได้ถูกต้อง |
| `FFGL-AC-013` | Backup, restore, emergency stop, no-write delta, reconcile และ resume ผ่านบน exact candidate |
| `FFGL-AC-014` | Full regression, typecheck, build, Full-flow UAT และ Independent QA ผ่านโดยไม่มี Blocker |
| `FFGL-AC-015` | Production เปิดตามลำดับ C → D7 → D8 → D9 → D10 และ smoke/monitoring ผ่านทุก Gate |

---

## 11. Test Matrix ขั้นต่ำ

- **Happy path:** Flow A, B, C และ D จบครบหนึ่งรอบ
- **Scale sanity:** Member ประมาณ 20 คนจากหลายองค์กรสร้าง Project/Order โดยข้อมูลไม่ปะปน
- **Roles:** Member, Member Admin, Product/Sourcing, Order Admin, Finance, Purchasing, Production, QC, Logistics, Claim และ Report
- **Tenant/security:** อ่าน/แก้ข้ามองค์กร, เดา ID, direct RPC, inactive user, revoked session, unauthorized file และ Admin Client path
- **Payment:** ไม่มีไฟล์, corrupted/mutated/reused evidence, partial, exact, overpayment, reject, duplicate reference และ concurrent verify; เพิ่ม adjustment/reversal เมื่อข้อ 6.4 ได้รับอนุมัติ
- **Order/PO:** project item ซ้ำ, request retry, concurrent submit, PO ก่อน Deposit, Supplier split และ snapshot immutability
- **Operations:** QC fail/rework, Custom approval reject, balance missing, dispatch blocked, partial shipment, POD missing และ freight unpaid
- **Recovery:** schedule isolation, notification retry, emergency stop, rollback/restore และ reconciliation หลัง recovery
- **Regression:** existing Release B catalog/project flow, permission, typecheck และ optimized build

---

## 12. Release Gate, Monitoring และ Rollback

แต่ละ Production Gate ต้องมีข้อมูลต่อไปนี้ก่อน Owner อนุมัติ:

- exact commit/tree และ deployment candidate
- migration/config allow-list พร้อม hash
- backup/restore point ที่ใหม่พอและผลตรวจสถานะ
- QA/UAT evidence ต่อ Acceptance Criteria
- ผู้รับผิดชอบ Finance, Order/Purchasing, QC, Logistics และ Incident decision
- monitoring window, stop conditions และ rollback command/runbook

### Stop Conditions

- มี cross-organization access หรือ confidential data leakage
- Payment/Order/PO reconciliation ไม่ตรง หรือเกิดรายการซ้ำ
- Migration hash, environment ID, schedule target หรือ candidate ไม่ตรง manifest
- Backup/rollback/restore ใช้งานไม่ได้
- Blocker จาก Independent QA หรือ Production smoke test
- ต้องขยาย scope, เปลี่ยนกฎราคา/เงิน, เพิ่มค่าใช้จ่าย หรือแตะ Production เกิน Approval Record

เมื่อเกิด Stop Condition ให้หยุด write traffic/feature ตาม runbook เก็บหลักฐาน และขอคำตัดสินใหม่ ห้ามแก้ Production แบบ ad hoc

---

## 13. ความเสี่ยงที่ต้องติดตาม

| ระดับ | ความเสี่ยง | วิธีควบคุม |
| --- | --- | --- |
| Blocker | Scoped staff หรือ Admin Client ข้ามองค์กร | RLC-HARDEN + direct API/RPC negative tests + Independent QA |
| Blocker | Schedule/secret ชี้ Production จาก Staging | Isolated identity, inactive-by-default, complete snapshot guard และ fail closed |
| Blocker | Order/PO/Payment ซ้ำหรือยอดไม่ตรง | atomic/idempotency guard และ reconciliation ก่อนเปิด Gate |
| Major | Manual Payment ไม่พิสูจน์เงินเข้าธนาคารอัตโนมัติ | Finance ตรวจบัญชีจริงก่อน Verify และเก็บ Audit |
| Major | Restore point เก่ากว่าข้อมูล Member/Transaction | backup ใหม่ก่อน release และกำหนด reconciliation/restore owner |
| Major | เปิด Full Flow พร้อมกันทำให้ rollback ยาก | ปล่อย C → D7 → D8 → D9 → D10 ทีละ Gate |
| Minor | UX/notification บางจุดไม่ชัด | แก้ก่อน Slice ที่เกี่ยวข้องหรือบันทึก Owner acceptance พร้อมผู้รับผิดชอบ |

---

## 14. Approval Records

### 14.1 Authorization สำหรับจัดทำเอกสารฉบับนี้

- `approval_level`: Documentation only — ไม่ใช่ Scope/Implementation/Release Approval
- `approved_by`: ภคภพ ช.เจริญยิ่ง
- `approval_text_or_reference`: “ทำเอกสาร `FULL-FLOW-GO-LIVE-01 v0.1` ตามที่ได้วางแผนมาได้เลย”
- `scope_document_version`: `FULL-FLOW-GO-LIVE-01 v0.1`
- `environment`: Local documentation on branch `development`
- `data_migration_authorized`: No
- `production_allowed`: No
- `approved_at`: `2026-09-20T22:03:37.1959602+07:00`

### 14.2 Scope Approval — Approved

บันทึกการอนุมัติอยู่ที่ `docs/GISP-APR-FULL-FLOW-GO-LIVE-01-LOCAL-IMPLEMENTATION-20260920-v1.0.md`
และครอบคลุม:

- ขอบเขต Must Have / Out of Scope
- Manual/Offline Payment ตามข้อ 6
- Proposed Financial Controls ข้อ 6.4: Adjustment/Reversal แบบ append-only และ Supplier Payment maker/checker คนละคน
- Temporary Staging และระยะ 14 วัน
- Production staged release C → D7 → D8 → D9 → D10
- งบประมาณ/ค่าใช้จ่าย External Resource ยังต้องเสนอจำนวนจริงก่อนสร้าง

### 14.3 Implementation Authorization — Approved for Local isolated worktree only

ขอบเขตที่อนุมัติ:

- isolated worktree/branch และขอบเขต component
- Local isolated worktree เท่านั้น; Temporary Staging ยังไม่อนุญาต
- สร้าง migration files และ Local synthetic fixtures ได้ แต่ห้าม Apply/เขียน Backend
- external project/deployment/schedule/storage/email authority: `No`
- `production_allowed: No`

### 14.4 Release Authorization — Pending และแยกทุก Production Gate

Release C, D7, D8, D9 และ D10 ต้องมี Approval Record ของตัวเองหลัง exact candidate ผ่าน QA/UAT
โดยระบุ Production, migration/config, backup, rollback, monitoring window และผู้รับผิดชอบโดยตรง

---

## 15. Definition of Done

`FULL-FLOW-GO-LIVE-01` ปิดได้เมื่อ:

- Acceptance Criteria `FFGL-AC-001` ถึง `FFGL-AC-015` ผ่าน
- ไม่มี QA Blocker และ Major ถูกแก้หรือมี Owner Risk Acceptance ที่ถูกต้อง; Minor ที่เลื่อนต้องมี owner, กำหนดเสร็จ และ Owner Acceptance ชัดเจน
- Production เปิดถึง D10 ตามลำดับและ post-release smoke/monitoring ผ่าน
- Manual Payment ใช้งานกับเงินจริงได้โดย Finance ตรวจและ Audit ครบ
- Backup/Rollback/Recovery พร้อมและหลักฐานไม่เผย secret
- เอกสาร Active, Candidate Manifest, UAT และ Operations Runbook สอดคล้องกับระบบจริง

ก่อนถึงเงื่อนไขทั้งหมด ห้ามรายงานว่า “พร้อมใช้งานครบทุกขั้นตอนบน Production”

---

## 16. ลำดับขั้นตอนคงเหลือเพื่อปิด Slice

เหลือ **7 milestones** (ไม่ใช่ 7 Approval Records):

1. Owner อนุมัติ Scope `FULL-FLOW-GO-LIVE-01 v0.1` และ Manual Payment rule
2. ยืนยัน Temporary Staging, ค่าใช้จ่ายจริง และ Implementation Authorization
3. Builder สร้าง isolated exact candidate รวม Security/Transaction hardening และ Full-flow gaps
4. Apply allow-list/seed synthetic data บน Staging และทำ Full-flow UAT/Recovery rehearsal
5. Independent QA และ Owner UAT ผ่านบน candidate เดียวกัน
6. ขอ Release Authorization และเปิด Production ทีละ Gate: `6C` Release C → `6D7` → `6D8` → `6D9` → `6D10`; แต่ละ Gate เป็น Approval Record และ smoke/rollback decision แยกกัน
7. ติดตาม Stabilization 14 วัน แล้วขออนุมัติ retire Temporary Staging

---

## 17. Source of Truth References

- `docs/active/MVP BUSINESS MASTER PLAN.md`
- `docs/active/MVP IMPLEMENTATION PLAN.md`
- `docs/active/STAGED PRODUCTION RELEASE PLAN.md` — DEC-049
- `docs/active/ENVIRONMENT REGISTRY.md` — ENV2-v0.1
- `docs/active/PRODUCTION OPERATIONS RUNBOOK.md`
- `docs/GISP-RELEASE-CD-GO-LIVE-READINESS-20260919-v0.1.md`
- `docs/GISP-RELEASE-C-CONTROLLED-PILOT-PACKAGE-20260919-v0.1.md`
- `docs/GISP-SECURITY-ADVISOR-TRIAGE-20260919-v0.1.md`
