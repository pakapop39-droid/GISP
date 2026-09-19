# PAY-RPC-GATE-001 Emergency Stop / Forward Resume

สถานะ: **Template only — ห้าม Apply หรือ Deploy จากแพ็กเกจนี้โดยไม่มี Production Release/Incident Authorization เฉพาะครั้ง**

แพ็กเกจนี้เป็นแผนหยุด Write ทั้งหมดของ C/D Slice ที่เลือกด้วย ACL และ fail-closed private executors; `stop-c.sql` ปิดทั้ง Member writes และ staff continuation writes ในขอบเขต C ไม่ใช่เพียงหยุดรับ Order ใหม่. แพ็กเกจนี้ไม่ย้อนข้อมูล ไม่ลบตาราง ไม่แก้ข้อมูลธุรกิจ และไม่แทน Named Backup. ก่อนเหตุการณ์จริงต้องตรึง Hash ของไฟล์ทั้งหมดและอ่าน `pg_proc`/`proacl` ของ Production ซ้ำ เพราะ ACL อาจเปลี่ยนจาก snapshot ที่ใช้ร่างนี้

## ลำดับหยุด

ใช้เฉพาะไฟล์ที่ตรงกับ Slice ที่เปิดอยู่ และลดระดับจากใหม่ไปเก่าเสมอ:

1. `stop-d10.sql`
2. `stop-d9.sql`
3. `stop-d8.sql` — เปลี่ยน `freight_payment_enabled()` เป็น `FALSE` ด้วย
4. `stop-d7.sql`
5. `stop-c.sql` — ปิด 9 Member writes, 9 staff continuations และทำ private Payment preview/verify เป็น `EMERGENCY_WRITE_DISABLED`
6. ตั้ง App Stage/flags ให้ปิดใน Deployment ที่อนุมัติแยก แล้วรัน `reconcile.sql` หลังหยุด writes

ห้ามใช้คำสั่ง apply-all, wildcard grant/revoke หรือรันทั้งโฟลเดอร์. ผู้ดำเนินการต้องเลือกไฟล์และตรวจ Hash ทีละไฟล์. การลด D10 ไม่ปิด D9/D8/D7/C; การลด D8 ไม่ปิด D7/C. Retired `create_shipment(TEXT,JSONB)` และ `record_delivery(UUID,TEXT,UUID,BOOLEAN)` ถูกปิดใน `stop-d8.sql` และไม่มีไฟล์ resume ใดเปิดกลับ

## ลำดับเปิดกลับแบบ Forward-only

หลัง Finance/Operations กระทบยอด, Backup สถานะเหตุการณ์เสร็จ, QA ตรวจ negative/positive smoke และเจ้าของอนุมัติเหตุการณ์:

1. `resume-c.sql`
2. `resume-d7.sql`
3. `resume-d8.sql`
4. `resume-d9.sql`
5. `resume-d10.sql`

แต่ละไฟล์เปิดเฉพาะ Gate ของตัวเอง ไม่เปิด Gate ถัดไป. `resume-c.sql` คืน private function bodies จาก `20260920010200_pay-private-executor.sql`, ให้ `project_admin` เรียกได้เท่านั้น และไม่เปิด legacy `verify_payment_transfer(UUID,BOOLEAN,TEXT)` หรือ `submit_payment_transfer_bound_impl(...)`.

## Preflight บังคับ

- Project ID, environment, migration head, deployment ID, Release Stage และ D slice flags ต้องตรง Approval Record.
- บันทึก Function definition hash และ ACL ของทุก signature ก่อน stop. Production-B read-only snapshot วันที่ 19 ก.ย. แสดง staff continuation ทั้ง 9 มี EXECUTE สำหรับ `authenticated` และ `project_admin`, ไม่มี `anon`; stop ถอนเฉพาะ user-facing roles และคง trusted internal role. หาก incident-time ACL ไม่ตรง snapshot นี้ให้หยุดและสร้างไฟล์เฉพาะเหตุการณ์ใหม่; ห้ามเดา.
- D7 stop/resume แตะเฉพาะ 5 write RPCs; `get_dispatch_gate(UUID)` และ `can_dispatch_order_item(UUID)` เป็น read helpers และต้องคง ACL เดิม.
- Named Backup ก่อน cutover และ incident-state Backup ต้อง `completed`; ห้ามลบ Backup เพื่อคืนช่องโดยไม่มีอำนาจเฉพาะ.
- บันทึก `gisp.cutover_at` จากเวลาจริง และส่งให้ session ที่รัน `reconcile.sql`; ไฟล์ reconcile ไม่มีคำสั่ง `SET` หรือ write.
- เก็บผล counts/deltas ของ Order, Payment, Shipment, File และ Audit ก่อน/หลังทุกขั้น.

