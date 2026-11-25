# Built-in Mini Program components: audit and plan

QChat runs Mini Programs on `glass-easel`. `glass-easel` is a component
framework: it provides `Page`, `Component`, `Behavior`, the component space and
a backend contract. It does **not** ship WeChat's built-in components.
`glass-easel-miniprogram-adapter` does not ship them either. The official
`glass-easel-miniprogram-template` registers even `view` and `image` as local
custom components, which confirms that the host owns those tags.

This document started as a plan. Phase 2 is now implemented: the 15 components
listed in §7.1 are real `glass-easel` host components in
`packages/miniapp-framework/builtin/`, rendered through the official template
and stylesheet compilers. Phase 4 adds the six remaining priority built-ins
(`swiper`, `swiper-item`, `picker`, `form`, `label`, `rich-text`), for 21
registered tags in total. The automated matrix in
`packages/miniapp-framework/test/builtin.test.ts` covers rendering, events,
group aggregation, `model:value`, slider/scroll/swiper gestures, form
submit/reset, picker modes, rich-text sanitisation, page lifecycle and
navigation. `test/capabilities.test.ts` checks that the capability registry
matches the runtime and the built-in set, and `test/devtools.test.ts` covers the
Studio event channel. There is still **no Android or iOS device result**; §8
lists what is and is not claimed.

## Fidelity levels

| Level | Meaning |
| --- | --- |
| **F0** | The tag renders as an ordinary host element. No WeChat-specific attribute or event. This is **not** acceptable as "compatible". |
| **F1** | Layout and visual attributes work (mode, sizing, text spacing, disabled states). |
| **F2** | Core attributes + events + component lifecycle match the documented WeChat behaviour. |
| **F3** | Full behaviour, including native or platform-specific features, verified against WeChat on real devices. |

Shipping target: **F2** for the core set, **F1/F2** for media that can be
mapped to web primitives, and an explicit "unsupported" state for anything that
would otherwise be a fake tag.

## 0. Implementation status

Implemented in `packages/miniapp-framework/builtin/<tag>/<tag>.{js,json,wxml,wxss}`.
Every entry is a `glass-easel` `Component` registered per user page/component
through `usingComponents`; internals use native `div`/`span`/`img`/`input`/
`textarea`/`button` nodes and never reference another Mini Program tag.
Shared behaviour lives in `builtin/behaviors/` (`hidden`, `hover`) and host-DOM
helpers in `builtin/shared/dom.js`. Default visuals are in `builtin/base.wxss`,
compiled to `wx-*` tag selectors so an author rule can override them.

The registry in `packages/miniapp-framework/src/capabilities.ts` is the single
source of truth for what the host really implements. It is embedded into
`window.__QCHAT_APP_CONFIG__.capabilities` at build time, `wx.canIUse` and
`wx.getCapabilities` read it, and `test/capabilities.test.ts` fails if the
runtime, the component set and the registry drift apart. Nothing below is
listed as supported unless a test boots the runtime and exercises it.

### 0.1 Phase 2 components

