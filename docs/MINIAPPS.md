# QChat Mini Apps

Mini Apps are small applications that run inside QChat. They are built and
uploaded by developers, reviewed by an administrator, released as immutable
packages, and opened by the Flutter client.

Only the native qapp runtime exists:

- **Native qapp** (`schemaVersion: 2`, `.japp`): TSX is compiled to JavaScript,
  executed by an embedded QuickJS engine, turned into a virtual UI tree and
  rendered with real Flutter widgets.
- The legacy WebView runtime, the loopback asset server, the HTML preview
  bridge, `@qchat/miniapp-sdk` and the Vite starter template were removed.
  Uploading a `schemaVersion: 1` package is rejected with `MANIFEST_INVALID`.

The platform is self-hosted: it does not use uniMP, DCloud, Alipay or any other
external mini-app runtime.

## Pieces

| Piece | Location | Responsibility |
| --- | --- | --- |
| Developer Center | `apps/developer/dashboard.tsx`, `/developer` | Dashboard, apps, builds, review console, permissions, API keys, analytics, team, docs |
| API | `apps/server/src/modules/miniapps.ts` | Store, developer, review and release endpoints |
| Storage | `apps/server/src/services/miniapp-storage.ts` | Immutable builds in private S3 or a signed filesystem adapter |
| Package validation | `apps/server/src/services/zip.ts`, `miniapp-package.ts` | ZIP, manifest, metadata, checksum and permission checks |
| Native framework | `packages/miniapp-framework` | `@mna/qchat` TSX runtime, components, APIs, compiler and `.japp` CLI |
| Native examples | `packages/miniapp-examples` | Hello World and counter built through the real compiler |
| IDE download | `apps/developer/dashboard.tsx` (IDE tab), admin → landing links (`ide`) | Administrator-configured download link, read from `SiteLink` |
| Reviewer preview | `apps/server/src/services/miniapp-preview.ts`, `miniAppPreview` | Raw file inspection for `.japp` builds |
| Runtime | `apps/mobile/lib/features/miniapps` | Download, verify, cache, QuickJS host and Flutter renderer |
| Contracts | `packages/contracts/miniapps.ts` | Permissions, categories and the qapp manifest schema |

## Roles

- **Developer** — any authenticated QChat user. Can create apps and manage the
  apps they own or belong to as a team member.
- **Team member** — another user added by the owner; can manage builds and
  releases unless the app is restricted to the owner.
- **Reviewer / Administrator** — `User.role === "ADMIN"`. Can see the review
  queue, approve or reject builds, release versions, revoke versions and
  suspend apps.
- **API key** — scoped to one app, used by CI to upload a build. It never grants
  access to the Developer Center or to another app.

Authorization is checked on the server from the authenticated session. Client
ids, roles and app ids are never trusted. Mutations from the Developer Center
also require `x-qchat-csrf: 1`; the browser never receives the access token
because the Center uses an httpOnly refresh cookie and a server-side proxy.

## Lifecycle

```
create app
  → upload package (multipart, max 20 MB, .japp)
  → build status UPLOADED (immutable, with format and sdkVersion)
  → submit for review (REVIEWING)
  → approve (APPROVED) or reject (REJECTED)
  → release (currentVersion changes, PUBLISHED)
  → rollback to an earlier approved version, or revoke a version
  → release a revoked version again (only if it was published before)
  → suspend / restore the whole app
```

Uploading is not releasing. A build is stored under
`miniapps/<appId>/<uuid>.japp`, with its version, format (`qapp`), SDK version,
SHA-256, size, manifest, uploader and review state. Re-uploading the same
version is rejected; publish a new version instead.

Revoking a version or suspending an app applies to native qapp packages.

## Store API

All endpoints require a normal QChat bearer session.

