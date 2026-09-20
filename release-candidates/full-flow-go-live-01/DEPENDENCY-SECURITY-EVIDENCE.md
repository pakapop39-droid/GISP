# FULL-FLOW-DEP-SEC-01 v0.1 — Local dependency security evidence

Authority: `docs/GISP-APR-FULL-FLOW-DEP-SEC-01-LOCAL-IMPLEMENTATION-20260921-v1.0.md`.

Environment: local isolated worktree `codex/full-flow-go-live-01`. Production allowed: `No`. No migration Apply, backend write, deploy, staging, or Production action was performed.

## Exact dependency result

| Dependency | Previous | Candidate |
| --- | --- | --- |
| `next` | `16.2.12` | `16.3.5` |
| `eslint-config-next` | `16.2.12` | `16.3.5` |
| `sharp` direct/override | `0.35.3` | `0.35.4` |
| `vitest` | `4.1.10` | `4.1.11` |
| resolved `js-yaml` | `4.3.1` | `4.3.2` |

Required transitive packages changed only as resolved by npm for those exact upgrades, including Next/SWC/Sharp platform packages and Vitest/Vite/Rolldown packages. No other direct dependency declaration changed.

## Verification evidence

- `npm ls next eslint-config-next sharp vitest js-yaml --all`: exact requested versions resolved; Sharp deduped to `0.35.4`.
- `npm audit --json`: 0 total vulnerabilities (`info 0`, `low 0`, `moderate 0`, `high 0`, `critical 0`).
- npm reported that `unrs-resolver@1.12.2` has an unapproved optional postinstall script under npm's allow-scripts control. No script approval or security-safeguard bypass was performed.
- `npm test -- --run src/lib/full-flow-dependency-security.test.ts src/lib/full-flow-candidate-package.test.ts`: PASS, 2 files / 6 tests (`vitest 4.1.11`).
- `npm test -- --run`: PASS, 109 files / 592 tests.
- `npm run typecheck`: PASS.
- `npm run lint`: PASS with 0 errors and 7 warnings. The warnings are one existing unused constant in `scripts/smtr/verify.mjs` and six Next.js client-navigation warnings; no source compatibility change was required or made.
- `npm run build`: PASS on Next.js `16.3.5` with the optimized Turbopack build and 128/128 static pages generated.

## Exact local artifact hashes

- `package.json`: `1D37FFA7B15587C3BC4C46B5A5321B2E06EC5EC70D56842B76012D78873E9F30`
- `package-lock.json`: `35826341C33DB0829BA48C5199411011E3BB4493A33D4054BF690C6E0E13F88D`

No application source compatibility fix and no migration content change was needed for this dependency gate.
