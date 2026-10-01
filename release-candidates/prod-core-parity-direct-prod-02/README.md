# PROD-CORE-PARITY-DIRECT-PROD v0.2

This package is source-only. It does not authorize or perform a Production release.

Activation requires both controls:

1. Apply `migrations/20261001203111_prod-core-parity-direct-prod.sql` under a separate Production Release Authorization.
2. Set the exact frontend combination `RELEASE_STAGE=D`, `RELEASE_D_ENABLED_SLICES=7,8,9,10`, and `PRODUCTION_CORE_PARITY_ENABLED=true`. No partial or progressive combination is valid for this maintenance patch. Any mismatch fails the release attestation and fails closed all Release C/D transaction and operations routes, panels, and writes covered by this package.

Emergency stop order:

1. Set `PRODUCTION_CORE_PARITY_ENABLED=false` and redeploy/restart the frontend. The central route gate then blocks every Release C/D transaction and operations route in scope, and the order projection hides Supplier Payment and Production Timeline controls. Verify `/api/health/release-attestation` returns HTTP 503 before relying on the stop.
2. If database writes must be stopped immediately, apply `emergency/stop-core-parity.sql` under the incident authority. It revokes RPC execution and does not mutate business rows.

The release migration preserves the private hardened implementations, resolves permissions against the target organization, rejects self-approval, and rejects a paid action by the same actor who approved it.
