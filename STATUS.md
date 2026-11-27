# STATUS

- **Specification:** QChat Mini App Platform — Engineering Specification **V8.7**
  (`QChat_MiniApp_Spec_V8_7.md`, supplied 2026-11-27).
- **Current milestone:** **M4 — APIs and navigation**
- **M0 exit check:** `PASS` (commit `6cd467e`, pushed to `origin/feat/miniapp-v7`)
- **M1 exit check:** `PASS`; the real-device item is `BLOCKED` (no SDK/device)
- **M2 exit check:** `PASS`; the Android QuickJS build and device run are `BLOCKED`
- **M3 exit check:** `PASS` (Node); device rendering and theme matrix are `BLOCKED`
- **PLAN:** `DONE`
- **M0:** `DONE`
- **M1:** `DONE` (device evidence `BLOCKED`)
- **M2:** `DONE` (Android engine build `BLOCKED`)
- **M3:** `DONE` (device view/theme evidence `BLOCKED`)
- **Last updated:** 2026-11-27

## 1. Where the work stands

### Done

- Re-read rule applied: the whole V8.7 specification, `AGENTS.md`,
  `apps/mobile/AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/MINIAPPS.md`,
  `docs/DEPLOYMENT.md`, `docs/MINIAPP-DEVELOPER-GUIDE.md`, `README.md`.
- Repository, git history and environment audited; audit report written:
  `docs/audit/M0-AUDIT.md`.
- All 80 public repositories of `wechat-miniprogram` listed with license, last
  push, archive state and size: `docs/audit/wechat-miniprogram-repos.md`.
- Reuse-versus-build decision: `docs/adr/001-reuse-versus-build.md`.
- Container integration decision: `docs/adr/002-container-integration.md`.
- Module layout decision: `docs/adr/003-module-layout.md`.
- Minimum Android decision: `docs/adr/004-minimum-android.md`.
- Pinned WeChat base library: `docs/adr/005-pinned-base-library.md`.
- Theme ownership: `docs/adr/006-theme-ownership.md`.
- Backend shape: `docs/adr/007-backend-modular-monolith.md`.
- Package format and signing: `docs/adr/008-package-format-signing.md`.
- Removal register: `docs/qapp-removal.md` (54 items).
- Compatibility matrix: `docs/compatibility.md` (all `Not started`).
- Store policy analysis: `docs/store-policy.md`.
- Baseline checks: `pnpm typecheck` pass; `pnpm test` 32 pass; `flutter analyze`
  "No issues found!".
- M1 contracts in `packages/miniapp-contracts` (bridge, lifecycle, permissions,
  components, APIs, manifest, renderer, theme, performance, errors) with 41
  tests.
- M1 spike: `packages/miniapp-service-runtime` (11 tests) and
  `packages/miniapp-view-runtime` (9 tests, including the round trip).
- Engine ADR 009; isolation guard `scripts/check-miniapp-isolation.mjs` wired
  into CI; `pnpm test:miniapp` added.
- M2 slice 1: `ServiceEngine` contract, a real Node `vm` adapter with no host
  globals, string code generation disabled and a wall-clock limit (8 tests), and
  the host bridge client with allowlist, ids, timeout, cancellation, close and
  binding checks (9 tests).
- M2 slice 2: the in-engine JavaScript SDK (`App`, `Page`, `Component`,
  `getApp`, `getCurrentPages`, `setData`, tracked timers) and a confined
  relative module loader; 7 tests, including a nested `require`, a cache hit and
  a path that escapes the package.
- M3: WXML parser and compiler (directives, templates, events, dataset, typed
  render tree), safe expression evaluator, WXSS compiler (`rpx`, `@import`,
  scoping, theme selectors), seven P0 custom elements with a dependency-free
  bootstrap, path-based `setData` ops with a `seq`-ordered render session, and
  diagnostics with file/line/column/code — 63 compiler and 36 view tests.
- M3 sample: `packages/miniapp-examples-v2/qchat-hello` in native source format,
  compiled and run end to end by `packages/miniapp-test-harness` (engine → SDK →
  compiler → view → DOM tap → patch); 7 tests.
- Environment report below; Appendix A assumptions below.

### In progress

- M4 APIs and navigation (task plan written before the first M4 task).

### Blocked

| Item | Needs | Effect |
|---|---|---|
| Android device evidence (M1 spike, M6 MVP) | Android SDK + a real phone, or a phone that can install a CI-built APK | Device items stay `BLOCKED`, never passed |
| iOS build/device (M8) | A Mac or accepted macOS CI minutes + a real iPhone + signing | iOS items `BLOCKED` |
| Performance targets (section 9.1) | The reference low-end device | All values `BLOCKED` |
| Production app migration (section 12.5) | Owner-supplied export (name, owner, users, features, size) | Per-app decisions `BLOCKED`; apps stay on legacy |
| Production access (M11) | Owner-provided, least-privilege credentials | Production items `BLOCKED` |

### Next task

M4 — APIs and navigation: write the M4 task plan, then implement the MVP APIs
(`wx.navigateTo`, `redirectTo`, `switchTab`, `navigateBack`, `reLaunch`,
storage, `request`, the interaction and system-info calls) over the bridge and
the page stack in the Service Runtime, each with tests. Device evidence stays
`BLOCKED`; the Android host lands in M5 and the phone checklist stays in §5.4.

### How to verify M0

```powershell
Get-Content STATUS.md
Get-Content docs/audit/M0-AUDIT.md
Get-Content docs/qapp-removal.md
Get-Content docs/compatibility.md
Get-Content docs/store-policy.md
Get-ChildItem docs/adr
pnpm typecheck
pnpm test
cd apps/mobile; E:\flutter\bin\flutter.bat analyze --no-pub
```

## 2. PLAN

### 2.1 Scope

Build the QChat Mini App Platform that runs Mini Apps written with WeChat Mini
Program conventions (WXML, WXSS, JavaScript, `wx.*`) inside QChat, using the
system WebView for page content and a separate Service Runtime for logic, and
**completely remove the legacy QApp system** (section 12). Compatibility is
incremental and measured against the pinned base library; no claim of full
WeChat compatibility is made.

Fixed architecture (section 0.1): system WebView (Android WebView, iOS
WKWebView); no same-layer rendering, custom Chromium, third-party kernels, hole
punching or Flutter-drawn Mini App content; native code only for the host, logic
runtime, bridge, APIs and full-screen native screens; service and view runtimes
separate (WXS is the only view-layer script, isolated); performance targets or a
measured deviation; theme owned by `qxColorScheme`.

