# PDF Catalog Import v1.0 — Scope and Implementation Approval

## Development Merge/Deploy Release Authorization

- Approval level: Release Authorization — Merge/Deploy Development and post-deploy verification
- Approved by: ภคภพ ช.เจริญยิ่ง
- Approved at: 2026-09-13T10:48:37+07:00
- Scope document: PDF Catalog Import v1.0
- Environment: Development only
- Data/migration authority: no additional schema or data authority; release only the already approved PDF Catalog Import v1.0 implementation and additive migrations to Development
- Production allowed: No

Owner approval text:

> โอเคตรวจแล้วผ่าน อนุมัติ Merge/Deploy Development และตรวจหลัง Deploy

This authorization permits the Release Executor to merge and deploy this approved slice to Development and perform post-deploy verification. It does not authorize Production, new scope, new migrations, additional data mutation or relaxed security/budget/provider controls.

## Development release result

The authorized Development release was executed from source commit `a674de3c8e4cc9509c85ab00c3c080600457e047`. The Full backend branch merged with 34 additions, 5 modifications and 0 conflicts after a clean dry-run; frontend deployment `999ff236-e60c-4208-a6e5-62e56754ca4f` reached `READY`; worker health and schedules passed their post-deploy checks; and Production remained untouched. Exact backup hashes, backend/compute/schedule identifiers and endpoint evidence are recorded in `2026-09-13-pdf-catalog-import-v1-development-release.md`.

The four-PDF, at-least-100-product ground-truth benchmark remains a formal evidence gap unless it was completed as part of the owner's UAT. This release record does not infer a benchmark pass.

## Azure-only provider restoration amendment

- Approval level: Scope/Implementation routing amendment
- Approved by: ภคภพ ช.เจริญยิ่ง
- Approved at: 2026-09-13T09:06:36+07:00
- Scope document: PDF Catalog Import v1.0
- Environment: Development only
- Data/migration authority: the original additive schema and test-data authority only
- Provider: `openai/gpt-4o-mini` through Azure on OpenRouter only
- Privacy/routing: `zdr: true`, `data_collection: deny`, no provider fallback
- AI budget: maximum USD 1/job and USD 50/month
- Production allowed: No

Owner approval text:

> ผม ภคภพ ช.เจริญยิ่ง อนุมัติให้ PDF Catalog Import v1.0 บน Development กลับไปใช้ Azure-only ผ่าน OpenRouter โดยคง ZDR, data_collection=deny, ไม่ fallback และงบเดิม ไม่อนุญาต Production

This amendment supersedes only the provider-routing part of the OpenAI-only amendment below. All other approved scope, privacy, budget, review, security and Development-only safeguards remain unchanged.

## OpenAI-only provider amendment

- Approval level: Scope change + Implementation
- Approved by: ภคภพ ช.เจริญยิ่ง
- Approved at: 2026-09-13T08:47:44+07:00
- Scope document: PDF Catalog Import v1.0
- Environment: Development only
- Data/migration authority: additive migration/schema and test data only
- Provider: `openai/gpt-4o-mini` through OpenAI on OpenRouter only
- Privacy/routing: `zdr: true`, `data_collection: deny`, no provider fallback
- AI budget: maximum USD 1/job and USD 50/month
- Production allowed: No

Owner approval text:

> ผม ภคภพ ช.เจริญยิ่ง อนุมัติเปลี่ยน PDF Catalog Import v1.0 บน Development จาก Azure-only เป็น OpenAI-only ผ่าน OpenRouter โดยคง ZDR, data_collection=deny, ไม่ fallback และงบ AI ไม่เกิน $1/งาน/$50 ต่อเดือน ไม่อนุญาต Production ให้ใช้เวลาข้อความนี้เป็นเวลาอนุมัติ

This amendment supersedes only the Azure provider routing choice below. All other approved scope, privacy, budget, review, security and Development-only safeguards remain unchanged.

## Azure-ZDR amendment

- Approval level: Scope + Implementation amendment
- Approved by: ภคภพ ช.เจริญยิ่ง
- Approved at: 2026-09-12T21:07:09+07:00
- Scope document: PDF Catalog Import v1.0 Azure-ZDR amendment
- Environment: Development — local source and an authorized Development backend branch only
- Data/migration authority: existing additive schema and test data only; no additional Production or business-data authority
- Provider: `openai/gpt-4o-mini` through Azure on OpenRouter only
- Privacy/routing: `zdr: true`, `data_collection: deny`, no provider fallback
- AI budget: maximum USD 1/job and USD 50/month
- Production allowed: No
- Approval text/reference: the owner's latest message in the primary Codex thread explicitly approves this Azure-only amendment with the privacy, fallback, budget, Development-only and Production-No constraints above.

This amendment supersedes only the earlier OpenAI-provider routing choice. All other limits and safeguards in the original approval below remain unchanged.

- Approval level: Scope + Implementation
- Approved by: ภคภพ ช.เจริญยิ่ง
- Approved at: 2026-09-12T19:24:35+07:00
- Scope document: PDF Catalog Import v1.0 (owner-approved plan in the Codex thread)
- Environment: Local + InsForge Full Backend Branch under `gisp-mvp-development`
- Data/migration authority: additive schema and test data only
- Storage authority: maximum upload size 25 MB for the Development configuration
- External services: Custom Compute up to USD 20/month; AI up to USD 1/job and USD 50/month
- Production allowed: No

Owner approval text:

> ผม [ภคภพ ช.เจริญยิ่ง] อนุมัติ Scope และ Implementation ของ PDF Catalog Import v1.0 บน Development อนุญาตให้แก้โค้ด สร้าง Migration/RLS ปรับ Storage เป็น 25 MB ใช้ InsForge Backend Branch, Custom Compute ไม่เกิน $20/เดือน และ AI ไม่เกิน $1/งาน/$50 ต่อเดือน โดยอนุญาตเฉพาะ Schema และข้อมูลทดสอบ ไม่อนุญาต Production และให้ใช้เวลาที่ส่งข้อความนี้เป็นเวลาอนุมัติ

## Historical infrastructure preflight

> This section records the initial preflight state. The later authorized Development release result above and the dedicated 2026-09-13 release evidence supersede it as the current state.

- Scheduled Development backup at 2026-09-12 08:00 was present and completed.
- A new manual backup could not be created because the manual backup quota was full (5/5). No backup was deleted.
- Full branch creation `pdf-catalog-import-v1` was attempted and rejected by the platform: `Per-org quota: max 3 parent projects with branches`.
- No migration, configuration, compute service, secret, schedule, test data, or frontend deployment was applied to the Development parent or Production.
