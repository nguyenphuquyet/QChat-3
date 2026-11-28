# M0 audit — QChat repository and legacy QApp

- **Date:** 2026-11-27
- **Milestone:** M0
- **Status:** audit complete; production figures `BLOCKED` (no owner export)
- **Scope:** the whole repository (`E:\QChat-3`), its git history, and the
  environment. No production system was queried.

## 1. Method

- Read the specification (V8.7), `AGENTS.md`, `apps/mobile/AGENTS.md`,
  `docs/ARCHITECTURE.md`, `docs/MINIAPPS.md`, `docs/DEPLOYMENT.md`,
  `docs/MINIAPP-DEVELOPER-GUIDE.md`, `README.md`.
- Listed the working tree, the workspace packages and the tracked file set.
- Inspected the legacy modules, the server module, the Prisma schema and the
  migrations, the Developer Center, the admin console and the IDE.
- Searched the git history for the earlier WebView runtime and for the qapp
  identifiers (case-insensitive).
- Checked the toolchain and devices with `flutter doctor -v`, `node --version`,
  `pnpm --version`, `java -version`, `rustc --version`, `adb devices`.
- Fetched the public `wechat-miniprogram` repository inventory from the GitHub
  API (all 80 repositories) and the npm metadata for `glass-easel`.
- Verified the store rules on the official Google Play and Apple pages.

Commands used for the inventory:

```powershell
git log --all --oneline --grep="WebView" -i
git show --stat b0e5e78
git show --stat 204bd81
git ls-files | Measure-Object
Select-String -Path apps,packages,docs,scripts,tests,.github -Pattern 'qapp|\.japp|@mna/qchat' -Recurse
```

## 2. Environment (summary)

Full report in `STATUS.md`. The machine is a Windows 11 Pro desktop with a
4-core Xeon E3-1220 v2, 8 GB RAM and 6.3 / 29.5 / 7.5 GB free on C: / D: / E:.
Installed: Flutter 3.47.6 (Dart 3.13.5), Node 26.13.1, pnpm 10.11.0, Java 25,
Git 2.56.0. **Missing:** Android SDK, Android device, emulator, Rust/Cargo,
Visual Studio C++ workload, Chrome, macOS. Consequences: Android build and
device items are `BLOCKED` locally; GitHub Actions (including `macos-latest`)
is the only build path for Android/iOS. This is recorded as a cost and risk in
`STATUS.md`.

## 3. QChat stack (confirmed)

| Layer | Evidence | Confirmation |
|---|---|---|
| Mobile | `apps/mobile/pubspec.yaml`, `lib/main.dart` | Flutter 3.47.6, Dart 3.13.5, `WidgetsApp.router`, Riverpod, go_router, Drift, Socket.IO, WebRTC, Firebase push |
| Backend | `apps/server/package.json`, `app/api/[...path]/route.ts`, `src/modules/*` | Next.js 16 App Router, TypeScript, Prisma 6.19 / PostgreSQL, S3-compatible storage, Redis |
| Realtime | `apps/realtime` | standalone Socket.IO process (in `docs/ARCHITECTURE.md`) |
| Developer Center | `apps/developer/dashboard.tsx` | Next.js page + cookie proxy `/api/developer/*` |
| Admin | `apps/admin/dashboard.tsx`, `apps/server/app/admin` | Next.js page inside the server app |
| Desktop IDE | `apps/miniapp-ide` | Tauri v2 + React 19 + Monaco |
| Packages | `packages/contracts`, `packages/miniapp-framework`, `packages/miniapp-examples` | workspace packages |

The Appendix A initial description is confirmed with one correction: the
desktop IDE is Tauri v2 (not only "Tauri-based"); the server is Next.js, not a
separate Express/Nest process.

## 4. Repository size

- 850 tracked files, about 146,000 lines in the counted source/doc extensions.
- Largest language groups: Dart 52k, TSX 32k, TS 28k, JS 18k.
- The legacy Mini App surface is about 2,560 matching lines in 246 files for the
  `qapp|.japp|@mna/qchat` identifiers (includes generated copies in
  `apps/miniapp-ide/src-tauri/resources` and docs).

