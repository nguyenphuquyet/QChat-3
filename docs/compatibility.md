# Compatibility matrix

- **Pinned reference:** WeChat base library **v3.18.1 (2026-11-17)**, retrieved
  2026-11-27 (ADR 005).
- **Statuses:** `Not started`, `Supported`, `Partial`, `Unsupported`,
  `Experimental`. `Supported` and `Partial` require a linked test; without one
  the entry stays `Not started`. Entries whose name or behaviour has not been
  checked against the official documentation carry `UNVERIFIED`.
- **Rule:** lifecycle callbacks (`onLoad`, `onShow`, `onReady`, `onHide`,
  `onUnload`, …) are `App`/`Page` options, not `wx.*` functions. WXSS entries are
  WXSS, not utility-framework directives.
- **No percentage is published** without a defined denominator. The matrix is
  the denominator.

## Part 1 — New runtime matrix

### 1.0 Contracts, M1 spike and M2 service runtime

M1 delivered the shared contracts and a Node spike; M2 delivered the engine
contract, the Node engine adapter, the in-engine SDK, the module loader and the
bridge client. These entries describe the QChat runtime itself, not a WeChat
feature, so they are `Experimental` and are not counted in the WeChat
denominator. No `wx.*` API and no component changes status in M1/M2: the
implementation is M4/M3.

