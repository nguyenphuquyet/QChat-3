# ADR 001 — Reuse versus build for the new Mini App runtime

- **Status:** ACCEPTED
- **Date:** 2026-11-27
- **Milestone:** M0

## Context

The specification fixes the architecture (section 0.1): Mini App page content is
rendered by the system WebView, Mini App logic runs in a separate Service
Runtime, and native code is limited to the host, the logic runtime, the bridge,
APIs and full-screen native screens. Section 6.1 requires an M0 comparison of
`didi/dimina`, the `wechat-miniprogram` organisation (especially `glass-easel`)
and a custom build, with license text, maintenance status, size and the covered
`wx.*` and component surface.

Evidence collected on 2026-11-27 (GitHub REST API, npm registry, repository
inspection). The full 80-repository inventory is in
`docs/audit/wechat-miniprogram-repos.md`.

| Candidate | Version / commit checked | License | Last push | Size | Status | What it gives |
|---|---|---|---|---|---|---|
| `didi/dimina` | `main`, 2026-11-27 | Apache-2.0 | 2026-11-27 | 34.2 MB | active, 976 stars | A complete Mini Program container: Android/iOS native hosts, WebView, WXML/WXSS compiler, `wx.*` layer |
| `wechat-miniprogram/glass-easel` | npm 1.2.2 | MIT | 2026-11-23 | 2.8 MB | active, 340 stars | Component/render framework with multiple backends (DOM, native) |
| `glass-easel-miniprogram-adapter` | npm 1.2.2 | MIT | (same repo) | — | active | `Page`/`Component`/`Behavior`, code space, backend association |
| `glass-easel-template-compiler` / `-stylesheet-compiler` | npm 1.2.2 | MIT | (same repo) | — | active | Official WXML and WXSS compilers |
| `glass-easel-miniprogram-webpack-plugin` | npm 1.2.2 | MIT | (same repo) | — | active | Official build pipeline (WXML/WXSS loaders, virtual entry) |
| `miniprogram-api-typings` | npm 5.3.1 | MIT | 2026-11-06 | 2.1 MB | active | `wx.*` type definitions (behaviour reference) |
| `miniprogram-demo` | repo | MIT | 2026-09-11 | 4.2 MB | active, 7.3k stars | Official demo (behaviour reference) |
| `miniprogram-simulate` | repo | MIT | 2026-11-12 | 4.4 MB | active | Component unit-test harness |
| `miniprogram-api-promise` | repo | **none** | 2020-01-15 | 11 KB | stale | Promisified `wx.*` (not reusable: no licence) |
| `miniprogram-ci` | not a public repo | — | — | — | — | Upload/build tooling tied to WeChat's backend |
| `miniprogram-compiler` | npm 0.2.3 | MIT (`UNVERIFIED` in npm metadata) | — | — | — | Real `wcc`/`wcsc`; output targets WeChat's closed client runtime |

Additional facts:

- `glass-easel`'s miniprogram adapter runs `App`/`Page`/`Component` logic in the
  same JavaScript context as the rendered components. The specification forbids
  that (section 0.1 item 4: Mini App logic never runs in the View WebView).
- The official webpack plugin emits a combined `app-service.js` (logic and
  templates) plus `app-wxss.css`. Splitting the logic out means replacing the
  plugin's bootstrap, which is most of the integration.
- This repository already tried the official pipeline on a branch
  (`b0e5e78` 2026-11-25 → `1e88215` 2026-11-26, branch
  `backup/miniapp-webview-1e88215`). It needed a loopback HTTP server, a
  root-absolute `/assets/` URL rewriter, BOM workarounds and built-in component
  recursion fixes, and it was never run on a device. It was left unmerged.
- `dimina` is a complete container, not a library: adopting it would replace
  the Flutter host integration, the QChat design system chrome, the QChat
  permissions and the QChat storage/API layer, and would add a second native
  stack to maintain on Android and iOS.

## Decision

**Build the new runtime custom**, with two narrow reuse points:

1. The View Runtime is a QChat-owned renderer bundle on the system WebView:
   our WXML/WXSS compiler, our DOM renderer, our components and our theme
   handling. It does not embed `glass-easel` or `dimina`.
2. The Service Runtime is a QChat-owned JavaScript SDK (App/Page/Component,
   `wx.*` proxy, module loader) on a separate engine (engine ADR in M1).
3. WeChat's official documentation, `miniprogram-api-typings` (MIT) and
   `miniprogram-demo` (MIT) are used as **behaviour references and test
   inputs**, never copied into the runtime. No `glass-easel` code is copied.
4. Reuse is limited to standard, non-WeChat libraries (e.g. a ZIP reader, a
   signature library) and each one gets a third-party notice.

## Alternatives considered

1. **`glass-easel` + official compilers.** Best WXML/WXSS fidelity and the
   smallest compiler effort. Rejected because its miniprogram adapter puts
   `App`/`Page` logic in the view context (conflicts with section 0.1 item 4),
   the official plugin emits a combined service/view bundle that would have to
   be re-architected, and the prior branch proves the integration is fragile and
   was never device-verified. `UNVERIFIED`: whether glass-easel can be driven
   as a pure view backend without its adapter; a future ADR may revisit this if
   the custom compiler misses a compatibility target.
2. **`dimina`.** Fastest path to a working container, Apache-2.0. Rejected
   because it is a whole container with its own native hosts, not a renderer we
   can place behind QChat's Flutter chrome; adopting it replaces the host
   integration, permissions, storage and API design, and adds a large
   third-party native surface on both platforms.
3. **Hybrid: `glass-easel` for rendering, custom service runtime.** Rejected for
   the same coupling reason as (1); it would also leave two component models
   (glass-easel's and ours) to keep in sync.
4. **Keep the existing TSX/QuickJS renderer and add WXML on top.** Rejected by
   section 0.1 item 2 (in-page UI is never drawn with Flutter widgets) and by
   section 12 (the legacy QApp must be removed).

## Consequences and risks

- We own a WXML/WXSS compiler and a DOM renderer. Effort is higher and
  compatibility must be measured against the pinned base library (ADR 005).
- We can keep the service/view split exact, validate every message in the host,
  and keep the bundle small.
- Risk: WXML edge cases (templates, slots, WXS) take longer than planned. The
  compatibility matrix makes every gap visible and the M7 phase owns the long
  tail.
- Risk: a custom renderer is a new attack surface. Mitigated by rendering data
  as text, never as HTML/script, and by the bridge tests of section 4.3.

## Cost and effort to reverse

High. Replacing the renderer later means replacing the compiler output format,
the view bundle, the bridge payloads and every component test. Replacing only
the service engine is cheap (it is behind the `wx.*` contract).
