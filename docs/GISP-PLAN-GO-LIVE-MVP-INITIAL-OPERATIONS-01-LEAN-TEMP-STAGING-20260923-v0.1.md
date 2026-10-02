# GO-LIVE-MVP-INITIAL-OPERATIONS-01 — Lean Temporary Staging v0.1

## 1. Document Control

| Field | Value |
| --- | --- |
| Document ID | `GO-LIVE-MVP-INITIAL-OPERATIONS-01-LEAN-TEMP-STAGING` |
| Version | `v0.1` |
| Date | 2026-09-23 (Asia/Bangkok) |
| Status | **Proposed — Awaiting Exact Temporary Staging Authorization** |
| Owner intent received | `อนุมัติ Temporary Staging และทำ UAT/recovery rehearsal` |
| Risk tier | `T4 Environment execution` |
| Exact Local candidate commit | `8b2573729b7d2b8ad750414e1ba86daa633e4218` |
| Exact Local candidate tree | `9cb01e050462ded9160ac2429667794b27ceaf00` |
| Candidate manifest SHA-256 | `89E51D111698D16467C16C2600218B9E1962468C6A09703152E5585026132ACD` |
| Production-B baseline manifest SHA-256 | `71AFD16B32D952D3632ACF310663A9287F590A48E5E5870DFE6CF09F071790D0` |
| Lean guard migration SHA-256 | `287292A1D37DC7A31C64A738B9234D3D903EE427F531F6D70CC0ADC4700C1EF0` |
| Lean Scope v0.2 SHA-256 | `E13B4F5260A7234006EFD6A8042FB4441C153C5A4B8EF95639C0FD5600A94B5A` |
| Lean Local Addendum SHA-256 | `3386047835F1D30C590B1574E5C4EF84C9DA2216C6C18600CC17702D1DA0BA3A` |
| Custom File Binding Amendment SHA-256 | `A5568CE2F4005151A168E6829356C0E77A7A4F3D44DE34A5F42998883C3AB480` |
| Local QA evidence | `.codex-tmp/lean-staging-qa/LOCAL-CANDIDATE-QA-20260923.md`, SHA-256 `C70DB57A889FA00FEA037DF5EC0AB14CF8B6D0CD62E2FC6C6F9851DDC7DC83A9`; Independent QA PASS: focused 6/52, full 128/669, typecheck/lint/build PASS; sealed commit/tree re-attested |
| Production allowed | `No` |

ข้อความอนุมัติแบบทั่วไปข้างต้นยืนยันเจตนา แต่ยังไม่อนุญาต mutation จนกว่าเจ้าของจะอนุมัติ exact project/cost/migration/data/deploy/backup/restore scope ในข้อ 13

## 2. Read-only Findings

ตรวจเมื่อ 2026-09-23 โดยไม่แก้ Backend:

- Production: ID `865860c2-49fa-4e53-908f-9396b2f75233`, host marker `m8ugbyak`
- Temporary Staging เดิม: `gisp-full-flow-staging-20260921`, ID `33481c06-9ac0-43e0-a13f-88480e409441`, host marker `4tsmimwp`, region `ap-southeast`, `nano`, active
- Staging เดิมมี Active Schedule = `0` และ SMTP = `false`
- Staging เดิมมี migration `43` รายการ head `20260920011310_full-flow-payment-private-executor-repair` ซึ่งรวม Full-flow candidate เดิมถึง #17 และไม่ตรง Lean target `Production-B 26 + Lean delta 12`
- Staging เดิมจึง **ห้าม reuse, reset, restore, delete หรือเขียนเพิ่ม** ภายใต้เอกสารนี้
- การทดลองใช้ environment variable เพื่อชี้ Project ไม่เปลี่ยน CLI context สำหรับ Schedule; ผล read-only ไปอ่าน Production ซึ่งยังพบ `GISP-Notification-Retry` active จึงต้องใช้ isolated CLI context ที่ link ตรง exact Staging เท่านั้น
- Forbidden identity markers รวม Production Schedule ID `aefecf8b-5b02-4649-a9b2-47aa448af0e8` และ Ghost Child ID `41df0506-ef0a-4753-9426-b1c8ed4f9ff6`

## 3. Proposed Isolated Environment

| Field | Proposed value |
| --- | --- |
| Type | New standalone top-level InsForge project; not a Production child/branch |
| Name | `gisp-lean-staging-20260923` |
| Region | `ap-southeast` |
| Instance | `nano` only; no resize or paid add-on |
| Resource owner | ภคภพ ช.เจริญยิ่ง |
| InsForge organization | `e93668ea-e8ab-4361-9872-282454438478` |
| Billing/account owner | User ID `f3a87026-c41d-4ba0-83cf-e150a9ba1f93` (`pakapop39@gmail.com`) |
| Local CLI context | `C:\codex\GISP\.insforge-audit-lean-staging-new` |
| Fixture prefix | `GLMVP-STG-20260923-*` |
| Production | Forbidden |

