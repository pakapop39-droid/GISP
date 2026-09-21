# Production-B migration baseline for standalone Staging

**Source identity:** Production parent migration history, project `865860c2-49fa-4e53-908f-9396b2f75233`  
**Fetch context:** read-only CLI context `C:\codex\GISP\.insforge-audit-production`  
**File count:** `26`  
**Applied-history head:** `20260908170000_release-b-member-pilot.sql`  
**Authority:** Local packaging only; `production_allowed: No`

This directory is a mechanical LF-normalized copy of the 26 migration files
returned by the Production-B remote migration history. It is a schema/runtime
baseline, not a database dump: no existing Production row set, PII export,
credential, token value, or secret was cloned into this package. Migrations may
contain static reference/configuration data and runtime function bodies that
write rows only when those functions are later invoked.

Do not run `up --all` from the shared repository migration tree. After a
separate standalone Staging approval and identity/schedule preflight, apply
only these exact packaged files one at a time in the order below, verify each
SHA-256 before execution, then apply the separate 16-file candidate allow-list.
This document does not authorize creation of Staging, migration apply, data
write, deployment, or any Production change.

Hashes use canonical UTF-8 with CRLF/CR normalized to LF and trailing file
whitespace removed; this ignores checkout-only line-ending/final-newline drift.

| File | Canonical-LF SHA-256 |
| --- | --- |
| `20260731090000_foundation.sql` | `417E8A4924D113569C883495DDD333E61FB8783CFE0CDCEA263B9EF10922E33D` |
| `20260731091000_catalog-projects-quotations.sql` | `67821F43B60FBD9CEC8FBB59D0F725057D0CEADB892C4818D9EAA9745618ACFB` |
| `20260731092000_orders-operations.sql` | `17643104083D56E6ADC22A6FEBC5B095A091C26987BB40C598C7940FD85DCAC5` |
| `20260731093000_storage-rls.sql` | `229C3DA497644303F54C96C2672FE52C3398425772DF4E5DABDF31D0E1976FDE` |
| `20260731094000_notifications.sql` | `8B8E2A23C968B73852BF43226C1E0B3DF89B55F56A4E0E5B4B7D7AEFF23335B6` |
| `20260731095000_fixed-reports.sql` | `4B50846EA6C5E86EF1AAF3B0F18D5320D7BE6075C6FE29C5452535B46FBA0585` |
| `20260731096000_secure-initial-admin-bootstrap.sql` | `2E3BB59F61F42ED3B317C611C50C3890A028186559C89772F7E5548D53C58B34` |
| `20260731097000_secure-member-catalog-view.sql` | `922D8FC015CF2B31EB308D18C6EEBE65048F87E7549021F9ADF79FB071CBA24A` |
| `20260817234156_slice-1-access.sql` | `25EBC47DD90D3A5FC6F3B06B4EFC6CA2197B208146ADF6693CA87B7ADB9D716F` |
| `20260817235342_slice-1-admin-helpers.sql` | `DBBA284D94663F24E7E4F68555F302D508A62C223D74B39CB8E2B628E1D832BA` |
| `20260818000655_slice-1-audit-file-guards.sql` | `5CB09ED8A6B366BF248A9CEB3E601F7A3FBD48CDD64CC30FF2E5E84412BA3398` |
| `20260818000926_slice-1-operator-user-lookup.sql` | `4BAB9BA05F504692D2200F3E10B0CC59102BBE675F5CFA6C875BB4939E375592` |
| `20260818145357_slice-2-catalog-foundation.sql` | `E50C7821F4B146E5CAA8CEF94B7DA5AB402966F0FEE9D388C21F276DFBDBDBBC` |
| `20260818151117_slice-2-pricing-engine.sql` | `883B9F7397DEC8AE9AB8F450247CA782F0E6F35C237CEAD84407334B08E93B7F` |
| `20260818152901_slice-2-catalog-actions.sql` | `8387B0834D3746E3D33699B401846D3247F1F5F9572EFA866DCC6706A6689402` |
| `20260818193000_slice-2-product-lifecycle.sql` | `EC126B2B54BEE419D8EFF822FB3121D3F36B6A33A697214AA0827B989073A9AE` |
| `20260818193001_add-product-options-workflow.sql` | `6D7AC27357688B35A40908958FCE32B56CE2631FB26B8D8A5B1BD6F3FE8A068B` |
| `20260818234345_catalog-import-file-guard.sql` | `64D0CDA709CD468F16BC7AAA89E652D09E2F853C9103885B530DDBC4ACF8A428` |
| `20260819004500_catalog-batch-operations.sql` | `8BDF8BA0C3AD97CDB1A943FD93505480164A133B744A211F7D4C2D3EAFA5F609` |
| `20260819010500_catalog-batch-rls.sql` | `F980E69027450BAFD287CE6921AAE73B8177E27175033348F22C7C23A8520CA3` |
| `20260819013000_catalog-batch-state.sql` | `69EC92FF1E2E45AAD37BD33585D286FA8646866CF595246E0E1A22B1DD346377` |
| `20260822134500_catalog-import-workflow-ui.sql` | `958480310BB281A74EEC19A489CA7482278154F5594B3072506F9A2CD2393F9C` |
| `20260904214500_release-a-runtime-hardening.sql` | `929C81586AB6DA983C2C5103B14B93CBD5A8C3E0A0A191596E034167F94EA799` |
| `20260906010000_production-mvp-upgrade.sql` | `95FCB8EDCC1B32AB9198BDDFCD0FDC8D5FAE5AF19D1C4B2F0C41FDB9FEF45372` |
| `20260906020000_restrict-sequence-helper-rpc.sql` | `84CBA9377379F309008EDCE2D8A93543F9AC0A7EF408A996D0E3F8DEBE7AB649` |
| `20260908170000_release-b-member-pilot.sql` | `662F33A521A503F323AF6EB30487280B99588122D02D065C150ADE85B2EB90F1` |