| Component | Level | Implemented | Remaining gap |
| --- | --- | --- | --- |
| `view` | F2 | Block host with slot; `hidden`; `hover-class` + start/stay timing | `hover-stop-propagation` is accepted but inert (no ancestor hover in this runtime) |
| `text` | F2 | Inline host with nested text; `selectable`/`user-select`; `space` (`nbsp`/`ensp`/`emsp`) and `decode` now applied | iOS selection/copy policy unverified |
| `button` | F2 | `type`/`size`/`plain`/`disabled`/`loading`, hover, native button, `open-type=share`/`getUserInfo`; `form-type=submit`/`reset` reaches the enclosing `form` | `open-type` values other than `share`/`getUserInfo` emit `error`; `contact`/`feedback`/`getPhoneNumber`/`requestPayment` need host capabilities and are reported unsupported |
| `image` | F2 | Native `img`, `mode` → CSS class, `bindload`/`binderror`, empty state, asset URL rewrite | Exact crop per mode relies on `object-fit`; long-press menu not implemented; remote `src` is blocked by the WebView CSP |
| `scroll-view` | F2 | `scroll`/`scrolltolower`/`scrolltoupper` detail, `scroll-top`/`scroll-left`, `scroll-into-view`, axis direction, thresholds | Pull-to-refresh gesture is property-only; `enhanced` flags are accepted but inert; device gesture verification pending |
| `input` | F2 | Native input, value sync, `model:value`, `input`/`focus`/`blur`/`confirm`, password/number types, `maxlength`, `disabled`, `name` for forms | `placeholder-class` styles only the native element; iOS keyboard `confirm-type` and selection restore unverified |
| `textarea` | F2 | Native textarea, value sync, `auto-height`, `linechange`, `input`/`focus`/`blur`/`confirm`, `name` for forms | Placeholder styling partial; native overlay/keyboard behaviour unverified |
| `switch` | F2 | `checked`/`disabled`/`color`/`type="checkbox"`, `change`, `name` for forms | Animation parity unverified |
| `checkbox` / `checkbox-group` | F2 | Group relation, checked aggregation, `change` with `{value:[…]}`, `name` for forms; setting the group `value` to `[]` now unchecks children | Ordering is document order |
| `radio` / `radio-group` | F2 | One checked child, `change` with `{value}`, group `value` sync, `name` for forms | None known beyond device verification |
| `slider` | F2 | Pointer drag/tap, `changing`/`change`, `min`/`max`/`step`, colors, `disabled`, `name` for forms | No `duration`-style smoothing; touch device verification pending |
| `navigator` | F2 | `navigate`/`redirect`/`switchTab`/`reLaunch`/`navigateBack`, hover, URL query | `target="miniProgram"` and `open-type="exit"` emit `error`; no route guards |
| `progress` | F2 | `percent` clamp, `stroke-width`, colors, `show-info`, active stripe | `duration`/`active-mode` animation speed is fixed |

### 0.2 Phase 4 components

| Component | Level | Implemented | Remaining gap |
| --- | --- | --- | --- |
| `swiper` / `swiper-item` | F2 | Descendant relation over `swiper-item`; `current`, `autoplay`, `interval`, `duration`, `circular`, `vertical`, `indicator-dots`/colors, `display-multiple-items`, `previous-margin`/`next-margin`/`easing-function`/`snap-to-edge` accepted; touch and mouse drag paging; `change` and `animationfinish` with `{current, source}` | `circular` wraps by animating across all items instead of cloning the ends; `previous-margin`/`next-margin` are parsed but not laid out; `easing-function` does not change the CSS timing |
| `picker` | F2 | `selector`, `multiSelector`, `time`, `date` modes with native controls; `value`/`range`/`range-key`/`fields`; `change` with `{value}`; `columnchange` for `multiSelector`; `disabled`; `name` for forms; `region` emits `error` instead of faking a region picker | `multiSelector` uses inline native columns rather than WeChat's wheel sheet; `header-text` unused; `region` mode unsupported |
| `form` | F2 | Collects named `input`, `textarea`, `switch`, `checkbox-group`, `radio-group`, `slider`, `picker` into `submit` detail `{value}`; `reset` restores the values captured at ready; `bindsubmit`/`bindreset`; two-sided `button` relation for `form-type` | `report-submit`/`report-submit-timeout` accepted but `formId` stays `""` (no template-message backend) |
| `label` | F2 | `for` activates the target `switch`/`checkbox`/`radio`/`button`/`input` by id; wrapping a control also works; tap bubbles normally | Checkbox/radio activation relies on the control's own tap handler |
| `rich-text` | F2 | `nodes` accepts an HTML string or a node array; sanitises against a tag/attribute allow-list (drops `<script>`, event attributes, `javascript:` URLs) | Allow-list is conservative; WeChat's full inline-style surface is larger |

### 0.3 Cross-cutting notes

- **Relations are two-sided in `glass-easel`.** A pair links only when *both*
  components declare it. `checkbox`↔`checkbox-group`, `radio`↔`radio-group`,
  `swiper`↔`swiper-item` and `button`↔`form` each declare both sides; a
  parent-only `descendant` declaration does not link.
- **Relation callbacks run before the node list is populated.** `swiper` reads
  its item count on the next task (`__qchatScheduleRefresh`) instead of inside
  `linked()`.
- **`swiper` is idempotent.** `__qchatRefresh` patches only changed fields and
  `__qchatApplyCurrent` emits `change` only when the effective index really
  changes, so a page that binds `current` and writes it back in `bindchange`
  does not loop.
- **Boolean WXML attributes need explicit values.** `indicator-dots` alone
  becomes `""`, which is `false`; write `indicator-dots="{{true}}"`.

Host-level behaviour that the matrix also covers:

- `page` is created by the host runtime as `<wx-page>` and is the target of the
  compiled `page {}` rule.
- `hidden` is a shared behaviour that uses the same temporary style segment as
  the official `view`, so author `display` rules still win.
- Tap events bubble from the native control inside a built-in to the author's
  `bindtap`; a disabled `button`/`switch`/`checkbox`/`radio` stops the tap.
- `input`/`textarea` native events are captured on the component host and
  re-emitted once with WeChat's detail shape, so no detail-less duplicate leaks.

## 1. Source-of-truth status

| Candidate source | Built-in implementations? | License | Usable for glass-easel? |
| --- | --- | --- | --- |
| WeChat client | Yes, native C++/Android/iOS | Closed source | No |
| `glass-easel` + adapter | No | MIT | Framework only |
| `glass-easel-miniprogram-template` | `view` and `image` demos only | MIT | Reference for wrapper shape, not a library |
| `weui-miniprogram` | No; it is a UI kit (`mp-*`) built on top of built-ins | MIT | Yes, as an app-level component library, after built-ins exist |
| `kbone` / `miniprogram-render` | Partial reference: `image`, `input`, `textarea`, `video`, `canvas`, `select`, `option` | MIT (package) / BSD-3-Clause (repo, with third-party notices) | No — tied to kbone's own virtual DOM and exparser |
| `miniprogram-simulate` + `j-component` | Test-only subset | MIT | No — test harness |

**Conclusion:** there is no public, production-grade, directly reusable
implementation of WeChat's built-in components. QChat must implement them as
host components. That is host-platform work, not a replacement for
`glass-easel`, and it must be reported per component rather than hidden behind
tag names.

## 2. Core structure and text

| Component | Core WeChat behaviour | Public impl. | QChat plan | Target | Missing |
| --- | --- | --- | --- | --- | --- |
| `view` | Block container; `hover-class`, `hover-start-time`, `hover-stay-time`, `hover-stop-propagation`; flex layout is CSS-driven | No | `glass-easel` host component wrapping a `div`; hover classes via touch listeners | F2 | Hover timing, propagation stop, default `display:block` |
| `text` | Inline text; `selectable`, `space` (`nbsp`/`ensp`/`emsp`), `decode`; nested `text` inherits | No | **Implemented at F2**: host `span` with `space`/`decode` | F2 | iOS copy/selection policy |
| `block` | Compile-time wrapper, no node | Compiler (official) | No runtime component. `glass-easel-template-compiler` handles it | F3 | — |
| `slot` | Content projection | `glass-easel` | Native `glass-easel` feature | F3 | Verify named/scoped slots |
| `template` / `import` / `include` | Compile-time composition | Official template compiler | No runtime component | F3 | Verify WXS interaction |
| `wxs` | Inline/external script evaluated by the template compiler | Official template compiler (script deps) | Compiled by official pipeline | F2 | Host policy for inline WXS |
| `root-portal` | Renders subtree outside the page hierarchy | No | Host component using a top-layer mount point | F1 | Stacking and teardown |
| `page-container` | Overlay page with enter/leave animations | No | Host component + native overlay route | F1 | Gesture dismissal, nested page stack |

## 3. Media

| Component | Core WeChat behaviour | Public impl. | QChat plan | Target | Missing |
| --- | --- | --- | --- | --- | --- |
| `image` | `src`, `mode` (9 modes), `lazy-load`, `show-menu-by-longpress`, `binderror`/`bindload` | Demo only | Host component wrapping `img`; `mode` → `object-fit`/`object-position`; load/error events | F2 | Exact `mode` crops, long-press menu, `webp`/`svg` policy |
| `video` | Playback, `controls`, `autoplay`, `poster`, `danmu`, fullscreen, `bindplay`/`bindended`/`bindtimeupdate`/`binderror` | kbone reference only | Host component using HTML `<video>` in the WebView | F1–F2 | Fullscreen orientation, background audio, DRM/HLS codecs, iOS inline policy |
| `camera` | Live camera preview, `device-position`, `flash`, `bindstop`/`binderror` | No | Native platform view (Flutter camera) over the WebView | Deferred | Permissions, lifecycle, frame handoff |
| `canvas` | 2D canvas, `canvas-id`, `type="2d"`, touch events, `wx.createCanvasContext` | kbone reference only | Host `<canvas>` + bridge for legacy context; 2D context via WebView | F1 | Legacy drawing API, image data upload, performance |
| `map` | Native map, markers, polylines, controls, region, events | No | Native map platform view (Google/Apple Maps) | Deferred | Provider choice, markers, gestures, clustering |
| `live-player` / `live-pusher` | RTMP/WebRTC live streaming | No | Native platform SDK | Unsupported initially | Provider, licenses, permissions |
| `audio` (legacy) | Audio playback | Deprecated by WeChat | Map to `InnerAudioContext` via `wx.*`; no tag | Not planned | WeChat deprecation parity |
| `web-view` | Embedded web page | No | WebView-in-WebView or iframe with a strict allow-list | F1 | Cookie/storage isolation, JS bridge restrictions |
| `ad` | WeChat ad slot | No | Not applicable to QChat | Unsupported | No ad network |
| `official-account` | Follow official account banner | No | Not applicable | Unsupported | — |

