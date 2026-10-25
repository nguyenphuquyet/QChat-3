# QChat Mini App template

React + Vite starter that builds a ZIP accepted by the QChat Developer Center.

## Create a project

1. Create an app in the QChat Developer Center and copy its `appId` (`mp_…`).
2. Copy this folder outside the QChat repository (or keep it in a workspace).
3. Replace `appId` in `qchat.manifest.json`.
4. Install and run:

```bash
npm install
npm run dev        # local browser preview without the host bridge
npm run build:miniapp
```

`build:miniapp` runs `vite build`, copies `qchat.manifest.json` to the ZIP root
and writes `release/<appId>-<version>.zip`. It prints the local SHA-256; the
server computes and stores the authoritative checksum.

5. Upload the ZIP in **Developer Center → your app → Builds**, submit it for
   review, then release it after approval.

Inside this monorepo the SDK dependency is `file:../miniapp-sdk`. When the
template is copied elsewhere, install the published package instead:

```bash
npm install @qchat/miniapp-sdk
```

## Layout

```
qchat.manifest.json   App id, version, entry and requested permissions
src/App.tsx           Demo screen: host-safe header, cards and SDK calls
vite.config.ts        base: "./" so assets work on the runtime origin
scripts/package.mjs   Dependency-free ZIP writer
```

## Host chrome and safe areas

The runtime draws no header of its own: the mini app owns the whole screen and
the host only floats a menu button and a close button over the top right
corner. Keep that strip (about `92 x 46` logical pixels, starting at the top
safe area) free of controls — the starter's sticky `.app-bar` does it with the
`--capsule` CSS variable, so the app title and the host buttons never overlap.

`App.tsx` is a demo screen rather than a blank page: header with the app name,
a hero card with live counters, a checklist, bridge actions and a device card.
Keep the header when you replace the content, otherwise your first row of
buttons slides under the host's menu and close buttons.

The runtime disables pinch zoom, so the page is always laid out at the device
width. Design for the viewport and scroll vertically instead of expecting the
user to zoom.

`QChat.getSystemInfo()` reports `safeAreaTop` and `safeAreaBottom`; the starter
writes them into the `--safe-top` / `--safe-bottom` CSS variables because
`env(safe-area-inset-*)` resolves to `0` inside the Android WebView.

## Manifest rules

- `entry` must be a relative HTML file (`index.html` in this starter).
- `version` must be semver and must be unique for the app.
- `requestedPermissions` may only contain `toast`, `user.profile`,
  `media.choose`, `share`, `storage`, `qchat.api`.
- Do not include executables, symlinks or paths outside the ZIP root.
- Keep the ZIP below 20 MB; the server rejects larger uploads.

## Security notes

The runtime serves the package from a per-session `127.0.0.1:<port>` origin with
a strict CSP. It never exposes a QChat access token to the page. All privileged
calls go through `@qchat/miniapp-sdk` and are re-checked by the Flutter host,
including permission grants, request ids, schemas and timeouts. External
navigation is blocked; use `QChat.share` for links.

## Scripts

```bash
npm run dev           # Vite dev server
npm run build         # build + ZIP
npm run build:miniapp # alias
npm run preview       # preview dist
```
