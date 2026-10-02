# Lean Order closeout candidate v0.3

Status: **Local frozen app candidate. Staging UAT and Recovery remain unverified. Production is not authorized.**

## Source identity

- Candidate commit: `456bb844ef5913dc63ff043684ee0981ed62c6a8`
- Candidate tree: `af9c5f44a14293da78a8ce61b3dd03ce350aeb77`
- Parent Order migration candidate: `2317e60e013c16b907732368d195afd39fc7e64c`
- Base app commit before Migration #13: `6280c52d72c1182e40f7963c6255b218559b7615`
- Parent Order manifest SHA-256: `39F64745F6DCA2F66B092474521E4F19CC9FFC2FF592B85A193CBA380DFB899C`

The only files added to the parent commit by this candidate are `src/lib/api/response.ts` and `src/lib/api/response.test.ts`. Their current SHA-256 values are `2217E0C17AD4D51CFFC21AC769EF9E2A7B3DFA6685E33EB746B963FBEC6D3AA3` and `6BDDC37C6D3C2D5E0A40E0C680C651B9B5D25F39D36884382269964712872A75`, respectively. The change maps exact `PROJECT_ITEM_NOT_READY` and `INVALID_ORDER_QUANTITY` failures to reloadable HTTP 409. No pricing, authorization, or Order-writing path changes in this commit.

## Migration identity

Migration #1–#12 remain exactly the twelve entries in the parent Order manifest. Migration #13 is `20260926150000_order-cost-version-snapshot.sql`, SHA-256 `F35C9192B89FE6DA4A011AEB574BF08C6924C3264E5415DFD51B048E1E5B8DDE`. The source and package mirror must match this hash. On named Staging `a24aff68-a82e-41da-b64a-a128a1539769`, #13 was previously applied once; this candidate grants **no** permission to reapply it. Do not use `up --all`.

## Approval and execution boundary

- Owner: ภคภพ ช.เจริญยิ่ง; approval text: the annotated Stage-1 instruction in this Codex task, recorded on 2026-09-26. It authorizes freezing this bounded candidate, independent QA, and conditional named-Staging Stage-1 work under the approved Lean plan.
- `environment: Local + named Staging only`; `migration_authority: None`; `production_allowed: No`.
- Staging deploy is conditional on independent QA of this exact source and Local runner, fresh Project/host/history/SMTP/Schedule/billing/backup gates, and read-only reconciliation of any ambiguous prior deployment. Deploy once only; no retry on uncertain outcome.
- Stage-1 data is limited to the existing synthetic Member 01 and existing Project/Catalog item, one successful Order with deterministic child rows, and the previously approved one-sentinel Recovery rehearsal. No duplicate account, Catalog, Project, or Order fixture; no Finance/PO writes for the reduced downstream test.
- Development evidence for unchanged downstream paths may be cited only as Development evidence with an explicit residual-risk judgment by independent QA. It must never be relabeled as a Staging pass.
- Production release requires a separate exact-candidate Release Authorization after Staging QA `GO` and Production preflight.

## Local verification already completed

Independent QA passed the response-mapping diff before freeze: 680 tests, typecheck, production build. The two-file commit has the same diff; QA must attest the final commit/tree and local Stage-1 package seal before any Staging write. These Local results are not Staging UAT or Production evidence.
