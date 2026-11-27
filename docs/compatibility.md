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

### 1.0 Contracts and M1 spike

M1 delivered the shared contracts and a Node spike. These entries describe the
QChat runtime itself, not a WeChat feature, so they are `Experimental` and are
not counted in the WeChat denominator. No `wx.*` API and no component changes
status in M1: the spike implements neither.

| Contract | Entry | Status | Linked test | Notes |
|---|---|---|---|---|
| Bridge | Envelope, binding, size limit, unknown keys | Experimental | `packages/miniapp-contracts/test/bridge.test.ts` | Foreign app/session/page rejected |
| Manifest | `.qxpkg` manifest, pages, files, signature shape | Experimental | `packages/miniapp-contracts/test/manifest.test.ts` | Hashes/signature verified in M5 |
| Permissions | Declared permissions, unknown rejected | Experimental | `packages/miniapp-contracts/test/contracts.test.ts` | Prompt/OS mapping is M4 |
| Components | Registry (P0/P1/P2) | Experimental | `packages/miniapp-contracts/test/contracts.test.ts` | Rendering is M3/M7 |
| APIs | Registry + bridge allowlist | Experimental | `packages/miniapp-contracts/test/contracts.test.ts` | Implementation is M4/M7 |
| Renderer | Typed tree, ops, event binding | Experimental | `packages/miniapp-view-runtime/test/view.test.ts` | Only `wx-*` tags render |
| Service | `App`/`Page`, lifecycle, stack, `setData` | Experimental | `packages/miniapp-service-runtime/test/service.test.ts` | Engine is ADR 009 |
| Round trip | Service render → view paint → tap → service | Experimental | `packages/miniapp-view-runtime/test/roundtrip.test.ts` | Node bridge, not a device |
| Theme contract | Fixed/`auto` resolution, no event to fixed | Experimental | `packages/miniapp-service-runtime/test/service.test.ts` | Device matrix in 1.5 stays `Not started` |
| Performance | Metric definitions and judge rule | Experimental | `packages/miniapp-contracts/test/contracts.test.ts` | Values stay `Blocked` |

### 1.1 APIs — MVP (M4/M6)

| Feature | Reference | Status | Linked test | Notes |
|---|---|---|---|---|
| `wx.navigateTo` | `/miniprogram/dev/api/route/wx.navigateTo.html` | Not started | — | Page stack; query string preserved |
| `wx.redirectTo` | `/miniprogram/dev/api/route/wx.redirectTo.html` | Not started | — | Replaces the top page |
| `wx.switchTab` | `/miniprogram/dev/api/route/wx.switchTab.html` | Not started | — | Requires a tabBar config |
| `wx.navigateBack` | `/miniprogram/dev/api/route/wx.navigateBack.html` | Not started | — | `delta` |
| `wx.reLaunch` | `/miniprogram/dev/api/route/wx.reLaunch.html` | Not started | — | Clears the stack |
| `wx.setStorage` | `/miniprogram/dev/api/storage/wx.setStorage.html` | Not started | — | Async; per-app quota |
| `wx.setStorageSync` | `/miniprogram/dev/api/storage/wx.setStorageSync.html` | Not started | — | Synchronous over the bridge |
| `wx.getStorage` | `/miniprogram/dev/api/storage/wx.getStorage.html` | Not started | — | |
| `wx.getStorageSync` | `/miniprogram/dev/api/storage/wx.getStorageSync.html` | Not started | — | |
| `wx.removeStorage` | `/miniprogram/dev/api/storage/wx.removeStorage.html` | Not started | — | |
| `wx.removeStorageSync` | `/miniprogram/dev/api/storage/wx.removeStorageSync.html` | Not started | — | |
| `wx.clearStorage` | `/miniprogram/dev/api/storage/wx.clearStorage.html` | Not started | — | App-scoped only |
| `wx.clearStorageSync` | `/miniprogram/dev/api/storage/wx.clearStorageSync.html` | Not started | — | |
| `wx.request` | `/miniprogram/dev/api/network/request/wx.request.html` | Not started | — | HTTPS + domain allowlist |
| `wx.showToast` | `/miniprogram/dev/api/ui/interaction/wx.showToast.html` | Not started | — | Host-drawn |
| `wx.showModal` | `/miniprogram/dev/api/ui/interaction/wx.showModal.html` | Not started | — | Host-drawn |
| `wx.showLoading` | `/miniprogram/dev/api/ui/interaction/wx.showLoading.html` | Not started | — | Host-drawn |
| `wx.hideLoading` | `/miniprogram/dev/api/ui/interaction/wx.hideLoading.html` | Not started | — | |
| `wx.getSystemInfo` / `wx.getSystemInfoSync` | `/miniprogram/dev/api/base/system/wx.getSystemInfo.html` | Not started | — | Only needed fields; `theme` is the resolved theme |
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
| P0 | `view` | `/miniprogram/dev/component/view.html` | Not started | — | Web element |
| P0 | `text` | `/miniprogram/dev/component/text.html` | Not started | — | Text only, never HTML |
| P0 | `image` | `/miniprogram/dev/component/image.html` | Not started | — | `mode`, `lazy-load` |
| P0 | `button` | `/miniprogram/dev/component/button.html` | Not started | — | `open-type` subset |
| P0 | `input` | `/miniprogram/dev/component/input.html` | Not started | — | `bindinput`, `bindconfirm` |
| P0 | `scroll-view` | `/miniprogram/dev/component/scroll-view.html` | Not started | — | `scroll-y`, `scroll-x`, `bindscrolltolower` |
| P0 | Navigation bar | `app.json` `window` + `wx.setNavigationBarColor` | Not started | — | Drawn by the View Runtime |
| P1 | `textarea` | `/miniprogram/dev/component/textarea.html` | Not started | — | |
| P1 | `checkbox` / `checkbox-group` | `/miniprogram/dev/component/checkbox.html` | Not started | — | |
| P1 | `radio` / `radio-group` | `/miniprogram/dev/component/radio.html` | Not started | — | |
| P1 | `switch` | `/miniprogram/dev/component/switch.html` | Not started | — | |
| P1 | `slider` | `/miniprogram/dev/component/slider.html` | Not started | — | |
| P1 | `picker` | `/miniprogram/dev/component/picker.html` | Not started | — | `selector`, `multiSelector`, `date`, `time`; `region` `UNVERIFIED` |
| P1 | `form` | `/miniprogram/dev/component/form.html` | Not started | — | `bindsubmit`, `bindreset` |
| P1 | `swiper` / `swiper-item` | `/miniprogram/dev/component/swiper.html` | Not started | — | |
| P1 | Tab bar | `app.json` `tabBar` | Not started | — | Drawn by the View Runtime |
| P1 | Custom components | `/miniprogram/dev/framework/custom-component/` | Not started | — | `usingComponents`, properties, slots, behaviors |
| P2 | `video` | `/miniprogram/dev/component/video.html` | Not started | — | HTML `<video>`; codecs documented |
| P2 | `canvas` | `/miniprogram/dev/component/canvas.html` | Not started | — | Canvas/WebGL |
| P2 | `map` | `/miniprogram/dev/component/map.html` | Not started | — | Web map library; license/cost first |
| P2 | `camera` | `/miniprogram/dev/component/camera.html` | Not started | — | `getUserMedia`; permission behaviour |

