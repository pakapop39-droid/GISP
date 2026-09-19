# GISP Release C/D Hosted Rehearsal Plan v0.1

**สถานะ:** Read-only preflight ผ่าน / รอ Implementation Authorization ก่อน Apply, Deploy, Backup หรือ Restore  
**เจ้าของแผน:** ภคภพ ช.เจริญยิ่ง  
**Production allowed:** No

## 1. เป้าหมาย

พิสูจน์ Candidate Release C/D แบบครบชุดในพื้นที่ซ้อมที่แยกจาก Production: Hosted App → ACL/Security → Emergency Stop → zero data delta → Reconcile → Forward Resume → Database/Storage Restore → Independent QA โดยไม่เปิด C/D และไม่เปลี่ยนข้อมูล Production.

## 2. Candidate และ Environment ที่ตรึง

- Source chain: `9901c04fe099038f5835b05d0cd87e3064e4582f` → `195880d1416be98ccfef53f46bac744675fa48fe` → `55de0c854e8dc51e9dd547385a7ecd2ee418823a`.
- Tree hash: `0100f6078d9cffdc3f69bdcc20886e1faa060258`.
- ใช้ clean detached checkout ของ `55de0c8`; ไม่ใช้ untracked `pnpm-lock.yaml`, `tools_tmp/` หรือ Python caches.
- Rehearsal child เท่านั้น: `pay-seq-02-rehearsal-20260918`, ID `e902393a-ffe7-433d-96d8-a37256948959`, schema-only, ready, parent Production B `865860c2-49fa-4e53-908f-9396b2f75233`.
- Baseline ณ preflight: 38 migrations, head `20260920011100`; 8 Orders, 12 Payment Transfers, 0 Shipments, 12 File Metadata, 49 Audits, 4 Notification Jobs, 3 public test users, 2 Organizations.
- Backup เดิม: scheduled `b002919d-fabb-4eef-a7fa-1d385e7720b7` และ manual pre-migration `ac4aec5a-8789-4332-b974-cd7a1c78a171`; ห้าม Restore ตัว pre-migration เพราะอยู่ก่อน Candidate 12 migrations.
- Child มี Schedule `GISP-Notification-Retry` ID `aefecf8b-5b02-4649-a9b2-47aa448af0e8` เป็น Active และ URL ยังชี้ parent Production host `m8ugbyak...`; นี่เป็น Blocker ก่อนสร้างข้อมูลซ้อม. ต้องปิด Schedule เฉพาะ Child ก่อน Backup และคงปิดหลัง Restore; ห้ามแก้ Schedule ของ Parent.
- Parent มี Branch เต็ม 2/2; ห้าม create/delete/reset/merge Branch. Restore จะใช้ fresh named backup ของ Child เดิมหนึ่งครั้ง เพราะข้อมูลใน Child เป็นข้อมูลจำลองและการสร้าง R2 ต้องลบหรือยึด Branch อื่น.

## 3. Read-only Security Baseline

- C/D function inventory พบ 54 signatures; ทั้งหมดเป็น `SECURITY DEFINER`, owner `project_admin`, pinned `search_path=pg_catalog, public, pg_temp`.
- User-facing C/D functions ที่เปิดอยู่ให้ `authenticated`; Payment private executor 2 ตัวและ legacy/bound implementation เป็น `project_admin` only.
- Public tables 112 ตารางเปิด RLS และมีอย่างน้อยหนึ่ง policy ทุกตาราง ณ snapshot นี้; runtime isolation ยังต้องทดสอบด้วยผู้ใช้จริงของ Fixture ไม่อนุมานจาก `project_admin` query.
- Advisor scan เดิม ID `f33db0a7-f5b6-4efd-81c2-801952d6d1ce`, 8 Sep 2026: 543 findings รวม 142 Critical. เมื่ออ่าน category security ด้วย limit 1000 ได้ครบ 228 security issues; 33 Critical ตรงกับชื่อ C/D ที่มีใน scan เดิม. ผลนี้เก่าและไม่ใช่ exact-candidate clearance.

