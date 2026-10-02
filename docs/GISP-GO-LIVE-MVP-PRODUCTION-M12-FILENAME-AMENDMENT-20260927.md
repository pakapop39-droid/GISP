# Production M12 Filename Amendment — 2026-09-27

- Approver: ภคภพ ช.เจริญยิ่ง
- Environment: Production project `865860c2-49fa-4e53-908f-9396b2f75233`
- Mechanical alias: `20260923090000_startup-initial-operations-guard.sql`
- Required SHA-256: `287292A1D37DC7A31C64A738B9234D3D903EE427F531F6D70CC0ADC4700C1EF0`
- Migration authority: apply this alias as #12 once, then apply the already authorized #13 once
- Production allowed: Yes — bounded continuation of the existing Production Canary Release

The alias bytes must be identical to the originally approved #12. Migrations #1–#11 must not be replayed. `up --all`, `--to`, and raw SQL are prohibited. After exact history verification, deployment and Canary may continue under the existing authorization.
