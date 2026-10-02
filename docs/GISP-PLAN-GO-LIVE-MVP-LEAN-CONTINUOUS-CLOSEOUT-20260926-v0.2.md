# GO-LIVE-MVP-INITIAL-OPERATIONS-01 — แผนปิด Go Live ต่อเนื่องแบบ Lean v0.2

สถานะ: **ร่างที่ QA ยังไม่ให้ผ่าน — ห้ามใช้อ้างอนุมัติหรือ Execute**; ยังขาดคำตัดสินของเจ้าของว่าจะใช้ผล Development สำหรับขั้นตอนหลัง Order แทน Staging หรือทำ Staging full flow ต่อ รวมถึงต้องแก้ Recovery runner ให้ผูก backup หลัง #13 เอกสารนี้ยังไม่ใช่สิทธิ์เขียน Staging หรือ Production และไม่แก้ย้อนหลังเอกสารหรือผลทดสอบเดิม

## 1. สิ่งที่เจ้าของตัดสินใจแล้ว

ภคภพ ช.เจริญยิ่ง ตอบในแชตวันที่ 2026-09-26 ว่า “ข้อ 1 ยอมลด / ข้อ 2 ยอมกรอกครั้งเดียว” ต่อคำถามที่ระบุชัดว่า (1) ใช้ Member ทดสอบเดิม 1 คนส่ง 2 คำขอสร้าง Order พร้อมกันแทน Staging 20 คน × 2 คำขอ และนำผลทดสอบส่วนที่ไม่เปลี่ยนมาใช้ต่อเมื่อ Independent QA ยืนยันความเพียงพอ (2) หากไม่มี session เดิม ยอมกรอกรหัสรีเซ็ตอีเมลใหม่ **ไม่เกินหนึ่งครั้ง** เฉพาะ Member 01; ไม่รีเซ็ตอีก 4 บัญชีและไม่ส่งซ้ำเมื่อผลไม่ชัด นี่เป็นการตัดสินใจด้าน Scope/วิธีพิสูจน์ ไม่ใช่ Production Release Authorization

เป้าหมายยังเป็น Lean Scope v0.2: Catalog, Project/Custom RFQ, Order, ลูกค้าโอนภายนอกและ Finance ตรวจสลิปด้วยมือ, Production/QC, Warehouse, Shipment, Delivery; Supplier Payment และ business notification ทำภายนอก ไม่เพิ่มฟีเจอร์ ระบบ Auth หรือ Migration

## 2. ฐานที่ตรวจแล้ว ไม่ทำซ้ำ

| หลักฐาน | สถานะ |
| --- | --- |
| Candidate | commit `2317e60e013c16b907732368d195afd39fc7e64c`, tree `fdfebb1f6e5e1672bfcdd48a9bb331db74ed3bce`, [manifest](../release-candidates/go-live-mvp-initial-operations-01-lean-order-fix/CANDIDATE-MANIFEST.md) SHA-256 `39F64745F6DCA2F66B092474521E4F19CC9FFC2FF592B85A193CBA380DFB899C`. Diff จาก app commit `6280c52d72c1182e40f7963c6255b218559b7615` มีเฉพาะ Migration #13, manifest/mirror และ test; **ไม่มี app runtime source เปลี่ยน** |
| Local | Independent QA ผ่าน `npm run check`: 677/677 tests, typecheck/build; ไม่รันซ้ำถ้า candidate ไม่เปลี่ยน |
| Staging | Project `a24aff68-a82e-41da-b64a-a128a1539769`, host `5wjnzj4y`, region `ap-southeast`; SMTP ปิด, Active Schedule 0 ตาม post-Apply QA |
| Migration | #13 `20260926150000_order-cost-version-snapshot.sql` SHA-256 `F35C9192B89FE6DA4A011AEB574BF08C6924C3264E5415DFD51B048E1E5B8DDE` Apply บน Staging **แล้วหนึ่งครั้ง**; history 39/head #13; QA ยืนยัน function body และ ACL แต่ยังไม่ใช่ runtime UAT `GO` |
| Backup | `glmvp-pre-order-cost-v2-20260926` ID `c20d2f88-2d93-460a-941c-f74166a0b449` `completed` สร้างก่อน #13; ไม่ใช้เป็น Restore ของการทดสอบหลัง #13 เพราะจะเอา #13 และข้อมูลที่สร้างภายหลังออก |
| UAT เดิม | เก็บ Development/Local/Staging PASS ที่ผูกกับโค้ดและกฎเดิมไว้; QA ทำ evidence matrix หนึ่งครั้งว่าอะไรไม่ stale อะไรยังไม่ผ่าน ห้ามเติม `PASS` จากความคาดหวัง |
| Order หลังแก้ | ยังไม่มีผล Order จริงหลัง #13; Custom Request ทดสอบ `28aa7b00-41cd-47c3-8b2f-8fe2193b1a8d` เป็น `CONVERTED` และอ่านกลับพบ Order ที่เกี่ยวข้อง 0 รายการ |