### 2.2 Milestones and task lists (section 11)

| Milestone | Tasks | Done when |
|---|---|---|
| **M0 — Audit and plan** (no production code) | Audit repository, stack, legacy QApp, reusable parts, data, users, risks; git history of the earlier WebView runtime; environment report; reuse-vs-build ADR with the repository/license review; container integration and module locations; store policy; sample apps; `docs/qapp-removal.md`; `docs/compatibility.md`; migration options; Appendix A assumptions | Audit, plan, register, compatibility, STATUS exist; exit check passes |
| **M1 — Contracts and technical spike** | Short contracts (theme boundaries, bridge transport); ADRs; spike in the new modules; service sends data to view and a tap returns; real Android phone evidence | Spike verified on a real phone (or `BLOCKED`); spike report; exit check |
| **M2 — Service Runtime and bridge** | Engine, module loading, lifecycle, bridge, timers, tests | Contracts and tests pass; engine ADR |
| **M3 — View Runtime and build tool** | WXML/WXSS compilation, P0 components, `setData`, events, theme handling, diagnostics | P0 renders; diagnostics with file/line/column/code; tests |
| **M4 — APIs and navigation** | MVP APIs and page stack | All MVP APIs with tests |
| **M5 — Package and Android host** | Packaging, signing, verification, installation, rollback, storage isolation | `.qxpkg` verified; tamper tests; atomic install/rollback |
| **M6 — MVP validation** | Sample app end to end on real Android, more than one WebView version where available; section 9.1 metrics; bridge/package threat model | MVP report, measured performance, real-device evidence |
| **M7 — Full runtime compatibility** | P1/P2 components, remaining APIs, WXS, npm/subpackages/UniApp/Taro, menu/audio/file/device/QChat APIs; per-API ADRs | Matrix entries with linked tests; ADRs |
| **M8 — iOS host** | WKWebView renderer, JavaScriptCore evaluation, bridge, APIs, permissions, package install, same contracts; signing/distribution decision; real iPhone | iOS device evidence or `BLOCKED` |
| **M9 — Backend platform** | Modular monolith `/api/v1/`: auth, developers, apps, projects, builds, packages, signing, versions, releases, distribution, permissions, analytics, crashes, compatibility, audit; isolated workers; Developer Center; Admin Console | Backend tests, no manual review, authorization and audit |
| **M10 — Desktop Developer IDE** | Technology ADR; project create/import/settings/templates/source control; Monaco for JS/TS/JSON/WXML/WXSS/WXS; explorers; simulator; debugger/inspectors; developer login/build/release/device preview | IDE builds on each desktop target; simulator marked as such |
| **M11 — QChat integration and production** | Store/discovery/details/recent/installed/updates/cache/settings/permissions; migration of production apps; complete legacy removal with proof; monitoring/crash reporting; deployment/rollback; final reports | Section 12.4 proof passes; project definition of done |

Phase order exception: if M8 is `BLOCKED`, close it with the blocked items,
continue M9/M10, revisit M8; M11 starts only after M8 passes.

### 2.3 Appendix A — owner inputs

All 9 fields were blank in the supplied specification. Assumptions recorded:

| Field | Assumption used | Reason |
|---|---|---|
| QChat tech stack | Flutter mobile; Next.js/TypeScript server with Prisma/PostgreSQL; Tauri v2 desktop IDE | Confirmed in M0 (`docs/audit/M0-AUDIT.md` §3) |
| Minimum Android version | **API 26 (Android 8.0)**, WebView feature check | ADR 004; owner confirmation requested |
| Reference low-end Android device | **None supplied** | Performance items `BLOCKED` until named |
| Real Android test phones | **None available to the agent** | Device items `BLOCKED`; owner can install a debug APK |
| Real iPhone / Mac | **None**; GitHub Actions `macos-latest` can build unsigned artifacts | iOS device items `BLOCKED` |
| Target Mini Apps / samples | **`qchat-hello`** (M6 MVP) and **`qchat-notes`** (M7) | Chosen in M0; effort 1 and 3 days |
| Distribution | **Direct debug APK** for development; no store claim | Appendix A default |
| Cost ceiling | **Zero**; no paid service enabled | Appendix A default |
| Default `qxColorScheme` | **`light`** | Appendix A default |

**Additional questions** (separate from Appendix A, asked once):

1. Can you supply the production Mini App export (name, owner, users, features,
   size)? It is required before any per-app migration decision (section 12.5).
2. What is the GitHub Actions plan and monthly minutes, and are macOS minutes
   acceptable for the iOS builds? (Estimated below.)
3. Is raising `minSdk` to 26 acceptable, and which Android versions must the app
   still support?
4. Which real Android phone(s) can be used, and can you install a CI-built debug
   APK and run a short checklist?
5. Is an Apple Developer account available, and who owns the 4.7.2 permission
   request and iOS signing?
6. Which package name / app ID and signing-key owner should the new platform
   use?
7. Are there legal or brand constraints on the "QChat Mini App" name and store
   listing?

Do not wait for the answers; work continues on the assumptions above.

### 2.4 Reuse versus build

Decision: **build custom** (ADR 001). Evidence and the full 80-repository list:
`docs/audit/wechat-miniprogram-repos.md`. Key evidence: `glass-easel` is MIT and
active but its miniprogram adapter runs `App`/`Page` logic in the view context
(conflicts with section 0.1 item 4); `dimina` is Apache-2.0 but a complete
container with its own native hosts, not a renderer behind QChat's Flutter
chrome; the official pipeline was already tried on an unmerged branch and never
device-verified. Reuse is limited to standard libraries and WeChat documentation
as a behaviour reference.

### 2.5 Module locations and container integration

New modules (ADR 003): `packages/miniapp-contracts`, `miniapp-compiler`,
`miniapp-view-runtime`, `miniapp-service-runtime`,
`packages/qchat_miniapp_webview` (Flutter plugin),
`packages/miniapp-examples-v2`, `packages/miniapp-test-harness`,
`apps/mobile/lib/features/miniapps_runtime`, `apps/server/src/modules/v1`.
Shared code is adapted, never forked.

