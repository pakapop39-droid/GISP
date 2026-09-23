# GO-LIVE-MVP-INITIAL-OPERATIONS-01 — Custom File Binding Amendment v0.1

## 1. Document Control

| Field | Value |
| --- | --- |
| Amendment ID | `GO-LIVE-MVP-INITIAL-OPERATIONS-01-CUSTOM-FILE-BINDING-01` |
| Version | `v0.1` |
| Date | 2026-09-23 (Asia/Bangkok) |
| Status | **Proposed — Awaiting Scope and Local Implementation Authorization** |
| Parent Scope | `GO-LIVE-MVP-INITIAL-OPERATIONS-01 v0.2 — LEAN Scope Amendment` |
| Parent Scope SHA-256 | `E13B4F5260A7234006EFD6A8042FB4441C153C5A4B8EF95639C0FD5600A94B5A` |
| Parent Local Addendum SHA-256 | `3386047835F1D30C590B1574E5C4EF84C9DA2216C6C18600CC17702D1DA0BA3A` |
| Worktree | `C:\Users\ASUS\.codex\worktrees\full-flow-go-live-01\GISP` |
| Branch | `codex/full-flow-go-live-01` |
| Baseline HEAD/tree | `88b8b6d992cc2e91b3526312dc21cbc96f05b97d` / `71b80afb5c328a9be521af34129f3c82e8101053` |
| Pre-amendment Lean migration #12 SHA-256 | `287292A1D37DC7A31C64A738B9234D3D903EE427F531F6D70CC0ADC4700C1EF0` |
| Pre-amendment Lean candidate manifest SHA-256 | `89E51D111698D16467C16C2600218B9E1962468C6A09703152E5585026132ACD` |
| Data authority | Local in-memory mocks only |
| Migration authority | None |
| Backend/network write | None |
| Staging allowed | No |
| Production allowed | No |

## 2. Reason

Independent QA พบว่า dedicated Member/Admin Custom Request download routes ตรวจ Request ownership/Organization และ link existence แล้ว แต่ยังไม่ยืนยันว่า `file_metadata` แถวนั้นผูกกับ Custom Request เดียวกันแบบครบทุก field หากข้อมูล link หรือ metadata ผิดรูป อาจออก signed URL ให้ไฟล์ที่ไม่ควรถูกดาวน์โหลดได้

การแก้นี้เป็น security completion ของข้อกำหนด private-file/cross-org เดิม ไม่เพิ่ม feature หรือ business flow ใหม่

Working tree มี dirty files ของ Lean candidate ที่ Builder เดิมเป็นเจ้าของ ไฟล์เหล่านั้นเป็น no-touch ภายใต้ Amendment นี้ ยกเว้น 4 ไฟล์ใน Exact File Allow-list เท่านั้น

## 3. Exact File Allow-list

Modify:

- `src/app/api/member/custom-requests/[id]/files/[fileId]/route.ts`
- `src/app/api/admin/custom-requests/[id]/files/[fileId]/route.ts`

New:

- `src/app/api/member/custom-requests/[id]/files/[fileId]/route.test.ts`
- `src/app/api/admin/custom-requests/[id]/files/[fileId]/route.test.ts`

ไฟล์อื่นทั้งหมดเป็น read-only ภายใต้ Amendment นี้ หากจำเป็นต้องแก้ไฟล์อื่นต้องหยุดและขอ Amendment ใหม่

Pre-change source hashes ที่ต้องตรงก่อนเริ่ม:

- Member route: `DE56BE6B0802DCB86A23D969C97194F6D8F4C015C87383BEC6009110621C2EC6`
- Admin route: `BAD6AED48E2BB359EE32F09262EF672AF70650C21F150B4F30FB503D819650B9`

## 4. Required Binding Contract

ก่อนออก signed URL ทั้ง Member และ Admin route ต้องยืนยันพร้อมกันว่า:

1. `CFB-REQ-001`: Custom Request และ file link มีอยู่จริง
2. `CFB-REQ-002`: Member GET route — ผู้ใช้เป็นเจ้าของ Request และอยู่ใน Organization ที่ถูกต้อง
3. `CFB-REQ-003`: Admin GET route — actor มีสิทธิ์และ Organization scope ที่ถูกต้องตาม behavior เดิม
4. `CFB-REQ-004`: `file_metadata.id` ตรงกับ requested `fileId`, `entity_type = 'CUSTOM_REQUEST'` และ `entity_id` ตรงกับ Custom Request `id`
5. `CFB-REQ-005`: `file_metadata.organization_id` ตรงกับ Custom Request `organization_id` และ `member_profile_id` ตรงกับ Custom Request `member_profile_id`
6. `CFB-REQ-006`: `bucket = 'gisp-member-private'` และ `visibility = 'MEMBER_PRIVATE'`
7. `CFB-REQ-007`: `object_key` ต้องไม่ว่างและขึ้นต้นด้วย exact prefix `custom-requests/{memberProfileId}/{requestId}/`
8. `CFB-REQ-008`: เมื่อ query ผิดพลาด, metadata ไม่มี, field ใดเป็น null/ไม่ตรง หรือ link เป็น orphan/malformed ต้อง Fail Closed ก่อนเรียก storage signed-URL API
9. `CFB-REQ-009`: Hardening นี้ใช้กับ `GET`/signed-URL authorization เท่านั้น ห้ามเปลี่ยน `DELETE`, deletion order, database deletion, storage removal หรือ cleanup behavior แม้ Member route จะใช้ helper ร่วมกันอยู่ก่อนแก้

ห้ามเปลี่ยน storage bucket/key, expiry, response payload, role model, Organization model หรือ behavior ของไฟล์ประเภทอื่น

## 5. Acceptance Criteria

- `CFB-AC-01`: Valid same-request binding ดาวน์โหลดได้ตาม GET behavior เดิม
- `CFB-AC-02`: Wrong `entity_type`, wrong `entity_id`, wrong Organization และ wrong Member Profile ถูกปฏิเสธ
- `CFB-AC-03`: Wrong bucket, wrong visibility, blank key และ key ที่อยู่นอก exact request/member prefix ถูกปฏิเสธ
- `CFB-AC-04`: Missing/null metadata และ orphan/malformed link ถูกปฏิเสธ
- `CFB-AC-05`: Cross-org Member/Admin ถูกปฏิเสธ
- `CFB-AC-06`: ทุก negative case ยืนยันว่า signed-URL API ถูกเรียก `0` ครั้ง
- `CFB-AC-07`: Member `DELETE` tests ยืนยัน deletion order, database deletion, storage removal และ cleanup behavior เดิมไม่เปลี่ยน
- `CFB-AC-08`: Adjacent tests, existing Custom RFQ/file security tests, typecheck, lint, full tests, build และ `git diff --check` ผ่าน; changed-file secret scan ไม่พบ secret

## 6. Explicit No-touch

- Database schema, migrations, data และ ACL
- Member `DELETE` behavior, Upload route, generic download route และ production source อื่น
- `.env*`, `.insforge/**`, credentials, secrets และ `.codex-tmp/**`
- Backend, Staging, Production, Apply Migration, Deploy, Notification, Schedule, Restore และ Cleanup/Delete
- Pricing, payment, Order, Catalog, Release B และ business rules ทุกชนิด

## 7. Proposed Authorization

> ผม ภคภพ ช.เจริญยิ่ง อนุมัติ Scope Amendment และ Local Implementation ตามเอกสาร `GO-LIVE-MVP-INITIAL-OPERATIONS-01 — Custom File Binding Amendment v0.1` และ checksum companion ที่แนบ โดยอ้างอิง Lean Scope v0.2 SHA-256 `E13B4F5260A7234006EFD6A8042FB4441C153C5A4B8EF95639C0FD5600A94B5A` และ Local Addendum SHA-256 `3386047835F1D30C590B1574E5C4EF84C9DA2216C6C18600CC17702D1DA0BA3A` อนุญาตให้แก้เฉพาะ GET/signed-URL authorization ใน Member/Admin Custom Request dedicated download routes และสร้าง adjacent tests รวม 4 ไฟล์ตาม Exact File Allow-list ใน Local isolated worktree `C:\Users\ASUS\.codex\worktrees\full-flow-go-live-01\GISP` branch `codex/full-flow-go-live-01` เท่านั้น ห้ามเปลี่ยน Member DELETE behavior อนุญาต Local in-memory mocks เพื่อทดสอบ ห้ามแก้ไฟล์อื่น, Migration, data, Backend, Staging, Deploy, Apply Migration หรือ Production ให้ใช้เวลาของข้อความอนุมัติเป็น `approved_at` กำหนด `data_authority: Local in-memory mocks only`, `migration_authority: None`, `network_backend_authority: None`, `staging_allowed: No` และ `production_allowed: No`

## 8. Remaining Steps

หลัง Amendment authorization เหลือ 4 ขั้นตอนเพื่อปิด Lean Go-live Slice:

1. แก้ 2 routes + tests และ Independent QA ซ้ำ
2. Temporary Staging Authorization และ UAT/recovery rehearsal
3. Production Release Authorization และ rollout
4. เปิดสมาชิกประมาณ 20 คนและ monitoring 24 ชั่วโมง