หากสร้าง Project ไม่ได้, quota เต็ม, ชื่อชน, ราคาเกินเพดาน หรือ ID/host หลังสร้างไม่ตรง ให้หยุด ห้ามลบ Project อื่นเพื่อคืน quota โดยไม่มี Deletion Authorization แยก

## 4. Cost and Retention

- Official InsForge pricing checked 2026-09-23: Nano is listed at approximately USD `0.0067/hour` or USD `5/month`; actual organization billing/credits remain authoritative at execution time.
- Maximum incremental budget authorized by the proposed record: USD `10` total.
- No upgrade, resize, add-on, custom compute or additional paid resource.
- Retention: until `14 days after Production rollout` or `30 days after Staging creation`, whichever occurs first.
- At expiry, export sanitized evidence, perform a final read-only identity check, then delete only the exact new Staging Project captured by this run. Deletion must stop if its ID/name/host differs or if the target matches Production, old Staging or Ghost Child.
- An extension requires separate owner authorization before day 25 after creation or day 10 after Production rollout, whichever comes first; without that exact extension the authorized default is deletion at expiry.
- Stop before project creation if CLI/dashboard indicates the incremental cost can exceed USD `10`.

## 5. Exact Migration Authority

1. Bootstrap exactly the Production-B baseline `26` migrations from `release-candidates/full-flow-go-live-01/production-b-baseline/` pinned by manifest SHA-256 `71AFD16B32D952D3632ACF310663A9287F590A48E5E5870DFE6CF09F071790D0`.
2. Verify baseline head `20260908170000_release-b-member-pilot` before Lean delta.
3. Apply exactly the `12` ordered migrations in `release-candidates/go-live-mvp-initial-operations-01-lean/MIGRATION-ALLOWLIST.md` and candidate manifest SHA-256 `89E51D111698D16467C16C2600218B9E1962468C6A09703152E5585026132ACD`.
4. Apply each migration by exact filename, one at a time. `up --all`, shared migration tree, `db query` DDL and files outside the allow-list are forbidden.
5. Stop on the first failure; no retry after changing SQL, no skip and no out-of-order apply without a new Amendment.

The historical Production-B manifest contains wording for an older 16-file candidate. This Lean plan supersedes only that candidate instruction with the sealed Lean 12-file allow-list; the immutable baseline manifest/file bytes remain unchanged.

## 6. Backup and Recovery Authority

Proposed authority is limited to the new Staging ID returned after creation:

- Create and wait for named backup `glmvp-pre-lean-delta-20260923` after the 26-file baseline and before Lean delta.
- Create and wait for `glmvp-post-lean-delta-20260923` after all 12 Lean migrations.
- Create and wait for `glmvp-pre-recovery-20260923` before recovery rehearsal.
- Use only the exact emergency package under `release-candidates/go-live-mvp-initial-operations-01-lean/emergency/`.
- Rehearse Stop `D8 → D7 → C`, SELECT-only reconcile, then Resume `C → D7 → D8`.
- Create one synthetic DB/Storage sentinel with the fixture prefix, restore `glmvp-pre-recovery-20260923` into this Staging once, and verify the sentinel is removed while migration/function/ACL/file hashes return to the recorded checkpoint.
- No backup deletion. No Production backup/restore.

The recovery sentinel is an exact post-backup exception, separate from the Catalog fixture:

- Create only after `glmvp-pre-recovery-20260923` is `completed` and exact Category ID/code absence is proven.
- Category via Admin SDK: ID `4d18e30a-df55-4c79-a870-79e92f719099`, `parent_id=NULL`, code `GLMVP-STG-RECOVERY-SENTINEL-20260923`, `name_th=หมวด Sentinel สำหรับ Recovery`, `name_en=GLMVP Recovery Sentinel`, status `INACTIVE`, `sort_order=9999`.
- Storage via Admin SDK: bucket `gisp-confidential`, locally generate and durably checkpoint one UUID-v4 key matching `recovery-sentinel/GLMVP-STG-20260923/<random-uuid>.txt` before an exact-key absence check, then call standard `upload(exactGeneratedKey,file)` once. MIME `text/plain`, exact UTF-8 Base64 `R0xNVlAtU1RHLTIwMjYwOTIzLVJFQ09WRVJZLVNFTlRJTkVMCg==`, size `37`, SHA-256 `022017B5694315B80DBB3FABCCC46B90E1C7CEAA93183C815513298409B42688`.
- No `file_metadata` row is created. Any existing Category ID/code or generated object key stops the phase. Use an exclusive runner/state lock and durable `STARTED`; no upload retry, overwrite, update or delete. An ambiguous result permits read-only reconciliation of the checkpointed key only and cannot PASS. A possible orphan remains until the approved Restore or exact-project retention deletion.
- Verify exact Category fields and downloaded object size/full hash before Stop. After Restore verify both sentinel objects are absent while the formula and all pre-backup fixtures remain.

