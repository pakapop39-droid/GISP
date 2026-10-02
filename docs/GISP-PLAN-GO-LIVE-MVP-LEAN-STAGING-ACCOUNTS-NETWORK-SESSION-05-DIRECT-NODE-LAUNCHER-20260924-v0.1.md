# GO-LIVE-MVP-INITIAL-OPERATIONS-01 — Network Evidence Session 05 Direct Node Launcher Repair v0.1

## 1. จุดประสงค์

ซ่อมสาเหตุที่พิสูจน์แล้วของ Session 04 ด้วยวิธีเล็กที่สุด แล้วทำ Read-only Evidence Session ใหม่หนึ่งครั้งโดยไม่ขยายไปถึง Accounts, Business data, Deploy, Migration หรือ Production

จัดระดับ `T3 Sensitive` เพราะเกี่ยวข้องกับ Authentication และ External Network contract

## 2. Root cause ที่ยืนยันแล้ว

- Session 04 เรียก logical launcher เป็น `npx` ด้วย `shell:false`
- บน Windows เครื่องนี้มี `npx.cmd`/`npx.ps1` แต่ไม่มี `npx.exe`
- Local no-network smoke test ของ `spawn("npx", ["--version"], {shell:false})` คืน `ENOENT`
- Exact direct launcher `C:\Program Files\nodejs\node.exe` + pinned CLI entrypoint `dist/index.js --version` ผ่านและคืน `0.2.8` โดยไม่มี Network
- Session 04 มีเพียง `AUTH-RENEWAL-STARTED.json`; ไม่มี Auth Completed, Main STARTED หรือ Final Evidence และถูกปิดแล้ว ห้าม retry

ดังนั้นสาเหตุไม่ใช่ InsForge Backend และไม่จำเป็นต้องใช้ Device Login

## 3. Source binding ที่คงเดิม

- Temporary Staging: `gisp-lean-staging-20260923`
- Project ID: `a24aff68-a82e-41da-b64a-a128a1539769`
- Organization ID: `e93668ea-e8ab-4361-9872-282454438478`
- Host / region / tier / plan: `5wjnzj4y` / `ap-southeast` / `nano` / `pro`
- Candidate commit/tree: `8b2573729b7d2b8ad750414e1ba86daa633e4218` / `9cb01e050462ded9160ac2429667794b27ceaf00`
- Collector aggregate: `AD4890F8E742A328030F1725BABAA1D8BE0F05B4096416F76E3F98CDD0C228DC`
- Auth User ID: `f3a87026-c41d-4ba0-83cf-e150a9ba1f93`
- CLI package/version/cache hashes และ Transport/PostHog contract เดิมทั้งหมด

Collector 5 ไฟล์ต้องไม่แก้และ aggregate ต้องไม่เปลี่ยน

## 4. Exact Session 05 binding

- Session ID: `glmvp-accounts-ro2-c6074126-949a-400e-981d-cafcc9ee40fc`
- Directory: `.codex-tmp/lean-staging-execution/runs/glmvp-accounts-ro2-c6074126-949a-400e-981d-cafcc9ee40fc/`
- ใช้ Auth/Main/STOPPED/FINAL marker names เดิมใต้ directory ใหม่นี้
- Session 03 และ 04 ห้าม retry หรือแก้ marker

## 5. Stage A Local repair

อนุญาตให้ Builder แก้เฉพาะ:

1. `.codex-tmp/lean-staging-execution/accounts-readonly-cli-adapter-v2.mjs`
2. `.codex-tmp/lean-staging-execution/accounts-readonly-cli-adapter-v2.test.mjs`
3. `.codex-tmp/lean-staging-execution/ACCOUNTS-READONLY-NETWORK-MANIFEST.json`

การแก้ต้องเป็น Reuse/Modify เท่านั้น:

- คง logical command plan และ pinned offline CLI contract เดิม
- Physical launcher เปลี่ยนจาก bare `npx` เป็น exact:
  - executable: `C:\Program Files\nodejs\node.exe`
  - first argv: `C:\Users\ASUS\AppData\Local\npm-cache\_npx\3cd4ecbf2f3a9e3b\node_modules\@insforge\cli\dist\index.js`
  - remaining argv: exact approved CLI command args โดยตัดเฉพาะ logical npx prefix `--offline -y @insforge/cli@0.2.8`
- ใช้ `shell:false`, exact cwd/context, `NODE_OPTIONS` transport preload และ PostHog v0/host เดิม
- ห้าม `cmd.exe`, PowerShell wrapper, `npx.cmd`, registry, global CLI หรือ fallback
- เพิ่ม real Windows no-network launcher smoke test ที่ตรวจ Node executable, CLI entrypoint/hash, version `0.2.8`, preload และ exit 0
- Unit test ต้องใช้ real launcher test เพิ่มจาก injected mocks
- Manifest ต้อง pin exact logical-to-physical mapping, Session 05 paths, hashes และ Stage A QA requirement

Stage A ห้าม Network และต้องได้ Independent QA PASS ก่อน Stage B

## 6. Auth gate และ Stage B

ก่อนสร้าง Auth marker:

