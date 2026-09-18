# GISP Release C/D Candidate Manifest v0.1 — Development preparation only

Reference: owner authorization in `GISP-APR-RELEASE-CD-IMPLEMENTATION-20260918-v0.1.md`. This is a local source-and-migration inventory for review and rehearsal, **not** Production release authorization, a deployment command, or an instruction to apply migrations. Hashes are SHA-256 of the complete local files on 2026-09-18 (Asia/Bangkok). The working tree contains unrelated existing changes; only the C/D hunks and files identified below are in this candidate. Review the selected diff before assembling an artifact; do not package the whole working tree.

## Application and test files

| SHA-256 | Path |
|---|---|
| `b14ce070d87951c2424ed8941619d4295919831b32883c08151d15d82df7971c` | `src/lib/release-stage.ts` |
| `5479616867fb09b2616f24c9dd7b8d49cd30ac5c76429daa8587f762fcbb0476` | `src/lib/release-stage.test.ts` |
| `825c115e19c17d9001e117f6cf0e218303fddc9d4f1a3b08930c1639e01e9a82` | `src/proxy.release-gate.test.ts` |
| `6745288950ec5f16394d33365b1e80b546b51efef1593fa6d66611b54426eb3e` | `src/app/admin/orders/[id]/page.tsx` |
| `71516399f187f7038540e0d316323614c211f3ff2d0a3ad910b9b0035c2da30d` | `src/app/member/orders/[id]/page.tsx` |
| `f6a045f65c9f1b8c70c621fd4680bb8ebdbd1ed50d0e4e11f90d9115743793a5` | `src/components/admin-order-detail.tsx` |
| `9003080aa333dd30d637775d09bf989e1bbccfe6a81474c4879185ae2419d9f7` | `src/components/member-order-detail.tsx` |
| `2ea1d0159778307b73f77eb58841c25dbc9dab0c15d23a6cb69534912c34bb13` | `src/app/member/dashboard/page.tsx` |
| `ff16cae2fe4d85ea6df217bdb211a9f2b55ac716749a28f7ce692681da8f9cd2` | `src/app/admin/dashboard/page.tsx` |
| `5eca17044e47d158a26f0aeaf5e32c30c79c086434e576fb1c34d64a89ad147d` | `src/app/api/admin/dashboard/route.ts` |
| `2854cab5318f7df444b070a0ee79e38e97458fdc3a21420c2718711cd7588548` | `src/lib/orders/server.ts` |
| `ec846674d15aef7485ff399ac02febbab351a5a726a75190111b318319515dc9` | `src/lib/orders/release-projection.ts` |
| `b7c4e023081df3b21dcb7e01bc16ada4632daf748461dd96cb9da5146d592023` | `src/lib/orders/release-projection.test.ts` |
| `2eeff889accc9140173c035aea6bc517d31638912b99b3db954a184c308d8eb4` | `src/modules/reports/release-projection.ts` |
| `91b77cc941e7daf313a8179ea56c22287003631f91e91716129b8b0403daf685` | `src/modules/reports/release-projection.test.ts` |
| `968a173f149d5f69faaf42694d2b6a93af7821a7cef7af6f7ef2a2feaa2802e1` | `src/lib/payments/bound-evidence.ts` |
| `a22bbaee30cbc3bb32f9168325e2b142b47407d4967ce6063c1d9a8fef272096` | `src/lib/payments/bound-evidence.test.ts` |
| `10d976dcaae5e91ae60607ae0ef07d7bf2b2fdcaefc19965c3a69eec25ce3db3` | `src/app/api/admin/payment-transfers/[id]/evidence/route.ts` |
| `8d947f37c60754d3f19ecc2c524aaae57e8947966f44a0b6f60e416c6e1e8963` | `src/app/api/admin/payment-transfers/[id]/evidence/route.test.ts` |
| `2afad848c5f6abddeaee3d297b5eee992b189f66b9cad1564e50688458898f6f` | `src/app/api/admin/payment-transfers/[id]/verify/route.ts` |
| `a2f1c8583f45c00ac54a08edc60473ed8e8b0da2ba0aaeb28390412289d9bd9c` | `src/app/api/admin/payment-transfers/[id]/verify/route.test.ts` |
| `9901f988dc6fc40df4b7288ffe243dda7e4368bb6f0d095c7b1118030db632fd` | `src/app/api/member/payment-transfers/route.ts` |
| `506d816b4d9aa20b481d91942a0e3313518abb5cbee1741fd9485e017896ae74` | `src/app/api/member/payment-transfers/route.test.ts` |
| `5246fac753bdfeef124ee12c678a1ef79980cd9d101278836d4f2d88e5422986` | `src/app/api/admin/operations-media/route.ts` |
| `e7df66248008a05eb0ca2a52a542bd23fc3839bc9c42d94f0e0bd248174d7fe4` | `src/app/api/admin/operations-media/route.test.ts` |
| `4b20c79380d472566e57692f6411d05b2660f0b8efacc7ac8176838af527e06b` | `src/components/logistics-panels.tsx` |
| `62d0a943ec1d4b29212c49eb61da8dc00efc837582f88bbf530814fc3d5df615` | `src/components/logistics-panels.test.ts` |
| `5969ff8dcbfa3926f28d8ea345fcabbd950f6b03441eb98ec810394b6315ca85` | `src/lib/release-privileges-migration.test.ts` |

## Forward-only permission migration drafts — not applied

Run only in the order below **after** a fresh target-environment function-signature/ACL audit, release-candidate rehearsal, QA sign-off, backup/rollback verification, and the applicable separate owner authorization. Stage D is not one blanket release: D7, D8, D9, and D10 each need their own gate. Production B lacks `reopen_qc_inspection`; its approved QC function migration is a D7 prerequisite and must be separately enumerated and reviewed, not silently pulled in by this manifest.

| Order | SHA-256 | Path |
|---|---|---|
| C | `2abb7fc8e1ca11fb1c3376b211370908810b9dbe89184528084a913912c822a5` | `migrations/20260918133858_release-c-transaction-privileges.sql` |
| D7 | `9be89b775164025ee03368a83fd3a24bbaab3207203921f391ab56b96dcb855e` | `migrations/20260918133905_release-d7-production-qc-privileges.sql` |
| D8 | `41ecb7c4486caae0db5a2118a0fe062feed713e295131376d0d63c8632231970` | `migrations/20260918133916_release-d8-logistics-privileges.sql` |
| D9 | `f80a8c0e2106a373333b86206c23322b3b6afe12f7504fee76c211bc0f5defd2` | `migrations/20260918133927_release-d9-claim-privileges.sql` |
| D10 | `d38c80941b0172fd1d46638ea79edfbe17c7901f842318d49d39f7fbb7ced5ab` | `migrations/20260918133933_release-d10-report-privileges.sql` |

Runtime configuration to review separately: `RELEASE_STAGE=C` for C; D requires `RELEASE_STAGE=D` **and** contiguous `RELEASE_D_ENABLED_SLICES` (`7`, `7,8`, `7,8,9`, or `7,8,9,10`). A hosted Production deployment with missing/invalid stage fails closed. No environment file or secret is included in this inventory.

Excluded from automatic apply/deploy: every other dirty worktree file; all existing standalone Slice 4–11, ISS-02, QC-Reopen, and unrelated migrations; any data migration; Production configuration; credentials; live transaction data. The candidate does not remove the outstanding direct-RPC Payment-evidence binding gap, which requires explicit resolution before real payments are enabled. The existing global `files.member.manage` permission model is a separate QA review observation, not a confirmed cross-organization exploit.
