# GO-LIVE-MVP-INITIAL-OPERATIONS-01 — Local Auth Resume Corrective Approval

- `approved_by`: ภคภพ ช.เจริญยิ่ง
- `approved_at`: 2026-09-27T08:50:11.8772685+07:00
- `environment`: Local isolated worktree and exact Temporary Staging `a24aff68-a82e-41da-b64a-a128a1539769`
- `local_scope`: Local ignored Stage1 runner, adjacent tests, and package seal only.
- `auth_scope`: Read `public.users` only for `id/status`, verify email from `auth.users`, and add a fail-closed resume path that accepts the same existing synthetic Staging password once for hosted sign-in.
- `data_authority`: After independent QA, continue only the previously approved Order/Recovery operations. No duplicate fixture or account.
- `email_authority`: None. Never send another reset email or request another email code.
- `deploy_authority`: None
- `migration_authority`: None
- `config_schedule_authority`: None
- `production_allowed`: No

## Exact owner approval

> อนุมัติ Local Auth Resume Corrective ให้แก้เฉพาะ Local ignored Stage1 runner/tests/seal เพื่ออ่าน `public.users` เฉพาะ `id/status` และตรวจอีเมลจาก `auth.users` พร้อมเพิ่มทาง Resume โดยให้กรอกรหัสผ่าน Staging เดิมหนึ่งครั้งเพื่อล็อกอิน โดยห้ามส่ง reset email หรือขอรหัสอีเมลซ้ำ เมื่อ QA ผ่านให้ทำ Order/Recovery เดิมต่อ ห้ามแก้แอป, Deploy, Migration, Config, Schedule หรือ Production; `production_allowed: No`

## Confirmed state before implementation

- Existing Member 01 reset email and password checkpoints are both `PASS`.
- No Order POST checkpoint exists.
- The live failure was PostgreSQL `42703` because `public.users.email` does not exist; email remains available from the exact `auth.users` identity read.