| Contract | Entry | Status | Linked test | Notes |
|---|---|---|---|---|
| Bridge | Envelope, binding, size limit, unknown keys | Experimental | `packages/miniapp-contracts/test/bridge.test.ts` | Foreign app/session/page rejected |
| Manifest | `.qxpkg` manifest, pages, files, signature shape | Experimental | `packages/miniapp-contracts/test/manifest.test.ts` | Required `build/view.json`; hashes/signature verified in M5 |
| Permissions | Declared permissions, unknown rejected | Experimental | `packages/miniapp-contracts/test/contracts.test.ts` | Prompt/OS mapping is M7 |
| Components | Registry (P0/P1/P2) | Experimental | `packages/miniapp-contracts/test/contracts.test.ts` | Rendering is M3/M7 |
| APIs | Registry + bridge allowlist | Experimental | `packages/miniapp-contracts/test/contracts.test.ts` | Implementation is M4/M7 |
| Renderer | Typed tree, ops, event binding | Experimental | `packages/miniapp-view-runtime/test/view.test.ts` | Only `wx-*` tags render |
| Tree diff | `diffRenderTree`, deterministic op order, no full reload | Experimental | `packages/miniapp-contracts/test/renderer-diff.test.ts` | Removes descending, inserts ascending |
| Render session | `seq` ordering, tree then ops, stale payload ignored | Experimental | `packages/miniapp-view-runtime/test/session.test.ts` | Ops before a tree are rejected |
| View WebView client | `window.__qchatView` start/receive/destroy; tree/ops; page-root theme; `bind`/`catch` bubbling | Experimental | `packages/miniapp-view-web/test/client.test.ts`, `test/browser.test.ts`, `test/bundle.test.ts` | Dependency-free 51 KB bundle; package-root URLs stay inside the version; device WebView `UNVERIFIED` |
| Android WebView host | `WebViewAssetLoader` origin, CSP, origin-bound `addWebMessageListener`, page CSS injection, teardown | Experimental | `packages/qchat_miniapp_webview/android/src/test/kotlin/...` (JVM) | Code written in host module 1; CI build/tests pending; device `UNVERIFIED` |
| Service | `App`/`Page`, lifecycle, stack, path-based `setData` | Experimental | `packages/miniapp-service-runtime/test/service.test.ts` | First visible render is a tree; later updates are ops |
| Round trip | Service render → view paint → tap → service | Experimental | `packages/miniapp-view-runtime/test/roundtrip.test.ts` | Node bridge, not a device |
| Sample end to end | `qchat-hello` source → compiler → engine → view → tap → patch | Experimental | `packages/miniapp-test-harness/test/sample.test.ts` | Node harness; device screen is host module 2 |
| `wx` SDK | Callback + Promise forms, navigation primitives, sync channel | Experimental | `packages/miniapp-service-runtime/test/wx-sdk.test.ts` | One source on Node/QuickJS/JSC |
| API host | Navigation, storage, request, UI and system-info dispatch | Experimental | `packages/miniapp-service-runtime/test/api-host.test.ts` | Policy and adapters; device adapters are host modules 2–3 / M8 |
| Page stack end to end | `navigateTo`/`navigateBack`, query, state restore | Experimental | `packages/miniapp-test-harness/test/sample.test.ts` | Node harness |
| Async APIs end to end | Storage callback, `wx.request`, toast event | Experimental | `packages/miniapp-test-harness/test/host-api.test.ts` | Recording adapters; no network |
| Sync API channel | `__qchatHost.sync`, storage and system info | Experimental | `packages/miniapp-service-runtime/test/wx-sdk.test.ts` | ADR 010; device timing `BLOCKED` |
| Theme contract | Fixed/`auto` resolution, no event to fixed | Experimental | `packages/miniapp-service-runtime/test/service.test.ts` | Device matrix in 1.5 stays `Not started` |
| Performance | Metric definitions and judge rule | Experimental | `packages/miniapp-contracts/test/contracts.test.ts` | Values stay `Blocked` |
| Engine | Isolated context, no host globals, no dynamic code, time limit | Experimental | `packages/miniapp-service-runtime/test/engine.test.ts` | Node `vm`; QuickJS/JSC adapters are M2/M8, device `Blocked` |
| SDK | `App`, `Page`, `Component`, `getApp`, `getCurrentPages`, `setData` | Experimental | `packages/miniapp-service-runtime/test/sdk-runtime.test.ts` | Runs inside the engine |
| Modules | Relative `require`, cache, escape rejection | Experimental | `packages/miniapp-service-runtime/test/sdk-runtime.test.ts` | npm/subpackages are M7 |
| Bridge client | Allowlist, ids, timeout, cancel, close, binding | Experimental | `packages/miniapp-service-runtime/test/bridge-client.test.ts` | Host side |
| Service calls | `__qchatCall`/`__qchatResponse`, unknown method rejected | Experimental | `packages/miniapp-service-runtime/test/sdk-runtime.test.ts` | `wx.*` wrappers in `sdk.ts` |
| Timers | Tracked `setTimeout`/`setInterval`, cleared on close | Experimental | `packages/miniapp-service-runtime/test/sdk-runtime.test.ts` | Long-running timing test is M3 |
| WXML parser | Elements, attributes, text, mustache, comments, locations | Experimental | `packages/miniapp-compiler/test/wxml.test.ts` | Syntax tree only |
| WXML compiler | Directives, templates, events, dataset, typed render tree | Experimental | `packages/miniapp-compiler/test/wxml-compiler.test.ts` | Node only; no device |
| Expressions | Safe `{{ }}` subset, no calls, no prototype access | Experimental | `packages/miniapp-compiler/test/expression.test.ts` | Never `eval` |
| WXSS compiler | `rpx`, `@import`, scoping, theme selectors | Experimental | `packages/miniapp-compiler/test/wxss.test.ts` | `prefers-color-scheme` rejected; Node only |
| Package builder | `.qxpkg` ZIP, manifest, per-file SHA-256, Ed25519 signature | Experimental | `packages/miniapp-compiler/test/package.test.ts` | Private key is caller-supplied; never shipped |
| Package verifier | Size, ZIP limits, path/extension, signature, hashes, runtime gate | Experimental | `packages/miniapp-compiler/test/package.test.ts` | Tamper and oversize tests |
| Installer | Staging, atomic rename, `state.json`, two versions, rollback | Experimental | `packages/miniapp-compiler/test/package.test.ts` | Revoked and downgrade refused |
| Storage isolation | Per-app directory, key hashing, quota, corruption | Experimental | `packages/miniapp-compiler/test/package.test.ts` | Device storage adapter is host module 3 |
| Compiled bundle | `build/view.json` read and rendered from an installed package | Experimental | `packages/miniapp-compiler/test/package.test.ts`, `packages/miniapp-test-harness/test/installed.test.ts` | No compiler on the device path |