| Method | Path | Result |
| --- | --- | --- |
| `GET` | `/api/miniapps/store?q=&category=&sort=new\|recommended&page=` | `{ items, total, page, pageSize }` |
| `GET` | `/api/miniapps/store/:appId` | app detail |
| `GET` | `/api/miniapps/store/:appId/manifest` | current manifest and checksum |
| `GET` | `/api/miniapps/store/:appId/build?version=` | download URL, SHA-256, size, permissions |
| `GET` | `/api/miniapps/recent` | recently opened apps |
| `POST` | `/api/miniapps/recent` | record an open |
| `GET` | `/api/miniapps/favorites` | favorites |
| `POST` | `/api/miniapps/favorites` | add a favorite |
| `DELETE` | `/api/miniapps/favorites/:appId` | remove a favorite |
| `POST` | `/api/miniapps/telemetry` | `open`, `launch_success`, `launch_failure`, `download_failure`, `update_failure`, `runtime_error` |

A suspended app returns `410 APP_SUSPENDED`; a revoked version returns
`410 VERSION_REVOKED`. The mobile client deletes a revoked cached version and
refuses to open a suspended app.

The build response also includes `entry` (`app.js`), `format` (`qapp`) and
`sdkVersion`.

## Developer API

The Developer Center talks to `/api/developer/...`, which authenticates the
cookie session and forwards to the same module. CI uploads directly to
`POST /api/miniapps/developer/apps/:appId/builds` with `X-QChat-Key: qk_...` and
a multipart `file` field containing a `.japp` package.

| Method | Path |
| --- | --- |
| `GET` | `/api/miniapps/developer/dashboard` |
| `GET` | `/api/miniapps/developer/ide` |
| `GET` | `/api/miniapps/developer/audit` |
| `GET` / `POST` | `/api/miniapps/developer/apps` |
| `GET` / `PATCH` | `/api/miniapps/developer/apps/:appId` |
| `GET` | `/api/miniapps/developer/apps/:appId/versions` |
| `POST` | `/api/miniapps/developer/apps/:appId/builds` (multipart) |
| `POST` | `/api/miniapps/developer/apps/:appId/versions/:version/submit` |
| `POST` | `/api/miniapps/developer/apps/:appId/versions/:version/release` (also re-releases a previously published, revoked build) |
| `POST` | `/api/miniapps/developer/apps/:appId/rollback` |
| `POST` | `/api/miniapps/developer/apps/:appId/revoke` |
| `GET` | `/api/miniapps/developer/apps/:appId/analytics` |
| `GET` / `POST` | `/api/miniapps/developer/apps/:appId/permissions` |
| `GET` / `POST` / `DELETE` | `/api/miniapps/developer/apps/:appId/members` |
| `GET` / `POST` / `DELETE` | `/api/miniapps/developer/apps/:appId/keys` |
| `GET` | `/api/miniapps/review/queue` |
| `POST` | `/api/miniapps/review/versions/:versionId/decision` |
| `POST` | `/api/miniapps/review/permissions/:id` |
| `POST` | `/api/miniapps/review/apps/:appId/suspend` |
| `POST` | `/api/miniapps/review/apps/:appId/restore` |

Every release, revoke, review decision, suspension and API-key action writes an
`AuditLog` row prefixed with `MINIAPP_`. Rate limits apply per user.

### Reviewer preview

The Developer Center review queue can inspect a build before it is approved. The
preview is available only to administrators, only for a build in `REVIEWING`,
and only through the cookie proxy:

```
GET /api/developer/miniapps/review/versions/:versionId/preview-token
GET /api/developer/miniapps/review/versions/:versionId/preview/<token>/<file>
```

The admin-only token endpoint signs a build-scoped token valid for 15 minutes;
the token sits in the file path and authorizes requests without a cookie. The
stored `.japp` is read from private storage and one file is returned per request;
nothing is extracted to disk and no code runs in the reviewer's browser.

`manifest.json`, `permissions.json`, `metadata.json`, `app.js` and declared
assets are returned exactly as stored, with `format: "qapp"`. Real rendering
happens only in the Flutter QuickJS host.

The IDE tab downloads whatever link an administrator saves under the `ide`
platform in the admin console; the link is served by
`GET /api/miniapps/developer/ide` so the Developer Center never needs a rebuild.