Container integration (ADR 002): Kotlin `WebView` + `WebViewAssetLoader` +
`WebViewCompat.addWebMessageListener` on Android; `WKWebView` +
`WKURLSchemeHandler` + `WKScriptMessageHandler` on iOS (M8). No
`webview_flutter` (its `JavaScriptChannel` is `addJavascriptInterface`), no
loopback HTTP server, no `file://`.

### 2.6 ADRs written in M0

1. ADR 001 — build the runtime custom; WeChat repositories are references only.
2. ADR 002 — Flutter plugin with `WebViewAssetLoader` + `addWebMessageListener`;
   WKWebView on iOS.
3. ADR 003 — new module layout; no new code in legacy modules.
4. ADR 004 — minimum Android 8.0 (API 26), WebView feature check, documented
   error.
5. ADR 005 — pin WeChat base library v3.18.1 (2026-11-17).
6. ADR 006 — `qxColorScheme` ownership; `data-theme` + `color-scheme`; host
   theme events only for `auto`; no reload.
7. ADR 007 — modular monolith on the existing Next.js server, `/api/v1/`,
   isolated workers, separate signing service, no manual review.
8. ADR 008 — `.qxpkg` ZIP, SHA-256 per file, Ed25519 manifest signature, atomic
   install, rollback, revoked/downgrade blocks.

### 2.7 Sample apps (new source format)

| App | Pages | Exercises | Effort |
|---|---|---|---|
| `qchat-hello` | 1 | P0 components, `{{}}`, `wx:if`, `wx:for`, `setData`, `showToast`, light theme | 1 day |
| `qchat-notes` | 2 | navigation stack, sync + async storage, list, form, `auto` theme, `onThemeChange`, `request` | 3 days |

Both are written in WXML/WXSS/JS. No TSX is valid input (section 6).

### 2.8 Why the earlier WebView runtime was abandoned

Full analysis: `docs/audit/M0-AUDIT.md` §8. Summary:

- **First runtime (before 2026-10-26):** a WebView + `127.0.0.1` loopback server
  + `QChatNative` JavaScript channel; replaced by `204bd81` (2026-10-26). The
  docs at `204bd81^` state it was never exercised on a device; the commit gives
  no further rationale (`UNVERIFIED` inference: thin web wrapper, no component
  or compiler pipeline).
- **Second attempt (2026-11-25/26, unmerged):** `b0e5e78` → `1e88215` on
  `backup/miniapp-webview-1e88215`, using `glass-easel` and the official WXML
  pipeline. It fixed a token-path white screen (`1e88215`) and an installer
  rejection (`ac0a03e`), was never run on a device, and was not merged; `HEAD`
  is the native TSX runtime.
- **How V8.7 avoids them:** platform asset loader instead of a loopback server;
  origin-scoped message listener instead of a JS interface; separate service
  runtime instead of logic in the view; device gates in M1/M6; a fixed `.qxpkg`
  path/manifest contract; new modules instead of whole-package churn.

### 2.9 Performance targets (confirmed)

Reference low-end device: **not supplied**. The section 9.1 values are confirmed
as the targets; every measurement is `BLOCKED` until a device is named.

| Metric | Target |
|---|---|
| Cold start | ≤ 2.5 s |
| Warm start | ≤ 1.0 s |
| `setData` → painted, ≤ 20 KB | ≤ 100 ms median |
| Scroll 500 simple items | ≥ 50 fps median, no stall > 200 ms |
| Memory above host idle baseline | ≤ 200 MB peak |
| Install 2 MB package incl. verification | ≤ 3 s |

### 2.10 Store policy

`docs/store-policy.md`. Conclusion: Google Play permits interpreted JavaScript
in a WebView but requires the host to prevent policy violations and forbids an
added JS interface over untrusted content; Apple 4.7 permits HTML5/JS mini apps
but 4.7.2 requires **prior permission** to expose native platform APIs, 4.7.4
requires an index with universal links, and 4.7.5 requires age gating. Apple
4.7.2 is the largest risk and a release gate for M8.

### 2.11 Theme plan

ADR 006. Implementation: M1 contract (`qxColorScheme`, page root attributes,
bridge event, error codes); M3 view root and `[data-theme]` CSS; M4 system info
`theme`; M6 device matrix (four fixed combinations, two `auto`, live change,
no-event bridge test); M7 `wx.onThemeChange`/`offThemeChange` and the
QChat-namespaced switch; M8 iOS `overrideUserInterfaceStyle`; M10 simulator with
its own host theme switch.

### 2.12 Migration options for the existing production apps

Per section 12.5, three options for each app:

1. **Rewrite** in WXML/WXSS/JS (default).
2. **One-way offline conversion tool** TSX → new source format. Separate tool,
   never part of the runtime, never calls legacy QApp at run time, retired when
   migration ends.
3. **Retirement**, only when the owner export shows no active users or the app
   depends on an unsupported feature (e.g. payment).

Effort assumption (to be replaced by real figures): small app 3–5 days, medium
1–2 weeks, large 3–4 weeks. Per-app decision: `BLOCKED` until the export exists.
No migration is implemented before the decision is recorded.

### 2.13 Removal register summary

`docs/qapp-removal.md`: 54 items — 23 `REMOVE`, 15 `ADAPT`, 15 `REPLACE`, 1
`BLOCKED` (production apps). Targets: M1 1, M2 2, M5 7, M6 1, M7 1, M9 16,
M10 4, M11 22. Nothing is past its target at M0.

### 2.14 Environment report

| Item | Value |
|---|---|
| OS | Windows 11 Pro 10.0.26100, 64-bit |
| CPU | Intel Xeon E3-1220 v2, 4 cores / 4 threads @ 3.10 GHz |
| RAM | 8.0 GB |
| Free disk | C: 6.3 GB, D: 29.5 GB, E: 7.5 GB |
| Flutter | 3.47.6 stable (engine 692136cb65), Dart 3.13.5, DevTools 2.60.0 |
| Node / pnpm | Node 26.13.1 / pnpm 10.11.0 (corepack not installed) |
| Java | Temurin 25.0.5.1 LTS; `JAVA_HOME` set |
| Rust / Cargo | **not installed** (Tauri IDE cannot build locally) |
| Android SDK | **not found**; no `adb`; no emulator; no device |
| Visual Studio C++ | **not installed** (Windows desktop build unavailable) |
| Chrome | **not found** (web run unavailable) |
| macOS / iPhone | **none locally**; GitHub Actions has `macos-latest` jobs in `.github/workflows/flutter.yml` (simulator + unsigned IPA) |
| Emulator works? | No (not installed) |
| Real devices connected | None |
| Rules that change | Builds go through CI; device items `BLOCKED`; local Android/Tauri/Windows builds unavailable; keep builds light (8 GB RAM, low disk) |

