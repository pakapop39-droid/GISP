# Dependency and security evidence

- Baseline manifest SHA-256: `71AFD16B32D952D3632ACF310663A9287F590A48E5E5870DFE6CF09F071790D0`.
- Migration #12 depends only on C/D7/D8 objects created by the ordered package.
- No table, role, permission name, package dependency, price, VAT, 50/50 split or Freight formula is created or changed.
- Supplier Payment, Claims, Advanced Reports and generic notification enqueue execute privileges are closed by exact signature.
- `verify_payment_transfer_private(UUID,BOOLEAN,TEXT,TEXT,UUID,TEXT,BIGINT)` is not redefined or revoked.
- Custom Request generic download is denied and uploads validate extension, declared MIME and magic bytes before storage.
- Evidence is static/local; it does not claim hosted ACL execution or migration apply.