### 1.4 Syntax and configuration

| Feature | Reference | Status | Linked test | Notes |
|---|---|---|---|---|
| Data binding `{{ }}` | `/miniprogram/dev/reference/wxml/data.html` | Not started | — | Text interpolation, attributes, expressions |
| `wx:if` / `wx:elif` / `wx:else` | `/miniprogram/dev/reference/wxml/conditional.html` | Not started | — | |
| `wx:for`, `wx:for-item`, `wx:for-index`, `wx:key` | `/miniprogram/dev/reference/wxml/list.html` | Not started | — | |
| `block` | `/miniprogram/dev/reference/wxml/` | Not started | — | |
| `template` / `import` / `include` | `/miniprogram/dev/reference/wxml/template.html` | Not started | — | |
| `slot` (single and multiple) | `/miniprogram/dev/framework/custom-component/wxml-wxss.html` | Not started | — | |
| `behaviors` | `/miniprogram/dev/framework/custom-component/behaviors.html` | Not started | — | |
| Event bind / catch | `/miniprogram/dev/framework/view/wxml/event.html` | Not started | — | `bindtap`, `catchtap`, `bindinput`, `bindchange`, … |
| Two-way binding `model:value` | `/miniprogram/dev/framework/view/two-way-bindings.html` | Not started | — | `UNVERIFIED` scope |
| `rpx` | `/miniprogram/dev/framework/view/wxss.html` | Not started | — | 750 rpx = screen width |
| `@import` in WXSS | `/miniprogram/dev/framework/view/wxss.html` | Not started | — | |
| Page and component styles | `/miniprogram/dev/framework/custom-component/wxml-wxss.html` | Not started | — | Scoping rules |
| `app.json` (`pages`, `window`, `tabBar`, `usingComponents`) | `/miniprogram/dev/reference/configuration/app.html` | Not started | — | |
| `page.json` | `/miniprogram/dev/reference/configuration/page.html` | Not started | — | |
| `qxColorScheme` (`light`, `dark`, `auto`) | section 4.4 | Experimental | `packages/miniapp-contracts/test/manifest.test.ts` | Contract only; compiler/view is M3 |
| `darkmode`, `themeLocation`, `theme.json` | WeChat theme | Unsupported | — | Replaced by `qxColorScheme`; compiler error code |
| `@media (prefers-color-scheme)` | WXSS | Unsupported | — | Unless a real-device test proves it follows the resolved theme |
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
