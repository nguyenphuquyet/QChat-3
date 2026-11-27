# Legacy QApp removal register

- **Created:** 2026-11-27 (M0)
- **Owner:** the engineering agent
- **Format:** section 12.2A of the V8.7 specification.
- **Rule:** a legacy item is never `KEEP` and is never described as the new
  runtime. Decisions are `REMOVE`, `ADAPT`, `REPLACE`, or `BLOCKED` when an
  input is missing.

## Summary

| Decision | Items |
|---|---|
| REMOVE | 23 |
| ADAPT | 15 |
| REPLACE | 15 |
| BLOCKED | 1 (production apps, section 12.5) |
| **Total** | **54** |

| Milestone | Items targeted |
|---|---|
| M1 | 1 |
| M2 | 2 |
| M5 | 7 |
| M6 | 1 |
| M7 | 1 |
| M9 | 16 |
| M10 | 4 |
| M11 | 22 |

Removal progress is reported in every phase report (section 12.2B). Nothing is
past its target milestone at M0.

## Register

| # | Item | Location | How found | Callers | Data / users affected | Decision | Target | Status | Evidence |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Legacy Flutter renderer and view model | `apps/mobile/lib/features/miniapps/qapp/qapp_renderer.dart`, `qapp_view.dart`, `qapp_style.dart`, `qapp_tree.dart`, `qapp_custom_paint.dart`, `qapp_screen_transition.dart` | directory audit | `miniapp_runtime_screen.dart`, `qapp` tests | Rendered every legacy Mini App frame | REMOVE | M11 | Open | Replaced by `packages/miniapp-view-runtime` (ADR 001/003) |
| 2 | TDesign Mini App control island | `apps/mobile/lib/features/miniapps/qapp/qapp_tdesign.dart` | grep `tdesign_flutter` | `qapp_renderer.dart` | Leaf controls of legacy frames | REMOVE | M11 | Open | The new view renders web components; the repo rule §7 is retired with it (see `STATUS.md` conflicts) |
| 3 | QuickJS host and qapp backend | `qapp_js_runtime.dart`, `qapp_js_runtime_native.dart`, `qapp_js_runtime_stub.dart`, `qapp_backend*.dart`, `qapp_js_types.dart` | grep `flutter_js` | `miniapp_runtime_screen.dart` | Executed legacy `app.js` | REMOVE | M11 | Open | Replaced by `packages/miniapp-service-runtime` + new engine ADR (M1) |
| 4 | Generated qapp contract whitelist | `qapp_contract.generated.dart` | grep `generated` | renderer, tests | Validated legacy node types | REMOVE | M11 | Open | Replaced by generated contracts in `packages/miniapp-contracts` |
| 5 | Legacy runtime screen | `apps/mobile/lib/features/miniapps/miniapp_runtime_screen.dart` | directory audit | route `/miniApps/:appId` | Whole legacy Mini App screen | REPLACE | M5 | Open | New runtime screen in `features/miniapps_runtime` |
| 6 | Legacy bridge | `apps/mobile/lib/features/miniapps/miniapp_bridge.dart` | directory audit | runtime screen | Permissions and host APIs | REPLACE | M2 | Open | New typed bridge per section 4.3 |
| 7 | Legacy cache/installer | `miniapp_cache.dart` | directory audit | runtime screen | `.japp` download, SHA-256, unzip | REPLACE | M5 | Open | New `.qxpkg` installer (ADR 008) |
| 8 | Legacy per-app storage | `miniapp_storage.dart` | directory audit | bridge | Legacy storage keys | REPLACE | M5 | Open | New per-app storage with quotas |
| 9 | Legacy store client | `miniapp_api.dart` | directory audit | store/runtime screens | Store, build, telemetry calls | REPLACE | M9 | Open | New `/api/v1` client |
| 10 | Legacy models | `models.dart` | directory audit | store/runtime screens | App/version/permission models | REPLACE | M9 | Open | New contracts types |
| 11 | Store/discovery screen | `miniapps_screen.dart` | directory audit | route `/miniApps` | Discovery, recent, favorites | ADAPT | M11 | Open | Keep the QChat UI shell, replace the data layer and models |
| 12 | Mini App routes | `apps/mobile/lib/main.dart` (`/miniApps`, `/miniApps/:appId`) | grep | app router | Navigation | ADAPT | M11 | Open | Routes stay; screens and arguments change |
| 13 | `flutter_js` dependency | `apps/mobile/pubspec.yaml` | pubspec audit | legacy QuickJS host | Engine | ADAPT | M2 | Open | Candidate Android service engine; replace if the M1 spike rejects it |
| 14 | `archive`, `crypto` dependencies | `apps/mobile/pubspec.yaml` | pubspec audit | legacy installer | ZIP, SHA-256 | ADAPT | M5 | Open | Reused by the `.qxpkg` installer after review |
| 15 | qapp widget/runtime tests | `apps/mobile/test/qapp_*.dart` (10 files) | test directory | CI | Regression only | REMOVE | M11 | Open | New view/service tests replace them |
| 16 | Mini App container tests | `miniapps_test.dart`, `miniapp_bridge_test.dart` | test directory | CI | Regression only | REPLACE | M5 | Open | New installer/bridge tests |
| 17 | `features/miniapps` legacy tree | `apps/mobile/lib/features/miniapps/` | directory audit | routes | Legacy runtime | ADAPT | M11 | Open | After removal the new tree is `features/miniapps_runtime`; the folder name retires |
| 18 | Legacy SDK, compiler and CLI | `packages/miniapp-framework/` | workspace audit | IDE, server tests, examples | `@mna/qchat`, `.japp` builds | REMOVE | M11 | Open | Replaced by `miniapp-compiler`, `miniapp-service-runtime`, `miniapp-view-runtime` |
| 19 | Legacy env polyfills and protocol | `packages/miniapp-framework/src/env/*`, `src/protocol.ts` | package audit | legacy bundles | Runtime only | REMOVE | M11 | Open | Not reused; the new engine contract is in `miniapp-contracts` |
| 20 | Legacy example apps (8) | `packages/miniapp-examples/{hello-world,demo-kit,custom-kit,env-demo,cafe,rap-pho,so-viec,vi-nho}` | workspace audit | none (developer samples) | No production users | REMOVE | M11 | Open | Samples, not published apps; the new samples are `qchat-hello`, `qchat-notes` |
| 21 | `counter` example | `packages/miniapp-examples/counter` | workspace audit | developer sample | No production users | REPLACE | M6 | Open | Rewritten in WXML/WXSS as `qchat-hello` |
| 22 | `shell` example | `packages/miniapp-examples/shell` | workspace audit | developer sample | No production users | REPLACE | M7 | Open | Rewritten in WXML/WXSS as `qchat-notes` |
| 23 | Tracked `.japp` artifacts | `packages/miniapp-examples/*/dist/*.japp` | `git ls-files` | none | None | REMOVE | M11 | Open | Not rebuilt in the new format |
| 24 | Legacy UI contract | `packages/contracts/miniapp-ui.contract.json` | package audit | generator, renderer, IDE | Legacy component/props contract | REMOVE | M11 | Open | Replaced by `miniapp-contracts` component registry |
| 25 | Legacy contract generator | `packages/contracts/generate-miniapp-ui.mjs`, `.d.mts` | package audit | root scripts, CI | Generated Dart/TS/Monaco files | REMOVE | M11 | Open | New generator lives in `miniapp-contracts` |
| 26 | Legacy permission/category/manifest schema | `packages/contracts/miniapps.ts` | package audit | server, clients | Permission catalog | REPLACE | M1 | Open | New manifest/permission schema in `miniapp-contracts` |
| 27 | Shared package exports | `packages/contracts/index.ts` | package audit | server, clients | Shared types | ADAPT | M9 | Open | Keep shared exports, drop qapp-only ones |
| 28 | Legacy store/favorites/recents/telemetry endpoints | `apps/server/src/modules/miniapps.ts` (store part) | module audit | mobile store | Users' recents/favorites/telemetry | ADAPT | M9 | Open | Move to `/api/v1` app registry/distribution with a new schema |
| 29 | Legacy developer app/version/build/permission/key endpoints | `apps/server/src/modules/miniapps.ts` (developer part) | module audit | Developer Center, CI keys | Developer data, builds, keys | ADAPT | M9 | Open | New app registry, build jobs, permissions, API keys |
| 30 | Legacy review queue and decisions | `apps/server/src/modules/miniapps.ts` (review part) | module audit | Developer Center, admin | Review records | REMOVE | M9 | Open | The new platform has no manual review (section 14); `MiniAppReview` rows are archived then dropped |
| 31 | Legacy package validation | `apps/server/src/services/miniapp-package.ts` | service audit | upload endpoint | `.japp` validation | REPLACE | M5 | Open | New `.qxpkg` validator (ADR 008) |
| 32 | Legacy build storage | `apps/server/src/services/miniapp-storage.ts` | service audit | upload/download | Stored `.japp` files | ADAPT | M9 | Open | Reuse S3/signed-filesystem adapter; new key layout and immutable artifacts |
| 33 | Reviewer preview | `apps/server/src/services/miniapp-preview.ts` | service audit | admin review | Raw file preview | REMOVE | M9 | Open | No review stage; replaced by the IDE simulator (M10) |
| 34 | Hardened ZIP reader | `apps/server/src/services/zip.ts` | service audit | package validation | Upload safety | ADAPT | M5 | Open | Reuse the limits and traversal checks for `.qxpkg` |
| 35 | Legacy Mini App data models | Prisma `MiniApp`, `MiniAppVersion`, `MiniAppRelease`, `MiniAppMember`, `MiniAppApiKey`, `UserRecentMiniApp`, `UserFavoriteMiniApp`, `MiniAppAnalyticsEvent` | schema audit | server | Apps, versions, releases, users | ADAPT | M9 | Open | New columns for format, signature, channels, staged rollout; data migrated |
| 36 | `MiniAppReview` model | Prisma `MiniAppReview` | schema audit | review module | Review history | REMOVE | M9 | Open | Archived, then dropped by a new migration |
| 37 | `MiniAppPermissionRequest` model | Prisma `MiniAppPermissionRequest` | schema audit | review module | Permission approvals | REMOVE | M9 | Open | Permissions are declared in the manifest and granted at install |
| 38 | `format` and `sdkVersion` columns | `MiniAppVersion.format`, `MiniAppVersion.sdkVersion` | schema audit | server, clients | Version metadata | REMOVE | M11 | Open | Dropped by a new migration after the data migration |
| 39 | qapp format migrations | `apps/server/prisma/migrations/202610260001_qapp_format`, `202610260002_qapp_only_default` | migration audit | DB | Historical only | REMOVE | M11 | Open | Active columns dropped; historical migration files remain as the section 12.3 exception |
| 40 | Legacy API routes | `apps/server/app/api/[...path]/route.ts` miniapp paths, `/api/miniapps/*` | route audit | mobile, Developer Center | Live endpoints | REMOVE | M11 | Open | Replaced by `/api/v1/*` |
| 41 | Developer cookie proxy | `apps/server/app/api/developer/[...path]/route.ts` | route audit | Developer Center | Session forwarding | ADAPT | M11 | Open | Keep the proxy, point it at the new paths |
| 42 | Legacy backend smoke test | `scripts/miniapps-smoke.mjs` | script audit | CI/local | None | REPLACE | M9 | Open | New smoke test for `/api/v1` |
| 43 | Legacy server tests | `tests/miniapps.test.ts` | test audit | CI | None | REPLACE | M9 | Open | New contract/API tests |
| 44 | Developer Center Mini App panels | `apps/developer/dashboard.tsx` | UI audit | developers | Developer workflows | ADAPT | M9 | Open | Keep shell/auth/layout; replace apps/builds/review/keys panels |
| 45 | Admin review console | `apps/admin/dashboard.tsx` | UI audit | admins | Review/suspend actions | REMOVE | M9 | Open | Replaced by version suspend/revoke and audit views |
| 46 | Desktop IDE shell | `apps/miniapp-ide` (Tauri, window, updater, installers) | workspace audit | developers | Developer tooling | ADAPT | M10 | Open | Keep Tauri + Monaco shell; replace compiler/templates/preview |
| 47 | IDE TSX tooling | `apps/miniapp-ide/src/lib/qapp/*`, `qchat-sdk.generated.ts`, `templates.ts`, `PreviewPanel.tsx` | IDE audit | Studio users | TSX projects | REPLACE | M10 | Open | New WXML/WXSS language service, templates, simulator |
| 48 | IDE bundled qapp resources | `apps/miniapp-ide/src-tauri/resources/qapp/*`, `prepare-cli.mjs` | IDE audit | Studio build | Bundled legacy SDK | REMOVE | M10 | Open | New compiler bundle |
| 49 | IDE CI | `.github/workflows/miniapp-ide.yml` | CI audit | CI | Installer builds | ADAPT | M10 | Open | Keep installer jobs; new CLI/resources |
| 50 | Legacy documentation | `docs/MINIAPPS.md`, `docs/MINIAPP-DEVELOPER-GUIDE.md`, `docs/miniapp-ui-reference.md` | docs audit | developers, agents | None | REPLACE | M9 | Open | New platform docs; `miniapp-ui-reference.md` is removed |
| 51 | Legacy root scripts and env | `package.json` (`qapp`, `test:qapp`, `contract:*`), `.env.example` miniapp vars, `docs/DEPLOYMENT.md` miniapp section, `README.md` mentions | root audit | CI, developers | None | REMOVE | M11 | Open | New scripts and env names in M9 |
| 52 | Earlier WebView branch | `backup/miniapp-webview-1e88215` | `git branch -a` | none | None | REMOVE | M11 | Open | Delete after the new runtime is verified; no merge |
| 53 | Mini App TDesign repo rule | `apps/mobile/AGENTS.md` §7 | rule audit | contributors | None | REMOVE | M11 | Open | The new view is web content; see `STATUS.md` conflict entry |
| 54 | Production Mini Apps (names/users unknown) | production database and storage | section 12.5 | users | Unknown | BLOCKED | M11 | Blocked | Needs the owner-supplied export (name, owner, users, features, size) |