## 4. Form controls

| Component | Core WeChat behaviour | Public impl. | QChat plan | Target | Missing |
| --- | --- | --- | --- | --- | --- |
| `button` | `type`, `size`, `plain`, `disabled`, `loading`, `form-type`, `open-type` (`share`, `getUserInfo`, `contact`, `feedback`, …), `hover-class` | No | Host component; QChat design shown by WeChat-compatible states; `open-type` routed through the native bridge | F2 | Each `open-type` needs a host capability; unsupported ones must report, not silently no-op |
| `input` | `type`, `value`, `password`, `placeholder`, `placeholder-class`, `maxlength`, `focus`, `confirm-type`, `bindinput`/`bindfocus`/`bindblur`/`bindconfirm` | kbone reference only | Host component wrapping `input`; controlled value sync with `setData` | F2 | iOS keyboard `confirm-type`, selection/cursor preservation, `adjust-position` |
| `textarea` | Multi-line input, `auto-height`, `maxlength`, `show-confirm-bar`, `bindlinechange` | kbone reference only | Host component wrapping `textarea` | F2 | Auto-height measurement, native overlay on iOS |
| `switch` | Boolean control, `checked`, `color`, `bindchange` | No | Host component (accessible button + track) | F2 | Animation parity, disabled state |
| `checkbox` / `checkbox-group` | Grouped multi-select | No | Host components | F2 | Group value ordering |
| `radio` / `radio-group` | Grouped single-select | No | Host components | F2 | Group value semantics |
| `slider` | Range input, `min`/`max`/`step`/`value`, `activeColor`, `block-size`, `bindchange`/`bindchanging` | No | Host component (pointer events) | F2 | `bindchanging` throttling |
| `picker` | `selector`, `multiSelector`, `time`, `date`, `region`; `bindchange`/`bindcancel`/`bindcolumnchange` | No | **Implemented at F2** for `selector`/`multiSelector`/`time`/`date`; `region` emits `error` | F2 | Region dataset, wheel-sheet parity |
| `picker-view` / `picker-view-column` | Custom wheel picker | No | Host component | F1 | Momentum/snap physics |
| `form` | Collects named controls, `bindsubmit`/`bindreset` | No | **Implemented at F2** (see §0.2) | F2 | `report-submit` template-message backend |
| `label` | Focuses/activates the labelled control | No | **Implemented at F2** (see §0.2) | F2 | Cross-component `for` is limited to the rendered tree |
| `editor` | Rich-text editor | No | Host `contenteditable` + `wx.*` editor context | Deferred | Delta format, selection APIs |

## 5. Scrolling and gestures

| Component | Core WeChat behaviour | Public impl. | QChat plan | Target | Missing |
| --- | --- | --- | --- | --- | --- |
| `scroll-view` | Axis scrolling, `scroll-into-view`, `scroll-top`/`scroll-left`, `refresher-*`, `bindscroll`/`bindscrolltolower`/`bindscrolltoupper`, `enhanced` | No | Host component; overflow scroll + event throttling | F2 | Refresher, `enhanced` features, nested scroll arbitration |
| `swiper` / `swiper-item` | Paging, `autoplay`, `interval`, `duration`, `circular`, `indicator-dots`, `vertical`, `bindchange` | No | **Implemented at F2** (see §0.2): two-sided relation, touch/mouse paging, `change`/`animationfinish` | F2 | Seamless `circular` cloning, `previous-margin`/`next-margin` layout, easing curves |
| `movable-area` / `movable-view` | Draggable/zoomable surface, `direction`, `inertia`, `out-of-bounds`, `scale`, `bindchange`/`bindscale` | No | Host component with pointer gesture math | F1 | Inertia curves, bounds modes, pinch |
| `match-media` | Responsive query wrapper | No | Host component using `matchMedia` | F1 | Query syntax parity |
| `cover-view` / `cover-image` | Native overlay above native components | No | Only meaningful over native platform views | Deferred | Native layering |
| `grid-view` / `list-view` / `sticky-header` / `sticky-section` / `share-element` / `snapshot` / `span` | Skyline renderer components | No | Skyline is a separate renderer; `glass-easel` web target does not implement it | Unsupported | Would require a different renderer |

