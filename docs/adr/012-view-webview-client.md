# ADR 012 — View WebView client, message transport and event semantics

- **Status:** ACCEPTED (Node evidence; the Android host is written, device
  WebView evidence open). The iOS transport is ADR 018.
- **Date:** 2026-11-28
- **Milestone:** M6
- **Supersedes:** nothing. Implements the view side of ADR 011 §3.

## Context

ADR 011 fixed the Android host seam: `WebViewAssetLoader` serves the installed
version at an app-private origin and `WebViewCompat.addWebMessageListener`
carries messages from the page. It did not decide what the page runs, how the
host starts it, or how a WXML event becomes a DOM event. M6 task 2 needs that
client, and the same contract must hold on iOS in M8.

The renderer, the diff and the render session already exist in
`packages/miniapp-view-runtime` and are tested in Node. Re-implementing them in
JavaScript for the WebView would create a second, divergent renderer.

## Decision

### 1. Bundle and entry point

`packages/miniapp-view-web` builds `dist/qchat-view.js` from `src/browser.ts`
with esbuild: one IIFE, `target=chrome61` (the WebView on the minimum Android
8.0 device), no imports, no `require`, no `eval`, no `new Function`, no
`innerHTML`, no `fetch`, no `XMLHttpRequest`, no `WebSocket`. The bundle composes
the shared `createViewRenderer` and `createRenderSession`; it never compiles
WXML and never fetches.

`packages/miniapp-view-runtime` is marked `sideEffects: false` so the P0
component bootstrap (`COMPONENTS_SOURCE`) is not pulled into the client bundle.
The host injects that script separately; the two artifacts have different jobs.

The bundle is committed and a `vm` test evaluates the committed file, so the
dependency-free claim is checked without a bundler in the loop.

### 2. Transport

The host serves an HTML page containing `<div id="qchat-root">`, loads the P0
component script and `qchat-view.js`, then calls through `evaluateJavascript`:

```
__qchatView.start('{"appId":"…","sessionId":"…","pageId":"p1"}')
__qchatView.receive('<bridge event JSON>')
__qchatView.destroy()
```

- `start` is separate so a Content-Security-Policy needs no inline script and
  the host decides when the page is ready. A second start is refused.
- The page sends through `window.qchatViewBridge.postMessage(json)`, the object
  injected by `addWebMessageListener`. The host listener is bound to the exact
  origin and to the app/session/page triple; a foreign origin or frame is
  `BRIDGE_ORIGIN_REJECTED`.
- Every message is a `BridgeEvent` from the shared contract. The view rejects a
  foreign binding, a non-event message and an unknown event name; it returns a
  JSON `ViewClientResult` so the host can read the outcome of
  `evaluateJavascript` instead of guessing.
- A rejected message sends `view.error` with the registry code and message, and
  never touches the DOM. A lost host channel closes the page instead of throwing
  inside a DOM listener.
- `view.ready` tells the host the page is ready for its first tree.

### 3. Render protocol

`view.render` carries `{pageId, seq, update}`:

- the first update for a page is a full `tree`; later updates are path `ops`;
- `seq` is monotonic; a duplicate or stale `seq` is ignored;
- `ops` before a tree, or for another page, are rejected;
- the payload `pageId` must equal the binding page id, not only the envelope;
- the theme in the payload is written to the page root; a `view.theme` event
  changes the root only and never reloads the tree.

The page root is `document.documentElement`: `data-theme="light|dark"` plus the
CSS `color-scheme` property. `:root[data-theme]` is therefore what WXSS selects,
and a fixed-theme page never receives a host theme event.

### 4. Event semantics

| WXML | DOM | Detail |
|---|---|---|
| `bindtap` / `catchtap` | `click` | `{x, y}` from the pointer |
| `bindinput` / `bindchange` | `input` / `change` | `{value}` from the component |
| `bindscroll`, `bindload`, … | same name | the component's `CustomEvent.detail`, JSON-copied |
| any other | same name | `{}` if the detail is not JSON data |

`bind` lets the native event bubble, so an ancestor binding also fires. `catch`
stops the native event at that element before its handler runs. The shared
`DomAdapter.addEventListener` therefore takes an optional
`{stopPropagation}` flag; the memory adapter ignores it because it has no
bubbling.

### 5. Minimum-WebView compatibility

- `structuredClone` does not exist on Chrome 61. The view runtime clones the
  tree with a recursive function, and a test removes `structuredClone` before a
  `patch` to prove it.
- The adapter creates only `wx-*` tags (the contract's allowlist), writes text
  with `Text.data`, and never uses `innerHTML`.
- A DOM event detail that is not JSON data becomes `{}`, so a node, a function
  or a cycle cannot cross the bridge.

## Consequences

- One renderer and one session serve the Node harness and the device WebView.
- The host owns the HTML page, the CSP, the component script and the origin;
  the client owns only the tree and the events.
- The bundle is ~51 KB unminified. The host can minify it further; the test
  checks the committed unminified file, so the check is readable.
- A WXML resource URL that starts with `/` is package-root (`/assets/logo.png`).
  The DOM adapter writes it as `./assets/logo.png`, so it stays under
  `/qchat/<appId>/<version>/`; protocol-relative and remote URLs are unchanged
  and the CSP refuses them.
- `view.ready` and `view.error` are new internal event names. They are not
  `wx.*` APIs and do not change the bridge allowlist.
- The device WebView, the origin check, the message listener and the theme root
  on a real phone remain `BLOCKED` (no phone). No Node test is device proof.
- WXS, P1/P2 components and the device performance numbers are M7/M8 work.

## Evidence

- `packages/miniapp-view-web/src/dom.ts` — browser adapter, tag allowlist,
  theme root, `tap`/`input` detail, `catch` propagation.
- `packages/miniapp-view-web/src/client.ts` — binding, `seq`, tree/ops, theme,
  destroy, `view.event`, `view.error`.
- `packages/miniapp-view-web/src/install.ts` — `window.__qchatView` and the
  `qchatViewBridge` channel.
- `packages/miniapp-view-web/src/fake-dom.ts` — bubbling DOM for Node tests.
- `packages/miniapp-view-web/test/client.test.ts` (18), `browser.test.ts` (5),
  `bundle.test.ts` (2).
- `packages/miniapp-view-runtime/test/view.test.ts` — the no-`structuredClone`
  test.
- `packages/miniapp-contracts/src/renderer.ts` — `VIEW_READY_EVENT`,
  `VIEW_ERROR_EVENT`, the `stopPropagation` adapter option.
- `pnpm test:miniapp` → 269 pass, 0 fail; `pnpm typecheck` and
  `pnpm check:miniapp` pass.