## Package format

A `.japp` file is a ZIP with this layout:

```
manifest.json
app.js
metadata.json
permissions.json
assets/...          (optional)
```

`manifest.json`:

```json
{
  "schemaVersion": 2,
  "format": "qapp",
  "name": "Counter",
  "description": "Optional",
  "version": "1.0.0",
  "entry": "app.js",
  "sdkVersion": "1.0.0",
  "minRuntimeVersion": "1.0.0",
  "requestedPermissions": ["storage", "toast"],
  "networkDomains": []
}
```

- `entry` is always `app.js`; `format` is the internal format id `qapp`.
- Do not declare `appId`: the server assigns it from the app record.
- `metadata.json` records `formatVersion: 1`, the version, entry, `appSha256`
  and a `files` array of `{ path, sha256, size }`. Every payload file except
  `metadata.json` itself is listed. The device re-verifies these hashes and
  sizes on install and on every open.
- `permissions.json` repeats `requestedPermissions` and `networkDomains` and
  must match the manifest exactly.
- Only allowlisted asset extensions may live under `assets/` (images, fonts,
  JSON/text, audio and video). Undeclared files, symlinks, executables and path
  traversal are rejected.
- `sdkVersion` and `minRuntimeVersion` are checked by the host. The internal
  format id stays `qapp`; the file extension is `.japp`.

Packages may only declare these permissions:

| Permission | APIs |
| --- | --- |
| `toast` | `showToast` |
| `user.profile` | `getUserInfo`, `request("/users/me")`, `/friends` |
| `media.choose` | `chooseImage` |
| `share` | `share` |
| `storage` | `getStorage`, `setStorage`, `removeStorage` |
| `qchat.api` | `request("/conversations")` |
| `network` | `fetch` to HTTPS hosts declared in `networkDomains` |

`getAppInfo`, `getSystemInfo`, `navigateTo` and `closeMiniApp` need no
permission. Declaring a permission is necessary but not sufficient: the Flutter
host checks the granted permission on every call.

`networkDomains` accepts at most 10 exact hosts or wildcard hosts such as
`*.example.com`. The `network` permission and a non-empty `networkDomains` array
must be declared together. Requests are HTTPS-only, redirects are re-checked
against the allowlist, responses are capped at 1 MB, and the host never attaches
a QChat token.

### Upload checks

- 20 MB request limit and a real ZIP signature/central-directory check.
- Only `schemaVersion: 2` / `format: "qapp"` manifests are accepted; legacy
  WebView packages are rejected.
- Rejects absolute paths, `..`, backslashes, drive letters, NUL bytes, symlinks
  and executables.
- Rejects archive bombs using declared and expanded size limits and an entry
  count limit.
- Verifies CRC and the manifest, computes SHA-256 server-side and stores the
  build as an immutable object.
- Verifies `metadata.json` (`formatVersion`, entry, `appSha256`, per-file
  SHA-256/size), that `permissions.json` matches the manifest, and that every
  payload file is declared, has an allowlisted asset extension and lives under
  `assets/`.
- Rejects a version that already exists, and never executes uploaded content.
- The client only receives a short-lived URL (S3 presign or HMAC-signed
  `/api/miniapps/blob`); storage keys and internal paths stay private.
- The device repeats the checksum, manifest, metadata, path and permission
  checks after download and on every cached open; a modified cache is deleted.

## Native qapp SDK

`@mna/qchat` (in `packages/miniapp-framework`) is a deliberately small reactive
TSX runtime. It does not use React DOM and it does not render HTML: JSX becomes a
virtual tree that is sent over a JSON bridge and mapped to Flutter widgets.

```tsx
import { start, useState } from "@mna/qchat";
import { showToast } from "@mna/qchat/navigation";
import { Button, Text, View } from "@mna/qchat/ui";

function App() {
  const [count, setCount] = useState(0);

  return (
    <View style={{ flex: 1, padding: 24, gap: 12, justifyContent: "center" }}>
      <Text style={{ fontSize: 28, fontWeight: "bold" }}>Count: {count}</Text>
      <Button
        onPress={() => {
          setCount(count + 1);
          void showToast("+1");
        }}
      >
        Increment
      </Button>
    </View>
  );
}

start(App);
```