## 5. Legacy QApp inventory

### 5.1 Mobile runtime (`apps/mobile`)

| Item | Path | Notes |
|---|---|---|
| Flutter renderer | `lib/features/miniapps/qapp/qapp_renderer.dart` (107 KB) | Maps a JSON virtual tree to Flutter widgets; TDesign leaf controls |
| View/state model | `qapp_view.dart`, `qapp_tree.dart`, `qapp_style.dart`, `qapp_custom_paint.dart`, `qapp_screen_transition.dart` | Flex layout, style validation, Cupertino transitions |
| TDesign island | `qapp_tdesign.dart` | The only file importing `tdesign_flutter`; tied to the legacy renderer |
| QuickJS host | `qapp_js_runtime_native.dart` | `flutter_js`, `__qchatNative` JSON bridge, timer wake |
| Backend/stub | `qapp_backend*.dart` | Conditional import for native vs test |
| Contract whitelist | `qapp_contract.generated.dart` | Generated from `packages/contracts/miniapp-ui.contract.json` |
| Container screen | `miniapp_runtime_screen.dart` (39 KB) | Host chrome, capsule, back, reload |
| Bridge | `miniapp_bridge.dart` (23 KB) | Permission checks, host APIs, events |
| Cache/installer | `miniapp_cache.dart`, `miniapp_storage.dart` | `.japp` download, SHA-256, unzip, two-version cache |
| Store client | `miniapp_api.dart`, `models.dart` | Legacy store endpoints |
| Store screen | `miniapps_screen.dart` (30 KB) | Discovery, recent, favorites |
| Routes | `lib/main.dart` `/miniApps`, `/miniApps/:appId` | Host routes |
| Tests | `test/qapp_*.dart`, `miniapp*_test.dart` | ~12 files |

### 5.2 Packages

- `packages/miniapp-framework` — `@mna/qchat` TSX SDK, compiler (`esbuild`),
  QuickJS env polyfills, CLI, manifest, protocol, UI components, tests. This is
  the legacy SDK and compiler.
- `packages/miniapp-examples` — 10 TSX apps (`hello-world`, `counter`, `shell`,
  `demo-kit`, `custom-kit`, `env-demo`, `cafe`, `rap-pho`, `so-viec`, `vi-nho`)
  and tracked `dist/*.japp` artifacts.
- `packages/contracts` — `miniapp-ui.contract.json`, `miniapps.ts` (permissions,
  categories, manifest schema), `generate-miniapp-ui.mjs` (generates Dart/TS/
  Monaco typings), `index.ts`.

### 5.3 Server and database

- `apps/server/src/modules/miniapps.ts` (43 KB): store, developer, review,
  release, permissions, members, API keys, analytics, telemetry, recents,
  favorites.
- `src/services/miniapp-package.ts`, `miniapp-storage.ts`, `miniapp-preview.ts`,
  `src/services/zip.ts`.
- Prisma models: `MiniApp`, `MiniAppVersion`, `MiniAppReview`, `MiniAppRelease`,
  `MiniAppPermissionRequest`, `MiniAppMember`, `MiniAppApiKey`,
  `UserRecentMiniApp`, `UserFavoriteMiniApp`, `MiniAppAnalyticsEvent`.
- Migrations `202610240002_mini_apps`, `202610260001_qapp_format`,
  `202610260002_qapp_only_default`.
- Legacy routes `/api/miniapps/*`, `/api/developer/*` and the cookie proxy.
- `scripts/miniapps-smoke.mjs`, `tests/miniapps.test.ts`.

### 5.4 Clients and docs

- Developer Center `apps/developer/dashboard.tsx` (apps, builds, review console,
  permissions, API keys, analytics, team, docs).
- Admin console `apps/admin/dashboard.tsx` (review/suspend/links).
- Desktop Studio `apps/miniapp-ide` (TSX Monaco, qapp CLI, TSX templates,
  device panel, Tauri resources).
- Docs `docs/MINIAPPS.md`, `docs/MINIAPP-DEVELOPER-GUIDE.md`,
  `docs/miniapp-ui-reference.md`.
