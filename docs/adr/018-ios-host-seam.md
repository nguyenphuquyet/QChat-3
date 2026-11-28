# ADR 018 — iOS host seam

- **Status:** ACCEPTED (the host is written in M7 module 5; the macOS build and
  every device claim are still open)
- **Date:** 2026-11-28
- **Milestone:** M8 (host module 5)
- **Implements:** the iOS half of ADR 011 §3 and the transport of ADR 012.
  Refines ADR 012's "the object injected by `addWebMessageListener`" note, which
  is Android-only.

## Context

ADR 011 and ADR 012 fixed the host seam for Android: `WebViewAssetLoader` serves
the installed version at `https://appassets.androidplatform.net/qchat/<appId>/<version>/`
and `WebViewCompat.addWebMessageListener` carries bridge messages from the exact
origin. The same package, the same compiled `build/view.json` and the same
`view.render` protocol must run on iOS.

iOS has no equivalent of either API:

- `WKWebView` cannot route `https` to a handler; only a custom scheme goes to a
  `WKURLSchemeHandler`.
- There is no `addWebMessageListener`; `WKScriptMessageHandler` receives a
  message body but no source origin.
- A custom-scheme document has an opaque origin, so a CSP `'self'` matches
  nothing.

`file://` and a loopback HTTP server stay forbidden by ADR 011. The service
runtime on iOS is JavaScriptCore (ADR 009) and is host module 6; this ADR is only
the page side.

## Decision

### 1. Origin

```
qchat-app://app/qchat/<appId>/<version>/
```

- Scheme `qchat-app`, host `app`, the same `/qchat/<appId>/<version>/` path as
  Android, so the layout and the relative asset rules are unchanged.
- Host assets live at `qchat-app://app/qchat-host/`, outside every app
  directory.
- The host document is `qchat-app://app/qchat/<appId>/<version>/__qchat_view.html`.
- The app id, version, session id, page id and route are validated with the same
  regular expressions as the Android host (`MiniAppOrigin`); a route with an
  empty, `.` or `..` segment is refused.

### 2. Scheme handler

`MiniAppSchemeHandler` is the only thing registered for `qchat-app`, and it
answers from exactly two places:

1. the installed version directory, through the view-asset allowlist (images,
   fonts, audio, video). `app.js`, page `.js`, `.wxml`, `.wxss`, `.wxs` and
   `manifest.json` are never served, so page script cannot read its own service
   code;
2. the host page and the host scripts.

Every resolved file must stay under the version directory after
`resolvingSymlinksInPath`, a path with a backslash, colon, NUL, absolute prefix
or dot segment is refused, and a package file named `__qchat_view.html` is
shadowed by the host document. A request for another path is 404. A stopped
`WKURLSchemeTask` is removed from the active set before any reply, because
`didFinish` after `stop` is an exception.

### 3. Bridge

- `WKScriptMessageHandler` name: `qchatViewBridge`.
- The host serves `qchat-host/qchat-bridge.js`, which defines
  `window.qchatViewBridge.postMessage(message)` over
  `window.webkit.messageHandlers.qchatViewBridge`. `qchat-view.js` is unchanged:
  it calls `window.qchatViewBridge.postMessage`, exactly as on Android.
- The handler requires `frameInfo.isMainFrame`, a frame URL inside the version
  or the host assets, and a current document URL that starts with the version
  base URL. A custom-scheme origin is opaque, so there is no origin string to
  compare; the document can only have come from the scheme handler above.
- The message must be a string, at most 1 MiB, a JSON object with `v == 1`, a
  known `kind`, and the `appId`/`sessionId`/`pageId` triple of the binding.
  Failures report the same `BRIDGE_*` codes as Android.
- The per-view channel is `qchat/miniapp/<viewId>` with `ready`, `send` and
  `destroy`; `onMessage` and `onError` come back the same way. `send` evaluates
  `window.__qchatView.receive(...)`, `destroy` evaluates
  `window.__qchatView.destroy()`.

