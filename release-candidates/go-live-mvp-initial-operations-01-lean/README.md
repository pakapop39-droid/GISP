# GO-LIVE-MVP-INITIAL-OPERATIONS-01 Lean candidate

Local-only candidate for the approved Lean initial-operations contract. It contains exactly 12 ordered delta migrations: 11 immutable reused files plus the new guard. This directory is evidence, not Apply/Deploy/Staging/Production authority.

The Production-B schema baseline is pinned by `release-candidates/full-flow-go-live-01/production-b-baseline/MANIFEST.md` SHA-256 `71AFD16B32D952D3632ACF310663A9287F590A48E5E5870DFE6CF09F071790D0`. Apply tools must never use the shared migration tree or `up --all`.

Supplier payment is manual/off-system. Claims, advanced reports, adjustment/reversal/hold and notification processing are deferred and fail closed.