### 1.1 APIs — MVP (M4/M6)

| Feature | Reference | Status | Linked test | Notes |
|---|---|---|---|---|
| `wx.navigateTo` | `/miniprogram/dev/api/route/wx.navigateTo.html` | Experimental | `packages/miniapp-service-runtime/test/api-host.test.ts`, `packages/miniapp-test-harness/test/sample.test.ts` | Declared routes only; query preserved; stack limit |
| `wx.redirectTo` | `/miniprogram/dev/api/route/wx.redirectTo.html` | Experimental | `packages/miniapp-service-runtime/test/api-host.test.ts` | Replaces the top page |
| `wx.switchTab` | `/miniprogram/dev/api/route/wx.switchTab.html` | Experimental | `packages/miniapp-service-runtime/test/api-host.test.ts` | Requires a declared tab page; no query; reuses the page |
| `wx.navigateBack` | `/miniprogram/dev/api/route/wx.navigateBack.html` | Experimental | `packages/miniapp-service-runtime/test/api-host.test.ts` | `delta` 1–100; the bottom page cannot be popped |
| `wx.reLaunch` | `/miniprogram/dev/api/route/wx.reLaunch.html` | Experimental | `packages/miniapp-service-runtime/test/api-host.test.ts` | Clears the stack |
| `wx.setStorage` | `/miniprogram/dev/api/storage/wx.setStorage.html` | Experimental | `packages/miniapp-service-runtime/test/api-host.test.ts`, `packages/miniapp-test-harness/test/host-api.test.ts` | Async; per-app quota; host adapter required |
| `wx.setStorageSync` | `/miniprogram/dev/api/storage/wx.setStorageSync.html` | Experimental | `packages/miniapp-service-runtime/test/api-host.test.ts`, `packages/miniapp-service-runtime/test/wx-sdk.test.ts` | Synchronous host channel (ADR 010) |
| `wx.getStorage` | `/miniprogram/dev/api/storage/wx.getStorage.html` | Experimental | `packages/miniapp-service-runtime/test/api-host.test.ts` | Missing key is `API_FAILED` |
| `wx.getStorageSync` | `/miniprogram/dev/api/storage/wx.getStorageSync.html` | Experimental | `packages/miniapp-service-runtime/test/api-host.test.ts`, `packages/miniapp-service-runtime/test/wx-sdk.test.ts` | Missing key returns `""` |
| `wx.removeStorage` | `/miniprogram/dev/api/storage/wx.removeStorage.html` | Experimental | `packages/miniapp-service-runtime/test/api-host.test.ts` | |
| `wx.removeStorageSync` | `/miniprogram/dev/api/storage/wx.removeStorageSync.html` | Experimental | `packages/miniapp-service-runtime/test/api-host.test.ts` | |
| `wx.clearStorage` | `/miniprogram/dev/api/storage/wx.clearStorage.html` | Experimental | `packages/miniapp-service-runtime/test/api-host.test.ts` | App-scoped only |
| `wx.clearStorageSync` | `/miniprogram/dev/api/storage/wx.clearStorageSync.html` | Experimental | `packages/miniapp-service-runtime/test/api-host.test.ts` | |
| `wx.request` | `/miniprogram/dev/api/network/request/wx.request.html` | Experimental | `packages/miniapp-service-runtime/test/api-host.test.ts`, `packages/miniapp-test-harness/test/host-api.test.ts` | HTTPS + domain allowlist; adapter injected; no fallback |
| `wx.showToast` | `/miniprogram/dev/api/ui/interaction/wx.showToast.html` | Experimental | `packages/miniapp-service-runtime/test/api-host.test.ts`, `packages/miniapp-test-harness/test/host-api.test.ts` | Host-drawn; typed event |
| `wx.showModal` | `/miniprogram/dev/api/ui/interaction/wx.showModal.html` | Experimental | `packages/miniapp-service-runtime/test/api-host.test.ts` | Host-drawn; id-scoped result |
| `wx.showLoading` | `/miniprogram/dev/api/ui/interaction/wx.showLoading.html` | Experimental | `packages/miniapp-service-runtime/test/api-host.test.ts` | Host-drawn; `hideLoading` pairs |
| `wx.hideLoading` | `/miniprogram/dev/api/ui/interaction/wx.hideLoading.html` | Experimental | `packages/miniapp-service-runtime/test/api-host.test.ts` | |
| `wx.getSystemInfo` / `wx.getSystemInfoSync` | `/miniprogram/dev/api/base/system/wx.getSystemInfo.html` | Partial | `packages/miniapp-service-runtime/test/api-host.test.ts`, `packages/miniapp-test-harness/test/host-api.test.ts` | Sync form only; only documented fields; `theme` is the resolved theme; async form is M7 |
| `wx.getWindowInfo` | `/miniprogram/dev/api/base/system/wx.getWindowInfo.html` | Not started | — | Split API; `UNVERIFIED` until checked |
| `wx.getDeviceInfo` | `/miniprogram/dev/api/base/system/wx.getDeviceInfo.html` | Not started | — | Split API; `UNVERIFIED` until checked |
| `wx.getAppBaseInfo` | `/miniprogram/dev/api/base/system/wx.getAppBaseInfo.html` | Not started | — | Split API; `UNVERIFIED` until checked |

