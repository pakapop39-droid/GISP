# GO-LIVE-MVP-INITIAL-OPERATIONS-01 — Lean Temporary Staging Risk Amendment v0.1

Date: 2026-09-23  
Environment: Local planning and Local isolated runner implementation first; Temporary Staging only after a separate exact execution authorization  
Production allowed: No

## 1. Purpose

This amendment resolves two limitations discovered by Independent QA before any Temporary Staging project or data was created:

1. `@insforge/sdk` 1.5.1 uploads an exact Storage key with replace-capable `PUT` semantics and does not expose atomic create-only / `If-None-Match`.
2. InsForge CLI 0.2.8 can read billing, usage and project details but cannot provide an authoritative pre-create Nano price or select a paid instance tier in the create command.

The approved pricing formula is unchanged. Production, old Staging and the Ghost Schedule child remain out of scope.

## 2. Proposed Lean Change — Recovery Storage Sentinel

Replace the previously fixed object key with exactly one locally generated cryptographically random UUID key under the dedicated prefix, then call the standard SDK `upload(exactGeneratedKey, file)` exactly once:

`recovery-sentinel/GLMVP-STG-20260923/<random-uuid>.txt`

Controls:

- Keep the approved exact file bytes, MIME `text/plain`, size `37` and SHA-256 `022017B5694315B80DBB3FABCCC46B90E1C7CEAA93183C815513298409B42688`.
- Keep the approved exact Recovery Category ID/code and create it only after backup `glmvp-pre-recovery-20260923` is verified `completed`.
- Generate the UUID once from a cryptographically secure local source, persist the exact key in the durable `STARTED` checkpoint before any upload, then list/check that exact generated key is absent.
- Use one exclusive runner/state lock and call `upload(exactGeneratedKey, file)` at most once.
- Persist the returned bucket/key and response hash immediately. The returned key must equal the checkpointed generated key.
- If the result is missing, ambiguous or fails verification, stop. Never upload again, overwrite, update or delete an object to force a PASS.
- Download the returned object and verify all 37 bytes and the full SHA-256 before the recovery rehearsal.
- After the one Restore, verify that the recorded dynamic object and Recovery Category are absent while pre-backup fixtures and the approved pricing formula remain.
- Accept the residual platform risk that the SDK still uses replace-capable `PUT`; the random UUID plus pre-write absence check makes collision extremely unlikely but is not a mathematical atomic create-only guarantee. This risk applies only to one synthetic Staging object and never to real or Production data.
- If upload succeeds but its response or checkpoint persistence is lost, the known generated key from `STARTED` is used only for read-only reconciliation. The rehearsal cannot PASS and upload cannot be retried. The possible orphan remains until the one approved Restore proves it absent or until the exact Staging Project reaches its separately authorized retention deletion; no ad-hoc cleanup is allowed.

## 3. Proposed Lean Change — Billing Evidence

Do not accept a number typed only into Local JSON as proof of cost.

Before project creation:

- Allow read-only inspection of the InsForge Billing/Dashboard or official control-plane view for the approved Organization.
- Capture a sanitized evidence record containing source label, currency, Nano rate/quote, quote timestamp, billing cycle, current usage/credits and SHA-256 of the source artifact. It must be captured in the same execution session and be no older than 15 minutes when project creation starts.
- Independent QA must attest that the provider-visible upper bound for the approved retention is no more than USD 10 and includes incremental compute, backups, Storage and usage—not only the Nano compute line. If price, tier or total coverage cannot be confirmed, stop before project creation.

After project creation and before each write phase:

- Bind fresh read-only `projects get`, billing status/credits/usage and the pre-create quote to the exact new Project ID and Organization ID.
- Require `instance_type=nano`; mismatch, missing fields, evidence older than 15 minutes or projected total above USD 10 means stop before any migration/deploy/data write and request an exact owner decision about deletion of the newly created wrong-tier Project. Do not delete it under this amendment.
- No resize, add-on, paid upgrade or cost-setting mutation is authorized.

## 4. Unchanged Boundaries

- The synthetic GLOBAL formula remains: Markup 25%, Freight 15–20%, Import 5%, Operations 10%, Service 10%.
- The exact candidate commit/tree, migration allow-list, buckets, accounts, bounded fixtures, SMTP=false, Active Schedule=0, backups, one Restore, UAT and recovery gates remain unchanged.
- No Production action, real data, real payment, notification send/retry, old-Staging mutation or Ghost-Child mutation.
- This amendment does not itself authorize creation of a cloud project, deployment, migration apply, Staging data write, backup/restore, deletion or Production action.