Components: `View`, `Row`, `Column`, `Text`, `Button`, `Pressable`, `Image`,
`Icon`, `TextField`, `Checkbox`, `Switch`, `Slider`, `ScrollView`, `ListView`,
`GridView`, `Stack`, `Positioned`, `Spacer`, `Divider`, `ActivityIndicator`,
`SafeArea`, `AnimatedView` and `CustomPaint`.

Hooks: `useState`, `useReducer`, `useRef`, `useMemo`, `useCallback`, `useEffect`
and `useLifecycle`. Hooks use global slots, so they must be called
unconditionally; conditional hooks are not supported. State updates re-render
the tree synchronously.

APIs:

- App: `getAppInfo`, `getSystemInfo`, `getUserInfo`, `chooseImage`, `share`.
- Navigation: `navigateTo`, `navigateBack`, `closeMiniApp`, `showToast`,
  `openExternal`.
- Storage: `getStorage`, `setStorage`, `removeStorage`, `createStorage`.
- Network: `request` (QChat read-only API), `fetch`, `fetchJson` (declared HTTPS
  hosts only).

Navigation is single-page. `navigateTo(path)` pushes an internal route and emits
the `navigate` lifecycle event with `{ path, depth }`; `navigateBack` pops it and
emits `back`. The host back button pops the internal route stack first, then
closes the mini app. `useLifecycle` also receives `resume`, `pause` and
`destroy`.

Build and inspect a project from the monorepo:

```sh
corepack pnpm qapp create my-app
corepack pnpm qapp dev --dir my-app
corepack pnpm qapp build --dir my-app
corepack pnpm qapp test --dir my-app
corepack pnpm qapp validate my-app/dist/my-app-1.0.0.japp
corepack pnpm qapp inspect my-app/dist/my-app-1.0.0.japp
```

`qapp build` runs a TypeScript check, bundles the TSX with esbuild for the
QuickJS target, embeds the runtime, hashes every file and writes
`dist/<slug>-<version>.japp`. The `hello-world` and `counter` examples in
`packages/miniapp-examples` are built this way; they are not hardcoded screens.

The framework is built with
`corepack pnpm --filter @mna/qchat build`; the root `qapp` script runs that
compiled CLI. Framework tests run with `corepack pnpm test:qapp`.

## Flutter runtime

1. Fetch app detail and the current build, including `format` and `sdkVersion`.
2. Reuse a verified cache entry or download the package with a 60 s timeout.
3. Enforce the 25 MB package limit, verify SHA-256, unzip into a staging
   directory with path/bomb/extension guards, validate the manifest, then rename
   into place.
4. Keep at most two versions per app for offline fallback and rollback.
5. Ask the user once per app for each declared permission and persist the
   decision. The runtime never receives a QChat access token.
6. Handle back, close, background/resume events, favorites, recent apps and
   telemetry.
7. Draw no host header: the mini app owns the whole screen and the host only
   floats a menu button and a close button over its top right corner. Reload and
   favorite live in that menu. `getSystemInfo()` reports `safeAreaTop` and
   `safeAreaBottom` so packages can keep their own content clear of the status
   bar, the navigation bar and the floating buttons.

The renderer:

1. Reads `app.js` and `assets/` from the verified cache directory. The native
   backend rejects traversal and oversized reads.
2. Creates a QuickJS runtime with `flutter_js`, XHR disabled and a 1 MB stack,
   installs the `globalThis.__qchatNative` JSON bridge, then evaluates `app.js`.
   Browser `fetch` and `XMLHttpRequest` do not exist; networking goes through the
   host.
3. JavaScript sends `{ id, method, params }` over a synchronous channel. The
   host answers asynchronously through `__qchatResolve(id, json)`, and pending
   promises are flushed with the QuickJS job queue.