### 1.2 APIs — after the MVP (M7)

| Feature | Reference | Status | Linked test | Notes |
|---|---|---|---|---|
| `wx.chooseImage` | `/miniprogram/dev/api/media/image/wx.chooseImage.html` | Not started | — | Permission prompt |
| `wx.chooseMedia` | `/miniprogram/dev/api/media/video/wx.chooseMedia.html` | Not started | — | |
| `wx.scanCode` | `/miniprogram/dev/api/device/scan/wx.scanCode.html` | Not started | — | Full-screen native screen |
| `wx.getLocation` | `/miniprogram/dev/api/location/wx.getLocation.html` | Not started | — | OS + app permission |
| `wx.uploadFile` | `/miniprogram/dev/api/network/upload/wx.uploadFile.html` | Not started | — | Domain allowlist |
| `wx.downloadFile` | `/miniprogram/dev/api/network/download/wx.downloadFile.html` | Not started | — | Domain allowlist |
| `wx.connectSocket` | `/miniprogram/dev/api/network/websocket/wx.connectSocket.html` | Not started | — | Allowlisted hosts |
| `wx.setClipboardData` | `/miniprogram/dev/api/device/clipboard/wx.setClipboardData.html` | Not started | — | |
| `wx.getClipboardData` | `/miniprogram/dev/api/device/clipboard/wx.getClipboardData.html` | Not started | — | |
| `wx.login` | WeChat login | Unsupported | — | Replaced by a QChat login design (short-lived code, per-app user id); WeChat credentials never used |
| `wx.requestPayment` | WeChat Pay | Unsupported | — | Payment is outside this specification |
| `wx.onThemeChange` | `/miniprogram/dev/api/base/system/wx.onThemeChange.html` | Not started | — | Resolved theme only |
| `wx.offThemeChange` | `/miniprogram/dev/api/base/system/wx.offThemeChange.html` | Not started | — | |
| `wx.setNavigationBarColor` | `/miniprogram/dev/api/ui/navigation-bar/wx.setNavigationBarColor.html` | Not started | — | Developer-owned colors |
| `wx.setTabBarStyle` | `/miniprogram/dev/api/ui/tab-bar/wx.setTabBarStyle.html` | Not started | — | |
| QChat runtime theme switch | section 4.4 item 6 | Not started | — | QChat-namespaced API, M7 |

### 1.3 Components

