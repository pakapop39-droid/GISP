# RLC-HARDEN-01 isolated rehearsal evidence template

Status: `NOT EXECUTED`

## Authorization and candidate

- Execution Approval Record:
- approved_by / approved_at:
- candidate commit: `cf62215b0cb359de87700b35f45c6d4ba1aaf1c2`
- candidate tree: `8345c23b52b2ddc102dbc8bc92d237f957eeb1ef`
- evidence commit/tree:

## Exact targets and preflight

- Child ID/name/appkey/state/mode: `41df0506-ef0a-4753-9426-b1c8ed4f9ff6` / `rlc-harden-01-rehearsal-20260920` / `m8ugbyak-bd6` / ____ / ____
- Parent ID/appkey: `865860c2-49fa-4e53-908f-9396b2f75233` / `m8ugbyak`
- Schedule ID/name/state/target result: `aefecf8b-5b02-4649-a9b2-47aa448af0e8` / `GISP-Notification-Retry` / ____ / ____
- Active schedules targeting Production count before each write: ____
- Production migration baseline count/head: `26` / `20260908170000`
- Production schedule baseline unchanged: PASS / FAIL
- Sanitization review: PASS / FAIL; no secret values retained

## Migration allow-list results

| Order | File | Expected SHA-256 | Actual SHA-256 | Current Child re-read | Schedule re-read | Result |
|---:|---|---|---|---|---|---|
| 1 | `20260920010000_pay-close-legacy-entry.sql` | `081e4105445f2b51be6d7798c6175345237c2ae20bb8966baf0f363ec959e26b` | | | | NOT RUN |
| 2 | `20260920010100_pay-evidence-binding.sql` | `c9f09a6dfe6c4a07472a2bbae40530b62707ad6be1d1b0d78a5747ee91cda11c` | | | | NOT RUN |
| 3 | `20260920010200_pay-private-executor.sql` | `4cc15afc0583b1b0e9f9183d3b194cea7da510c85480c1107eaa2e6c8f82c929` | | | | NOT RUN |
| 4 | `20260920010250_release-c-org-scope-hardening.sql` | `0d2fac819d158a2a87962b181f2f637ada298b7973240341dfcef46f4be9bfa2` | | | | NOT RUN |
| 5 | `20260920010300_release-c-privileges.sql` | `852a12532b9103809361e396647cdb8cb303da2cbefcedbd8a36813fbb09b98f` | | | | NOT RUN |

Record sanitized CLI stdout/stderr, exit code and remote migration head after each explicit apply. `up --all` and `up --to` are prohibited.

## Synthetic fixture manifest

- prefix: `REH-RLC-HARDEN-01`
- creation command/result:
- organizations and immutable IDs:
- synthetic actor aliases and immutable IDs:
- table before/after counts:
- audit IDs:
- external notification/payment calls: `0`

Do not record passwords, keys, cookies, tokens, Authorization headers, real emails or business row contents.

## Runtime results

| Case | Global | Same-org scoped | Other-org scoped | No role | Anonymous | Audit/atomic evidence |
|---|---|---|---|---|---|---|
| RFQ list/detail | | | | | | |
| Quotation cost/RLS | | | | | | |
| Order list/detail | | | | | | |
| File metadata/download/RLS | | | | | | |
| Supplier payment/status oracle | | | | | | |

Direct RPC negative results:

- `issue_supplier_orders`:
- `create_supplier_payment`:
- `review_supplier_payment`:
- `mark_supplier_payment_paid`:
- `decide_order_cancellation`:

Integrity and lifecycle:

- duplicate UUID rejection / zero partial writes:
- mixed-case duplicate UUID rejection / zero partial writes:
- INACTIVE session/context/touch/application denial:
- Release C enabled:
- D7/D8/D9/D10 closed:
- Freight closed:

## Cleanup and final Production checks

- cleanup separately authorized: YES / NO
- prefixed fixture count before/after:
- non-prefixed counts unchanged:
- Production schedule unchanged:
- Production migrations still `26` / `20260908170000`:
- CLI returned to Production parent:
- limitations / failed steps / support IDs:

