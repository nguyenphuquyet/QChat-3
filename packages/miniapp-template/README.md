# Template

A QChat Mini App built with React + Vite. The `@qchat/miniapp-sdk` bridge client
is vendored under `src/sdk/` so this project builds standalone.

## Develop

```sh
npm install
npm run dev
```

## Package for QChat

```sh
npm run build
```

This runs `vite build` and then `scripts/package.mjs`, which produces
`release/mp_c6f7feffd3227d68-<version>.zip`. Upload that ZIP to the QChat Developer Center
(or via `POST /api/miniapps/developer/apps/:appId/builds` with an API key). The
script prints the local SHA-256; the server computes and stores the
authoritative checksum.

## Host chrome and safe areas

The runtime draws no header of its own: the mini app owns the whole screen and
the host only floats a menu button and a close button over the top right
corner. Keep that strip (about `92 x 46` logical pixels, starting at the top
safe area) free of controls — the starter does it with the `--capsule` CSS
variable.

`QChat.getSystemInfo()` reports `safeAreaTop` and `safeAreaBottom`; `src/App.tsx`
writes them into the `--safe-top` / `--safe-bottom` CSS variables because
`env(safe-area-inset-*)` resolves to `0` inside the Android WebView.

## Manifest

Edit `qchat.manifest.json` to change `version`, `requestedPermissions` or the
display name. `appId` must match the app created in the Developer Center
(format `mp_<12-24 hex chars>`).

- `entry` must be a relative HTML file (`index.html` in this starter).
- `version` must be semver and must be unique for the app.
- `requestedPermissions` may only contain `toast`, `user.profile`,
  `media.choose`, `share`, `storage`, `qchat.api`.
- Do not include executables, symlinks or paths outside the ZIP root.
- Keep the ZIP below 20 MB; the server rejects larger uploads.

## Security notes

The runtime serves the package from a per-session `127.0.0.1:<port>` origin with
a strict CSP. It never exposes a QChat access token to the page. All privileged
calls go through the vendored SDK and are re-checked by the Flutter host,
including permission grants, request ids, schemas and timeouts. External
navigation is blocked; use `QChat.share` for links.

## Scripts

```sh
npm run dev           # Vite dev server
npm run build         # build + ZIP
npm run build:miniapp # alias
npm run preview       # preview dist
```
