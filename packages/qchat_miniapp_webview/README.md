# QChat Mini App WebView host (Android)

This Flutter plugin is the Android host seam of ADR 011 §3 and the transport of
ADR 012. It owns:

- the app-private origin `https://appassets.androidplatform.net/qchat/<appId>/<version>/`
  served by `WebViewAssetLoader`;
- an origin-checked `WebViewCompat.addWebMessageListener` bound to one
  app/session/page triple;
- the host page and the P0/P1 component script;
- teardown of the listener, timers and the WebView.

It does not run the service runtime. The page's `app.js` and page scripts are
never served to the WebView: only view assets (images, fonts, media) leave the
installed directory, so the service code cannot be fetched by page script.

## Assets

`assets/qchat-view.js` and `assets/qchat-components.js` are byte copies of
`packages/miniapp-view-web/dist`. Rebuild and sync them together:

```sh
pnpm --filter @qchat/miniapp-view-web build
node scripts/sync-miniapp-webview-assets.mjs
```

`pnpm check:miniapp` fails when the copy is stale.

## State

The Kotlin compiles in CI (`flutter build apk --debug`) and its JVM unit tests
run on the Linux runner. Nothing here has run on a real device: the device
checklist in `STATUS.md` §5.4 stays `BLOCKED` until the owner installs the APK.
