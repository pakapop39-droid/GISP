# HR-FIX npm audit evidence and runtime triage — 2026-09-19

Status: evidence/triage only. No dependency, lockfile, override, application
behavior, Child or Production environment was changed.

## Reproducible evidence

- Command: `npm audit --json`
- Canonical UTF-8/LF stdout SHA-256:
  `aa3f7ceeedb83b6f86cebbba8c2b39d6935d04dba44fb524a09d7eba726da2fe`
- Result: 5 findings — 1 critical, 2 high, 2 moderate.
- Installed tree was confirmed with
  `npm ls next sharp js-yaml vitest @vitest/mocker --all --json`.

| Package | Installed | Severity | Advisory/runtime assessment for this candidate |
|---|---:|---:|---|
| `next` | 16.2.12 | Critical | `GHSA-p293-qw3h-jr36` matches the package version but requires a Windows-hosted server. The candidate bundles Linux Sharp libraries for the intended hosted target; the actual hosted OS must still be retained as rehearsal evidence before treating that exploit path as not applicable. |
| `next` | 16.2.12 | Critical | `GHSA-2xp9-vwfh-vxw4` matches the package version and requires AVIF use in the Image Optimization API. This candidate does not configure AVIF output, accepts only JPEG/PNG/WebP on image-upload paths, marks dynamic stored images `unoptimized`, and uses optimized `next/image` only for repository PNG assets. No reachable AVIF source was found, but the vulnerable package remains installed. |
| `sharp` | 0.35.3 | High | `GHSA-rgj7-g3m4-5g8c` affects libheif. The explicit Sharp runtime path validates JPEG/PNG/WebP signatures and requires Sharp metadata to match those formats; HEIF/AVIF is not accepted. Next optimization in this candidate uses repository PNG assets. No reachable libheif input was found, but the affected native library remains bundled. |
| `js-yaml` | 4.3.1 | High | `GHSA-2883-xcg3-v3hh`; dependency path is `eslint → @eslint/eslintrc → js-yaml`. It is development/lint tooling and is not part of the hosted application runtime. |
| `vitest`, `@vitest/mocker` | 4.1.10 | Moderate | `GHSA-82fw-gwwq-j7x9`; test-only tooling, not part of the hosted application runtime. Do not expose a Vitest server in rehearsal or Production. |

## Decision boundary

The runtime review found no currently configured input path that satisfies the
AVIF/libheif exploit prerequisites. This is not the same as upgrading or clearing
the vulnerable dependencies. Before Production authorization, retain proof that
the hosted runtime is Linux and choose one of the following under a separately
approved dependency scope:

1. update Next and Sharp to fixed compatible versions and rerun the complete
   candidate gate, or
2. explicitly accept the residual dependency risk with the AVIF/HEIF paths kept
   disabled and monitored.

No automatic `npm audit fix` or package upgrade was run because HR-FIX does not
authorize dependency changes.
