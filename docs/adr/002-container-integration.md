# ADR 002 — Mini App container integration into the Flutter host

- **Status:** ACCEPTED
- **Date:** 2026-11-27
- **Milestone:** M0 (implemented from M1/M5)

## Context

`apps/mobile` is a Flutter app whose entire UI is drawn by the QChat design
system, with no Material widgets (`apps/mobile/AGENTS.md`). The new runtime puts
Mini App page content in the system WebView and keeps the QChat chrome (capsule,
status bar, host dialogs, native full-screen screens) in Flutter.

The bridge must meet section 4.3:

- content served from an app-private origin (`WebViewAssetLoader` or equivalent),
  never `file://`;
- a message channel restricted to that origin (`WebViewCompat.addWebMessageListener`
  or `WebMessagePort` on Android, `WKScriptMessageHandler` with a frame-origin
  check on iOS);
- `addJavascriptInterface` only with an ADR and tests that prove it safe;
- navigation blocked to external content, broad file access disabled, remote
  debugging disabled in release.

`webview_flutter` exposes only `JavaScriptChannel`, which is implemented with
`addJavascriptInterface` on Android, and it does not expose `WebViewAssetLoader`
or allowed-origin message listeners. It cannot satisfy the contract.

## Decision

Build a federated Flutter plugin, **`packages/qchat_miniapp_webview`**, with:

- **Android (M1/M5):** Kotlin `WebView` inside a `PlatformView`; content served
  by `WebViewAssetLoader` from the app-private installed package directory;
  bridge through `WebViewCompat.addWebMessageListener` with an allowed-origin
  rule for the app-private origin; `WebSettings` hardened (no file access, no
  universal access from file URLs, no remote debugging in release, no
  `allowFileAccessFromFileURLs`); navigation delegate that cancels anything
  outside the origin.
- **iOS (M8):** `WKWebView` with a `WKURLSchemeHandler` for the app-private
  origin and `WKScriptMessageHandler` with a frame-origin check.
- **Dart API:** a small, typed surface (`MiniAppWebViewController`) that loads a
  page, sends/receives typed messages, reports load errors and disposes. It
  contains no UI.
- **Host UI:** `apps/mobile/lib/features/miniapps_host/` owns the runtime
  screen, the capsule/status bar, the permission prompts, the installer and the
  bridge client. It uses only the QChat design system.

The plugin is outside `apps/mobile/lib`, so the Material scan does not apply to
its native code; it draws no UI of its own.

## Alternatives considered

1. **`webview_flutter`.** Rejected: `JavaScriptChannel` is
   `addJavascriptInterface` on Android, and the package does not expose
   `WebViewAssetLoader` or origin-scoped message listeners.
2. **A loopback HTTP server in Dart** (the earlier attempt). Rejected: it needs
   a port, a token path and URL rebasing (the `1e88215` white-screen bug), and
   it is a weaker origin story than the platform asset loader.
3. **Draw Mini App content with Flutter widgets.** Forbidden by section 0.1
   item 2.
4. **A separate Android Activity outside Flutter.** Rejected: it would duplicate
   lifecycle, permissions and theming, and the host needs the QChat capsule over
   the page.

## Consequences and risks

- We maintain a small amount of Kotlin/Swift. That is allowed: native code is
  limited to the host, the bridge and the runtime.
- `addWebMessageListener` requires a modern WebView (section 4.3). The minimum
  Android version and the WebView requirement are recorded in ADR 004 and must
  be checked at runtime with a documented error.
- The plugin must be tested for foreign-origin, foreign-frame and closed-page
  calls (section 4.3) before the MVP.

## Cost and effort to reverse

Medium. The Dart API is small; replacing the platform layer means rewriting the
Kotlin/Swift host and the bridge transport, not the renderer or the service
runtime.