- Root scripts `qapp`, `test:qapp`, `contract:generate`, `contract:check`.
- CI `.github/workflows/miniapp-ide.yml`.

The full per-item register is `docs/qapp-removal.md`.

## 6. Shared code that must survive

- Server: `security/auth.ts`, `security/permissions.ts`, `security/rate-limit.ts`,
  `security/errors.ts`, `services/db.ts`, `services/api.ts`, `services/push.ts`,
  `services/site-links.ts`, the S3/storage client, the audit log, the session
  proxy and the Next.js app shell.
- Mobile: auth, network, Drift storage, design system, router, media picker,
  push, settings, the QChat capsule/header widgets.
- Developer/Admin: Next.js page shell, cookie proxy, auth, layout, shared
  components.
- IDE: Tauri shell, Monaco component, window/updater, installer CI.
- Contracts: permissions/categories semantics can be re-expressed in the new
  contract; the generated qapp UI contract itself is legacy.

## 7. Data and users

- Production figures are **`BLOCKED`**: no owner-supplied export exists
  (section 2.1). The agent did not query production.
- Known schema facts: apps are owned by a `User`, have team members, API keys,
  versions, releases, permission requests, recents, favorites and analytics.
- Migration decisions for the production apps are `BLOCKED` until the export
  lists app name, owner, users, features and size (section 12.5).

## 8. Why the earlier WebView runtimes were abandoned

Two distinct attempts exist in the history. The specification asks for the
earlier WebView runtime; both are recorded because the second one is the closest
precedent for this project.

### 8.1 First WebView runtime (before 2026-10-26)

- It loaded an unpacked package in an isolated WebView from a random
  `127.0.0.1:<port>` server and talked through a `QChatNative` JavaScript
  channel (`docs/MINIAPPS.md` at `204bd81^`, "Flutter runtime" steps 5–7).