## 6. Navigation, feedback and misc

| Component | Core WeChat behaviour | Public impl. | QChat plan | Target | Missing |
| --- | --- | --- | --- | --- | --- |
| `navigator` | `url`, `open-type` (`navigate`, `redirect`, `switchTab`, `reLaunch`, `navigateBack`), `delta`, `hover-class` | No | Host component calling the QChat page stack | F2 | Route guards, tab state |
| `rich-text` | `nodes` (HTML string or node array) | No | **Implemented at F2** with an allow-list sanitiser (see §0.2) | F2 | Larger inline-style surface |
| `progress` | `percent`, `stroke-width`, `activeColor`, `active`, `show-info` | No | Host component | F2 | Animation parity |
| `icon` | `type`, `size`, `color` | No | QChat icon set mapped to WeChat types | F1 | Exact glyph parity |
| `open-data` | Displays user/group data | No | Native bridge, consent-gated | Deferred | Privacy model |
| `functional-page-navigator` | Opens a plugin functional page | No | Not applicable | Unsupported | — |

## 7. What QChat will do first

1. **Done (Phase 2):** `view`, `text`, `button`, `image`, `scroll-view`,
   `input`, `textarea`, `switch`, `checkbox`, `radio`, `slider`, `navigator`,
   `progress` at **F2** (with the gaps recorded in §0.1).
2. **Done (Phase 4):** `swiper`, `swiper-item`, `picker`, `form`, `label`,
   `rich-text` at **F2** (gaps in §0.2). The priority list from the product
   brief is complete.
3. **Next:** `video`, `canvas`, `web-view` at **F1** using web primitives, behind
   a capability flag; then device verification of everything already shipped.
4. `map`, `camera`, `live-player`, `live-pusher`, `editor`, Skyline components:
   report **unsupported** until a native implementation exists. No tag-only
   fallback is shipped as "compatible".

Every component gets:

- a `glass-easel` host component or backend node, never a bare tag rename;
- attribute parsing with WeChat defaults and type coercion;
- events with WeChat names and payload shapes;
- lifecycle/teardown handling;
- an entry in `src/capabilities.ts`, embedded into `AppConfig.capabilities`, so
  `wx.canIUse`/`wx.getCapabilities`, the IDE and the store show exactly which
  level is implemented.

## 8. Explicit non-claims

- Phase 2 and Phase 4 compatibility is proven by automated jsdom tests, not by
  Android or iOS device runs. No device result exists yet.
- The components are QChat's implementation of WeChat's documented surface, not
  WeChat's closed native implementation. Visual parity is approximate where
  WeChat does not document values.
- `weui-miniprogram` is not built-in compatibility; it needs the built-ins.
- `kbone` element classes are not `glass-easel` components and are not vendored.
- `miniprogram-compiler` (`wcc`/`wcsc`) output is not runnable without WeChat's
  closed runtime and is not used.
- `map`, `camera`, `live-player`, `live-pusher`, `editor` and Skyline components
  are unsupported. `video`, `canvas` and `web-view` are not implemented yet.
- `swiper` `circular` is not seamless, `picker` `region` mode is not
  implemented, and `form` `report-submit` yields no `formId`. These report their
  gaps rather than pretending parity.
- Remote image sources are subject to the WebView CSP (`img-src 'self' data:
  blob:`); a host proxy is not implemented.
- `wx.showModal`, `wx.showActionSheet`, `wx.getSetting`, `wx.authorize`,
  clipboard APIs, `wx.login`/`wx.checkSession` and `wx.previewImage` return
  `NOT_SUPPORTED` from the host runtime rather than faking success.
- Encrypted `.wxapkg` import is not implemented and must not be claimed.