### 2.15 Estimated cost

- Ceiling: **zero** (Appendix A). No paid service, cloud device farm, Mac rental
  or store account is enabled.
- GitHub Actions estimate (`UNVERIFIED` plan): one full Flutter CI run is about
  45 Linux minutes (analyze/test + two APK builds) plus about 40 macOS minutes
  (iOS simulator + unsigned IPA). macOS minutes are billed at 10×, so about
  445 minute-equivalents per run. A 2,000-minute private-repo allowance allows
  roughly four full runs per month; the plan must be confirmed. Until then,
  avoid unnecessary CI runs and run `flutter analyze` locally.
- No Codespaces or remote environment is used.

### 2.16 Risks and assumptions

| Risk | Impact | Mitigation |
|---|---|---|
| No Android SDK/device | M1/M6 device evidence `BLOCKED` | CI debug APK + owner checklist; install SDK when disk allows |
| No Mac/iPhone | M8 `BLOCKED` | macOS CI for unsigned builds; revisit when hardware exists |
| Low disk/RAM | Builds fail or thrash | CI builds; no Android SDK locally for now |
| Custom compiler effort | M3/M7 slip | P0 first, matrix-driven; glass-easel evidence kept for a future ADR |
| Apple 4.7.2 | iOS release blocked | minimise native APIs, request permission in M8 |
| Signing key handling | Security blocker | separate signing service, no key in repo/app |
| Legacy spread (246 files) | removal slips | register + per-phase progress + CI guard from M1 |
| Production export missing | migration `BLOCKED` | ask once; apps stay on legacy |

### 2.17 Conflicts between repository rules and the specification

| Conflict | Resolution |
|---|---|
| `apps/mobile/AGENTS.md` §7: Mini App frames draw controls with TDesign (`tdesign_flutter`) | The V8.7 architecture renders Mini App content in the WebView (section 0.1 items 2–3), so §7 applies only to the legacy runtime. Spec wins on architecture. §7 is removed with legacy QApp at M11; until then the legacy file stays. |
| `apps/mobile/AGENTS.md`: ask before long builds/tests; `flutter analyze` is cheap | Repo rule wins on tooling. The full Flutter suite runs in CI; locally only `flutter analyze`, `pnpm typecheck` and the Node tests. |
| `docs/MINIAPPS.md` states "Only the native qapp runtime exists" | Stale legacy documentation, not a rule. Replaced in M9 (register row 50). |

### 2.18 Minor decisions

- Audit helper `scripts/m0-wechat-repos.mjs` is a one-off tool, not runtime.
- Audit documents live under `docs/audit/`.
- The sample names are `qchat-hello` and `qchat-notes`.
- The store policy analysis is a separate document (`docs/store-policy.md`).
- The compatibility matrix lists post-MVP APIs now as `Not started`.
- The unmerged branch `backup/miniapp-webview-1e88215` is kept until M11 as
  evidence; its deletion is register row 52.
- M0 wrote no production code.

## 3. Phase reports

### M0 — Audit and plan

**Exit check:** `PASS` — all deliverables exist, baseline verified, committed and
pushed as `6cd467e` to `origin/feat/miniapp-v7`. Device items are not part of M0.

| Checklist item | Evidence |
|---|---|
| Audit report | `docs/audit/M0-AUDIT.md` |
| Plan (`PLAN`) | This file, §2 |
| Removal register | `docs/qapp-removal.md` (54 items) |
| Compatibility matrix | `docs/compatibility.md` |
| Environment report | This file, §2.14 |
| Reuse-vs-build ADR + full repo list | ADR 001; `docs/audit/wechat-miniprogram-repos.md` |
| Container integration ADR | ADR 002 |
| Module locations ADR | ADR 003 |
| Store policy analysis | `docs/store-policy.md` |
| Sample apps and effort | This file, §2.7 |
| Migration options | This file, §2.12 |
| Theme plan | ADR 006; this file, §2.11 |
| Appendix A assumptions | This file, §2.3 |
| Baseline checks | `pnpm typecheck` pass; `pnpm test` 32 pass; `flutter analyze` clean |
| Commit and push | `6cd467e` on `origin/feat/miniapp-v7` |

**ADRs written:** 001 reuse-versus-build; 002 container integration; 003 module
layout; 004 minimum Android; 005 pinned base library; 006 theme ownership; 007
backend modular monolith; 008 package format and signing.

**Removal progress (section 12.2B):**

| Decision | Total | Done | Remaining |
|---|---|---|---|
| REMOVE | 23 | 0 | 23 |
| ADAPT | 15 | 0 | 15 |
| REPLACE | 15 | 0 | 15 |
| BLOCKED | 1 | 0 | 1 |
| **Total** | **54** | **0** | **54** |

Past target milestone: 0. Blocked by access/input: 1 (production apps).

**Compatibility matrix:** created; every new-runtime entry `Not started`; legacy
inventory is informational only.

**Open risks / blocked:** see §1 and §2.16.

**How to verify:** the commands in §1 "How to verify M0".

## 4. M1 task plan

| # | Task | Output | Verification |
|---|---|---|---|
| 1 | Contracts package | `packages/miniapp-contracts`: versions, bridge envelope, manifest, permissions, error codes, renderer/component/API registries, theme contract, performance method | `pnpm --filter @qchat/miniapp-contracts test`, typecheck |
| 2 | Contract tests | Validation tests for envelope, manifest, permissions, theme values, error codes | Node test output |
| 3 | Spike: service runtime | `packages/miniapp-service-runtime` minimal `App`/`Page`, `setData`, event dispatch, render messages | Node test with a fake bridge |
| 4 | Spike: view runtime | `packages/miniapp-view-runtime` minimal renderer (text + button) behind a DOM adapter | Node test with a fake DOM adapter |
| 5 | Spike: bridge round trip | Service → view render → tap → service handler → new render | Node test, same payloads as the device bridge |
| 6 | Engine ADR | ADR 009 (QuickJS on Android, JavaScriptCore on iOS; evidence, alternatives) | ADR exists |
| 7 | Device proof | Real Android phone: logic outside the WebView sends data, tap returns | `BLOCKED`: no SDK/device; CI APK + owner checklist prepared |
| 8 | Spike report + exit check | `STATUS.md` M1 report, ADRs, removal progress, compatibility update | Exit check |