## 5. Local Implementation Authority Requested

After owner approval, the Builder may work only in `C:\Users\ASUS\.codex\worktrees\full-flow-go-live-01\GISP`, branch `codex/full-flow-go-live-01`, sealed app commit `8b2573729b7d2b8ad750414e1ba86daa633e4218`, tree `9cb01e050462ded9160ac2429667794b27ceaf00`, and runner baseline semantic seal `812ED051C518C25135AC92640C52BFB06552D642C65519E8A5C94798806C9CED` / aggregate seal `8D6C6D9115B8DB57170D5C1285EA2554EB2E50A69FCED100595F6A191F1FA18B`.

Exact Local file allow-list:

- `.codex-tmp/lean-staging-runner/recovery-sentinel.mjs`
- `.codex-tmp/lean-staging-runner/recovery-sentinel.test.mjs`
- `.codex-tmp/lean-staging-runner/billing-evidence.mjs`
- `.codex-tmp/lean-staging-runner/billing-evidence.test.mjs`
- `.codex-tmp/lean-staging-runner/interfaces.mjs`
- `.codex-tmp/lean-staging-runner/manifest.mjs`
- `.codex-tmp/lean-staging-runner/runner.mjs`
- `.codex-tmp/lean-staging-runner/runner.test.mjs`
- `.codex-tmp/lean-staging-runner/README.md`
- `.codex-tmp/lean-staging-runner/MANUAL-UAT-RECIPE.md`
- `.codex-tmp/lean-staging-runner/package-manifest.test.mjs`
- `.codex-tmp/lean-staging-runner/PACKAGE-MANIFEST.json`

No business adapter or tracked app source may change. Local synthetic mocks only; no Backend or Network call.

## 6. Proposed Approval Text

> ผม ภคภพ ช.เจริญยิ่ง อนุมัติ Scope Amendment และ Local Implementation ตามเอกสาร `GO-LIVE-MVP-INITIAL-OPERATIONS-01 — Lean Temporary Staging Risk Amendment v0.1` และ checksum companion ที่แนบ อนุญาตให้เปลี่ยน Recovery Storage Sentinel จาก exact fixed key เป็นหนึ่ง dynamic key รูปแบบ `recovery-sentinel/GLMVP-STG-20260923/<random-uuid>.txt` ที่สร้างและ checkpoint ใน Local ก่อนเรียก `upload(exactGeneratedKey,file)` โดยคง exact bytes, size และ SHA-256 เดิม ใช้ exclusive lock, durable STARTED, upload ได้ครั้งเดียว, ห้าม retry/overwrite/update/delete และยอมรับ residual risk ว่า SDK ใช้ replace-capable PUT ซึ่งไม่ใช่ atomic create-only แต่ความเสี่ยงจำกัดเฉพาะ synthetic object หนึ่งไฟล์บน Temporary Staging หาก response/checkpoint ไม่ชัดเจนให้ read-only reconcile เท่านั้นและห้าม PASS/ห้าม cleanup นอก Restore หรือ retention deletion ที่อนุมัติแยก อนุญาตให้เพิ่ม fail-closed billing evidence contract ที่ต้องใช้ provider-visible read-only quote/Dashboard/control-plane evidenceอายุไม่เกิน 15 นาทีและ Independent QA attestationว่าต้นทุนรวม compute, backup, Storage และ usage ตลอด retentionไม่เกิน USD 10 ก่อนสร้าง Project หากยืนยันไม่ได้ให้หยุด และหลังสร้างหากไม่ใช่ Nanoให้หยุดก่อน migration/deploy/data writeและขอคำสั่งเรื่อง deletionแยก อนุญาต Local implementation/tests/reseal เฉพาะ exact worktree/branch/baseline และ Exact Local file allow-list ในเอกสารด้วย Local mocks เท่านั้น ห้ามแก้ business adapter หรือ tracked app source ยังไม่อนุญาต Network/Backend/Staging write, project creation, Deploy, Apply Migration, Backup/Restore, Deletion หรือ Production ให้ใช้เวลาของข้อความอนุมัติเป็น `approved_at` กำหนด `data_authority: Local in-memory/file synthetic mocks only`, `migration_authority: None`, `network_backend_authority: None`, `staging_allowed: No` และ `production_allowed: No`
