# Catalog search field styling

The search field used a bordered wrapper plus a bordered input. The wrapper
also retained a different height in compact mode. Replaced this with the same
label and direct input structure as adjacent category/sort controls and added
the visible accessible label ค้นหาสินค้า. Removed the obsolete wrapper/input
CSS overrides. Search filtering and pagination handlers are unchanged.

Verification: targeted ESLint and Next.js build passed. Browser inspection of
the toolbar with the real application styles confirmed one border, matching
heights/alignment, and a single focus indicator. This visual fixture did not
exercise authenticated API calls. Original files are backed up under
output/backups/catalog-search-20260906/.

Development deployment 66026a32-82ba-44c0-bff9-c6b2f4eb8054 is READY at
https://kit6y4pj.insforge.site. Scope complete: 0 remaining implementation steps.