### 4. Content-Security-Policy

```
default-src 'none';
script-src qchat-app:;
style-src qchat-app: 'unsafe-inline';
img-src qchat-app: data:;
font-src qchat-app:;
media-src qchat-app:;
connect-src 'none'; frame-src 'none'; worker-src 'none';
object-src 'none'; base-uri 'none'; form-action 'none'
```

The scheme names replace `'self'` because an opaque origin would match nothing.
This is the one deliberate deviation from ADR 011's CSP. It stays safe because
the only registered `qchat-app` handler serves the installed version directory
and the host assets, and `connect-src 'none'` still forbids network access.

### 5. Installed layout and channels

- The iOS files directory is Application Support (`miniapps/`), the analogue of
  Android's `filesDir`. The layout is identical:
  `apps/<appId>/versions/<version>/build/view.json`.
- The installer channel is `qchat/miniapp/installer`, method `versionDir`, with
  the same validation and error code as Android. Dart never passes a path.
- The bundle is read by `MiniAppBundle` with the same `format`,
  `formatVersion`, 8 MiB limit and page lookup.

### 6. WKWebView settings

- Non-persistent data store; no cookie or local-storage persistence.
- JavaScript enabled for the view bundle only; automatic window opening,
  inline media playback, picture-in-picture, data detectors and link preview
  are disabled.
- Back/forward gestures and bounce scrolling are off, the background is clear,
  and the content inset is not adjusted: the Flutter widget owns the frame.
- Navigation is allowed only to `qchat-app` URLs inside the version or host
  assets (plus `about:blank` during teardown); anything else is cancelled before
  a request leaves the app.
- A load failure or a lost content process is `RUNTIME_CRASH`, as on Android.

### 7. Lifecycle

`WKUserContentController` retains script message handlers strongly, and the
platform view owns the WebView. The handler is therefore a small object that
holds the platform view weakly; the platform view keeps the
`WKUserContentController` it created and removes the handler and the navigation
delegate when it is deallocated. There is no retain cycle and no "zombie" view
answering messages after the widget is gone.

## Consequences

- The Dart widget is one implementation with two platform views (`AndroidView`
  and `UiKitView`) and one controller; nothing above the platform view changes.
- The view client, the CSP model, the bridge envelope and the error registry stay
  shared. Only the transport object and the scheme differ.
- The host page and the bridge bootstrap are host-owned, so a package cannot
  replace them.
- `Package.swift` declares iOS 15 (Flutter 3.47's floor); the Runner still
  targets iOS 16.
- The macOS CI job proves that the package compiles and links. It is `VERIFIED`
  for "builds" only. WebView behaviour, the scheme handler, the bridge and the
  CSP on a real iPhone stay `UNVERIFIED`/`BLOCKED`.
- JavaScriptCore and the `qchat/miniapp/service` channel are module 6 and are not
  part of this ADR.

## Evidence

- `packages/qchat_miniapp_webview/ios/qchat_miniapp_webview/Package.swift` — the
  Swift package Flutter looks for.
- `Sources/qchat_miniapp_webview/MiniAppOrigin.swift` — scheme, binding
  validation, app URL check.
- `MiniAppSchemeHandler.swift`, `MiniAppAssetPaths.swift`,
  `MiniAppResponses.swift`, `MiniAppHostPage.swift` — the served surface and the
  CSP.
- `MiniAppWebView.swift`, `MiniAppWebViewFactory.swift` — the platform view, the
  bridge, navigation policy and teardown.
- `QchatMiniappWebviewPlugin.swift` — view registration and the installer
  channel.
- `MiniAppBundle.swift`, `MiniAppInstallPaths.swift` — the installed layout and
  the compiled bundle.
- ADR 011 (Android seam), ADR 012 (transport and event semantics), ADR 017
  (Android service runtime).