## Canonical Hash inventory ของ package ต้นทาง ณ source `ebf80919`

ทุกค่าเป็น SHA-256 ของ **canonical UTF-8 bytes**: อ่านไฟล์เป็น UTF-8 แล้ว normalize `CRLF` และ `CR` เป็น `LF` ก่อน Hash. ห้ามใช้ Hash ของ raw working-tree bytes เพราะ `core.autocrlf` ทำให้ Windows Worktree ให้ค่าต่างจาก Git/แพ็กเกจ canonical ทั้งที่ SQL เหมือนกัน. ตารางนี้ต้องตรงกับ authoritative table ใน parent `release-candidates/pay-rpc-gate-001/README.md`; Hash ต้องตรวจใหม่ด้วยกฎ canonical หลังรวม candidate และไม่ใช่หลักฐาน Production state:

| File | SHA-256 |
|---|---|
| `20260920010000_pay-close-legacy-entry.sql` | `bbbf50032469ef407f287418d69cab33f64cd8b912a425e50e23c4f0994e5ffb` |
| `20260920010100_pay-evidence-binding.sql` | `5a8cc2a7308fd78a7dba87244871dae08d30e1665b2193694e9b9e97eb94dac3` |
| `20260920010200_pay-private-executor.sql` | `e9a4b2c4745cdf07278935cf079c8c5d3db4ab8e241b74626f72ac90148eb96c` |
| `20260920010300_release-c-privileges.sql` | `2abb7fc8e1ca11fb1c3376b211370908810b9dbe89184528084a913912c822a5` |
| `20260920010400_d7-qc-reopen-prerequisite.sql` | `354f735ef430a5a15a06c1741591a3b74c47daced974e720102e039e65a50d0e` |
| `20260920010500_release-d7-privileges.sql` | `9be89b775164025ee03368a83fd3a24bbaab3207203921f391ab56b96dcb855e` |
| `20260920010600_d8-consolidation-prerequisite.sql` | `df7de020ce9ab309b96e82a3551f653e228cb240ae5bddfaf96a3dfb01934ac3` |
| `20260920010700_d8-customs-prerequisite.sql` | `6c30c0380cd841a92074d40103f2594e3fae3f6ef2c7efc72972f3db9f7d70b6` |
| `20260920010800_release-d8-privileges.sql` | `41ecb7c4486caae0db5a2118a0fe062feed713e295131376d0d63c8632231970` |
| `20260920010900_d8-freight-payment-enable.sql` | `5cd45106a6bc4f36de1b16a2f09f606e2f48ff8961c56e778bae6b154258c577` |
| `20260920011000_release-d9-privileges.sql` | `f80a8c0e2106a373333b86206c23322b3b6afe12f7504fee76c211bc0f5defd2` |
| `20260920011100_release-d10-privileges.sql` | `d38c80941b0172fd1d46638ea79edfbe17c7901f842318d49d39f7fbb7ced5ab` |

## Stop conditions

หยุดทันทีเมื่อ Signature/ACL/Hash/Environment ไม่ตรง, Backup ไม่พร้อม, reconciliation มี post-cutover writes ที่อธิบายไม่ได้, private executor ไม่ fail closed, Freight ยังเปิดหลัง stop D8, หรือการแก้ต้อง Restore ทับธุรกรรมจริง. การ Restore ฐาน/Storage ต้องมีแผนรักษา post-cutover Order/เงิน/ไฟล์และคำอนุมัติเฉพาะเหตุการณ์.
