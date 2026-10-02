# GO-LIVE-MVP-INITIAL-OPERATIONS-01 — ซ่อม Local Collector สำหรับ Accounts Read-only ครั้งที่ 2 v0.1

## 1. จุดประสงค์

ซ่อมตัวเก็บหลักฐาน Preflight/Billing ใน Local ให้ตรวจย้อนหลังได้และหยุดอย่างปลอดภัย ก่อนขออนุมัติเชื่อม Temporary Staging รอบใหม่ โดยยังไม่เรียกเครือข่าย ไม่เขียน Backend/Staging และไม่รัน Accounts

เอกสารนี้ใช้แนวทาง Lean: ใช้ InsForge CLI เดิมแบบ pin รุ่นและ offline, ไม่สร้าง endpoint ใหม่, ไม่ patch ตัว CLI และไม่สร้างระบบ transport proxy ใหม่

## 2. สาเหตุที่ต้องซ่อม

Independent QA รายงาน `FAIL` ตาม SHA-256 `8CF0F89B04C6CFFAE594DBD54D7DD84161785ACA7FBA931078CF094380FBD8B8` โดยพบว่า:

1. ผล `db migrations list --json` เป็น `{ migrations: [...] }` แต่สคริปต์เดิมใช้เหมือน array
2. Session ID ยังไม่ถูกบันทึกก่อนเริ่ม network
3. `npx -y @insforge/cli` ไม่ pin รุ่นและติดต่อ npm registry
4. InsForge CLI `0.2.8` มี telemetry POST อัตโนมัติ จึงใช้ร่วมกับเงื่อนไข “GET เท่านั้นและห้าม POST ทุกชนิด” ไม่ได้
5. `memory list` ใช้ POST `/api/memory/index` จึงต้องนำออกจาก evidence session

ไม่มี Accounts, Organization, Member profile หรือข้อมูลธุรกิจถูกสร้างจากรอบที่ล้มเหลว

## 3. แนวทาง Lean ที่เลือก

- ใช้ `npx` ตามวิธีมาตรฐาน แต่ pin เป็น `@insforge/cli@0.2.8` และใช้โหมด offline เพื่อไม่ติดต่อ package registry หาก cache/version/hash ไม่พร้อม ให้หยุดก่อน network
- Pin CLI entrypoint SHA-256 `AF352BF5F5DD5FFB5F6A5FA3C15CC95F2BC428DB30642FF5FCBDC372A568B815`, package SHA-256 `4050D5DE43A0612646B7FD9E3C06597E0B4F18B1FA2252381C39021B8889872F` และ cache lock SHA-256 `32BBE4BA99FC7CBD2999C64ADDFAF228D4A56F4BE0916717D00FD8FA87E6372A`
- ไม่ใช้ `memory list`, `--sync`, mutation command, undocumented endpoint, raw SQL หรือวิธีข้ามสิทธิ์
- Local candidate จะบันทึกและตรวจ contract ของ telemetry เท่านั้น แต่ Local tests ต้องมี network call เป็นศูนย์
- การอนุญาตให้ telemetry ออกจากเครื่องยัง **ไม่เกิดขึ้นในเอกสารนี้** ต้องอยู่ใน Network Amendment แยกหลัง Local QA ผ่าน

## 4. Exact Local file allow-list

Builder แก้หรือสร้างได้เฉพาะ:

1. `.codex-tmp/lean-staging-execution/accounts-readonly-evidence-session-v2.mjs`
2. `.codex-tmp/lean-staging-execution/accounts-readonly-session-contract.mjs`
3. `.codex-tmp/lean-staging-execution/accounts-readonly-telemetry-contract.mjs`
4. `.codex-tmp/lean-staging-execution/accounts-readonly-evidence-session-v2.test.mjs`
5. `.codex-tmp/lean-staging-execution/ACCOUNTS-READONLY-SESSION-CONTRACT.md`

ห้ามแก้ executed script/report เดิม, sealed runner, `PACKAGE-MANIFEST.json`, application source, migration, config หรือ Backend

## 5. Requirements

- `REQ-ROFIX2-01`: Local tests ใช้ injected adapters ทั้งหมด และ default network ต้อง throw; network call เท่ากับศูนย์
- `REQ-ROFIX2-02`: execution contract ต้อง pin CLI version/path/entrypoint/package/cache-lock hashes และใช้ `npx` แบบ offline; ห้าม registry access
- `REQ-ROFIX2-03`: command allow-list ต้องไม่มี `memory list`, `--sync`, mutation verbs หรือ flag นอกขอบเขต
- `REQ-ROFIX2-04`: migration normalizer รับเฉพาะ plain object `{ migrations: [...] }`; top-level array, missing/extra collection หรือ malformed row ต้องหยุด
- `REQ-ROFIX2-05`: ตรวจ migration ทุกแถว, duplicate version/name, status, count `38` และ exact head `20260923090000_startup-initial-operations-guard.sql`
- `REQ-ROFIX2-06`: รับ Session ID จากภายนอกและสร้าง marker แบบ create-exclusive พร้อม `fsync` ก่อน external call แรก โดยมี scope hash, target identity, started-at, collector hashes, status `STARTED` และ `networkCallCount: 0`
- `REQ-ROFIX2-07`: marker ชนหรือเขียนไม่ได้ต้องหยุดก่อน external call; failure หลังเริ่ม session ต้องคง Session ID/STARTED และสร้าง STOPPED record โดยห้าม finalize Billing evidence
- `REQ-ROFIX2-08`: telemetry contract ต้องอนุญาตเฉพาะ automatic CLI telemetry ที่ระบุไว้ใน future Network Amendment และปฏิเสธ OAuth refresh, `/api/memory/index`, Deployment sync และ business/data POST
- `REQ-ROFIX2-09`: สร้าง collector aggregate จาก exact 5 files เพื่อให้ Independent QA pin ก่อนขอ network authorization