## 3. ขั้นตอน Go Live ที่ 1 — ปิด Staging โดยไม่เริ่ม UAT ใหม่ทั้งชุด

### 3.1 เตรียมงานครั้งเดียว

- ใช้ Local isolated worktree เดิม branch `codex/full-flow-go-live-01` แก้ได้เฉพาะ Local ignored UAT runner/tests/checkpoint/seal ที่จำเป็นต่อ **Member 01 หนึ่งบัญชีและ Order proof นี้** ไม่แก้แอป, Migration, pricing, role/permission หรือ fixture เดิม ผู้แก้และ QA ต้องเป็นคนละบทบาท; reseal เฉพาะเมื่อไฟล์ runner เปลี่ยน
- ตรวจ Staging identity/candidate/runtime attestation, history head #13, fixture เดิม, Billing ตามเพดาน Staging เดิม, SMTP=false, Schedule=0, backup และ absence ของ Order เป้าหมายแบบอ่านอย่างเดียวก่อน mutation หากไม่ตรงให้ reconcile แบบอ่านอย่างเดียว; ไม่สร้างรายการเดิมซ้ำ
- ตรวจว่ามี Member 01 session ที่ยืนยัน Auth User ID/role/Organization และยังใช้ได้จริงหรือไม่ ห้ามนำรหัส/session r11 จาก checkpoint มาอ้าง เพราะไม่ได้ถูกเก็บไว้

### 3.2 เข้าใช้ Member 01 โดยไม่วนกรอกรหัส

- ถ้า session เดิมใช้ได้ ให้ใช้ session นั้นและ **ไม่ส่ง reset email**
- ถ้าไม่มี ให้ส่ง reset email จาก Staging **ครั้งเดียว** ไปยัง alias Member 01 ที่อนุมัติไว้เท่านั้น ผู้ใช้กรอกรหัสหกหลักในหน้า Local loopback ไม่ส่งรหัสในแชต; ตรวจ exact alias/User ID/verified state ก่อนและหลัง รหัสที่ผิด/หมดอายุหรือผลส่งไม่ชัด = หยุด ห้ามส่งซ้ำเอง
- เพื่อไม่ต้องรีเซ็ตอีกหาก process สะดุด หน้า Local ให้ผู้ใช้กำหนด **รหัสผ่านใหม่สำหรับบัญชีสังเคราะห์นี้เท่านั้น** และเก็บไว้เองอย่างปลอดภัย; runner ใช้รหัสในหน่วยความจำ ไม่เขียนไฟล์/log/checkpoint/chat ถ้าต้องเริ่ม process ใหม่ ผู้ใช้กรอกรหัสผ่านเดิมในหน้า Local ได้โดยไม่ขอ OTP อีก ห้ามใช้รหัสผ่านจริงหรือรหัสที่ใช้กับบริการอื่น; Local tests/QA ต้องพิสูจน์ว่าไม่มี secret หลุด

### 3.3 พิสูจน์ส่วนที่เปลี่ยนจริง