M1 does not start M2 production code before the exit check has passed.

## 5. M1 phase report

### 5.1 Exit check

**Result:** `PASS`. The one item that cannot be produced here — execution on a
real Android phone — is recorded as `BLOCKED`, with the reason and the checklist
below. Section 11.1 allows a blocked device item; the phase is not reported as
device-verified.

| Checklist item | Evidence |
|---|---|
| Contracts exist and are versioned | `packages/miniapp-contracts/src/`: `version.ts`, `errors.ts`, `validate.ts`, `bridge.ts`, `lifecycle.ts`, `permissions.ts`, `components.ts`, `apis.ts`, `manifest.ts`, `renderer.ts`, `theme.ts`, `performance.ts`, `index.ts` |
| Contract tests | `pnpm --filter @qchat/miniapp-contracts test` → **41 pass, 0 fail** |
| Service runtime spike | `packages/miniapp-service-runtime`; `App`/`Page`, lifecycle, stack, `setData`, path validation, theme, message validation |
| Service tests | `pnpm --filter @qchat/miniapp-service-runtime test` → **11 pass, 0 fail** |
| View runtime spike | `packages/miniapp-view-runtime`; typed tree, diffing without reload, event binding, theme root, typed ops |
| View + round-trip tests | `pnpm --filter @qchat/miniapp-view-runtime test` → **9 pass, 0 fail** (includes the round trip) |
| Round trip | `packages/miniapp-view-runtime/test/roundtrip.test.ts`: service render → view paint → tap → service handler → new render; state kept across a theme change |
| Engine ADR | `docs/adr/009-service-engine.md` (QuickJS Android, JavaScriptCore iOS, one SDK) |
| Type check | `pnpm typecheck` → pass |
| No legacy import | `pnpm check:miniapp` → pass (9 module roots); CI runs it |
| Device proof | `BLOCKED`: no Android SDK, emulator or phone; the Flutter host screen does not exist yet (M5/M6) |
| Removal progress | 1/54 (row 26, `REPLACE`, done) |
| Compatibility update | §1.0 contracts/spike table; device theme cases stay `Not started` |
| Commit and push | `f68904c` on `origin/feat/miniapp-v7` |

### 5.2 What the spike proves

- Page logic lives in the service module; the view module never imports it and
  receives only a typed tree. The two modules meet at `BridgeMessage`.
- A tap travels view → host transport → service handler → `setData` → render,
  and the view diffs the tree instead of rebuilding the page (`createdTags`
  stays constant in the test).
- A theme change updates the root theme only and keeps page data.
- A fixed-theme page receives no host theme event; an `auto` page receives one.
- Untrusted input is rejected: wrong app/session/page binding, unknown message
  kinds/keys, unknown error codes, oversized messages, unsafe paths, prototype
  paths, non-`wx-*` tags.
- The same contract types are used by the contracts, service and view packages.

### 5.3 What the spike does not prove

- It does not run on Android or iOS, and it does not use QuickJS or
  JavaScriptCore. It runs on Node.
- It does not compile WXML/WXSS. `render(data)` is a hand-written stand-in for
  the M3 compiler output.
- It implements no `wx.*` API, no web component, no package install and no
  permission prompt.
- It measures no performance value.

### 5.4 Device checklist (for when a phone and the host exist)

1. Build the CI debug APK and install it on the Android phone.
2. Open the M1 spike screen (added with the Flutter host in M5): the service
   sends a render tree, the view paints `count:0`.
3. Tap the button: the service handler runs and the view shows `count:1`; the
   page is not reloaded and the log shows no second `onLoad`.
4. Switch the host theme with an `auto` page open: root `data-theme` changes,
   state stays, no reload.
5. Repeat with a `light` page: no theme event reaches the page.
6. Record device, OS and WebView versions next to the result.

### 5.5 ADRs written in M1

- **ADR 009** — Service Runtime engine: QuickJS on Android, system
  JavaScriptCore on iOS, one JavaScript SDK and one bridge contract. Device
  measurement `BLOCKED`.

### 5.6 Removal progress (section 12.2B)

| Decision | Total | Done | Remaining |
|---|---|---|---|
| REMOVE | 23 | 0 | 23 |
| ADAPT | 15 | 0 | 15 |
| REPLACE | 15 | 1 | 14 |
| BLOCKED | 1 | 0 | 1 |
| **Total** | **54** | **1** | **53** |

Past target milestone: 0. Blocked by access/input: 1 (production apps). The two
M2 items are rows 6 (legacy bridge) and 13 (`flutter_js`).

### 5.7 Compatibility matrix

Added §1.0 “Contracts and M1 spike” (10 entries, `Experimental`, linked tests).
`qxColorScheme` moved from `Not started` to `Experimental` (contract only). Every
WeChat API, component, syntax and device theme entry stays `Not started` or
`Blocked`; no compatibility claim is made.

### 5.8 Open risks / blocked

- Real-device proof for M1 and the M6 MVP: no Android SDK/device, and the
  Flutter host screen arrives in M5. Owner can install a CI APK later.
- Engine size and performance: documented in ADR 009 as `BLOCKED` until M2
  builds the engine and M6 measures it.
- The iOS half of ADR 009 is untested until M8.

### 5.9 How to verify M1

```powershell
pnpm typecheck
pnpm check:miniapp
pnpm test:miniapp
pnpm --filter @qchat/miniapp-contracts test
pnpm --filter @qchat/miniapp-service-runtime test
pnpm --filter @qchat/miniapp-view-runtime test
Get-Content docs/adr/009-service-engine.md
```

## 6. M2 task plan

| # | Task | Output | Verification |
|---|---|---|---|
| 1 | Engine interface | `ServiceEngine` contract: evaluate, post message, memory/stack/time limits, terminate; Node and QuickJS/JSC adapters behind it | Type check; Node adapter test |
| 2 | JavaScript SDK bootstrap | `App`, `Page`, `Component`, `getApp`, `getCurrentPages`, `setData`, module loading (CommonJS subset), timers | Node tests on the SDK, no legacy import |
| 3 | Host bridge | Request/response ids, allowlist, timeouts, cancellation on page/app close, ordering, origin/session/page binding, bounded queue | Unit tests for timeout, cancel, closed page, foreign binding |
| 4 | Android engine build | QuickJS vendored by commit, NDK build for the three ABIs, JNI surface limited to the contract; CI build job | CI artifact + size report; local build `BLOCKED` (no NDK) |
| 5 | Legacy rows 6 and 13 | Remove `miniapp_bridge.dart` usage and `flutter_js`; register status updated | `pnpm check:miniapp`; `flutter analyze` |
| 6 | M2 report + exit check | `STATUS.md` report, ADR updates, removal progress, compatibility note | Exit check |

