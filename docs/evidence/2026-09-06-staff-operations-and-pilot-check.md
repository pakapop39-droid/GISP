# Production staff operations and Member Pilot check

Date: 6 September 2026. Production project: 865860c2-49fa-4e53-908f-9396b2f75233.

- User reported all three staff passwords reset. Three PASSWORD_RESET_COMPLETED SUCCESS events observed at 02:08:31.444Z, 02:09:21.866Z, 02:10:15.683Z. Anonymous event attribution cannot independently prove each email; no password was requested or retained.
- Deployment 6b865051-aebc-4919-959e-d5aae0bc145b READY. RELEASE_STAGE=A plus ENABLE_STAFF_OPERATIONS=true. The server flag is persisted in deployment configuration and passed into both route gate and staff navigation. Endpoint authentication and role permissions remain in force. Slice 12/13 still gated.
- Release gate tests 9 passed, targeted ESLint and TypeScript passed, frozen-source production build passed.
- Live unauthenticated HTTP: /, /login, /forgot-password, /api/health = 200; /admin/orders = 307; admin orders/shipments/claims APIs = 401; /register, signup API, Member orders API, sourcing options API = 404. Evidence: output/production-completion-20260906/production/staff-operations-http.json.
- Existing Owner browser session loaded /admin/orders: Order, Finance and Supplier PO workspace; all queues zero; no orders. No test order/payment was created.
- User selected pakapop39@hotmail.com for Member Pilot, reporting already registered. Read-only exact-email query found no auth account in Production. Development query found ACTIVE with MEMBER_ADMIN, PRODUCT_ADMIN, ORDER_ADMIN, PURCHASING, QC. Browser inventory showed kit6y4pj.insforge.site/member/catalog. This is not a verified Production Member. No account copied or roles changed.
- Prepared docs/active/MEMBER TERMS AND PRIVACY DRAFT.md for review. It is not published and does not establish company refund, claim, retention or other unresolved policies.

Staff provisioning/password setup subtask: 0 steps remaining based on user confirmation. New-password staff login and a complete transaction still require user UAT. Overall Production completion retains 5 main steps: business policy/opening data, Member Pilot, Member transactions, aftersales, UAT/handoff.
