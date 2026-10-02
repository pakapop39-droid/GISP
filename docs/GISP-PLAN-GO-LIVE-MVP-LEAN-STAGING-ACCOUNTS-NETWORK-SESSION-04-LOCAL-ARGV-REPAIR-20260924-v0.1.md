# GO-LIVE-MVP-INITIAL-OPERATIONS-01 — Network Evidence Session 04 Local Argv Repair v0.1

## 1. เหตุผล

Network Evidence Session 03 ไม่ได้เริ่ม เพราะคำสั่ง Local มีเครื่องหมาย backtick ติดไปกับ path ทำให้ Adapter ปฏิเสธด้วย `ENTRYPOINT_TOKEN` ก่อนสร้าง directory/marker/process/network ทุกชนิด

เหตุการณ์นี้ไม่มี `whoami`, ไม่มีคำสั่ง read-only 13 รายการ, ไม่มี Backend/Staging/Production write และ Session 03 ต้องไม่ถูก retry

## 2. Exact new binding

- Session ID ใหม่: `glmvp-accounts-ro2-a94cc1f4-22c2-431c-9933-78750ae75367`
- Session directory ใหม่: `.codex-tmp/lean-staging-execution/runs/glmvp-accounts-ro2-a94cc1f4-22c2-431c-9933-78750ae75367/`
- Node executable: `C:\Program Files\nodejs\node.exe`
- Adapter absolute path: `C:\Users\ASUS\.codex\worktrees\full-flow-go-live-01\GISP\.codex-tmp\lean-staging-execution\accounts-readonly-cli-adapter-v2.mjs`
- Exact argv array:

```json
[
  "C:\\Users\\ASUS\\.codex\\worktrees\\full-flow-go-live-01\\GISP\\.codex-tmp\\lean-staging-execution\\accounts-readonly-cli-adapter-v2.mjs",
  "execute-approved-stage-b"
]
```

- Exact PowerShell invocation เพื่อสร้าง argv ข้างต้น:

```powershell
& 'C:\Program Files\nodejs\node.exe' 'C:\Users\ASUS\.codex\worktrees\full-flow-go-live-01\GISP\.codex-tmp\lean-staging-execution\accounts-readonly-cli-adapter-v2.mjs' 'execute-approved-stage-b'
```

ห้ามใช้ backtick, Markdown delimiter, extra argument หรือ wrapper อื่น

## 3. Local corrective scope

อนุญาตให้ Builder แก้เฉพาะ 3 ไฟล์เดิมเพื่อ rebind Session ID/path ใหม่:

1. `.codex-tmp/lean-staging-execution/accounts-readonly-cli-adapter-v2.mjs`
2. `.codex-tmp/lean-staging-execution/accounts-readonly-cli-adapter-v2.test.mjs`
3. `.codex-tmp/lean-staging-execution/ACCOUNTS-READONLY-NETWORK-MANIFEST.json`

ต้องคง logic, Collector aggregate `AD4890F8E742A328030F1725BABAA1D8BE0F05B4096416F76E3F98CDD0C228DC`, Auth contract, PostHog v0 contract, exact target และข้อห้ามเดิมทั้งหมด เปลี่ยนได้เฉพาะ Session binding, exact invocation evidence และ hashes ที่เกิดจากการ rebind

Independent QA ต้องตรวจ candidate ใหม่แบบไม่มี Network ก่อน Stage B

## 4. Stage B authorization

หลัง QA PASS เท่านั้น อนุญาต exact PowerShell invocation ในข้อ 2 หนึ่งครั้งสำหรับ Session 04 และทำ Auth Bootstrap/Main Session ตาม Network Session 03 + Session/Auth Amendment 01 เดิม

หาก local argv/hash/path/identity/auth/telemetry/evidence ไม่ตรง หรือคำสั่งล้มเหลว ให้หยุดโดยไม่ retry และห้ามสร้าง Session ใหม่เอง

## 5. ข้อห้าม

ข้อห้ามเดิมทั้งหมดคงอยู่: ไม่มี Accounts execution, data write, RPC, Deploy, Migration apply, Config/Secret/Schedule change, Notification, Backup create/Restore, Cleanup/Delete, Staging เก่า, Ghost Child หรือ Production

## 6. Exact approval text

> ผม ภคภพ ช.เจริญยิ่ง อนุมัติ Scope Amendment และ Implementation ตามเอกสาร `GO-LIVE-MVP-INITIAL-OPERATIONS-01 — Network Evidence Session 04 Local Argv Repair v0.1` และ checksum companion ที่แนบ อนุมัติให้ rebind exact Local Adapter 2 ไฟล์และ Network Manifest 1 ไฟล์จาก Session 03 ไปยัง Session ID `glmvp-accounts-ro2-a94cc1f4-22c2-431c-9933-78750ae75367` พร้อม paths ใหม่ตามเอกสาร และให้ Independent QA ตรวจแบบไม่มี Network ก่อน หลัง QA PASS อนุมัติให้เรียก exact PowerShell invocation และ exact argv array ในข้อ 2 หนึ่งครั้งโดยไม่มี backtick, extra argument หรือ wrapper อื่น เพื่อทำ Auth Bootstrap และ Read-only Evidence Session ตามขอบเขตเดิม หากล้มเหลวให้หยุดโดยไม่ retry ห้าม Accounts, data write, Deploy, Migration หรือ Production ใช้เวลาของข้อความนี้เป็น `approved_at` กำหนด `data_authority: None`, `migration_authority: None`, `network_authority: Exact previously approved auth and read-only commands for Session 04 only`, `staging_allowed: Read-only evidence session only` และ `production_allowed: No`

## 7. เงื่อนไขปิด Slice

Session 04 ต้องได้ Final evidence ที่ Independent QA รับรอง หรือหยุด Fail Closed โดยไม่มี Backend/Staging/Production data write