- Commit `204bd81` (2026-10-26, "replace WebView runtime with native TSX qapp
  engine") deleted `miniapp_asset_server.dart` and the WebView runtime, and
  introduced the TSX/QuickJS/Flutter renderer.
- The recorded state at `204bd81^` says: "Android WebView behavior has not been
  exercised on a physical device or emulator in this environment." So the first
  runtime was never device-verified.
- The commit message gives no further rationale. `UNVERIFIED` (inferred from the
  code and docs): the loopback server, the JavaScript channel and the absence of
  a component/compiler pipeline made it a thin web wrapper rather than a Mini
  Program runtime; the TSX engine was chosen to get a typed component model.

### 8.2 Second WebView attempt (2026-11-25 → 2026-11-26, unmerged)

- Branch `backup/miniapp-webview-1e88215` contains `b0e5e78` ("switch Mini App to
  WebView + official WXML pipeline"), `4a9235e`, `d29442a`, `167a03d`,
  `ac0a03e`, `1e88215`.
- It used the official `glass-easel` compilers and webpack plugin, a loopback
  token server, and 21 glass-easel host components. The commit says explicitly:
  "Chưa có kết quả trên Android/iOS" (no Android/iOS result yet).
- `1e88215` fixed a white screen caused by the package referring to
  root-absolute `/assets/...` while the host served the package under a random
  token path. `ac0a03e` fixed the installer rejecting `manifest.json` and
  `permissions.json`.
- The branch was never merged; `HEAD` (`d12d80b`, 2026-11-24, `feat/miniapp-v7`)
  is the native TSX runtime. The diff is ~18k insertions / 50k deletions across
  495 files.
- Evidence-based reasons it was not adopted: fragile serving (token path vs
  root-absolute URLs), package-format churn, a large new host component surface,
  no device verification, and the logic running in the same WebView as the view
  (which the new specification forbids in section 0.1 item 4).

### 8.3 How the V8.7 design avoids the same reasons

| Failure | V8.7 answer |
|---|---|
| Loopback server, port and token path | `WebViewAssetLoader` / custom scheme handler, app-private origin (ADR 002) |
| `addJavascriptInterface` JavaScript channel | `addWebMessageListener` with allowed origin (section 4.3, ADR 002) |
| Logic in the WebView | separate Service Runtime, typed bridge (section 0.1 item 4) |
| No device evidence | M1 device spike and M6 MVP are exit gates; `BLOCKED` is explicit |
| Package path surprises | `.qxpkg` contract with fixed paths, manifest hashes, atomic install (ADR 008) |
| Whole-package churn on every change | new modules only; legacy untouched until removal (ADR 003) |

## 9. Reuse versus build

Decision and evidence: `docs/adr/001-reuse-versus-build.md`. The complete
80-repository inventory with license, last push, archive state and size:
`docs/audit/wechat-miniprogram-repos.md`.

## 10. Store policy

Analysis: `docs/store-policy.md`. Summary: Google Play permits interpreted code
in a WebView but forbids an added JavaScript interface over untrusted content and
requires the app to prevent policy violations; Apple 4.7 permits HTML5/JS mini
apps but 4.7.2 forbids exposing native platform APIs without prior permission,
and 4.7.4/4.7.5 add an index and age-gating duties. Both are risks for M8/M11,
not blockers for M1–M7.

## 11. Sample apps for the new source format

| App | Pages | Features exercised | Effort |
|---|---|---|---|
| `qchat-hello` | 1 | P0 components (`view`, `text`, `button`, `input`, `scroll-view`, `image`), `{{}}`, `wx:if`, `wx:for`, `setData`, `showToast`, light theme | 1 day |
| `qchat-notes` | 2 | navigation stack, storage (sync + async), list rendering, form input, `auto` theme, `onThemeChange`, `request` against a local mock | 3 days |

`qchat-hello` is the M6 MVP sample (small enough to finish end to end).
`qchat-notes` is the M7 breadth sample. Both are written in WXML/WXSS/JS; no TSX.

## 12. Baseline verification (before any change)

| Check | Command | Result |
|---|---|---|
| TypeScript | `pnpm typecheck` | pass (after `pnpm install --frozen-lockfile`) |
| Server unit tests | `pnpm test` | 32 pass, 0 fail |
| Flutter analyze | `E:\flutter\bin\flutter.bat analyze --no-pub` (in `apps/mobile`) | "No issues found!" |
| Flutter tests | not run | `apps/mobile/AGENTS.md` asks before long runs; CI owns the full suite |
| Android build/device | not possible locally | `BLOCKED`: no Android SDK, no device |

## 13. Risks found

1. **No Android SDK/device locally.** Every device item is `BLOCKED`; CI builds
   are the only compile evidence until the owner installs the SDK or provides a
   phone.
2. **No macOS locally.** iOS build/device is `BLOCKED`; `macos-latest` CI can
   build unsigned artifacts but cannot run a real iPhone test.
3. **Low disk (6.3 GB on C:, 7.5 GB on E:).** Android SDK, Gradle caches and
   Flutter builds may not fit. Prefer CI for builds.
4. **Legacy coupling.** The qapp identifiers are spread across 246 files,
   including generated copies in the IDE resources. Removal is not a single
   delete; the register splits it.
5. **Repo rule conflict.** `apps/mobile/AGENTS.md` §7 says Mini App frames draw
   their controls with TDesign. The new runtime renders Mini App content in the
   WebView, so §7 becomes obsolete with legacy QApp. Recorded in `STATUS.md`;
   spec wins on architecture; the rule is updated at M11.
6. **Store policy.** Apple 4.7.2 (native API exposure) is a real risk for the
   `wx.*` surface; plan an Apple permission/justification step before M8.
7. **Signing key handling.** The new `.qxpkg` signature is only as safe as the
   M9 signing service; a key in the repo or app is a release blocker.
8. **Performance unknown.** No reference low-end device (Appendix A blank), so
   the section 9.1 numbers are assumptions until measured.

## 14. Open inputs (owner)

The 9 Appendix A fields are blank; the assumptions are in `STATUS.md`. The most
important ones: a real Android phone, a reference low-end device, an iPhone/Mac
or macOS CI budget, the production app export, and confirmation of the Android
minimum version.
