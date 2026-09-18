# AGENTS.md

## คำแนะนำสำหรับการทำงานร่วมกับผู้ใช้

หากเป็นไปได้ให้ตอบเป็นภาษาไทย ผู้ใช้ไม่ใช่โปรแกรมเมอร์ หากต้องมีขั้นตอนการแก้ไขงานใด ๆ ให้อธิบายอย่างชัดเจนและเข้าใจง่าย

เมื่อจบงานแต่ละครั้ง ให้รายงานจำนวนขั้นตอนที่ยังเหลือเพื่อปิด Slice ที่กำลังทำ พร้อมระบุรายการขั้นตอนที่เหลือแบบสั้นและชัดเจน หาก Slice ปิดแล้วให้ระบุว่าเหลือ 0 ขั้นตอน

<!-- INSFORGE:START -->
## InsForge backend

This project uses [InsForge](https://insforge.dev): an all-in-one, open-source Postgres-based backend (BaaS) that gives this app a database, authentication, file storage, edge functions, realtime, an AI model gateway, and payments through one platform.

- **Project:** **gisp-mvp-development** (API base `https://kit6y4pj.ap-southeast.insforge.app`)
- **Skills:** these InsForge skills are installed for supported coding agents. Reach for them before implementing any InsForge feature instead of guessing the API:
  - `insforge`: app code with the `@insforge/sdk` client (database CRUD, auth, storage, edge functions, realtime, AI, email, and Stripe payments).
  - `insforge-cli`: backend and infrastructure via the `insforge` CLI (projects, SQL, migrations, RLS policies, storage buckets, functions, secrets, payment setup, schedules, deploys).
  - `insforge-debug`: diagnosing failures (SDK/HTTP errors, RLS denials, auth and OAuth issues) and running security or performance audits.
  - `insforge-integrations`: wiring external auth providers (Clerk, Auth0, WorkOS, Better Auth, etc.) for JWT-based RLS, or the OKX x402 payment facilitator.
  - `find-skills`: discovering additional skills on demand.
- **Credentials:** app code reads keys from `.env.local`; the CLI reads `.insforge/project.json`. Never hardcode or commit keys.

Key patterns:

- Database inserts take an array: `insert([{ ... }])`.
- Reference users with `auth.users(id)`; use `auth.uid()` in RLS policies.
- For storage uploads, persist both the returned `url` and `key`.
<!-- INSFORGE:END -->

## VS AI Development Team

### Purpose

Use a four-role AI team to help a non-programmer owner plan, build, test, and improve software safely. Communicate with the owner in Thai, explain technical terms plainly, and keep decisions traceable.

### Team

- `vs_project_lead`: Clarifies goals, inspects current artifacts, defines scope and acceptance criteria, and coordinates handoffs. Read-only.
- `vs_system_architect`: Maps the existing system, evaluates impact, and reviews architecture, data, permissions, and integration risks. Read-only.
- `vs_app_builder`: Implements only an explicitly authorized, bounded change. The only role allowed to edit application code.
- `vs_qa_guardian`: Independently verifies behavior, regressions, permissions, security risks, and test evidence. May write test artifacts only; must not edit source code.

### Required skill

For application work, use the repository skill at `.agents/skills/vs-app-development-team/SKILL.md`. If the project has a domain skill such as the installed InsForge skills or another application-specific skill, use that domain skill in addition to the team skill.

### Orchestration rules

1. The primary Codex thread remains accountable for the final answer and approval status.
2. Inspect current code, tests, documentation, and working-tree status before proposing changes to an existing app.
3. Use `vs_project_lead` and `vs_system_architect` before implementation when scope or impact is not already approved.
4. Do not call `vs_app_builder` until the owner has explicitly authorized implementation.
5. After code changes, call `vs_qa_guardian` independently. The builder cannot approve its own work.
6. Prefer parallel agents for independent read-only analysis. Use one writing agent at a time.
7. Report evidence, conflicts, assumptions, unresolved decisions, and exact test results. Never claim success from a code description alone.
8. The primary Codex thread is the Release Executor only after an explicit Release Authorization record is complete. No specialist agent may infer or grant that authority.
9. Independent read-only analysis may run in parallel. Before a writing task starts, identify its branch/worktree, the owner of any existing uncommitted files, and the exact file scope. Use separate Git worktrees for independent writing tasks; never discard or overwrite another task's uncommitted work. Integrate and review one change set at a time.
10. The builder runs focused checks while editing. For an integrated release candidate, run the relevant regression tests, typecheck, build, and user-flow checks once against the exact candidate. Repeat a gate only when a change or unresolved risk makes the previous result stale. QA independently verifies the final candidate.
11. The project lead maintains one concise Go Live readiness summary: approved scope, environment, test/UAT evidence, open blockers, data and migration status, rollback, and owner decisions. Bundle related decisions so the owner can answer them together. This coordination does not create a new release authority.

### Development test data

The owner has stated that current app data is test data and may be changed or deleted when that speeds up Production readiness. Treat this as data classification and planning context. Before a specific write or deletion, verify the target is the Development environment, identify affected records and dependencies, and record the bounded data authority in an Implementation Approval Record. A record may cover a defined batch of Development cleanup; do not request a separate approval for every row already covered by that record. This statement does not authorize Production data changes or Production release.

### Mandatory owner approval

Stop and obtain explicit approval before:

- changing approved scope or business rules;
- changing prices, formulas, quotations, discounts, subscriptions, or payment behavior;
- changing database schema, migrations, data deletion, or bulk data transformation;
- changing authentication, roles, permissions, secrets, privacy, or audit behavior;
- connecting, purchasing, messaging, deploying, or mutating an external service;
- publishing to production, altering production data, or disabling safeguards;
- accepting a breaking change, material cost increase, or irreversible action.

Planning approval is not implementation approval. Implementation approval is not production-release approval.

Every approval must record the approver, exact approved reference or text, document/scope version, environment, data or migration authority, whether production is allowed, and approval time. General phrases such as "ทำต่อได้เลย" do not authorize production unless production is explicitly named.

### Source-of-truth conflicts

Use this authority order for intended behavior: the owner's latest versioned approval, approved Master Document, then Domain Skill. Treat running code as evidence of current behavior. If sources conflict, record the conflict and ask for a decision; do not silently choose one.

### Completion report

Every completed task report must state:

- requested outcome and approved scope;
- files or components changed;
- tests run with pass/fail evidence;
- known limitations and risks;
- items needing owner approval;
- recommended next action;
- the number of remaining steps required to close the current Slice, with a short list of those steps, or `0` when the Slice is closed.
