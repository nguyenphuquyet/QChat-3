# ADR 004 — Minimum Android version and WebView requirement

- **Status:** ACCEPTED
- **Date:** 2026-11-27
- **Milestone:** M0 (enforced from M5)

## Context

Appendix A leaves the minimum Android version to the agent. The bridge of
section 4.3 needs:

- `WebViewAssetLoader` (AndroidX WebKit) to serve Mini App content from an
  app-private origin without `file://`;
- `WebViewCompat.addWebMessageListener` with an allowed-origin rule, instead of
  `addJavascriptInterface`;
- a modern WebView that the user can update through Google Play.

The current Flutter app inherits `flutter.minSdkVersion` and has never declared
a minimum of its own. The reference low-end device is unknown (Appendix A is
blank), so the decision cannot be tied to a measured device.

## Decision

1. **Minimum Android version: Android 8.0, API 26.** Set `minSdk = 26` in
   `apps/mobile/android/app/build.gradle.kts` when the new runtime ships (M5).
2. **Minimum WebView: 88 or newer.** At runtime the host checks
   `WebViewCompat.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)` and,
   when it is missing, refuses to launch the Mini App with the documented error
   `MINIAPP_WEBVIEW_UNSUPPORTED` instead of falling back.
3. The check and the error are part of the bridge contract (section 5) and get
   a test in M1/M2.

`UNVERIFIED`: the exact WebView major that introduced `addWebMessageListener`.
AndroidX WebKit documents the feature flag but not a WebView number on the
`WebViewCompat` page checked on 2026-11-27. M1 verifies the feature flag on a
real device or emulator and records the actual WebView version; the runtime
check is by feature flag, not by version number, so the decision is safe even if
the number differs.

## Alternatives considered

1. **API 21 (Android 5.0).** Widest reach, but old WebViews are common, the
   message listener may be absent, and the support cost is high for an app whose
   reference device is unknown.
2. **API 24 (Android 7.0).** Enough for most modern WebViews; rejected because
   API 26 gives a cleaner baseline for file APIs and matches the expected
   lifetime of the app.
3. **API 29 (Android 10).** Simpler security model, but excludes devices the
   owner may still support. Revisit if the owner supplies a device list.

## Consequences and risks

- Devices below API 26 cannot install the QChat version that ships the new
  runtime. This is a product decision that must be announced before release.
- A device with an outdated WebView sees a documented error, not a blank screen.
- Raising `minSdk` affects the whole QChat app, not only Mini Apps. The owner
  must confirm the device floor before M11; the assumption is recorded in
  `STATUS.md`.

## Cost and effort to reverse

Low to change the number, medium to re-qualify devices and the bridge on an
older WebView.