## 4. ขั้นตอนดำเนินการหลังอนุมัติ

1. **Identity/Schedule/Backup Gate** — ตรวจ Project/name/parent/state/head/source/tree/hash ซ้ำ; ปิด Schedule ID `aefecf8b-5b02-4649-a9b2-47aa448af0e8` เฉพาะ Child และยืนยัน inactive; จากนั้นสร้าง fresh named Child backup `RCD-HR-CD-001-PRE-STOP` และรอ `completed`.
2. **Hosted/Security Baseline** — Deploy clean source `55de0c8` ไปยัง Child เท่านั้นด้วย env แบบ inline/secure; บันทึก Deployment ID/URL/Stage flags โดยไม่พิมพ์ Secret. Trigger fresh Advisor scan หนึ่งครั้ง; อ่าน security issues ครบโดยไม่ suppress. เก็บ function definition/ACL/RLS/storage hashes.
3. **Stop/Reconcile/Resume** — Apply exact Emergency SQL ทีละไฟล์เป็น rehearsal-only named migrations; ห้าม `up --all`. Stop `D10 → D9 → D8 → D7 → C`, ตรวจ direct RPC/API และ zero business delta; รัน `reconcile.sql` แบบ SELECT-onlyด้วย cutover timestamp; Resume `C → D7 → D8 → D9 → D10` และตรวจ ACL/hash/tenant isolation กลับตรง baseline.
4. **Restore Proof** — หลัง Backup สำเร็จ สร้าง DB+Storage sentinel ชื่อ prefix `REH-RCD-CD-001` ในข้อมูลจำลองเท่านั้น; Restore fresh backup ข้อ 1 กลับเข้า Child เดิมหนึ่งครั้ง. พิสูจน์ migration head/counts/function ACL/file hashes กลับตรง baseline, sentinel หาย และ Hosted smoke ผ่าน. ห้ามใช้ Branch reset.
5. **Independent QA** — QA ตรวจ source/deployment/backend identity, anon/no-role/cross-org/project-admin boundary, stop/no-delta/reconcile/resume, Advisor, Backup/Restore RTO/RPO และยืนยัน Parent Production/Branch อื่นไม่เปลี่ยน.

## 5. Acceptance Criteria

- `RCD-HR-01`: Target guard ตรง Child ID/name/parent/ready/head ก่อนทุก write; mismatch ต้องหยุด.
- `RCD-HR-02`: clean commit/tree และ canonical hashes ตรง Candidate; ไม่มี Secret/untracked file ใน deployment.
- `RCD-HR-02A`: inherited Notification Schedule ของ Child ถูกปิดก่อนข้อมูลซ้อม, Backup เก็บสถานะปิด และหลัง Restore ยังปิด; Parent Schedule ไม่เปลี่ยน.
- `RCD-HR-03`: Hosted App ชี้ Child ทั้งหมดและไม่มี Production endpoint/key.
- `RCD-HR-04`: Stop ปิดเฉพาะ Gate ตามลำดับ; D8 ทำ Freight=false, D7 คง read helpers, C private functions fail `EMERGENCY_WRITE_DISABLED`, legacy pathsไม่เปิด.
- `RCD-HR-05`: คำสั่งที่ถูกหยุดไม่สร้าง Order/Payment/Shipment/File/Audit/Notification delta; Reconcile อธิบายผลต่างทั้งหมดได้.
- `RCD-HR-06`: Resume เปิด `C → D7 → D8 → D9 → D10` ทีละ Gate; later Gate ไม่เปิดก่อนเวลาและ ACL/function hashes กลับตรง baseline.
- `RCD-HR-07`: Fresh Advisor + manual inspection ครบทุก 54 signatures; PUBLIC/anon/private/cross-org และ permission guards ผ่าน; ไม่มี suppression.
- `RCD-HR-08`: Fresh backup completed; Restore หนึ่งครั้งคืน DB+Storage/ACL/hash/counts ถูกต้องและลบเฉพาะ post-backup sentinel ตามคาด.
- `RCD-HR-09`: QA อิสระให้ PASS และยืนยันไม่มี Production mutation. PASS นี้ยังไม่ใช่ Production Release Authorization.