| Priority | Feature | Reference | Status | Linked test | Notes |
|---|---|---|---|---|---|
| P0 | `view` | `/miniprogram/dev/component/view.html` | Experimental | `packages/miniapp-view-runtime/test/components.test.ts` | `wx-view` custom element; hover-class timings |
| P0 | `text` | `/miniprogram/dev/component/text.html` | Experimental | `packages/miniapp-view-runtime/test/components.test.ts` | Text only, never HTML; `decode`, `space`, `selectable` |
| P0 | `image` | `/miniprogram/dev/component/image.html` | Experimental | `packages/miniapp-view-runtime/test/components.test.ts` | `scaleToFill`, `aspectFit`, `aspectFill`, `widthFix`; `lazy-load`; load/error |
| P0 | `button` | `/miniprogram/dev/component/button.html` | Experimental | `packages/miniapp-view-runtime/test/components.test.ts` | `size`, `type`, `plain`, `disabled`, `loading`; `open-type` subset |
| P0 | `input` | `/miniprogram/dev/component/input.html` | Experimental | `packages/miniapp-view-runtime/test/components.test.ts` | `bindinput`, `bindconfirm`, `password`, `maxlength`; keyboard height is host-side |
| P0 | `scroll-view` | `/miniprogram/dev/component/scroll-view.html` | Experimental | `packages/miniapp-view-runtime/test/components.test.ts` | `scroll-y`, `scroll-x`, `scroll-top`, thresholds; `enhanced` is a no-op |
| P0 | Navigation bar | `app.json` `window` + `wx.setNavigationBarColor` | Experimental | `packages/miniapp-view-runtime/test/components.test.ts` | `wx-navigation-bar` drawn by the View Runtime; host may override |
| P1 | `textarea` | `/miniprogram/dev/component/textarea.html` | Experimental | `packages/miniapp-view-runtime/test/components.test.ts` | `bindinput`, `bindconfirm`, `maxlength`, `auto-height`; `fixed` is a no-op |
| P1 | `checkbox` / `checkbox-group` | `/miniprogram/dev/component/checkbox.html` | Experimental | `packages/miniapp-view-runtime/test/components.test.ts` | `wx-checkbox-group` aggregates checked values; `change` detail `{value: string[]}` |
| P1 | `radio` / `radio-group` | `/miniprogram/dev/component/radio.html` | Experimental | `packages/miniapp-view-runtime/test/components.test.ts` | One selection per group; `change` detail `{value: string}` |
| P1 | `switch` | `/miniprogram/dev/component/switch.html` | Experimental | `packages/miniapp-view-runtime/test/components.test.ts` | `checked`, `disabled`, `color`; `change` detail `{value: boolean}` |
| P1 | `slider` | `/miniprogram/dev/component/slider.html` | Experimental | `packages/miniapp-view-runtime/test/components.test.ts` | `changing` on drag, `change` on release; `block-size` is a no-op |
| P1 | `picker` | `/miniprogram/dev/component/picker.html` | Partial | `packages/miniapp-view-runtime/test/components.test.ts` | `selector`, `date`, `time`, `datetime`; `multiSelector` uses the first column only; `region` is `UNVERIFIED` |
| P1 | `form` | `/miniprogram/dev/component/form.html` | Experimental | `packages/miniapp-view-runtime/test/components.test.ts` | `bindsubmit` collects named controls; `bindreset`; `report-submit` is a no-op |
| P1 | `swiper` / `swiper-item` | `/miniprogram/dev/component/swiper.html` | Experimental | `packages/miniapp-view-runtime/test/components.test.ts` | `current`, `autoplay`, `circular`, `vertical`, indicator dots; touch swipe is host-side |
| P1 | Tab bar | `app.json` `tabBar` | Experimental | `packages/miniapp-view-runtime/test/components.test.ts` | `wx-tab-bar` drawn by the View Runtime from `items`; `wx.setTabBarStyle` is M7 APIs |
| P1 | Custom components | `/miniprogram/dev/framework/custom-component/` | Partial | `packages/miniapp-compiler/test/components.test.ts`, `packages/miniapp-service-runtime/test/components.test.ts`, `packages/miniapp-test-harness/test/components.test.ts` | `usingComponents` at app/page/component level, property types and defaults, observers, `created`/`attached`/`ready`/`detached`, `setData`, `triggerEvent`, default and named slots, component WXSS scoped by `data-qchat-component`; `behaviors` and full page-to-component style isolation are not implemented; `ready` runs during mount |
| P2 | `video` | `/miniprogram/dev/component/video.html` | Not started | — | HTML `<video>`; codecs documented |
| P2 | `canvas` | `/miniprogram/dev/component/canvas.html` | Not started | — | Canvas/WebGL |
| P2 | `map` | `/miniprogram/dev/component/map.html` | Not started | — | Web map library; license/cost first |
| P2 | `camera` | `/miniprogram/dev/component/camera.html` | Not started | — | `getUserMedia`; permission behaviour |

