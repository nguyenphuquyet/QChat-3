# WeChat ecosystem integration: feasibility and decisions

This document records the final architecture decision — QChat is a **host** for
WeChat Mini Programs, not a competing framework — and the evidence behind it.
It replaces the earlier draft that proposed a QChat-owned WXML front-end.

## 1. Rule

Use the official WeChat ecosystem directly. Do not write a WXML/WXSS compiler,
a component runtime, a source format or a compiler pipeline. Build only the
integration layer that WeChat does not publish: the native host, the native
bridge and platform services.

## 2. What is publicly available and directly usable

| Component | Source | License | Verified | Role in QChat |
| --- | --- | --- | --- | --- |
| `glass-easel` 1.2.2 | npm / `wechat-miniprogram/glass-easel` | MIT | Installed, API inspected, used by the build below | Component framework and rendering core. Used verbatim. |
| `glass-easel-miniprogram-adapter` 1.2.2 | same repo | MIT | Installed, `MiniProgramEnv`, `CodeSpace`, DOM backend exercised | `Page`/`Component`/`Behavior`, code space, backend association. Used verbatim. |
| `glass-easel-template-compiler` 1.2.2 | same repo | MIT | `TmplGroup.addTmpl` and `getTmplGenObjectGroups` exercised | Official WXML compiler. Called by the official webpack loader. |
| `glass-easel-stylesheet-compiler` 1.2.2 | same repo | MIT | `StyleSheetTransformer` exercised (`rpx` → `vw`) | Official WXSS compiler. Called by the official webpack loader. |
| `glass-easel-miniprogram-webpack-plugin` 1.2.2 | same repo | MIT | End-to-end build of a real project executed | The official build pipeline: WXML loader, WXSS loader, component bootstrap, virtual entry. Used verbatim. |
| `weui-miniprogram` 1.5.6 | npm / `wechat-miniprogram/weui-miniprogram` | MIT | Package metadata and structure inspected | UI component library, authored in WXML/WXSS. Compiled by the same pipeline. Not a built-in component implementation. |
| `miniprogram-api-typings` 5.3.1 | npm / `wechat-miniprogram/api-typings` | MIT | Package metadata inspected | Type definitions for `wx.*`. Used for type-checking the bridge. |
| `miniprogram-simulate` 1.7.0 | npm / `wechat-miniprogram/miniprogram-simulate` | MIT | Dependency graph inspected | Component unit-test harness only. Not a production runtime. |
| `miniprogram-compat` 1.0.5 | npm / `wechat-miniprogram/miniprogram-compat` | MIT | Metadata inspected | API availability matrix for feature detection. |

### Build evidence

The official pipeline was run against a WeChat-shaped project
(`app.json`, `app.js`, `app.wxss`, two pages, one custom component):

- webpack 5 + `GlassEaselMiniprogramWxmlLoader` +
  `GlassEaselMiniprogramWxssLoader` + `GlassEaselMiniprogramWebpackPlugin`;
- output: `app-service.js` (197 KB) and `app-wxss.css`;
- executed in a DOM: the page rendered as
  `<wx-glass-easel-root><view id="page">…</view></wx-glass-easel-root>`,
  the custom component rendered with its scoped class (`A--card`), and
  `{{count}}`, `wx:if`, `wx:for`, `usingComponents` and `bind:tap` were
  compiled by the official compilers.

`packages/miniapp-framework/src/builder.ts` now wraps this pipeline end to end.
The following integration facts are enforced there and must not regress:

1. `.js` files must be forced to `javascript/auto`. A WeChat project nested in a
   `"type": "module"` repository is otherwise parsed as ESM and the generated
   CommonJS bootstrap is emitted unprocessed.
2. JSON with a UTF-8 BOM breaks the official plugin's `JSON.parse`. QChat reads
   project JSON through a BOM-stripping reader.
3. **Built-in component JSON must also be BOM-free.** A BOM-prefixed
   `<tag>.json` is silently treated as an asset by the plugin, so the component
   is never registered and the tag falls back to a plain native node. The
   builder strips the BOM when copying the built-in tree as a safeguard.
4. The plugin merges `app.json` `usingComponents` into **every** component. A
   global `input` therefore makes the built-in `input`'s own native `<input>`
   resolve to itself (`RangeError: Maximum call stack size exceeded`). Built-ins
   are injected per user page/component instead; the staged `app.json` has no
   `usingComponents`.
