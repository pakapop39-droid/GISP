# Incident runbook

1. Stop user traffic and capture `emergency/function-snapshot.sql` output.
2. With separate incident authorization, apply Stop in reverse order: D8, D7, C.
3. Run only `emergency/reconcile.sql` through the guarded runner; preserve output outside the backend.
4. Diagnose without deleting or rewriting business/audit data.
5. Forward-fix, then Resume C, D7, D8 in order under separate authorization.
6. Repeat snapshot/reconcile and compare exact function bodies/ACL.

Do not restore a backup, deploy an older app, enable Supplier Payment/Claims/Reports/notifications, or use a shared migration tree under this document.