Backup gates are phase-specific: pre-delta backup must complete before Lean migration #1; post-delta backup must complete before Deploy/fixtures; pre-recovery backup must complete before sentinel/Stop/Resume/Restore. If the required backup cannot complete or quota is full, stop before the next phase. Restore is authorized only after Independent QA confirms the backup ID/name/status and restore checklist for the new Staging ID.

### Exact emergency raw-SQL exception

`db query` DDL remains forbidden except these exact, hash-pinned emergency files against the new Staging context only:

| Ordered action | File | SHA-256 |
| --- | --- | --- |
| Stop D8 | `stop-d8.sql` | `D22E5D4D411C02B3B87B3C8AE3733210F2043EFA2069B800000B35613691DA39` |
| Stop D7 | `stop-d7.sql` | `A72DCDCC384372254F31410E633C6A5B4D6065248336DBF09BD8BB98306F4E47` |
| Stop C | `stop-c.sql` | `03AFFC8FDE5F4D430C03D805FCF1B847DE25D646CFD66B9057B5899CAF900482` |
| Resume C | `resume-c.sql` | `BBA7D8E5977B5CF9B2FEA857299DEE23602921F1374EF9C3FB1070C598563C87` |
| Resume D7 | `resume-d7.sql` | `1AA7060777EE56271C69364A5813BDFD0DF8046D2CD019D242CA7E41F387864C` |
| Resume D8 | `resume-d8.sql` | `377BF9EC125AADA4C918DFE9BC663453EDF881B5FEC937D5E881175755179D0F` |

Executor must recompute the file hash, reconfirm the isolated context Project ID, read the exact file bytes locally, and pass those bytes as the single SQL argument to standard `npx -y @insforge/cli db query`. No inline modification or other raw DDL is allowed. `reconcile.sql` SHA-256 `72CD3A7B96BA62B7E81293D172E0089CAD5E1B0FB5ED0F9DB6FB773D20898C2E` remains SELECT-only and must run through `run-reconcile.mjs` SHA-256 `55F75BE303C2568C8043456DDDD9EBE7FA4A6F38E164A7653A9ACB0B74A26C7D`.

The read-only function checkpoint must use `function-snapshot.sql` SHA-256 `2FDC38CB646E9D7CB234D52445375A7B05EE8D37BAF81B62DA298D8B4E74B09C` before Stop and after Resume/Restore.

## 7. Deploy, Config, Storage, Data and Notification Authority

- Deploy exact commit `8b2573729b7d2b8ad750414e1ba86daa633e4218` only to the new Staging project.
- Maximum deployments: four exact-source deployments—one fail-closed bootstrap C deployment solely to obtain the stable app URL, then final C, D7 and D8. No fixture/UAT write is allowed after bootstrap C until final C attestation passes.
- Deployment env/secret writes are allowed only for: `NEXT_PUBLIC_INSFORGE_URL`, `NEXT_PUBLIC_INSFORGE_ANON_KEY`, `INSFORGE_URL`, `INSFORGE_API_KEY`, `NEXT_PUBLIC_APP_URL`, `RELEASE_CANDIDATE_COMMIT`, `RELEASE_CANDIDATE_TREE`, `RELEASE_TARGET_PROJECT_ID`, `RELEASE_TARGET_BACKEND_HOST`, `RELEASE_TARGET_APP_KEY`, `RELEASE_STAGE`, `RELEASE_D_ENABLED_SLICES`, `APP_MODE`, `APP_ENV`, `ENABLE_STAFF_OPERATIONS`, `NEXT_PUBLIC_ENABLE_SHARED_CATALOGS`, `NEXT_PUBLIC_ENABLE_PRODUCT_SOURCING`, `NEXT_PUBLIC_ENABLE_POST_GO_LIVE_FEATURES`, `ENABLE_PDF_CATALOG_IMPORT`, `ENABLE_IMAGE_SEARCH`, `ENABLE_LOCAL_IMAGE_SEARCH`.
- All URLs, server/public keys and target identity values must come only from the new Staging project/deployment and must never be printed in evidence. Set `APP_MODE=application`, `APP_ENV=staging`, `ENABLE_STAFF_OPERATIONS=false`, Shared Catalog/Sourcing=`true`, Post-go-live/PDF/Image-search flags=`false`.
- Allowed Release transitions only: `C + [] → D + [7] → D + [7,8]`; each transition requires exact-source redeploy and attestation PASS. No reverse/skip/9/10 transition except Emergency Stop/Resume files above.
- Optional worker/notification secrets and services must be absent: no OpenRouter key, PDF worker values, image-search cron secret, notification processor secret or cron secret.
- Create exactly these buckets if absent: `gisp-public` public, `gisp-member-private` private and `gisp-confidential` private. No other bucket. Uploaded object keys must be generated by the exact Hosted routes and may use only `members/{memberProfileId}/...`, `custom-requests/{memberProfileId}/{requestId}/...`, `payments/{memberProfileId}/...`, `catalog/products/{productId}/{kind}/...`, `catalog/finishes/{finishId}/...`, `operations/{kind}/{entityId}/...` or `{organizationId}/operations/customs-entry/{entityId}/...`. The fixture prefix belongs in `original_name` and fixture metadata; it must not override a route-required object-key pattern.
- The only direct Admin SDK storage-key exception is the exact one-time post-backup recovery sentinel specified in section 6.
- Create only the bounded synthetic entities below through standard App/API/SDK flows; no ad-hoc data SQL.
- Maximum synthetic auth users: `24`.
- Member identifiers are exactly `pakapop39+glmvp-member-01@gmail.com` through `pakapop39+glmvp-member-20@gmail.com`. Each member completes the existing Hosted onboarding flow and receives exactly one separate synthetic Organization and MEMBER role because `member_profiles.organization_id` is unique. Member 01 and 11 are the representatives for cross-organization negative tests. No Admin SDK shortcut may bind Member profiles and no role/permission definition may change.
- Staff identifiers and existing job-group/role mapping:
  - `pakapop39+glmvp-admin@gmail.com`
  - `pakapop39+glmvp-finance@gmail.com`
  - `pakapop39+glmvp-operations@gmail.com`
  - `pakapop39+glmvp-logistics@gmail.com`