M2 does not start M3 view/compiler work before its exit check. Device execution
remains `BLOCKED`; the engine build is verified by CI, and the phone checklist
is reused from §5.4 when hardware exists.

### 6.1 M2 progress

| # | Task | State | Evidence |
|---|---|---|---|
| 1 | Engine interface | Done | `packages/miniapp-service-runtime/src/engine.ts`: evaluate/call, limits, memory report, terminate |
| 1a | Node engine adapter | Done | `src/node-engine.ts`; `test/engine.test.ts` — **8 pass**: isolation, no `process`/`require`/`Buffer`, no `eval`/`Function`, timeout, call, terminate |
| 3 | Host bridge client | Done | `src/bridge-client.ts`; `test/bridge-client.test.ts` — **9 pass**: allowlist, response matching, timeout, foreign binding, typed error, close, abort/cancel, events, malformed input |
| 2 | JavaScript SDK bootstrap | Done | `src/sdk.ts`, `src/sdk-runtime.ts`, `src/module-loader.ts`; `test/sdk-runtime.test.ts` — **7 pass**: App/Page registration, nested `require`, cache, open/setData/close, unknown handler, escape rejection, forbidden path |
| 2a | Timers | Done (basic) | SDK wraps `setTimeout`/`setInterval`, tracks handles and clears them on `clearTimers`; a long-running-timer test is M3 |
| 4 | Android QuickJS build | `BLOCKED` locally | No Android SDK/NDK; vendored source and the JNI/Gradle module land with the M5 host. ADR 009 records the decision; M2 does not claim a device build |
| 5 | Legacy rows 6 and 13 | Done | Rows 6 and 13 marked done in `docs/qapp-removal.md`; the legacy files stay until row 1/M11 because the legacy runtime still uses them |
| 6 | M2 report + exit check | Done | §7 |

`pnpm test:miniapp` now runs **89 tests** (41 contracts + 39 service + 9 view),
all passing; `pnpm typecheck` and `pnpm check:miniapp` pass.

## 7. M2 phase report

### 7.1 Exit check

**Result:** `PASS` for the M2 done-when condition — “contracts and tests pass;
engine ADR”. The Android QuickJS adapter build and any device execution are
`BLOCKED` (no Android SDK/NDK, no phone) and are carried into M5, where the
Flutter host and the Android module are built. This is recorded, not hidden.

| Checklist item | Evidence |
|---|---|
| Engine contract | `packages/miniapp-service-runtime/src/engine.ts`: evaluate, call, limits, memory report, terminate |
| Node engine adapter | `src/node-engine.ts`: separate V8 context, no `process`/`require`/`Buffer`, no `eval`/`Function`, timeout; **8 tests** |
| JavaScript SDK | `src/sdk.ts`: `App`, `Page`, `Component`, `getApp`, `getCurrentPages`, `setData`, tracked timers |
| Module loading | `src/module-loader.ts`: relative `require`, cache, package-root confinement, nested modules; **4 tests** |
| SDK host wiring | `src/sdk-runtime.ts`: install, app/page load, open, deliver, setData, close, back, respond, reject; **7 more tests** |
| Host bridge | `src/bridge-client.ts`: allowlist, ids, timeout, cancel, close, binding; **9 tests** |
| Service call path | SDK `__qchatCall` → host `onRequest` → `respond` → promise settles; unknown method answered with `BRIDGE_UNKNOWN_METHOD` |
| Engine ADR | `docs/adr/009-service-engine.md` |
| Type check | `pnpm typecheck` pass |
| Isolation guard | `pnpm check:miniapp` pass (9 roots) |
| Tests | `pnpm test:miniapp` → **89 pass, 0 fail** |
| Android QuickJS build | `BLOCKED`: no SDK/NDK; M5 |
| Device run | `BLOCKED`: no phone; checklist in §5.4 |
| Removal progress | 3/54 (rows 6, 13, 26) |
| Compatibility update | §1.0 M2 rows (engine, SDK, modules, bridge, calls, timers) |
| Commit and push | `42b3929` on `origin/feat/miniapp-v7` |

### 7.2 What M2 proves

- Page code runs in an isolated context that has no host object, no file access,
  no `require` from Node and no dynamic code generation. A runaway loop is
  stopped by the wall-clock limit.
- `App`/`Page`/`Component` register inside the engine; `setData` updates page
  data and emits a validated message; relative modules load once and are cached.
- A page can call a host API and receive a typed response; a method outside the
  allowlist is rejected by the host without reaching the transport.
- The host bridge matches responses by id, rejects a foreign app/session/page,
  times out, cancels and rejects everything on close.

### 7.3 What M2 does not prove

- No Android or iOS engine has been built or run. The Node adapter is real but
  it is not QuickJS or JavaScriptCore.
- No `wx.*` API is implemented; the call path is exercised with `wx.showToast`
  as a transport probe.
- No WXML/WXSS compiler, no web component and no visual render.
- No performance number.

### 7.4 Removal progress (section 12.2B)

| Decision | Total | Done | Remaining |
|---|---|---|---|
| REMOVE | 23 | 0 | 23 |
| ADAPT | 15 | 1 | 14 |
| REPLACE | 15 | 2 | 13 |
| BLOCKED | 1 | 0 | 1 |
| **Total** | **54** | **3** | **51** |

Past target milestone: 0. Blocked by access/input: 1 (production apps).

### 7.5 Compatibility matrix

Added engine, SDK, module loader, bridge client, service-call and timer entries
to §1.0 (`Experimental`, linked tests). Every WeChat API, component, syntax and
device theme entry is unchanged; no compatibility claim is made.

### 7.6 Open risks / blocked

- Android QuickJS build and JNI: no local NDK; must be verified by CI/M5.
- iOS JavaScriptCore adapter: M8.
- Engine memory enforcement is not measured; the Node adapter reports `null`
  rather than a host-wide number.