## Items `BLOCKED` by missing input

| Item | What is missing |
|---|---|
| Production Mini Apps (row 54) | The owner-supplied production export (section 2.1). Without it every per-app decision stays `BLOCKED` and the apps stay on legacy QApp. |

## Search identifiers for the CI check

The final check (section 12.4) runs case-insensitive over source, configuration,
file names, dependencies, package manifests, CI and the database schema. It must
find none of the following outside the allowed exceptions.

```
qapp
.japp
@mna/qchat
FlutterJsQappRuntime
miniapp-framework
miniapp-examples
miniapp-ui.contract.json
generate-miniapp-ui
qapp_tdesign
qapp_renderer
qapp_view
qapp_style
qapp_tree
qapp_contract.generated
qapp_js_runtime
MiniAppReview
MiniAppPermissionRequest
miniapp-preview
qchat-sdk.generated.ts
qapp-dev-log
qapp-dev-exit
202610260001_qapp_format
202610260002_qapp_only_default
schemaVersion": 2
"format": "qapp"
```

**Allowed exceptions (section 12.3):** already-applied migration files,
changelogs, ADRs, this register, backups under the approved retention period,
and the phase reports that quote them. The CI check excludes
`docs/adr/**`, `docs/qapp-removal.md`, `docs/compatibility.md`, `STATUS.md`,
`apps/server/prisma/migrations/**` and `.git/**`.

This section contains only legacy identifiers. It deliberately does not contain
new-runtime identifiers (`WebViewAssetLoader`, `addWebMessageListener`,
`WKScriptMessageHandler`, `qxpkg`) or host UI-rule identifiers (Material,
TDesign, photo picker packages).
