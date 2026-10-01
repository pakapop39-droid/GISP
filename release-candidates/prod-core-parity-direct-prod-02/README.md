# PROD-CORE-PARITY-DIRECT-PROD v0.2

This package is source-only. It does not authorize or perform a Production release.

Activation requires both controls:

1. Apply `migrations/20261001203111_prod-core-parity-direct-prod.sql` under a separate Production Release Authorization.
2. Set `RELEASE_STAGE=D`, `RELEASE_D_ENABLED_SLICES=7,8,9,10`, and `PRODUCTION_CORE_PARITY_ENABLED=true` on the frontend deployment. Any incomplete combination fails the release attestation; any parity-switch value other than the literal `true` hides the newly opened routes.

Emergency stop order:

1. Set `PRODUCTION_CORE_PARITY_ENABLED=false` and redeploy/restart the frontend so the routes and controls disappear.
2. If database writes must be stopped immediately, apply `emergency/stop-core-parity.sql` under the incident authority. It revokes RPC execution and does not mutate business rows.

The release migration preserves the private hardened implementations, resolves permissions against the target organization, rejects self-approval, and rejects a paid action by the same actor who approved it.
