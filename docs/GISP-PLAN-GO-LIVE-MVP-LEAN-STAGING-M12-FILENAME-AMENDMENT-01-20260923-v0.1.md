# GO-LIVE-MVP-INITIAL-OPERATIONS-01 — Lean Staging M12 Filename Amendment 01 v0.1

Date: 2026-09-23  
Environment: exact standalone Temporary Staging only  
Production allowed: No

## 1. Reason

The authorized migration #12 source file is:

`20260923090000_startup_initial_operations_guard.sql`

with SHA-256:

`287292A1D37DC7A31C64A738B9234D3D903EE427F531F6D70CC0ADC4700C1EF0`

InsForge CLI rejected the filename before sending SQL because CLI 0.2.8 requires `<version>_<lowercase-hyphen-name>.sql`; underscores in the migration name are invalid. The migration bytes were not applied and no SQL error occurred.

## 2. Exact Current State

- Project: `gisp-lean-staging-20260923`
- Project ID: `a24aff68-a82e-41da-b64a-a128a1539769`
- Host marker: `5wjnzj4y`
- Organization: `e93668ea-e8ab-4361-9872-282454438478`
- Region / instance / topology: `ap-southeast` / `nano` / standalone
- Applied migrations: `37`
- Current head: `20260920010900_d8-freight-payment-enable`
- Migration version `20260923090000`: absent
- Completed pre-Lean backup: `glmvp-pre-lean-delta-20260923`, ID `dcd7510f-1933-4e11-9294-3932428240c3`
- Deployments, buckets, fixtures and synthetic business data created by this run: none
- Production mutation: none

## 3. Proposed Minimal Correction

1. Keep the tracked candidate, original migration file and original candidate manifest unchanged.
2. In the isolated Staging CLI context only, create one mechanical filename alias:
   `20260923090000_startup-initial-operations-guard.sql`.
3. The alias bytes must be byte-for-byte identical to the approved original and must have SHA-256 `287292A1D37DC7A31C64A738B9234D3D903EE427F531F6D70CC0ADC4700C1EF0`.
4. Reconfirm exact Project identity, Schedule `0`, SMTP `false`, history count `37`, head `20260920010900_d8-freight-payment-enable`, version `20260923090000` absent and completed pre-Lean backup identity.
5. Apply the alias exactly once using standard `db migrations up 20260923090000_startup-initial-operations-guard.sql`. Do not use `up --all`, `--to`, raw SQL or modify SQL bytes.
6. If the apply fails or history is not exactly count `38`, version `20260923090000`, name `startup-initial-operations-guard`, stop before backup, deploy or data write. No second apply attempt.
7. If successful, continue the already authorized plan from the post-Lean backup gate.

## 4. Local Runner Alignment

Update the Local ignored runner expected migration head only to:

`20260923090000_startup-initial-operations-guard.sql`

Allowed runner files:

- `.codex-tmp/lean-staging-runner/manifest.mjs`
- `.codex-tmp/lean-staging-runner/README.md`
- `.codex-tmp/lean-staging-runner/PACKAGE-MANIFEST.json`
- `.codex-tmp/lean-staging-runner/package-manifest.test.mjs` only if required by reseal

Run focused/full offline tests, syntax, dry-run, package seal and Independent QA before using the resealed runner for Backend data phases. No tracked app/candidate file may change.

## 5. Boundaries

- No Production action.
- No change to migration SQL bytes, schema scope, business rules, formula or financial behavior.
- No baseline or migration #1–#11 repeat.
- No raw SQL workaround.
- No Deploy, bucket creation, fixture/data write, Restore or notification action until migration #12 and the post-Lean backup gate pass.
- No deletion, resize, add-on, Schedule activation, SMTP enablement or old-Staging/Ghost-Child mutation.

## 6. Proposed Approval Text

> ผม ภคภพ ช.เจริญยิ่ง อนุมัติ Scope Amendment และ Implementation ตามเอกสาร `GO-LIVE-MVP-INITIAL-OPERATIONS-01 — Lean Staging M12 Filename Amendment 01 v0.1` และ checksum companion ที่แนบ สำหรับ Temporary Staging `gisp-lean-staging-20260923` ID `a24aff68-a82e-41da-b64a-a128a1539769`, host marker `5wjnzj4y` เท่านั้น อนุญาตให้สร้าง mechanical alias `20260923090000_startup-initial-operations-guard.sql` ใน isolated CLI context โดย bytes ต้องเหมือน migration #12 เดิมและ SHA-256 ต้องเป็น `287292A1D37DC7A31C64A738B9234D3D903EE427F531F6D70CC0ADC4700C1EF0`, ปรับ Local ignored runner expected head และ reseal เฉพาะ allow-list ในเอกสาร หลังผ่าน preflight exact identity/Schedule=0/SMTP=false/history37/head#11/version#12 absent/pre-Lean backup completed อนุญาตให้ Apply alias #12 หนึ่งครั้งด้วย standard `db migrations up` เท่านั้น ห้าม `up --all`, `--to`, raw SQL, เปลี่ยน SQL bytes หรือ Apply baseline/#1–#11 ซ้ำ หากสำเร็จและ history เป็น 38/head alias ตรง อนุญาตให้ดำเนินแผนเดิมต่อจาก post-Lean backup gate หากไม่ตรงให้หยุดก่อน Deploy หรือ data write ไม่อนุญาต Production ให้ใช้เวลาของข้อความเป็น `approved_at` กำหนด `migration_authority: exact M12 alias one attempt only`, `data_authority: unchanged from the previously approved plan after M12 and post-backup gates`, `staging_allowed: exact project only` และ `production_allowed: No`