- ใช้ Project/Catalog item เดิมที่ยัง `READY_TO_ORDER` ส่ง create Order **สองคำขอพร้อมกันหนึ่งชุด** ภายใต้ Member 01 คนเดิม; ไม่ยิงซ้ำเมื่อผลลัพธ์ไม่แน่ชัด อ่านกลับจาก Staging ต้องมี Order ไม่เกินหนึ่ง, child rows ไม่ซ้ำ, คำขอที่แพ้เป็น conflict/error ที่ระบบเดิมจัดการได้
- ตรวจ Order snapshot, ราคาที่ Project item เลือก, cost-version ที่ราคาผูกไว้, Supplier Order cost เป็นบวก/CNY และยอด Order/Deposit/Balance เทียบข้อมูลจริง ไม่ใช้ตัวเลข inventory เป็นผลทดสอบ หากยังเกิด `SUPPLIER_COST_REQUIRED` หรือยอดไม่ตรงให้ QA `NO-GO`
- ใช้หลักฐาน cross-org/role/private-file/finance และ flow อื่นที่ผ่านแล้วต่อเมื่อ QA ยืนยันว่าไม่ stale กับ candidate นี้ ถ้า negative ของ Order ใหม่ยังขาด ให้ทำเฉพาะ read/negative case ที่จำเป็นและยืนยันก่อน–หลังว่าไม่มีข้อมูลเปลี่ยน ไม่รีเซ็ตอีกสี่บัญชีเป็นค่าเริ่มต้น

### 3.4 Recovery และคำตัดสิน

- ใช้ recovery package/allow-list เดิมที่ QA ตรวจแล้วและตรง hash เท่านั้น หลัง Order proof ผ่าน ให้สร้าง named **pre-recovery backup หลัง #13** ตามชื่อ/เพดาน/โควตาเดิมและรอ `completed`; ห้ามลบ backup เก่าเพื่อคืนที่ หาก cost/slot/package ไม่ตรงให้หยุดก่อน write
- สร้าง synthetic sentinel หนึ่ง Category/หนึ่ง private object ตาม scope เดิมหลัง backup แล้วทำ Emergency Stop → SELECT-only Reconcile → Resume ตามลำดับ/ไฟล์ hash เดิม จากนั้น Restore **หนึ่งครั้งเฉพาะ Staging** จาก post-#13 backup ที่ระบุ ID แน่ชัด ตรวจ sentinel หาย, Order/fixture ก่อน backup ยังอยู่, #13 ยังเป็น head, SMTP=false, Schedule=0, login ของ Member 01 และสิทธิ์ยังถูกต้อง ผล Restore ไม่ชัดห้ามยิงซ้ำ
- Independent QA รวบรวม evidence matrix + Order read-back + Recovery แล้วให้ `GO` เฉพาะเมื่อไม่มี Blocker/ผลไม่ชัด หลักฐานเดิมใช้ต่อได้เฉพาะส่วนที่ไม่เปลี่ยน; `PASS WITH CONDITIONS` ไม่เท่ากับ `GO`

## 4. ขั้นตอน Go Live ที่ 2 — Production Release แบบมีเงื่อนไข

**ยังไม่อนุญาต Production จากคำตอบสองข้อด้านบน** ก่อน Production write ต้องมี Release Approval Record แยกและระบุ `production_allowed: Yes` สำหรับ exact candidate นี้โดยตรง สามารถให้เจ้าของลงนาม Scope/Staging Record และ conditional Production Release Record **ในข้อความเดียว** ได้ แต่ต้องแยกสอง Record ชัดเจน และ Production Record มีผลเฉพาะเมื่อ Staging QA `GO` พร้อมทุก gate

Production ID `865860c2-49fa-4e53-908f-9396b2f75233` ต้องผ่าน read-only identity/baseline/history, exact candidate/migration #1–#13 hashes ใน manifest, config/SMTP/Schedule, cost, completed named backup และ Emergency Stop/rollback check ก่อนเขียน Apply เฉพาะไฟล์ที่ยังไม่เคย Apply **ทีละไฟล์** ห้าม `up --all`/Apply ซ้ำ; Deploy exact app artifact, smoke แล้วเปิด `C → D7 → D8` ตามแผนเดิม ปิด business notification schedule เฉพาะตัวที่ยืนยัน ID/ปลายทาง Production ได้ เปิดสมาชิกประมาณ 20 คนหลัง smoke ผ่าน ไม่สร้าง synthetic Production data, ไม่เปิด Supplier Payment/Claims/Advanced Reports ติดตาม 24 ชั่วโมงแรกผ่านระบบติดตามที่อนุมัติและแจ้งเมื่อมี Blocker