- exact identity และ refresh token ต้องมี; ห้ามแสดงค่า secret
- ถ้า JWT expired ให้ standard pinned `whoami --json` ทำ refresh ตามสิทธิ์เดิม
- ถ้า JWT valid อย่างน้อย 45 นาที ให้ตรวจ identity แล้วดำเนินตาม contract
- ถ้า JWT valid แต่เหลือน้อยกว่า 45 นาที ให้หยุดก่อน marker; ห้ามลบ/แก้ token หรือบังคับ refresh
- ไม่มี InsForge CLI process อื่นและ Session 05 path ต้องไม่ชน

หลัง Stage A QA PASS อนุญาต Stage B หนึ่งครั้ง:

- Auth traffic ceiling เดิม: Profile GET ไม่เกิน 2, OAuth refresh POST ไม่เกิน 1, PostHog `whoami` ไม่เกิน 1
- หลัง Auth Completed ต้อง JWT เหลืออย่างน้อย 45 นาที และเริ่ม Main ภายใน 5 นาที
- Main exact 13 read-only commands และ telemetry ceilings เดิม
- หลัง Main STARTED ห้าม OAuth refresh
- หาก launcher/auth/identity/hash/path/command/telemetry/evidence ไม่ตรง ให้หยุดโดยไม่ retry
- Final evidence ต้องผ่าน Independent QA ก่อนใช้พิจารณา Accounts Execution

## 7. ทางเลือก Lean หลัง Evidence ผ่าน

เพื่อ Go Live เร็วที่สุด แนะนำลด Canary UAT ใน Scope ถัดไปจาก 24 Accounts/20 Organizations เหลือ actor ขั้นต่ำ 6 Accounts/2 Organizations: Admin, Finance, Operations, Logistics, Member A/Org A และ Member B/Org B พร้อม 2 representative orders เพื่อพิสูจน์ role separation, tenant isolation และ Core flow

การลดนี้ยังไม่อนุญาตให้สร้าง Accounts/ข้อมูลในเอกสารฉบับนี้ และต้องมี Accounts Execution Authorization แยก แต่ช่วยลดเวลาทดสอบโดยไม่ตัด Auth/RLS/cross-org safety ที่ห้ามเลื่อน

## 8. ข้อห้าม

- ห้าม Device/Browser/Email Login และ User API Key fallback
- ห้าม Accounts runner, Auth user/business data write และ RPC
- ห้าม Deploy/redeploy, Migration apply, Config/Secret/Schedule change, Notification, Backup create/Restore, Cleanup/Delete
- ห้าม Staging เก่า, Ghost Child และ Production
- ห้าม retry Session 05 หากมี marker หรือ invocation เริ่มแล้ว

## 9. Exact approval text

> ผม ภคภพ ช.เจริญยิ่ง อนุมัติ Scope Amendment และ Implementation ตามเอกสาร `GO-LIVE-MVP-INITIAL-OPERATIONS-01 — Network Evidence Session 05 Direct Node Launcher Repair v0.1` และ checksum companion ที่แนบ เฉพาะ Temporary Staging `gisp-lean-staging-20260923` Project ID `a24aff68-a82e-41da-b64a-a128a1539769`, Organization ID `e93668ea-e8ab-4361-9872-282454438478`, host `5wjnzj4y` เท่านั้น อนุมัติ Stage A ให้ rebind exact Local Adapter 2 ไฟล์และ Network Manifest 1 ไฟล์ไปยัง Session ID `glmvp-accounts-ro2-c6074126-949a-400e-981d-cafcc9ee40fc` และเปลี่ยน physical launcher จาก bare `npx` เป็น exact `C:\Program Files\nodejs\node.exe` + pinned CLI entrypoint ตามข้อ 5 โดยคง Collector 5 ไฟล์และ aggregate `AD4890F8E742A328030F1725BABAA1D8BE0F05B4096416F76E3F98CDD0C228DC` ไม่เปลี่ยน อนุญาต Local real-launcher smoke test แบบไม่มี Network และให้ Independent QA ตรวจ exact candidate ก่อน
>
> หลัง Stage A QA PASS อนุมัติ Auth Bootstrap และ Read-only Evidence Session 05 หนึ่งครั้งตาม Auth/Main command, endpoint, telemetry, marker, no-write และ no-retry ceilings เดิม หาก JWT valid แต่เหลือน้อยกว่า 45 นาทีให้หยุดก่อน marker ห้ามบังคับ refresh หาก JWT expired อนุญาต standard pinned `whoami` refresh ตาม ceiling เดิม หลัง Main STARTED ห้าม OAuth refresh และห้าม Device/Browser/Email Login หรือ fallback ทุกชนิด หาก identity/hash/path/command/telemetry/evidence ไม่ตรงให้หยุดโดยไม่ retry แล้วให้ Independent QA ตรวจ Final Evidence Accounts execution ต้องขออนุมัติแยก ห้าม Backend/Staging business-data write, Deploy, Migration, Config/Schedule, Notification, Backup mutation และ Production ใช้เวลาของข้อความนี้เป็น `approved_at` กำหนด `data_authority: None`, `migration_authority: None`, `network_authority: Exact bounded pre-session auth plus one read-only Session 05`, `staging_allowed: Read-only evidence session only` และ `production_allowed: No`

## 10. เงื่อนไขปิด Slice

Session 05 ปิดเมื่อได้ Final Evidence ที่ Independent QA รับรอง หรือหยุด Fail Closed โดยไม่มี Backend/Staging/Production data write
