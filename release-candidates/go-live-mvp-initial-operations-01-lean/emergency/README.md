# Emergency package

Prepared Local artifacts only. `stop-*` and `resume-*` are idempotent ACL operations; Resume never grants Supplier Payment, Claims, Advanced Reports or generic notification enqueue. `function-snapshot.sql` and `reconcile.sql` are SELECT-only. `run-reconcile.mjs` verifies the template hash, exact CLI context project ID and explicit `SELECT_ONLY_RECONCILIATION` confirmation before calling the standard CLI with `shell:false`.

Execution, restore and any environment mutation require separate authorization.