### 1.4 Syntax and configuration

| Feature | Reference | Status | Linked test | Notes |
|---|---|---|---|---|
| Data binding `{{ }}` | `/miniprogram/dev/reference/wxml/data.html` | Experimental | `packages/miniapp-compiler/test/wxml-compiler.test.ts` | Compiler + typed render tree; no device run |
| `wx:if` / `wx:elif` / `wx:else` | `/miniprogram/dev/reference/wxml/conditional.html` | Experimental | `packages/miniapp-compiler/test/wxml-compiler.test.ts` | Sibling chain, whitespace between branches allowed |
| `wx:for`, `wx:for-item`, `wx:for-index`, `wx:key` | `/miniprogram/dev/reference/wxml/list.html` | Experimental | `packages/miniapp-compiler/test/wxml-compiler.test.ts` | `*this` and property keys; arrays and objects |
| `block` | `/miniprogram/dev/reference/wxml/` | Experimental | `packages/miniapp-compiler/test/wxml-compiler.test.ts` | Transparent; attributes are rejected |
| `template` / `import` / `include` | `/miniprogram/dev/reference/wxml/template.html` | Experimental | `packages/miniapp-compiler/test/wxml-compiler.test.ts` | `data` supports object and spread form; `import` is not recursive |
| `slot` (single and multiple) | `/miniprogram/dev/framework/custom-component/wxml-wxss.html` | Experimental | `packages/miniapp-compiler/test/wxml-compiler.test.ts` | Compiles to `wx-slot`; custom components are M7 |
| `behaviors` | `/miniprogram/dev/framework/custom-component/behaviors.html` | Not started | — | |
| Event bind / catch | `/miniprogram/dev/framework/view/wxml/event.html` | Experimental | `packages/miniapp-compiler/test/wxml-compiler.test.ts` | `bind*`/`catch*`, dynamic handler names; capture phase is rejected |
| Two-way binding `model:value` | `/miniprogram/dev/framework/view/two-way-bindings.html` | Unsupported | `packages/miniapp-compiler/test/wxml-compiler.test.ts` | Rejected with `COMPILER_UNSUPPORTED_DIRECTIVE`, never ignored |
| `rpx` | `/miniprogram/dev/framework/view/wxss.html` | Experimental | `packages/miniapp-compiler/test/wxss.test.ts` | Compiled to `--qchat-rpx` (750 rpx = page width); host sets the measured width |
| `@import` in WXSS | `/miniprogram/dev/framework/view/wxss.html` | Experimental | `packages/miniapp-compiler/test/wxss.test.ts` | Inlined, package-confined, cycle detected |
| Page and component styles | `/miniprogram/dev/framework/custom-component/wxml-wxss.html` | Experimental | `packages/miniapp-compiler/test/wxss.test.ts` | `scopeSelector` + `:host`; custom components are M7 |
| `app.json` (`pages`, `window`, `tabBar`, `usingComponents`) | `/miniprogram/dev/reference/configuration/app.html` | Partial | `packages/miniapp-compiler/test/components.test.ts` | `pages`, `window`, `tabBar` and `usingComponents` are read; other keys are ignored until their feature exists |
| `page.json` | `/miniprogram/dev/reference/configuration/page.html` | Not started | — | |
| `qxColorScheme` (`light`, `dark`, `auto`) | section 4.4 | Experimental | `packages/miniapp-test-harness/test/sample.test.ts` | `app.json` value validated and resolved by the host (ADR 006); the WebView root write is M5 |
| `darkmode`, `themeLocation`, `theme.json` | WeChat theme | Unsupported | — | Replaced by `qxColorScheme`; compiler error code |
| `@media (prefers-color-scheme)` | WXSS | Unsupported | `packages/miniapp-compiler/test/wxss.test.ts` | Rejected with `WXSS_UNSUPPORTED_FEATURE`; use `[data-theme]` |
| WXS | `/miniprogram/dev/framework/view/wxs/` | Not started | — | M7; isolated, no bridge/native objects |
| Subpackages (including independent) | `/miniprogram/dev/framework/subpackages.html` | Not started | — | M7 |
| npm dependencies (compatible) | WeChat npm support | Not started | — | M7 |
| UniApp / Taro `mp-weixin` output | section 6 | Not started | — | M7 |