- Map admin to existing `SUPER_ADMIN`; map the other three through the existing staff job groups `FINANCE`, `OPERATIONS` and `LOGISTICS`. `OPERATIONS` must resolve only to the existing role set `MEMBER_ADMIN`, `PRODUCT_ADMIN`, `ORDER_ADMIN`, `PURCHASING`, `QC`; Finance and Logistics must resolve only to `FINANCE` and `LOGISTICS`. Every staff role row has `organization_id=NULL`.
- Create and auto-confirm the admin Auth user first, then invoke the existing audited private `operator_bootstrap_super_admin(UUID,TEXT)` exactly once with that returned Auth User ID and name `GLMVP-STG-20260923 Admin`. This is the only non-emergency data-SQL exception: an exact `SELECT public.operator_bootstrap_super_admin('<returned-admin-auth-user-id>'::uuid,'GLMVP-STG-20260923 Admin');` through the isolated CLI context. `claim_initial_super_admin` is forbidden.
- Create the other staff accounts through the existing Admin user-management App/API flow and assign only the job groups above. Do not create/modify roles, permissions or role_permissions and do not use ad-hoc role SQL.
- Accounts must be admin-created verified/auto-confirmed without sending verification email.
- Synthetic passwords must come from a temporary runtime environment secret, never appear in source, command output, log or evidence, and be removed from the executor process environment when rehearsal evidence is complete.
- Because the empty baseline has no Hosted Category-create route, create exactly one Category through the bounded Admin SDK data path, not SQL: ID `4d18e30a-df55-4c79-a870-79e92f719001`, `parent_id=NULL`, code `GLMVP-STG-20260923-CAT`, `name_th=หมวดทดสอบ GLMVP`, `name_en=GLMVP Synthetic Category`, status `ACTIVE`, `sort_order=9900`. If this ID or code already exists or differs, stop; no update/delete is allowed. Supplier creation/activation must still use the existing Hosted routes.
- Create exactly one synthetic GLOBAL pricing formula through the Hosted Admin routes using the Admin/SUPER_ADMIN session: name `GLMVP-STG-20260923 Synthetic Formula`, `supplierId=NULL`, `productId=NULL`, first-create UTC timestamp as the checkpointed `effectiveFrom`, `effectiveUntil=NULL`, markup `25%`, freight `15–20%`, and enabled/included `PERCENTAGE` components `IMPORT=5%` of `FACTORY_COST_THB` (`ค่าดำเนินการนำเข้า`, sort 10), `OPS=10%` of `FACTORY_COST_THB` (`ค่าดำเนินงาน`, sort 20), and `SERVICE=10%` of `MEMBER_PRICE` (`ค่าบริการสมาชิก`, sort 30). Create/activate it after the post-delta backup and before Catalog/member-price UAT and the pre-recovery backup.
- Formula resume is fail closed: GET-discover first; one exact ACTIVE may resume, one exact DRAFT may activate, none may POST-create once. Multiple or mismatched same-name/GLOBAL formulas stop. An ambiguous POST result must reconcile by GET and must never blindly retry POST. No update/delete.
- Create exactly one Warehouse through the standard Admin SDK/API data path, not SQL: ID `25bd77ae-f4b4-4c3e-a483-80a20bb074f1`, code `GLMVP-STG-20260923-WH`, name `GLMVP-STG-20260923 Warehouse`, `country_code=CN`, address `{"fixture":"GO-LIVE-MVP-INITIAL-OPERATIONS-01","run_id":"GLMVP-STG-20260923","line1":"Synthetic China Warehouse"}`, timezone `Asia/Shanghai`, status `ACTIVE`, with `created_by` equal to the Logistics Auth User ID.
- SMTP must remain `false`; Active Schedule must remain `0`.
- No business notification process/send/retry, no schedule creation/activation, and no recipient outside this allow-list.
- No real Member, Production data/PII, real bank/payment document, real supplier or real money.

