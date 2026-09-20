# RLC-HARDEN-01 v0.1 — Local Release C hardening addendum

สถานะ: Local candidate เท่านั้น; ยังไม่ผ่าน Independent QA และ **ไม่อนุญาต Apply/Deploy ไป backend หรือ Production**.

Approval: `docs/GISP-APR-RLC-HARDEN-01-IMPLEMENTATION-20260920-v0.1.md`.

## ลำดับ migration ที่บังคับ

ไฟล์ใน addendum นี้ต้องแทรกหลัง `PAY-RPC-GATE-001` ขั้น `20260920010200_pay-private-executor.sql` และก่อน `20260920010300_release-c-privileges.sql` เสมอ เพื่อให้ duplicate guard และ organization-targeted RPC wrappers ถูกติดตั้งก่อนคืนสิทธิ์ Release C.

| Gate | SHA-256 (exact package bytes) | File |
|---|---|---|
| C hardening prerequisite | `0d2fac819d158a2a87962b181f2f637ada298b7973240341dfcef46f4be9bfa2` | `migrations/20260920010250_release-c-org-scope-hardening.sql` |

Source draft: `migrations/20260918133857_release-c-org-scope-hardening.sql` มี exact SHA-256 เดียวกันคือ `0d2fac819d158a2a87962b181f2f637ada298b7973240341dfcef46f4be9bfa2`.

## ขอบเขตและข้อห้าม

- Forward-only: เพิ่ม guard/trigger/policy และห่อ RPC เดิมด้วย target-organization authorization; ไม่มีการลบหรือแปลง business data.
- D7/D8/Freight/D9/D10 ยังปิดตาม gate เดิม; addendum นี้ไม่ grant สิทธิ์เหล่านั้น.
- ไม่มี backup/smoke/apply evidence เพราะ approval ไม่อนุญาต backend write.
- ก่อนใช้จริงต้องตรวจ lineage/signature/ACL/dependency บน isolated rehearsal ที่ได้รับอนุมัติใหม่, ทำ backup/restore drill, smoke/negative tests และรับ Production Release Authorization แยกต่างหาก.
