# GO-LIVE-MVP-INITIAL-OPERATIONS-01 — Local Auth Session Reconcile Approval

- `approved_by`: ภคภพ ช.เจริญยิ่ง
- `approved_at`: 2026-09-27T09:03:15.2123724+07:00
- `environment`: Local isolated worktree and exact Temporary Staging `a24aff68-a82e-41da-b64a-a128a1539769`
- `local_scope`: Local ignored Stage1 runner, adjacent tests, journal reconciliation evidence, and package seal only.
- `auth_scope`: Reconcile the prior successful login from exact `app_sessions` read-back; bind the `public.users` read to the frozen Member 01 ID before comparing it to hosted `context.userId`; allow one more sign-in with the same existing synthetic Staging password.
- `email_authority`: None. No reset email or email code.
- `data_authority`: After independent QA, continue only the previously approved Order/Recovery operations.
- `deploy_authority`: None
- `migration_authority`: None
- `config_schedule_authority`: None
- `production_allowed`: No

## Exact owner approval

> อนุมัติ Local Auth Session Reconcile ให้บันทึกว่าการล็อกอินครั้งก่อนสำเร็จจาก exact `app_sessions` read-back แก้ Local runner/tests/seal ให้ query `public.users` ด้วย Member 01 ID ที่ตรึงไว้แล้วจึงเทียบกับ hosted `context.userId` และอนุญาตล็อกอินด้วยรหัสผ่าน Staging เดิมอีกหนึ่งครั้งเพื่อสร้าง session ใหม่ หลัง QA ผ่านให้ทำ Order/Recovery เดิมต่อ ห้ามส่ง reset email ขอรหัสอีเมล แก้แอป Deploy Migration Config Schedule หรือ Production; `production_allowed: No`

## Read-only reconciliation evidence

- Prior sign-in created exact Member 01 app session `b4e19d85-f03d-42ac-a4a7-bc26da487482` at `2026-09-27T02:01:00.376Z`, active and not revoked.
- Exact Project order count remained `0` after the runner stopped.
- Runtime journal contained `member01-resume-login.STARTED` without `PASS`; no Order marker existed.