## 6. ขอบเขตข้อมูลและข้อห้าม

- อนุญาตเมื่อมี Record ใหม่เท่านั้น: ปิด Schedule ID `aefecf8b-5b02-4649-a9b2-47aa448af0e8` เฉพาะ Child, hosted deployment บน Child, fresh Advisor scan, named Child backup, exact rehearsal-only migrations, Fixture/Sentinel `REH-RCD-CD-001*`, notification เฉพาะสาม Gmail aliases ที่เคยอนุมัติ และ Restore fresh backup นั้นหนึ่งครั้ง.
- ห้าม: Production Apply/Deploy/Backup/Restore/config/data/permission,เงินจริง, Member จริง, Branch create/reset/delete/merge, backup deletion, `up --all`, Advisor suppression, การแก้ราคา/ภาษี/สูตร/Payment Term, recipient นอก allowlist หรือการลบ Fixture เดิม.
- หยุดทันทีเมื่อ Project/head/hash/ACL ไม่ตรง, Backup ไม่ completed, notification ออกนอก allowlist, cross-org/anon/private bypass, stopped RPC สำเร็จ, มี unexplained financial/file delta, Restore ไม่ตรง หรือพบ Secret ในหลักฐาน.

## 7. คำอนุมัติที่ต้องใช้ก่อน Execution

> ข้าพเจ้า ภคภพ ช.เจริญยิ่ง อนุมัติ Scope และ Implementation ตาม GISP-PLAN-RELEASE-CD-HOSTED-REHEARSAL-20260919-v0.1 สำหรับ Candidate `55de0c854e8dc51e9dd547385a7ecd2ee418823a` และ Tree `0100f6078d9cffdc3f69bdcc20886e1faa060258` บนพื้นที่ซ้อม `pay-seq-02-rehearsal-20260918` ID `e902393a-ffe7-433d-96d8-a37256948959` เท่านั้น อนุญาตให้ปิด Schedule `GISP-Notification-Retry` ID `aefecf8b-5b02-4649-a9b2-47aa448af0e8` เฉพาะ Child และคงปิดหลังทดสอบ, Deploy Hosted App ไปยัง Child นี้, Trigger Advisor Scan หนึ่งครั้งโดยไม่ Suppress, สร้าง Backup `RCD-HR-CD-001-PRE-STOP`, Apply เฉพาะ Emergency Stop/Resume/Reconcile ที่ตรึงไว้แบบระบุไฟล์ทีละรายการ, สร้างข้อมูลและ DB/Storage Sentinel prefix `REH-RCD-CD-001`, ใช้บัญชี/aliases ทดสอบเดิมและส่ง Notification ได้เฉพาะสาม aliases เดิม และ Restore Backup ใหม่นี้กลับเข้า Child เดิมหนึ่งครั้งเพื่อทดสอบ โดยอนุญาตให้สร้าง Audit/Event ที่ระบบสร้างอัตโนมัติ ไม่อนุญาตให้ใช้ `up --all`, สร้าง/Reset/Delete/Merge Branch, ลบ Backup หรือ Fixture เดิม, ใช้เงินจริง/Member จริง, แก้ราคา ภาษี สูตร Payment Term, Apply/Deploy/Restore/แก้ Schedule/สิทธิ์หรือข้อมูล Production และคำอนุมัตินี้ไม่ใช่ Production Release Authorization หาก Project, Lineage, Head, Hash, ACL หรือ Backup ไม่ตรงให้หยุดก่อนทำรายการเปลี่ยนแปลง.

## 8. สถานะ Slice

Planning/read-only preflight เหลือ **0 ขั้นตอน**. Hosted Rehearsal execution เหลือ **3 ขั้นตอนหลัก**: Owner อนุมัติ Record ข้อ 7 → Execute Hosted/Security/Stop/Resume/Restore → Independent QA และสรุป Go-Live gate.