4. The app renders a serialized virtual tree
   (`{ v, appId, revision, root }`). Dart validates node ids, component types,
   event names, tree depth and node count, then maps it to real Flutter widgets.
   No HTML is loaded and no WebView is created.
5. Press, input, change, submit and scroll events are sent back to JavaScript.
   A state update re-renders the tree synchronously and sends a new revision.
6. The first successful frame reveals the app; a JavaScript error or invalid
   tree reports `APP_LOAD_FAILED` and `runtime_error` telemetry instead of
   showing a blank screen.
7. Reload disposes the runtime and evaluates the bundle again. Back pops the
   internal route stack first and only then closes the mini app.

The renderer implements flex layout, spacing, colors, typography, borders,
radius, shadows, opacity, images, safe areas, scroll and grid views, stacks with
positioned children, simple animations and a declarative `CustomPaint` path
language. Arbitrary Dart or HTML is never accepted from the package.

## Local development

```sh
# backend
export DATABASE_URL=postgresql://qchat:...@127.0.0.1:5432/qchat_test
export JWT_SECRET=...
export WEB_ORIGIN=http://localhost:3000
export MINIAPP_STORAGE_DIR=$PWD/.tools/runtime/miniapps
export MINIAPP_SIGNING_SECRET=local-miniapp-secret
pnpm db:generate
pnpm db:migrate
pnpm dev

# native qapp framework and examples
corepack pnpm --filter @mna/qchat build
corepack pnpm test:qapp
corepack pnpm qapp build --dir packages/miniapp-examples/hello-world
corepack pnpm qapp build --dir packages/miniapp-examples/counter
```

The upload endpoint is multipart because the normal JSON limit is 128 KB.
`scripts/miniapps-smoke.mjs` exercises the whole backend flow (upload, bad
package, submit, approve, release, signed download, recent/favorites, telemetry,
API-key upload, rollback, revoke, suspend/restore and unauthorized access).

## Deployment

See `docs/DEPLOYMENT.md`. Set `MINIAPP_STORAGE_DIR` and
`MINIAPP_SIGNING_SECRET`, run the Prisma migrations `202610240002_mini_apps`,
`202610260001_qapp_format` and `202610260002_qapp_only_default`, and keep the
build storage in the private S3 bucket or on a persistent volume. Builds are not
reproducible from Git alone; back them up with the database.

## Verification status

- `corepack pnpm typecheck`, `corepack pnpm test` and
  `corepack pnpm test:qapp` pass in this repository. The framework/compiler
  checks include a tampered bundle, a declared `appId`, ZIP traversal, a legacy
  `schemaVersion: 1` package and the counter's host-event flow.
- `flutter analyze` reports no issues. Flutter tests cover qapp tree parsing,
  cache checksum/metadata/permission enforcement, native backend path guards,
  renderer components and events, plus storage and bridge tests.
- `packages/miniapp-examples/hello-world` and `counter` produce real `.japp`
  files through the compiler; `qapp inspect` confirms `schemaVersion: 2`,
  checksums and no `appId`.
- `qapp_js_runtime_test.dart` opens the compiled Hello World `.japp`, executes
  its `app.js` in the real QuickJS bridge, asserts the first frame, dispatches a
  button press and asserts the JS state update produced a second frame and a
  host `showToast` call. It runs on this Windows host and skips only when the
  native bridge library is unavailable.
- The backend validator, qapp-only persistence, raw preview branch and Prisma
  migrations compile and their unit tests pass. A live upload → review → release
  smoke run was not performed here because no PostgreSQL/server environment was
  available.
- Android/iOS device execution is still unverified: the runtime compiles and
  passes the host QuickJS test, but no emulator or physical device was
  available, and iOS requires macOS. Flutter web cannot run the qapp runtime
  because `flutter_js` has no web implementation; that target reports an
  unsupported path rather than silently falling back.
- The pre-existing golden test `reference_ui_test.dart` fails because its saved
  images predate the current renderer. It fails identically at clean `HEAD`
  (21.07% pixel diff), independently of the Mini App changes.