- `flutter_js` remains in `pubspec.yaml` only because the legacy runtime still
  uses it; row 1/M11 removes it with the legacy runtime.

### 7.7 How to verify M2

```powershell
pnpm typecheck
pnpm check:miniapp
pnpm test:miniapp
pnpm --filter @qchat/miniapp-service-runtime test
Get-Content docs/adr/009-service-engine.md
```

## 8. M3 task plan

| # | Task | Output | Verification |
|---|---|---|---|
| 1 | WXML parser | Tokenizer + AST for elements, attributes, text, comments; file/line/column on every node | Parser tests, malformed-input tests |
| 2 | WXML compiler | `{{}}` binding, `wx:if`/`wx:elif`/`wx:else`, `wx:for` + `wx:key`, `block`, `template`/`import`/`include`, `slot` | Compiler tests with fixtures |
| 3 | Event compiler | `bind*`/`catch*`, dataset, handler names; reject unknown syntax | Tests; event round trip with the view runtime |
| 4 | WXSS compiler | `rpx`, `@import`, page/component scoping, `[data-theme]`; `prefers-color-scheme` rejected | Tests; compiled CSS snapshots |
| 5 | P0 components | `view`, `text`, `image`, `button`, `input`, `scroll-view`, navigation bar as web components | Renderer tests per component |
| 6 | `setData` path ops | Batched, path-based operations from the service to the view; ordering defined | Unit tests; no page reload |
| 7 | Diagnostics | File, line, column, error code, explanation for every unsupported item | Diagnostic fixture tests |
| 8 | Sample | `qchat-hello` source (WXML/WXSS/JS) compiled and rendered in the Node harness | End-to-end test |
| 9 | M3 report + exit check | `STATUS.md` report, compatibility rows, removal progress | Exit check |

M3 does not start M4 API work before its exit check. The Android host remains
M5; M3 is verified in Node with the DOM adapter.

### 8.1 M3 progress

| # | Task | State | Evidence |
|---|---|---|---|
| 1 | WXML parser | Done | `packages/miniapp-compiler/src/wxml.ts`: elements, attributes (quoted, single-quoted, empty, boolean), text, mustache blocks (including `<` inside `{{ }}`), comments, self-closing tags, 1-based file/line/column on every node; `test/wxml.test.ts` — **15 pass**, including every parse error code |
| 2 | WXML compiler | Done | `src/wxml-compiler.ts`: `{{ }}` in text/attributes with typed whole-value results, `wx:if`/`wx:elif`/`wx:else` chains, `wx:for`/`wx:for-item`/`wx:for-index`/`wx:key` (`*this` and property paths), transparent `block`, `template`/`is`/`data` (object and spread form), `import`, `include`, `slot`; `test/wxml-compiler.test.ts` — **21 pass** |
| 2a | Expression evaluator | Done | `src/expression.ts`: literals, member/index access, unary/binary/ternary, array/object/spread; function calls, `new`, `this`, optional chaining and prototype keys are rejected at parse time; `test/expression.test.ts` — **9 pass** |
| 3 | Event compiler | Done | `bind*`, `bind:*`, `catch*`, `catch:*`, `mut-bind*`, static and `{{ }}` handler names, `data-*` → camelCase dataset; capture-phase bindings are rejected with a diagnostic |
| 4 | WXSS compiler | Done | `src/wxss.ts`: rules, declarations, comments, `rpx` → `--qchat-rpx` (750 rpx = page width), inlined `@import` with package confinement and cycle detection, `@media`/`@keyframes`/`@font-face`, component scoping with `:host`, `[data-theme]` preserved, `prefers-color-scheme` rejected; `test/wxss.test.ts` — **18 pass** |
| 5 | P0 components | Done | `packages/miniapp-view-runtime/src/components.ts`: `wx-view`, `wx-text`, `wx-image`, `wx-button`, `wx-input`, `wx-scroll-view`, `wx-navigation-bar` as real custom elements with shadow DOM, attribute reflection, hover, text decode/space, image modes and load/error, tap/input/confirm, scroll thresholds, navback; `COMPONENTS_SOURCE` is the dependency-free WebView bootstrap. `test/components.test.ts` — **18 pass** against a minimal DOM shim, plus a renderer pass over every P0 tag |
| 6 | `setData` path ops | Done | `diffRenderTree` in `packages/miniapp-contracts/src/renderer.ts` (text, props, dataset, events, children; removes descending, inserts ascending); the service sends a full tree once per visible page and path ops after that, with a monotonic `seq`; `createRenderSession` in `packages/miniapp-view-runtime/src/session.ts` applies payloads in order and ignores stale ones. Tests: `renderer-diff.test.ts` — **9 pass**, `session.test.ts` — **9 pass**, plus service and round-trip updates |
| 7 | Diagnostics | Done | `src/diagnostics.ts`; every parser, compiler and WXSS error carries file, 1-based line/column, registry code and an explanation |
| 8 | Sample | Done | `packages/miniapp-examples-v2/qchat-hello`: native `app.json`/`app.js`/`app.wxss` + one page with `{{ }}`, `wx:if`, `wx:for`/`wx:key`, `bindtap` and `setData`; `app.wxss` imports `styles/base.wxss`, page WXSS uses `rpx` and `[data-theme="dark"]`. `packages/miniapp-test-harness` loads it from disk, compiles WXML/WXSS, runs the page JS in the Node engine through `createSdkRuntime`, renders through the View Runtime over `MemoryDomAdapter`, and delivers a real DOM tap back to the handler. `test/sample.test.ts` — **7 pass**: compiled CSS (inlined import, rpx `calc()`, theme selector, no `prefers-color-scheme`/`rpx`), initial DOM, first/second tap patch only changed paths (same text handle, status branch created once, no reload), fixed-light vs dark host, snapshot isolation, closed-host and unknown-route errors |
| 9 | M3 report + exit check | Done | §9 |

`pnpm test:miniapp` now runs **200 tests** (50 contracts + 63 compiler + 44
service + 36 view + 7 harness), all passing; `pnpm typecheck` and
`pnpm check:miniapp` pass. The new packages are in `pnpm-workspace.yaml` and in
the isolation guard roots (9 module roots).

## 9. M3 phase report

### 9.1 Exit check

