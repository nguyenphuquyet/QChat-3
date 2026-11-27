# ADR 006 — Theme ownership and delivery (`qxColorScheme`)

- **Status:** ACCEPTED
- **Date:** 2026-11-27
- **Milestone:** M0 (contract in M1, implementation M3, device tests M6)

## Context

Section 4.4 fixes theme ownership: the Mini App developer chooses `light`,
`dark` or `auto`; the host never restyles a fixed app. The View Runtime computes
the resolved theme per page; the host sends its effective theme only to pages
that resolve to `auto`; bars and the capsule follow the developer's
configuration; the platform never auto-darkens.

## Decision

1. **Declaration.** `app.json` may declare `qxColorScheme`: `light`, `dark` or
   `auto`. `page.json` may override it. Default: `light` (Appendix A).
2. **Resolution.** The host reads the verified manifest and page config and
   computes `resolvedTheme` per page. For `auto` it uses the QChat effective
   theme (the one the app currently shows), not the raw OS trait. Switching
   `qxColorScheme` at run time is a QChat-namespaced API added in M7.
3. **Delivery to the view.** The page root receives:
   - `data-theme="light" | "dark"` and the CSS property `color-scheme`;
   - no host theme event at all for a page that resolves to `light` or `dark`.
   For an `auto` page the host sends a typed, allowlisted bridge event
   (`host.theme.changed`) only while the page resolves to `auto`.
4. **No reload on theme change.** Only the root attributes change; page state is
   preserved and `onLoad` is not called again.
5. **Bars.** Navigation bar and tab bar colors come from the developer's config
   and `wx.setNavigationBarColor` / `wx.setTabBarStyle`. The host does not derive
   them from its own theme.
6. **Capsule and status bar.** The host capsule uses the Mini App's navigation
   bar `frontColor`; status bar icon style follows the same value. Safe-area
   insets are layout data, not theme data.
7. **Splash.** The launch splash uses the verified manifest's default
   `qxColorScheme`; if it is `auto`, the host's current theme.
8. **No automatic darkening.** Android: `setForceDark` and algorithmic
   darkening are off. iOS (M8): the WKWebView `overrideUserInterfaceStyle` is set
   from the resolved theme.
9. **Unsupported WeChat theme features.** `darkmode`, `themeLocation` and
   `theme.json` are reported by the compiler with documented error codes.
   `@media (prefers-color-scheme)` is `Unsupported` unless a real-device test
   proves it resolves to the Mini App theme.

## Alternatives considered

1. **Follow the host always.** Rejected: it overrides the developer's design and
   section 4.4 forbids it.
2. **Follow the OS always.** Rejected: the host may not follow the OS (the user
   can choose a QChat theme), and the specification ties `auto` to the host.
3. **Reload the page on theme change.** Rejected: it loses state and fires
   `onLoad` again.
4. **Use `prefers-color-scheme`.** Rejected by default: it follows the device or
   WebView, not the resolved Mini App theme.

## Consequences and risks

- Developers of `auto` apps must set bar colors for both themes themselves; the
  documentation must show the pattern.
- The host must keep the effective theme in one place so `auto` pages and the
  splash agree.
- The four light/dark combinations and the no-event rule need real-device tests
  in M6; until then the entries stay `Not started`/`UNVERIFIED`.

## Cost and effort to reverse

Medium: the root attribute contract is small, but changing it later breaks
developer CSS that uses `[data-theme="dark"]`.
