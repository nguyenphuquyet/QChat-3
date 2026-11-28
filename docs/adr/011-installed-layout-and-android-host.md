# ADR 011 — Installed layout, compiled view bundle and the Android host seam

- **Status:** ACCEPTED (Android host written in M7; CI build and device evidence
  still open). The iOS counterpart is ADR 018.
- **Date:** 2026-11-28
- **Milestone:** M5
- **Supersedes:** nothing. Fills in the host and artifact details ADR 008 left
  at "compiled view bundle".

## Context

M5 must turn a verified `.qxpkg` into a running Mini App. The package is built
on a server or a desktop, but it runs on a phone with no Node.js, no TypeScript
and no WXML compiler. Two questions were still open after ADR 008:

1. What exactly does the package contain so the host never compiles on device?
2. Where does an installed version live, and how does the system WebView load it
   without `file://` and without a loopback server?

The Android SDK, NDK, emulator and a phone are absent in this environment
(`STATUS.md` §2.14). The 2026-11-28 correction makes that a device-evidence gap,
not a reason to leave the host unwritten: the seam is implemented in
`packages/qchat_miniapp_webview` and compiled by CI, and only the real-device run
stays `BLOCKED`.

## Decision

### 1. Compiled view bundle

`build/view.json` is one versioned JSON document produced by the compiler:

```json
{
  "format": "qchat-view-bundle",
  "formatVersion": 1,
  "appCss": "...",
  "pages": {
    "pages/index/index": {
      "wxml": { "file": "...", "nodes": [], "templates": {}, "files": [] },
      "css": "...",
      "config": {}
    }
  }
}
```

- `wxml` is the compiled template tree: typed nodes, parsed expressions, no
  HTML and no JavaScript. A host that renders it can never execute page data.
- `css` is the compiled app WXSS followed by the page WXSS, with `rpx` already
  turned into `calc(N * var(--qchat-rpx, calc(100vw / 750)))` and
  `prefers-color-scheme` already rejected.
- `config` is the page `.json` object, or `{}`.
- The manifest **requires** `build/view.json` and every page's `.js` and
  `.wxml`. Page `.json` and `.wxss` are optional, as in WeChat. The original
  sources stay in the package for traceability; the host reads only the bundle.
- A bundle whose page set differs from `app.json` is refused; there is no
  fallback that compiles sources on the device.

The reference consumer is `loadInstalledPackage` in
`packages/miniapp-test-harness/src/sample.ts`; it reads an installed directory,
rejects a missing or mismatched bundle, and runs the existing engine and view.

### 2. Installed layout

```
<app files dir>/miniapps/
  apps/<appId>/
    state.json                 { "current": "1.1.0", "previous": "1.0.0" }
    versions/<version>/        verified, read-only package content
      manifest.json
      app.js app.json app.wxss
      pages/... assets/...
      build/view.json
    .staging-<random>/         only during install
    .trash-<random>/           only during replacement
  storage/<appId>/<sha256(key)>.json
```

- Install verifies first, extracts into `.staging-*`, renames the directory into
  `versions/<version>` in one operation, then writes `state.json`. A failure
  before the rename leaves the previous version untouched.
- At most two versions are kept; `rollback` swaps `current` and `previous`
  without extracting again. Revoked versions and downgrades are refused unless
  the policy explicitly allows them.
- Storage is one directory per app ID; the file name is the SHA-256 of the key,
  so a key cannot choose a path. The quota is enforced before a write. A corrupt
  record is `STORAGE_CORRUPT`, never silently recreated.

### 3. Android host seam (implemented in M7 host module 1)

- **Origin:** `WebViewAssetLoader` serves the installed directory under
  `https://appassets.androidplatform.net/qchat/<appId>/<version>/`. The loader
  maps only that directory and rejects `..`, absolute paths and unknown files.
  `file://`, `content://` and a loopback HTTP server are not used.
- **Host assets:** the HTML document and the two scripts live at
  `https://appassets.androidplatform.net/qchat-host/`, outside every app
  directory. The document is served at
  `/qchat/<appId>/<version>/__qchat_view.html`, so relative package URLs resolve
  inside the version. Only view assets (images, fonts, audio, video) are served
  from the installed directory; the service code is never readable by page
  script.
- **CSS:** the host reads the page's compiled `css` from `build/view.json` and
  injects it as a `<style>` element before `start`; the bundle's `formatVersion`
  is checked and an unknown version is refused.
- **Bridge:** `WebViewCompat.addWebMessageListener` with the exact origin above;
  a message from another origin or frame is `BRIDGE_ORIGIN_REJECTED`.
  `addJavascriptInterface` is not used. The listener is bound to one app,
  session and page id; ids from the page are checked, never trusted.
- **WebView settings:** JavaScript enabled only for the view bundle; file access,
  universal access from file URLs, mixed content, third-party cookies and
  remote debugging (release) disabled; safe browsing enabled; force-dark and
  algorithmic darkening disabled (ADR 004/006); a CSP served with the document
  (`script-src 'self'`, `style-src 'self' 'unsafe-inline'`, `connect-src
  'none'`).
- **Engine:** QuickJS runs on its own thread with the SDK and the package's
  service modules. Only the SDK globals exist; no host object, file API or
  network API. The synchronous binding of ADR 010 is a map lookup in the host.
- **Native screens:** permissions, toasts, modals, loading, scan, camera and file
  pickers are host-drawn; the page receives typed events and ids.
- **Teardown:** closing the app terminates the engine, removes the message
  listener, clears timers and pending bridge calls, and releases the WebView.

## Consequences

- The device needs no compiler, so package size is the only build-time cost.
- `build/view.json` is a new compatibility surface. Its `formatVersion` is
  checked; a host rejects an unknown version instead of guessing.
- The Node reference and the Android host share the manifest, the layout and the
  bundle format, so the M6 host work is the WebView/engine binding, not a second
  package format.
- The Dart/Android Ed25519 verifier is still `UNVERIFIED` (ADR 008). The device
  cannot install anything until it is chosen and tested; M5 does not claim it.
- No Android build, WebView behaviour, TLS, storage durability or permission
  prompt is verified in M5. Those items are `BLOCKED` and carried to M6.

## Evidence

- `packages/miniapp-compiler/src/build.ts` — bundle builder, `createAppPackage`,
  `createAppPackageFromDirectory`.
- `packages/miniapp-compiler/src/package.ts` — ZIP writer/reader, limits, path
  and extension checks, Ed25519 manifest signature, runtime-version gate.
- `packages/miniapp-compiler/src/install.ts` — `PackageStore` (staging, atomic
  rename, state, prune, rollback, revocation, downgrade) and
  `FileStorageAdapter`.
- `packages/miniapp-contracts/src/manifest.ts` — required files, including
  `build/view.json`.
- `packages/miniapp-test-harness/src/sample.ts` — `loadInstalledPackage`.
- Tests: `packages/miniapp-compiler/test/package.test.ts` (9),
  `packages/miniapp-test-harness/test/installed.test.ts` (3),
  `packages/miniapp-contracts/test/manifest.test.ts`.