**Result:** `PASS` for the M3 done-when condition — "P0 renders; diagnostics with
file/line/column/code; tests". Rendering is proven in Node through the real
renderer and a DOM adapter, not in a WebView on a phone. Device rendering and
the theme matrix stay `BLOCKED` (no Android host until M5, no phone) and are
carried to M5/M6.

| Checklist item | Evidence |
|---|---|
| WXML parser | `packages/miniapp-compiler/src/wxml.ts`; 15 tests, every parse error code |
| WXML compiler | `src/wxml-compiler.ts`: `{{ }}`, `wx:if`/`elif`/`else`, `wx:for`/`wx:key`, `block`, `template`/`import`/`include`, `slot`; 21 tests |
| Expressions | `src/expression.ts`: typed safe subset; calls, `new`, `this`, optional chaining, prototype keys rejected; 9 tests |
| Events | `bind*`, `bind:*`, `catch*`, `catch:*`, `mut-bind*`, dataset; capture phase rejected with a diagnostic |
| WXSS compiler | `src/wxss.ts`: `rpx` → `calc()` over `--qchat-rpx`, inlined `@import`, scoping, `[data-theme]` kept, `prefers-color-scheme` rejected; 18 tests |
| P0 components | `packages/miniapp-view-runtime/src/components.ts`: `view`, `text`, `image`, `button`, `input`, `scroll-view`, navigation bar; 18 tests over a DOM shim + renderer pass |
| `setData` path ops | `diffRenderTree` + `validateRenderOp(s)`; service sends one tree, then ordered ops with `seq`; session ignores stale/duplicate payloads; 9 + 9 tests |
| Diagnostics | Every parser/compiler/WXSS error: file, 1-based line/column, registry code, explanation |
| Sample | `packages/miniapp-examples-v2/qchat-hello` + `packages/miniapp-test-harness`; 7 end-to-end tests (compile, launch, tap, patch, theme, close) |
| Type check | `pnpm typecheck` pass (2 GB heap; 512 MB is not enough for the whole repo) |
| Isolation guard | `pnpm check:miniapp` pass (9 roots) |
| Tests | `pnpm test:miniapp` → **200 pass, 0 fail** |
| Device render/theme | `BLOCKED`: WebView adapter and phone are M5/M6 |
| Removal progress | 3/54 (rows 6, 13, 26); no new row closes in M3, see §9.4 |
| Compatibility update | §1.0 rows for the sample; §1.3 P0 rows; §1.4 syntax rows |
| Commit and push | `494b555` (sample) and the M3 report commit on `origin/feat/miniapp-v7` |

### 9.2 What M3 proves

- A native-format Mini App source tree compiles without a bundler: WXML becomes a
  typed render tree, WXSS becomes plain CSS, and the JavaScript runs unchanged in
  the isolated engine.
- Directives behave as specified for the P0 surface: `wx:if`/`wx:elif`/`wx:else`
  chains, `wx:for` with `*this`/property keys, `block`, templates, imports and
  slots; events carry handler names and camelCase datasets.
- `{{ }}` is evaluated by a purpose-built evaluator, never `eval`. Anything that
  could reach the prototype or call a function is a compile error with a code,
  a file and a line/column.
- `rpx` resolves against the page width, `@import` is inlined inside the package,
  and theme rules are ordinary `[data-theme="dark"]` selectors, so a theme change
  is a root attribute change, not a reload.
- A tap travels DOM → view renderer → service handler → `setData` → path ops →
  patched DOM. The count text node keeps its identity, the button is not
  recreated, the `wx:if` branch is inserted once, and the page never reloads.

### 9.3 What M3 does not prove

- No WebView has run the components or the compiled CSS. The DOM shim implements
  only what the components use; real layout, custom-element upgrade order and
  shadow-DOM styling are M5/M6.
- No `data-theme` attribute is written by M3: the adapter receives the resolved
  theme and the CSS contract is tested, but the WebView root write is M5.
- No `wx.*` API, no navigation and no package installation; the sample uses only
  `Page`, `setData` and `bindtap`.
- No performance number, no WXS, no P1/P2 component.
- The legacy QApp renderer is untouched and still serves production; M3 builds
  the replacement, it does not remove the old path.

### 9.4 Removal progress (section 12.2B)

| Decision | Total | Done | Remaining |
|---|---|---|---|
| REMOVE | 23 | 0 | 23 |
| ADAPT | 15 | 1 | 14 |
| REPLACE | 15 | 2 | 13 |
| BLOCKED | 1 | 0 | 1 |
| **Total** | **54** | **3** | **51** |

Past target milestone: 0. Blocked by access/input: 1 (production apps).

M3 does not close a register row. The view-runtime rows (1, 2, 4) target M11 and
need the legacy renderer deleted only after the new screen is verified on a
device; deleting them now would break production Mini Apps, which section 12.2
forbids. The compiler and components are the replacement evidence those rows
will cite at M11.

### 9.5 Compatibility matrix

Added the sample end-to-end row to §1.0 and the `qxColorScheme` resolution note
to §1.4. The P0 component rows (§1.3) and the syntax rows (§1.4) were updated as
each task landed. No WeChat API row changes; the §1.5 theme rows stay
`Not started` because every one of them is a device/WebView case (M5/M6), and no
device or performance claim is made.

### 9.6 Open risks / blocked

- Real WebView behaviour (layout, shadow DOM, font metrics, custom-element
  upgrade) is unverified until M5/M6.
- The DOM shim is not a browser; a component test can pass while the browser
  behaves differently.
- `wx:key` reuse is index-based in the renderer; a keyed reorder test with a real
  list is M7.
- Long-running timers and the render budget under load are unmeasured.
- Android QuickJS build remains `BLOCKED` from M2.

### 9.7 How to verify M3

```powershell
$env:NODE_OPTIONS="--max-old-space-size=2048"
pnpm typecheck
pnpm check:miniapp
pnpm test:miniapp
pnpm --filter @qchat/miniapp-compiler test
pnpm --filter @qchat/miniapp-view-runtime test
pnpm --filter @qchat/miniapp-test-harness test
Get-Content docs/compatibility.md
```

### 9.8 ADRs written in M3

None. M3 implements decisions already recorded: ADR 001/003 (custom view runtime
and module layout), ADR 006 (theme ownership: `data-theme` + `color-scheme`,
no reload) and ADR 009 (engine split). The compiler's no-`eval` rule and the
`rpx`/theme-selector output follow ADR 006 and the specification, and are
recorded in `docs/compatibility.md` §1.4 rather than in a new ADR.