5. `tagNamePrefix: "wx-"` makes the stylesheet compiler prefix tag selectors
   (`page` → `wx-page`, `view` → `wx-view`, native `img` → `wx-img`). Component
   class selectors are style-scope prefixed (`.A--qchat-input`); page-level and
   app-level class selectors are not.
6. `customBootstrap: true` plus a host-created `createRoot("page", …)` is what
   makes an author's `page {}` rule match `<wx-page>`. `glass-easel` does not
   trigger the `ready` lifetime by itself, so the host walks the mounted tree
   and calls `triggerLifetime("ready", [])` once per component.
7. Byte-level `app-service.js` output is not stable because the plugin registers
   templates from async tasks. The tests compare manifest/index/config/style
   lengths and rules for a fixed date, not raw style bytes.

## 3. What is public but **not** directly usable

| Source | Why not |
| --- | --- |
| `miniprogram-compiler` 0.2.3 (`wcc`/`wcsc` binaries, MIT, published by `wechat-miniprogram`) | It is the real WeChat WXML/WXSS compiler, but its output (`$gwx` virtual-DOM functions, `app-service` bytecode) targets WeChat's closed client runtime. No public runtime consumes it. Running it would require re-implementing WeChat's internal renderer — the exact thing this decision forbids. It cannot be paired with `glass-easel`, which expects `TmplGroup` output. |
| `miniprogram-ci` 2.1.31 (MIT) | The build/upload module extracted from WeChat DevTools. Its usable surface is tied to the WeChat backend (appid, private key, preview/upload). It is not a local runtime or a reusable web build pipeline. |
| `miniprogram-render` 2.2.29 / `miniprogram-exparser` (kbone, MIT package / BSD-3-Clause repo with third-party notices) | A web adapter built around kbone's own virtual DOM and exparser. Its element classes (`image`, `input`, `textarea`, `video`, `canvas`) are reference implementations for that runtime, not `glass-easel` components; porting them would create a second renderer. |
| `j-component` (MIT) | A mock component framework used by `miniprogram-simulate` for unit tests. Not a production runtime. |
| WeChat built-in components (`view`, `text`, `image`, …) | No public source. In the real client they are native. `glass-easel` deliberately treats unknown tags as host nodes and ships no built-in definitions. See `docs/BUILTIN-COMPONENTS-AUDIT.md`. |
| Encrypted `.wxapkg` | The container format is known, but official packages are encrypted with an appid-derived key and carry WeChat-compiled `${gwx}` bytecode. Import cannot be claimed until decryption and execution are implemented and tested. |

## 4. Repositories named in the previous request

| Repository | Final decision | Reason |
| --- | --- | --- |
| `wxmlfile/wxml-parser` | **Not used** | A third-party parser would become a QChat-owned WXML front-end and duplicate the official template compiler. |
| `wxmlfile/wxml-traverse` | **Not used** | Same reason; traversal is internal to the official compiler. |
| `wxmlfile/wxml-generator` | **Not used** | No source-rewrite step exists, so nothing needs printing. |
| `chooin/mini-program-compiler` | **Rejected** | No license, no WXML compiler, a 2021 `tsc`+SCSS scaffolding script; would add a second build pipeline. |

## 5. Architecture

```
WeChat-shaped project (unchanged)
  app.json / app.js / app.wxss / project.config.json / sitemap.json
  pages/<route>/{js,json,wxml,wxss}
  components/<name>/{js,json,wxml,wxss}
        │
        │  official pipeline, no QChat compiler
        ▼
  GlassEaselMiniprogramWebpackPlugin
    ├── wxml_loader  → glass-easel-template-compiler (TmplGroup)
    ├── wxss_loader  → glass-easel-stylesheet-compiler
    └── virtual component bootstrap + code space
        │
        ▼
  app-service.js + app-wxss.css + assets
        │
        ▼
  QChat container (WeChat-compatible layout + QChat metadata)
        │
        ▼
  WebView: glass-easel + adapter + QChat host runtime
    ├── App/Page lifecycle and page stack      ← QChat (missing in WeChat OSS)
    ├── wx.* bridge → Flutter                  ← QChat (missing in WeChat OSS)
    ├── storage / domain / permission sandbox  ← QChat
    └── built-in components                    ← QChat host components
        │
        ▼
  Flutter native chrome: status bar, NavBar, TabBar, capsule, back
```

## 6. Gaps that QChat must implement

These are integration, not framework rewrites:

1. **App lifecycle and navigation.** `MiniProgramEnv` provides `Page` and
   `Component`, not WeChat's `App()`, page stack, `navigateTo`/`redirectTo`/
   `switchTab`, tab state or page config merging. *Implemented in
   `runtime/host.js` for the non-tab page stack; tab state and page config
   merging are still minimal.*
2. **`wx.*`.** No public implementation exists. The host must implement the
   documented APIs on top of the Flutter bridge, with `api-typings` as the
   contract. *Partially implemented: system info, navigation, storage,
   request/fetch, toast/loading, share, chooseImage/chooseMedia and a few
   others. Modal, action sheet, settings/authorize, clipboard, login and
   previewImage return `NOT_SUPPORTED`.*
3. **Built-in components.** No public implementation exists. See the audit.
   *The 15 Phase 2 components are implemented; the rest are not.*
4. **Native chrome.** NavBar, TabBar, capsule, safe areas, back gesture.
   *The host exposes title/navigation-bar hooks; Flutter chrome integration is
   outside this package.*
5. **Package and store.** Container layout, verification, install/update.
6. **Sandbox.** Storage snapshot, request-domain allow-list, permission
   prompts, clipboard/media gating. *Storage and media are bridged; the rest is
   not implemented here.*
7. **`wxapkg` import.** Only with real decryption and execution tests.

## 7. Status

**Phase 1 — builder.** Implemented and tested. `buildMiniProgram` stages the
project, runs the official webpack pipeline, and packages
`app-service.js`/`app-wxss.css`/`app-config.json` plus assets into the `.japp`
container. `test/builder.test.ts` covers the multi-page fixture, slots,
`wx:if`/`wx:for`, asset rewriting, BOM tolerance, official compiler diagnostics,
metadata/archive consistency and deterministic metadata. The CLI
(`create`/`build`/`inspect`) is wired to the same builder.

**Phase 2 — built-ins and host.** Implemented and tested in jsdom.
`runtime/host.js` installs `App`/`getApp`/`wx`/`getCurrentPages`, owns the page
stack and URL reconciliation, mounts pages as `<wx-page>`, and triggers `ready`.
The 15 components in `docs/BUILTIN-COMPONENTS-AUDIT.md` §0 render as `wx-*`
hosts with WeChat-shaped attributes, events and lifecycle. `test/builtin.test.ts`
covers rendering, `input`/`change`/`model:value`, group aggregation, slider and
scroll gestures, `page {}` CSS, `navigator` and `wx.navigateBack`.

**Phase 3 — end-to-end sample.** `packages/miniapp-examples/wechat-demo` is a
WeChat-shaped three-page app (home → form → about) with a custom `section`
component, an asset image and all 15 built-ins. `test/sample.test.ts` builds it
with the real pipeline, boots the bundle in jsdom and walks the whole flow:
button tap, `scroll-view` lower threshold, `navigator` push, every form control,
submit, `wx.navigateBack({ delta: 2 })`. The packaged Studio CLI
(`apps/miniapp-ide/scripts/prepare-cli.mjs` → `resources/qapp/cli.js`) builds and
inspects the same shape of project from outside the repository checkout.

**Verification limits.** Every result above is automated jsdom. There is **no**
Android or iOS device run, no WeChat comparison run and no performance
measurement. Treat the compatibility levels in the audit as implemented-and-
unit-tested, not as device-verified.

**Not implemented yet:**

- Phase 3 device verification on Android and iOS.
- `wx.*` beyond the bridge surface in `runtime/host.js`; unsupported APIs report
  `NOT_SUPPORTED` instead of faking success.
- `swiper`, `picker`, `rich-text`, `form`, `label`, `video`, `canvas`,
  `web-view`; `map`, `camera`, `live-player`, `live-pusher`, `editor` and
  Skyline components are explicitly unsupported.
- Remote images behind the WebView CSP, a host fetch proxy, and `wxapkg` import.
- Porting the Studio editor UI from the retired TSX format to WXML.

No mock component or fake API is used to make a check pass.

### Running the checks

```sh
pnpm --filter @mna/qchat build
pnpm --filter @mna/qchat typecheck
pnpm --filter @mna/qchat test        # 20 tests, jsdom; serial by design
pnpm test:miniapp                    # alias from the repository root
```

The test script passes `--test-concurrency=1`: each file runs a webpack build and
a jsdom bundle, and running three of those at once exhausts V8's zone memory on a
16 GB machine. Serial execution keeps the suite deterministic.