### Bounded fixture maxima

| Entity/artifact | Maximum |
| --- | ---: |
| Synthetic organizations / member profiles | 20 / 20; exactly one organization per member |
| Categories / Catalog products / Custom Requests / Quotations | 1 Catalog Category + 1 temporary post-backup Recovery Category (maximum 2) / 5 / 4 / 4 |
| Member projects | 20 |
| Simultaneous Order POST attempts | 40: exactly 20 members × 2 concurrent requests; no more than 20 Orders may result |
| Representative end-to-end Orders | 2 within the 20 Orders: one Catalog and one Custom RFQ |
| Customer payment transfers/evidence files | 6 / 6 |
| Supplier Orders / POs / supplier-disclosure records | 2 / 2 / 2; no Supplier Payment row |
| Production updates / QC inspections / QC evidence files | 8 / 4 / 8 |
| Warehouses / receipts / consolidations / shipments | Exactly the Warehouse above / 4 / 2 / 2 |
| Deliveries / POD files / delivery-issue cases | 2 / 2 / 1 |
| Freight invoices/cost items | 2 / 6 |
| All other synthetic files | 30 total across allowed buckets |

Allowed state transitions are only those exercised by `LMSTG-AC-04..14`. Deterministic child/link/status/audit rows created automatically by the exact authorized Hosted App/API/RPC calls are allowed, but the executor may not insert or alter them directly. This covers quotation/project/order items, catalog option/price/supporting master rows, payment schedules, supplier/order/warehouse/shipment/delivery/freight item links and immutable audit/status rows required by the two representative end-to-end Orders. Stop rather than create another top-level business object or invoke a route outside the sealed execution manifest.

## 8. UAT Scope

| ID | Required evidence |
| --- | --- |
| `LMSTG-AC-01` | New Project ID/host/key/storage differ from Production and old Staging; exact isolated CLI context |
| `LMSTG-AC-02` | SMTP false, Active Schedule 0 and no Production marker in config/payload/deployment |
| `LMSTG-AC-03` | Baseline 26 then Lean 12 migrations apply individually in exact hash/order |
| `LMSTG-AC-04` | Staging release attestation passes `C + []`, `D + [7]`, `D + [7,8]`; invalid combinations fail closed in the sealed Local automated tests and are not separately deployed |
| `LMSTG-AC-05` | Member onboarding, Published/Active Catalog selection, Custom RFQ/Quotation and Project flow pass |
| `LMSTG-AC-06` | Custom Request PDF/JPEG/PNG binding passes; spoof, wrong bucket/key/entity/org/member, cross-org and orphan access fail |
| `LMSTG-AC-07` | Exactly 20 synthetic members each issue 2 simultaneous Order requests; no more than one Order per member/project is created and the duplicate returns reloadable conflict |
| `LMSTG-AC-08` | Customer Deposit/Balance evidence, private preview, Finance Verify/Reject, partial/exact/overpayment and PO gate pass |
| `LMSTG-AC-09` | Supplier payment remains external/manual; Supplier Payment/Adjustment/Hold Hosted routes and Direct RPCs fail closed |
| `LMSTG-AC-10` | Production, QC, Warehouse, partial shipment, Delivery/POD and Actual Freight pass |
| `LMSTG-AC-11` | `DELIVERED_WITH_ISSUE` records delivery progress but blocks Order completion |
| `LMSTG-AC-12` | No new business notification job; processor/retry/send and deferred Claims/Advanced Reports fail closed |
| `LMSTG-AC-13` | Cross-org, inactive-user, private-file and role negative cases fail with audit evidence |
| `LMSTG-AC-14` | Backup/Stop/Reconcile/Resume/Restore rehearsal passes with no unexplained business delta |
| `LMSTG-AC-15` | Independent QA verifies Production baseline unchanged and reports PASS |

## 9. Mandatory Preflight Before Every Mutation Phase