### 1.5 Theme behaviour (section 4.4)

| Case | Status | Linked test | Notes |
|---|---|---|---|
| Declared `light`, host light | Not started | — | Page never changes |
| Declared `light`, host dark | Not started | — | Page never changes |
| Declared `dark`, host light | Not started | — | Page never changes |
| Declared `dark`, host dark | Not started | — | Page never changes |
| Declared `auto`, host light | Not started | — | Page matches host |
| Declared `auto`, host dark | Not started | — | Page matches host |
| Theme change while open, fixed app | Not started | — | No change, no event |
| Theme change while open, `auto` app | Not started | — | Update without reload; `onThemeChange` once; delay measured |
| Bridge: fixed page receives no host theme event | Not started | — | Foreign/absent event test |
| `data-theme` + `color-scheme` on the page root | Not started | — | |
| No WebView force dark (Android) / explicit `overrideUserInterfaceStyle` (iOS) | Not started | — | |

### 1.6 Performance (section 9.1)

Reference device: **not supplied** (Appendix A blank) → every value `BLOCKED`
until a real low-end device is named. Targets are confirmed as the M0 baseline.

| Metric | Target | Measured | Status |
|---|---|---|---|
| Cold start (installed, runtime not loaded) | ≤ 2.5 s | — | Blocked (no device) |
| Warm start (runtime loaded) | ≤ 1.0 s | — | Blocked (no device) |
| `setData` → painted, payload ≤ 20 KB | ≤ 100 ms median | — | Blocked (no device) |
| Scroll 500 simple items | ≥ 50 fps median, no stall > 200 ms | — | Blocked (no device) |
| Memory above host idle baseline | ≤ 200 MB peak | — | Blocked (no device) |
| Install 2 MB package incl. verification | ≤ 3 s | — | Blocked (no device) |

## Part 2 — Legacy QApp inventory (informational only)

This part describes what the legacy system does today. It supports no claim
about the new runtime and is deleted in M11 with the legacy system.

| Area | Legacy behaviour |
|---|---|
| Source format | TSX compiled with esbuild to `app.js`; `@mna/qchat` hooks and components |
| UI | A JSON virtual tree mapped to Flutter widgets; TDesign leaf controls; Cupertino overlay motion |
| Logic | QuickJS (`flutter_js`) inside the Flutter process; `__qchatNative` JSON bridge; timers via host wake |
| Package | `.japp` ZIP: `manifest.json`, `app.js`, `metadata.json`, `permissions.json`, `assets/` |
| APIs | `getAppInfo`, `getSystemInfo`, `getUserInfo`, `chooseImage`, `share`, navigation, toast, storage, `request`, `fetch` |
| Server | `/api/miniapps/*` store/developer/review/release; manual review; `.japp` storage |
| IDE | Tauri Studio with Monaco TSX and the qapp CLI |
| Theme | No per-app `qxColorScheme`; the legacy renderer follows the host palette |
| Compatibility | Measured only by the repository's own contract tests; no WeChat comparison |