หาก identity/hash/history/backup/schedule/cost/QA ไม่ตรง หรือผล mutation ไม่ชัด ให้หยุด **เฉพาะ mutation ถัดไป** และทำ read-only reconciliation; ไม่ retry, เปลี่ยน candidate, bypass สิทธิ์ หรือแก้ Production นอก allow-list คำว่า “ต่อเนื่อง” ไม่ใช่การรับประกันว่าจะผ่าน gate ที่ล้มเหลว และไม่เพิ่มขั้นตอน Go Live ใหม่

## 5. Approval Records ที่เสนอให้เจ้าของลงนามครั้งเดียว

**Record A — Scope Amendment + Staging Implementation.** อ้างอิงเอกสารนี้พร้อม SHA-256 companion, candidate commit/tree/manifest ในข้อ 2, Staging ID/host ในข้อ 2 อนุมัติการใช้หลักฐานเดิมที่ QA ยืนยันแทน UAT ส่วนที่ไม่เปลี่ยน, ลด concurrency จาก 20×2 เหลือ Member 01×2 หนึ่งชุด, แก้เฉพาะ Local ignored runner/tests/checkpoint/seal, ใช้ session เดิมถ้าตรวจได้ มิฉะนั้นส่ง reset email **ไม่เกินหนึ่งครั้ง** เฉพาะ Member 01 และให้เจ้าของกรอก OTP หนึ่งครั้งกับรหัสผ่านสังเคราะห์ใหม่ในหน้า Local, ทำ bounded Order/negative proof และ Recovery ข้อ 3 โดยใช้เฉพาะ fixture เดิมกับ child rows ที่ระบบสร้างตาม Order, named post-#13 backup และ sentinel/rehearsal/one-time Staging Restore ตาม package เดิม; `data_authority: bounded synthetic Staging Order and deterministic child rows, existing approved sentinel only`; `migration_authority: None (#13 applied already)`; `staging_allowed: Yes, exact scope only`; `production_allowed: No`. ใช้เวลาข้อความอนุมัติเป็น `approved_at` ห้าม Deploy, เปลี่ยน Config/Schedule, ส่ง notification ธุรกิจ, สร้างบัญชีหรือ Catalog/Project/Custom Request ซ้ำ และห้ามลบข้อมูลอื่น

**Record B — Conditional Production Release Authorization แยกจาก A.** เจ้าของระบุชัดว่าอนุมัติ Production ID `865860c2-49fa-4e53-908f-9396b2f75233` **เมื่อ** Independent QA ให้ Staging `GO` โดยไม่มี Blocker และ Production preflight ทุกข้อใน §4 ผ่าน สำหรับ exact candidate commit/tree/manifest ใน §2 และ Migration #1–#13 เฉพาะไฟล์ที่ยังไม่ Apply ตาม manifest ทีละไฟล์ อนุญาต completed named backup, exact Apply/Deploy, C→D7→D8, ปิดเฉพาะ verified Production business schedule, controlled member opening ประมาณ 20 คน, Emergency Stop/Recovery ตามเดิมและ monitoring 24 ชั่วโมง; `data_authority: No synthetic Production data; only normal real-user operations after smoke`; `migration_authority: exact unapplied #1–#13 only, one each`; `production_allowed: Yes, conditional gates only`; ใช้เวลาข้อความอนุมัติเป็น `approved_at`. หากเงื่อนไขไม่ผ่าน Record B ไม่อนุญาตให้ฝืน Release และไม่อนุญาต candidate ใหม่หรือสิทธิ์นอก manifest

เอกสารนี้และคำตอบสองข้อก่อนหน้า **ยังไม่ใช่ Record A หรือ B ที่ครบ** จนกว่าเจ้าของจะอ้างอิงฉบับ/hash นี้และยืนยันข้อความทั้งสอง Record โดยตรง หลังยืนยันแล้วทีมทำต่อในสองขั้นตอนเดิมโดยไม่ขออนุมัติซ้ำสำหรับงานที่ตรงเป้าหมาย/ขอบเขตและ gate; เมื่อ gate ล้มเหลวจริงต้องรายงานข้อเท็จจริง ไม่แก้ด้วยการขยายอำนาจเอง

## 6. จำนวนขั้นตอน

เหลือ **2 ขั้นตอน Go Live** ตาม §3 และ §4; จะเหลือ 0 เมื่อ Production เปิดใช้และการติดตาม 24 ชั่วโมงผ่านโดยไม่มี Blocker
