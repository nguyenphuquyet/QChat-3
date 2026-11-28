# ADR 003 — Where the new runtime modules live

- **Status:** ACCEPTED
- **Date:** 2026-11-27
- **Milestone:** M0

## Context

Section 12.2 requires new runtime code in new modules, outside the legacy
modules, never importing them. Section 12.2A requires every legacy item to have
a decision. Section 11.0 requires the plan to say where the new modules live.

The legacy modules are: `packages/miniapp-framework`, `packages/miniapp-examples`,
`packages/contracts/miniapp-ui.contract.json` + `generate-miniapp-ui.mjs`,
`apps/mobile/lib/features/miniapps/qapp`, `apps/server/src/modules/miniapps.ts`
and its services, and the qapp-specific parts of `apps/miniapp-ide`,
`apps/developer`, `apps/admin`, the Prisma models and migrations.

## Decision

Create these new modules. None of them imports a legacy module.

| Module | Kind | Responsibility |
|---|---|---|
| `packages/miniapp-contracts` | TS/JSON package | Versioned contracts: bridge messages, manifest and `.qxpkg` schema, error codes, API registry, component registry, theme contract (`qxColorScheme`), performance method. Generates Dart/TS types. |
| `packages/miniapp-compiler` | Node CLI package | WXML/WXSS/JS build, WXS compilation, `rpx`, diagnostics, `.qxpkg` writer and signer hook. Separate from the legacy compiler. |
| `packages/miniapp-view-runtime` | browser bundle package | DOM renderer, data binding, `setData` diffing, P0/P1/P2 components, theme root, WXS sandbox (M7). Runs only in the WebView. |
| `packages/miniapp-service-runtime` | JS package | `App`, `Page`, `Component`, `getApp`, `getCurrentPages`, lifecycle, module loader, timers, `wx.*` proxy. Runs only in the service engine. |
| `packages/qchat_miniapp_webview` | Flutter plugin | Android `WebViewAssetLoader` + `addWebMessageListener`, iOS `WKURLSchemeHandler` + `WKScriptMessageHandler` (M8). No UI. |
| `packages/miniapp-examples-v2` | WXML/WXSS sources | Sample apps in the new source format. |
| `packages/miniapp-test-harness` | TS package (M3+) | Shared fixtures, golden WXML/WXSS, fake bridge. |
| `apps/mobile/lib/features/miniapps_host` | Flutter feature | Runtime screen, capsule/status bar, installer, storage, permission prompts, bridge client. |
| `apps/server/src/modules/v1` | server domain modules | App registry, projects, build jobs, package storage, signing, versions, releases, distribution, permissions, analytics, crash reports, compatibility registry, audit logs, under `/api/v1/`. |
| `apps/miniapp-ide` | adapted desktop app | The Tauri/Monaco shell is kept; its compiler, templates, TSX tooling and preview are replaced (M10). |

Existing shared modules are **adapted**, not duplicated:

- `apps/server/src/security/*`, `services/db.ts`, `services/api.ts`,
  `services/push.ts`, `services/site-links.ts`, S3/storage clients, rate limits
  and audit logs.
- `apps/developer/dashboard.tsx` and `apps/admin/dashboard.tsx`: the Next.js
  shell, auth/session proxy and layout are reused; the Mini App panels are
  replaced.
- `apps/mobile` auth, network, storage, design system and routing.
- `apps/miniapp-ide` Tauri shell, Monaco component, installer CI.

Naming rule: legacy identifiers (`qapp`, `.japp`, `@mna/qchat`,
`miniapp-framework`) never appear in the new modules. The CI early guard
(section 12.2B) scans the new modules for them from M1.

## Alternatives considered

1. **Extend `packages/miniapp-framework`.** Forbidden by section 12.2.
2. **Put the runtime in `apps/mobile/lib`.** Rejected: the view runtime is a
   browser bundle and the service runtime is engine-hosted JavaScript; neither
   belongs in Dart. The Flutter plugin and the feature module stay in the app.
3. **One package for everything.** Rejected: the compiler (Node), the view
   bundle (browser), the service bundle (engine) and the Flutter plugin have
   different runtimes and different test harnesses; one package would hide the
   boundary the specification requires.

## Consequences and risks

- More packages to wire into `pnpm-workspace.yaml` and CI. Acceptable.
- The contracts package is the single source of truth; generated Dart/TS files
  must be checked in and verified by a CI check, like the old contract check but
  for the new contract.
- The old `packages/contracts` stays untouched until M11 except for its own
  removal decision.

## Cost and effort to reverse

Low for the module split (folders and workspace entries); high for the contract
package once code generation and tests depend on it.