Phase 0 before Project creation checks only exact Organization/account/name/region/nano/cost and forbidden IDs. A read-only project list must prove that the exact Organization contains zero projects with the target name. Before the create call, persist a Local `PROJECT_CREATE_STARTED` checkpoint binding Organization/name/region plus the fresh billing quote/session hashes. Invoke create exactly once with no automatic or manual retry. Immediately capture its returned ID/host/key and perform a read-only identity gate. If the response is missing or ambiguous, use only a read-only project list to reconcile: exactly one project matching every approved value may be captured and must then pass the post-create identity/`nano`/billing gate; zero, multiple or mismatched results mean STOP with no second create and no deletion. All later phases must perform every check below:

1. Reconfirm exact new Staging Project ID/name/host/region and confirm it is not Production, old Staging or a child.
2. Reconfirm exact candidate commit/tree/manifest and migration file hashes.
3. Reconfirm SMTP false, Active Schedule 0 and absence of Production ID/host marker.
4. Reconfirm expected migration count/head for the current phase.
5. Reconfirm named backup status `completed` when required.
6. Reconfirm fixture prefix, synthetic identities and zero real data.
7. Reconfirm provider-visible Billing evidence was captured in the same execution session no more than 15 minutes earlier, has Independent-QA attestation, binds the exact Organization/Project/`nano` tier and includes compute, backup, Storage and usage with total projected incremental cost no more than USD 10. Wrong tier, stale/missing evidence or cost drift stops before migration/deploy/data write.

Every CLI mutation after Project creation must run with working directory `C:\codex\GISP\.insforge-audit-lean-staging-new` linked to the captured new Project. Environment-variable project switching is forbidden.

Any mismatch is Fail Closed before the next write.

## 10. Stop Conditions

- Project identity, region, candidate, history, hash, schedule, SMTP, backup or cost differs.
- Production ID `865860c2-49fa-4e53-908f-9396b2f75233` or host marker `m8ugbyak` appears in a write target/payload.
- Old Staging ID `33481c06-9ac0-43e0-a13f-88480e409441` appears as a write target.
- Ghost Child ID `41df0506-ef0a-4753-9426-b1c8ed4f9ff6` or Production Schedule ID `aefecf8b-5b02-4649-a9b2-47aa448af0e8` appears in the new Staging config/payload.
- Need to delete/reset/restore old Staging or another project to continue.
- A migration fails or requires SQL change/retry beyond the exact unchanged file.
- A test requires real user/data/payment/email, new permission/business rule or Production mutation.
- Restore or Emergency Resume cannot reproduce the recorded Staging checkpoint.

## 11. Explicitly Out of Scope

- Any Production change, deploy, data, config, secret, schedule, backup or restore.
- Mutation, reset, restore, deploy or cleanup of old Staging ID `33481c06-9ac0-43e0-a13f-88480e409441`.
- Production release approval, real-member pilot and real transactions.
- Automatic notification, Supplier Payment workflow, Claims, Advanced Reports, Delivery Issue Resolution, payment adjustment/hold automation or new idempotency infrastructure.
- Deletion of any Project other than the exact new Staging at its retention expiry, paid upgrade, schedule activation, SMTP enablement and email send.

## 12. Evidence and Handoff

- Exact Local execution package: `.codex-tmp/lean-staging-runner/`.
- Semantic manifest SHA-256: `8832B6722D6FEA8F209F2D4E5C21CEFB62CF481B495794348B42B15DFB434D12`.
- Package aggregate SHA-256: `D26BE608955D4E508052578364DA79E044E14C0B1966942096535B4393F32F86`.
- `PACKAGE-MANIFEST.json` SHA-256: `0A1FAE470AD3F7B2F71FBA922610F400E71D0625EC90C8AC27D8F6BFE0948236`.
- `MANUAL-UAT-RECIPE.md` SHA-256: `1DB1D171AC4481556238D8A9F664E1E5B0A3BFD5E0881FEB2F70E247C9FB5DEF`; it is the only authorized manual Hosted App/API recipe for `LMSTG-AC-05..13`.
- Approved Local formula/sentinel implementation record: `.codex-tmp/LEAN-STAGING-FORMULA-SENTINEL-APPROVAL-20260923.md`, SHA-256 `4EBE90E49B4DFEEF55B2D6CF7C87D158907B300D88C584A670CC0AED0D1D1314`.
- Approved Risk Amendment: `GO-LIVE-MVP-INITIAL-OPERATIONS-01 — Lean Temporary Staging Risk Amendment v0.1`, SHA-256 `C98065E0148D2D715D4B062426F8582EB8AF482EC4C047D7C6186320C761B4F5`.
- Local package gates (Builder): offline tests `87/87` PASS, syntax PASS for every `.mjs`, default dry-run PASS with no Network/Write, package seal PASS, literal-secret scan PASS and no Backend/Network call.
- Independent QA R5: PASS for the exact Local sealed package; full `87/87`, focused `52/52`, syntax `31/31`, sealed inventory `33` files with mismatch `0`, dry-run `writes:false` / `networkCalls:false`; report `.codex-tmp/lean-staging-qa/LEAN-STAGING-RUNNER-QA-R5-20260923.md`, SHA-256 `A75B2C536635ED3E0E0A06E8B6D5B6CE86182C91554982A1591027B8D1661D17`.
- Automated phases may run only from package bytes that pass the exact aggregate seal. A business phase marked `MANUAL_UAT_REQUIRED` must follow the sealed recipe and cannot be marked PASS until its sanitized checkpoint matches run/phase/manifest/package/AC IDs and Independent QA supplies the exact gate. Missing or unverifiable adapters must stop before mutation.
- Sanitize every evidence file; never record API keys, tokens, passwords, signed URLs or file contents.
- Record new Project ID/host, backup IDs/status, migration versions/hashes, deploy identity, synthetic record counts and UAT results.
- Builder/Release Executor cannot approve its own Staging evidence; Independent QA must inspect the exact environment read-only.
- `LMSTG-AC-15` authorizes Independent QA to read Production baseline only through `C:\codex\GISP\.insforge-audit-production`; QA must not mutate Production and must return/leave that context linked to Production after the check.
- After Restore, reverify Project identity, auth/login, SMTP=false, Schedule=0, all three bucket visibilities, deployment env binding, release attestation, migration/function/ACL hashes and one valid login/UAT smoke before PASS.
- This document and its approval do not authorize Production.

