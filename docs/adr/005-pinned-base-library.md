# ADR 005 — Pinned WeChat base library reference

- **Status:** ACCEPTED
- **Date:** 2026-11-27
- **Milestone:** M0

## Context

Section 9 requires a pinned WeChat base library version as the behaviour
reference. Every compatibility entry is measured against it.

## Decision

Pin **WeChat base library v3.18.1 (2026-11-17)**, the latest version listed in
the official changelog at
`https://developers.weixin.qq.com/miniprogram/dev/framework/release/`, retrieved
2026-11-27.

- `docs/compatibility.md` records the version at the top.
- API and component names are verified against
  `https://developers.weixin.qq.com/miniprogram/dev/` and the
  `miniprogram-api-typings` 5.3.1 package (MIT).
- A change of the pinned version is a new ADR, because it changes the
  measurement baseline.

## Alternatives considered

1. **Pin an older, widely deployed version (e.g. v3.10).** More devices run it,
   but it hides features developers expect today and the reference would be
   stale for new projects.
2. **Follow the latest version continuously.** Rejected: a moving baseline makes
   the matrix unmeasurable and every result non-reproducible.

## Consequences and risks

- Some developers target older base libraries. The matrix can note "available
  since" in a later phase, but the pass/fail measurement stays on v3.18.1.
- Tencent can change behaviour in a patch release; the pinned date and the
  retrieved documentation are recorded with each verification.

## Cost and effort to reverse

Low: re-run the matrix against another version and write a superseding ADR.