## 6. Acceptance Criteria

- object migration shape ที่ถูกต้องผ่าน; shape อื่น, duplicate, count/head/status drift หยุด
- marker ถูก persist และ `fsync` ก่อน injected external call แรก
- marker collision/write failure ทำให้ external call count เป็นศูนย์
- Local exception หลัง injected external call ยังคง Session ID และไม่มี finalized quote/snapshot
- static/runtime tests ปฏิเสธ `memory list`, `--sync`, POST/PUT/PATCH/DELETE/RPC ที่ไม่อยู่ใน telemetry contract, package manager registry และ mutation command
- CLI version/path/hash หรือ offline cache ไม่ตรงต้องหยุดก่อน external call
- focused tests, syntax และ Local dry-run ผ่านโดย `networkCalls:false`, `backendWrites:false`, `accountsExecuted:false`
- existing sealed runner semantic/aggregate ต้องไม่เปลี่ยน
- Independent QA ตรวจ exact 5-file candidate แบบไม่มี network และรายงาน PASS ก่อนจัดทำ Network Amendment

## 7. ขอบเขต telemetry สำหรับเอกสารรอบถัดไป

Local candidate ต้องเตรียม contract สำหรับให้เจ้าของพิจารณาภายหลังเท่านั้น:

- InsForge usage telemetry ไป exact Staging host path `/api/usage/mcp` เฉพาะ payload `{tool_name, success, timestamp}` และจำนวนสูงสุดตาม exact command allow-list
- PostHog command telemetry ไป `https://us.i.posthog.com/batch/` เฉพาะ event จาก exact command allow-list
- ห้าม OAuth refresh POST, `/api/memory/index`, `--sync`, business/data POST และ host/path/payload อื่น

การอนุมัติ Local Amendment นี้ไม่อนุญาต telemetry หรือ network ใด ๆ

## 8. Stop Conditions

หยุดเมื่อมีไฟล์นอก allow-list เปลี่ยน, tests ติดต่อ network, CLI/hash/cache ไม่ตรง, ต้องใช้ registry, marker ไม่ durable, migration contract ไม่ตรง, telemetry contract กว้างกว่าข้อ 7, sealed runner hash เปลี่ยน หรือจำเป็นต้องเรียก Staging/Backend เพื่อพัฒนา

## 9. ข้อความเสนอเพื่ออนุมัติ

> ผม ภคภพ ช.เจริญยิ่ง อนุมัติ Scope Amendment และ Local Implementation ตามเอกสาร `GO-LIVE-MVP-INITIAL-OPERATIONS-01 — ซ่อม Local Collector สำหรับ Accounts Read-only ครั้งที่ 2 v0.1` และ checksum companion ที่แนบ เฉพาะ Local isolated worktree `C:\Users\ASUS\.codex\worktrees\full-flow-go-live-01\GISP` branch `codex/full-flow-go-live-01` อนุญาตให้สร้างหรือแก้เฉพาะ 5 ไฟล์ใน Exact Local file allow-list เพื่อ pin `@insforge/cli@0.2.8` แบบ offline/no-registry, แก้ migration object shape, สร้าง durable Session marker ก่อน external call, เพิ่ม telemetry contract สำหรับการพิจารณาใน Network Amendment ภายหลัง และสร้าง Local injected tests/collector aggregate อนุญาตเฉพาะ Local mocks/files โดย network call ต้องเป็นศูนย์ ห้ามแก้ sealed runner/application/migration/config/หลักฐานเดิม ห้าม Network, Backend/Staging write, Accounts runner, Deploy, Migration, Config/Secret/Schedule, Notification, Backup/Restore, Cleanup/Delete, Staging เก่า, Ghost Child และ Production หลัง Builder และ Independent QA ผ่าน ต้องขอ Network Authorization แยกก่อน preflight/Billing รอบใหม่ และต้องขอ Accounts Execution Authorization แยกหลัง evidence ผ่าน ให้ใช้เวลาของข้อความนี้เป็น `approved_at` กำหนด `data_authority: Local synthetic mocks/session markers only`, `migration_authority: None`, `network_authority: None`, `staging_allowed: No` และ `production_allowed: No`

## 10. การปิด Slice

Local Repair Slice นี้ปิดเมื่อ exact 5-file candidate ผ่าน Independent QA แบบไม่มี network และมี collector aggregate ที่ pin แล้วเท่านั้น