## 13. Proposed Exact Authorization

> ผม ภคภพ ช.เจริญยิ่ง อนุมัติ Scope และ Temporary Staging Implementation ตามเอกสาร `GO-LIVE-MVP-INITIAL-OPERATIONS-01 — Lean Temporary Staging v0.1` และ checksum companion ที่แนบ รวม Risk Amendment SHA-256 `C98065E0148D2D715D4B062426F8582EB8AF482EC4C047D7C6186320C761B4F5` อ้างอิง Lean Scope SHA-256 `E13B4F5260A7234006EFD6A8042FB4441C153C5A4B8EF95639C0FD5600A94B5A`, Lean Local Addendum SHA-256 `3386047835F1D30C590B1574E5C4EF84C9DA2216C6C18600CC17702D1DA0BA3A` และ Custom File Binding Amendment SHA-256 `A5568CE2F4005151A168E6829356C0E77A7A4F3D44DE34A5F42998883C3AB480` สำหรับ exact candidate commit `8b2573729b7d2b8ad750414e1ba86daa633e4218`, tree `9cb01e050462ded9160ac2429667794b27ceaf00`, candidate manifest SHA-256 `89E51D111698D16467C16C2600218B9E1962468C6A09703152E5585026132ACD`, Production-B baseline manifest SHA-256 `71AFD16B32D952D3632ACF310663A9287F590A48E5E5870DFE6CF09F071790D0`, Lean runner semantic manifest SHA-256 `8832B6722D6FEA8F209F2D4E5C21CEFB62CF481B495794348B42B15DFB434D12`, package aggregate SHA-256 `D26BE608955D4E508052578364DA79E044E14C0B1966942096535B4393F32F86`, package manifest SHA-256 `0A1FAE470AD3F7B2F71FBA922610F400E71D0625EC90C8AC27D8F6BFE0948236` และ manual UAT recipe SHA-256 `1DB1D171AC4481556238D8A9F664E1E5B0A3BFD5E0881FEB2F70E247C9FB5DEF` อนุญาตให้ตรวจ provider-visible Billing evidence แบบ read-onlyที่มีอายุไม่เกิน 15 นาทีใน same execution sessionและผ่าน Independent QA attestationว่าครอบคลุม compute, backup, Storage และ usageรวมไม่เกิน USD 10 จากนั้นสร้าง standalone InsForge Project ใหม่ชื่อ `gisp-lean-staging-20260923` ภายใต้ Organization ID `e93668ea-e8ab-4361-9872-282454438478`, region `ap-southeast`, ขนาด `nano`, Resource/Billing Owner user ID `f3a87026-c41d-4ba0-83cf-e150a9ba1f93` โดยห้าม resize/add-on และห้ามลบ Project อื่นเพื่อคืน quota หากหลังสร้าง Projectไม่ใช่ `nano` หรือ cost/identityไม่ตรงให้หยุดก่อน migration/deploy/data writeและขอคำสั่งเรื่อง deletionแยก อนุญาตให้สร้าง buckets `gisp-public` public, `gisp-member-private` private และ `gisp-confidential` private เท่านั้น, Bootstrap baseline 26 migrations และ Apply Lean allow-list 12 migrationsทีละไฟล์ตาม exact order/hashโดยห้าม `up --all`, เขียนเฉพาะ deployment env/secret allow-list และ Deploy exact candidateไม่เกิน 4 ครั้ง ได้แก่ fail-closed bootstrap C ที่ห้าม fixture/UAT write ตามด้วย final `C+[] → D+[7] → D+[7,8]`, สร้าง bounded synthetic fixturesตามตารางรวม 20 Members/20 synthetic Organizations × 2 simultaneous Order requests, Auth usersไม่เกิน 24 บัญชีตาม exact aliases/job groupsโดยไม่ส่ง email, Bootstrap Super Adminหนึ่งครั้งผ่าน exact private operator call และสร้าง Warehouse exactหนึ่งรายการผ่าน Admin SDK/API ตามเอกสาร รวมสร้างสูตรราคา synthetic แบบ GLOBAL หนึ่งสูตรโดย Admin/SUPER_ADMIN ด้วย Global Markup 25%, Freight 15–20%, Import 5%, Operations 10% และ Service 10% ตาม exact field/retry contract ในเอกสาร และสร้าง Recovery Sentinel หลัง pre-recovery backup เท่านั้นจำนวนหนึ่ง Category ID `4d18e30a-df55-4c79-a870-79e92f719099` กับหนึ่ง objectใน bucket `gisp-confidential` ที่ใช้ UUID-v4 key รูปแบบ `recovery-sentinel/GLMVP-STG-20260923/<random-uuid>.txt` โดย checkpoint keyก่อนตรวจ absenceและ uploadได้ครั้งเดียว ห้าม retry/overwrite/update/delete; ยอมรับ residual replace-capable PUT riskเฉพาะ synthetic objectตาม Risk Amendmentและ ambiguous resultทำได้เพียง read-only reconcile ห้าม PASS สร้าง named backups 3 รายการ, รันเฉพาะ exact hash-pinned emergency Stop/Reconcile/Resume raw SQL exception และ Restore backupหนึ่งครั้งเฉพาะ Project ใหม่นี้ รวม UAT `LMSTG-AC-01..15` ตาม sealed runner/manual recipe กำหนด SMTP=false และ Active Schedule=0 ตลอด ห้าม notification process/send/retry ห้ามแก้หรือลบ old Staging ID `33481c06-9ac0-43e0-a13f-88480e409441`, Ghost Child `41df0506-ef0a-4753-9426-b1c8ed4f9ff6` และห้าม Production mutationทุกกรณี; อนุญาต Independent QA อ่าน Production baselineผ่าน context `C:\codex\GISP\.insforge-audit-production` เท่านั้น หาก identity/hash/history/backup/schedule/SMTP/cost/package seal ไม่ตรงหรือ migration ใดล้มเหลวให้หยุดก่อน mutationถัดไป Retention สูงสุด 30 วันหลังสร้างหรือ 14 วันหลัง Production rollout แล้วแต่ว่าอย่างใดถึงก่อน หากไม่มี Extension Authorization ให้ export sanitized evidenceและลบเฉพาะ exact new Staging ที่ identity ตรงเมื่อครบกำหนด ห้ามลบ targetอื่น ให้ใช้เวลาของข้อความอนุมัติเป็น `approved_at` กำหนด `data_authority: Bounded synthetic fixtures, exact GLOBAL formula, exact recovery Category/object, and exact one-time operator bootstrap call only on the new Staging project`, `migration_authority: Production-B baseline 26 + Lean exact 12 only; individual apply; no up --all; exact emergency raw-SQL exception`, `config_secret_authority: Exact Staging deployment env allow-list only`, `backup_restore_authority: Three named backups and one restore on the new Staging only`, `deletion_authority: Exact new Staging only at retention expiry after sanitized evidence export`, `staging_allowed: Yes for the exact new project and scope`, และ `production_allowed: No`

> การอนุมัตินี้รวม Project-create fail-closed contract ในข้อ 9: ก่อนสร้างต้องยืนยันแบบ read-onlyว่าไม่มี Projectชื่อเป้าหมายใน Organization, บันทึก Local `PROJECT_CREATE_STARTED` ที่ผูก Organization/name/region/quote/session hashes, เรียก createเพียงครั้งเดียวและห้าม retry หากผลไม่ชัดเจนให้ทำได้เฉพาะ read-only project-list reconciliation; เดินต่อได้เมื่อพบ exact matchเพียงหนึ่ง Projectและผ่าน identity/`nano`/billing gate หากพบศูนย์/หลายรายการ/ไม่ตรงให้หยุด ห้าม createซ้ำและห้ามลบ

## 14. Remaining Go-live Steps

After this exact authorization:

1. Execute new Temporary Staging, UAT and recovery rehearsal; Independent QA.
2. Prepare and obtain Production Release Authorization; rollout.
3. Open approximately 20 real Members and monitor for 24 hours.
