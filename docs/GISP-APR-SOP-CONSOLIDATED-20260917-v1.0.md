# GISP SOP v1.1 Consolidated Approval Record v1.0

## Approval

| Field | Recorded value |
| --- | --- |
| Approver | ภคภพ ช.เจริญยิ่ง (owner) |
| Approval source | User message `อนุมัติ` in this Codex task, directly following delivery of SOP v1.1 Consolidated Review Candidate v0.3 and the request to review/approve it |
| Approved document | `output/GISP_SOP_Order_Finance_Logistics_TH_v1.1_CONSOLIDATED_REVIEW_CANDIDATE_v0.3.docx` |
| Candidate SHA-256 | `ACF3B11A8A87DDB61AF663A2F0D39D9B3AF7204507CF7CE0BD747E91682CA83A` |
| Approved issue | `output/GISP_SOP_Order_Finance_Logistics_TH_v1.1_APPROVED_DEVELOPMENT_PILOT_v0.3.docx` |
| Approved issue SHA-256 | `C206941A629BDCF6E6B44175117ACBD69BB82CC7AD9343704FA90D596B8BF719` |
| Document version | SOP-GISP-OPS-001, v1.1 Consolidated v0.3 |
| Approval date | 17 September 2026, Asia/Bangkok. The user-message timestamp is not exposed in the available task record, so no exact approval minute is asserted. |
| Record prepared at | 17 September 2026, approximately 13:18 Asia/Bangkok (06:18 UTC) |
| Environment and use | Documentation and Development Pilot only |
| Data or migration authority | None. No transaction data changes or data migration authorized by this approval. |
| Production allowed | No. This is not Production Release Authorization. |

## Approved document scope

The approved SOP consolidates the existing App-aligned SOP with ISS-01 and the owner's 17 September decision on Member incoming-payment verification. Product price remains separate from Freight Estimate and later Actual Freight/Freight Invoice. Member confirmation is the in-app `สร้าง Order และยอดชำระ 50/50` action; the system opens `ORD` at `PENDING_DEPOSIT` without a per-order `SUPER_ADMIN` gate. `FINANCE` is the final verifier for each Member incoming payment; `SUPER_ADMIN` governs policy and exceptions. The four Dispatch Gates are checked before shipment creation and again before dispatch.

The prior v0.2 electronic approval remains a historical record. This approval does not certify Final UAT, authorize new App behavior, change roles or permissions, approve Development transactions beyond their separately granted test scope, or authorize deployment to Production.

## Issuance

Codex issued an approved-status copy from the reviewed candidate, retaining the candidate unchanged. The approved-status copy changes only document-control and approval wording; the operational rules remain those presented in candidate v0.3. Visual and structural verification of the issued DOCX is recorded in the task response, not as a new UAT result.

The App–SOP consolidated-document approval Slice is closed. Final UAT and any Production release remain separate Slices with their own evidence and authorization.
