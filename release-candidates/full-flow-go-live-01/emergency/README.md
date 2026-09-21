# FULL-FLOW-GO-LIVE-01 exact-candidate emergency package

**Status:** Local templates only; no SQL has been applied.  
**Authority:** `FULL-FLOW-GO-LIVE-01 v0.1`, `production_allowed: No`.

The historical package under `release-candidates/pay-rpc-gate-001/emergency/`
remains unchanged. This directory is the exact candidate recovery package and
adds coverage for Payment Adjustment review, payment recalculation, workflow
hold confirmation, the wrapped verified-transfer executor, and the two
reconciliation tables.

## Stop order

Run only after a separate environment-specific authorization and exact
function/ACL snapshot: `stop-d10.sql` → `stop-d9.sql` → `stop-d8.sql` →
`stop-d7.sql` → `stop-c.sql`. The C stop replaces user-facing private
financial write executors with fail-closed `EMERGENCY_WRITE_DISABLED` bodies
and removes `project_admin` EXECUTE from every new private financial helper.
Never use wildcard ACL changes or `up --all`.

## Forward resume order

After SELECT-only reconciliation, no-write-delta verification, incident backup,
Independent QA, and a separate authorization: `resume-c.sql` →
`resume-d7.sql` → `resume-d8.sql` → `resume-d9.sql` →
`resume-d10.sql`. Resume C restores the exact pre-C bodies/ACL. Resume D8
then restores the exact post-D Freight-aware recalculation and hold-confirm
bodies. Legacy direct Payment bypasses remain revoked.

`reconcile.sql` is SELECT-only and covers orders, payment schedules,
verified transfers, `payment_adjustments`, `payment_workflow_holds`,
shipments, files, notifications and audit events. Set the session-level
`gisp.cutover_at` before running it; the file itself contains no `SET` or
write statement.

## SHA-256 inventory

Hashes use canonical UTF-8 content with CRLF/CR normalized to LF and trailing
file whitespace removed. Verify each file before authorized use.

| File | SHA-256 |
| --- | --- |
| `function-snapshot.sql` | `4BDFD8773DEDC668A019AA462D4AECAA65E4259B0D8C00E73ABC253B65E0ADC9` |
| `reconcile.sql` | `09A013AB644698278D19E4BC589BE5AF8F3EF26E8BBB6F0DC96A543358574B40` |
| `resume-c.sql` | `4817F836536058262B94D8E4FDECC43E1AE34F74BB65F5D0C04C360E3682662F` |
| `resume-d10.sql` | `363C60C76687829D36E61FE42C264EFA812AD2205DC5D1AB9F342D16C37F048C` |
| `resume-d7.sql` | `98CC941A83DB6EAE077DACEAD8B4EBB01CB36FE6B9E7A38C600594D7DD8DA3E7` |
| `resume-d8.sql` | `C25A5900F6073DC0E890FFFEB2B82860913E848959CB4328E6BA9721DA41838E` |
| `resume-d9.sql` | `CDEA0786BDC272645741782E5DF1D1FF6C2277735BC930F6150F9031BB4A185F` |
| `stop-c.sql` | `079F8AF1F7AC57E262896BCC754781DB23D1E64894AA177501A77F506269BF8D` |
| `stop-d10.sql` | `02133352788813B22BBDE127AF2A24D7DB0899BE16D9933D4CF06000DB6B9654` |
| `stop-d7.sql` | `293AC4984FA4A6AB4285526CD9A3DE0F167665735DE7A015185DA71E315D795B` |
| `stop-d8.sql` | `0515AA486F7A9F3B10DF38BE50B48F9CA59C68706C65E96ED1D687D739E002D8` |
| `stop-d9.sql` | `DF117BDA42A5A8DE36399862C20EBB0AF8C8630F4622E443643C65B69432F981` |
