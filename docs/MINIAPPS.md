# QChat Mini Apps

Mini Apps are small static web applications that run inside QChat. They are
built and uploaded by developers, reviewed by an administrator, released as
immutable ZIP packages, and opened by the Flutter client in an isolated WebView.
The platform is self-hosted: it does not use uniMP, DCloud, Alipay or any other
external mini-app runtime.

## Pieces

| Piece | Location | Responsibility |
| --- | --- | --- |
| Developer Center | `apps/developer/dashboard.tsx`, `/developer` | Dashboard, apps, builds, review console, permissions, API keys, analytics, team, docs |
| API | `apps/server/src/modules/miniapps.ts` | Store, developer, review and release endpoints |
| Storage | `apps/server/src/services/miniapp-storage.ts` | Immutable builds in private S3 or a signed filesystem adapter |
| Package validation | `apps/server/src/services/zip.ts`, `miniapp-package.ts` | ZIP and manifest security checks |
| SDK | `packages/miniapp-sdk` | `@qchat/miniapp-sdk` typed bridge client |
| Starter | `packages/miniapp-template` | React + Vite project and dependency-free ZIP packager |
| Runtime | `apps/mobile/lib/features/miniapps` | Download, verify, cache, loopback server, WebView bridge |
| Contracts | `packages/contracts/miniapps.ts` | Permissions, categories, manifest schema, API allowlist |

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
  → upload ZIP (multipart, max 20 MB)
  → build status UPLOADED (immutable)
  → submit for review (REVIEWING)
  → approve (APPROVED) or reject (REJECTED)
  → release (currentVersion changes, PUBLISHED)
  → rollback to an earlier approved version, or revoke a version
  → suspend / restore the whole app
```

Uploading is not releasing. A build is stored under
`miniapps/<appId>/<uuid>.zip`, with its version, SHA-256, size, manifest,
uploader and review state. Re-uploading the same version is rejected; publish a
new version instead.

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

## Developer API

The Developer Center talks to `/api/developer/...`, which authenticates the
cookie session and forwards to the same module. CI uploads directly to
`POST /api/miniapps/developer/apps/:appId/builds` with `X-QChat-Key: qk_...` and
a multipart `file` field.

| Method | Path |
| --- | --- |
| `GET` | `/api/miniapps/developer/dashboard` |
| `GET` | `/api/miniapps/developer/audit` |
| `GET` / `POST` | `/api/miniapps/developer/apps` |
| `GET` / `PATCH` | `/api/miniapps/developer/apps/:appId` |
| `GET` | `/api/miniapps/developer/apps/:appId/versions` |
| `POST` | `/api/miniapps/developer/apps/:appId/builds` (multipart) |
| `POST` | `/api/miniapps/developer/apps/:appId/versions/:version/submit` |
| `POST` | `/api/miniapps/developer/apps/:appId/versions/:version/release` |
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

## Package format

The ZIP must contain `qchat.manifest.json` at its root:

```json
{
  "schemaVersion": 1,
  "appId": "mp_0123456789abcdef",
  "name": "Demo",
  "description": "Optional",
  "version": "1.0.0",
  "entry": "index.html",
  "minRuntimeVersion": "1.0.0",
  "requestedPermissions": ["toast", "storage"],
  "buildHash": "optional and ignored"
}
```

`entry` is a relative HTML path. `version` must be semver and unique per app.
`requestedPermissions` may only contain:

| Permission | APIs |
| --- | --- |
| `toast` | `showToast` |
| `user.profile` | `getUserInfo`, `request("/users/me")`, `/friends` |
| `media.choose` | `chooseImage` |
| `share` | `share` |
| `storage` | `getStorage`, `setStorage`, `removeStorage` |
| `qchat.api` | `request("/conversations")` |

`getAppInfo`, `getSystemInfo`, `navigateTo` and `closeMiniApp` need no
permission. Declaring a permission is necessary but not sufficient: the Flutter
host checks the granted permission on every call.

### Upload checks

- 20 MB request limit and a real ZIP signature/central-directory check.
- Rejects absolute paths, `..`, backslashes, drive letters, NUL bytes, symlinks
  and executables.
- Rejects archive bombs using declared and expanded size limits and an entry
  count limit.
- Verifies CRC and the manifest, computes SHA-256 server-side and stores the
  build as an immutable object.
- Rejects a version that already exists, and never executes uploaded content.
- The client only receives a short-lived URL (S3 presign or HMAC-signed
  `/api/miniapps/blob`); storage keys and internal paths stay private.

## SDK

```ts
import { QChat } from "@qchat/miniapp-sdk";

await QChat.showToast("Hello");
const app = await QChat.getAppInfo();
const me = await QChat.getUserInfo(); // requires user.profile
await QChat.setStorage("counter", 1); // requires storage
```

Every method returns a promise, has a host timeout and rejects with a stable
`QChatError` code (`PERMISSION_DENIED`, `TIMEOUT`, `CANCELLED`,
`STORAGE_QUOTA_EXCEEDED`, `BRIDGE_UNAVAILABLE`, …). `dispose()` cancels every
in-flight call when the page closes.

Bridge protocol:

```js
window.QChatNative.postMessage(JSON.stringify({ id, method, params }));
// host:
window.__QChatReceive(JSON.stringify({ id, ok: true, result }));
window.__QChatReceive(JSON.stringify({
  id, ok: false, error: { code: "PERMISSION_DENIED", message: "…" },
}));
```

The Flutter bridge validates the request id, method allowlist, parameter schema,
declared permission, duplicate in-flight ids, rate limits and timeouts. It
executes privileged work natively. `QChat.request` is limited to `/users/me`,
`/friends` and `/conversations`; query strings are stripped before the check,
absolute URLs and `..` are rejected.

Storage is per app: at most 64 KB per value, 512 KB total and 128 keys. Values
are JSON. A different app cannot read another app's namespace.

## Flutter runtime

1. Fetch app detail and the current build.
2. Reuse a verified cache entry or download the ZIP with a 60 s timeout.
3. Enforce the 25 MB package limit, verify SHA-256, unzip into a staging
   directory with path/bomb/extension guards, validate the manifest, then rename
   into place.
4. Keep at most two versions per app for offline fallback and rollback.
5. Start a random `127.0.0.1:<port>` HTTP server for the unpacked assets. That
   origin isolates cookies, `localStorage` and IndexedDB per app; it also sends a
   strict CSP, `nosniff`, `no-referrer` and `frame-ancestors 'none'`.
6. Load the entry in a WebView with the `QChatNative` JavaScript channel. Only
   same-origin navigation is allowed; external links are blocked and must use
   `QChat.share`.
7. Ask the user once per app for each declared permission and persist the
   decision. The WebView never receives a QChat access token.
8. Handle back (WebView history, then close), close, background/resume events,
   favorites, recent apps and telemetry.

The runtime uses a host-side share sheet with copy-to-clipboard rather than a
native share plugin; this is intentional for the current dependency set.

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

# SDK
pnpm test:sdk

# starter (outside the monorepo, after copying packages/miniapp-template)
npm install
npm run build:miniapp
```

The upload endpoint is multipart because the normal JSON limit is 128 KB.
`scripts/miniapps-smoke.mjs` exercises the whole backend flow (upload, bad ZIP,
submit, approve, release, signed download, recent/favorites, telemetry,
API-key upload, rollback, revoke, suspend/restore and unauthorized access).

## Deployment

See `docs/DEPLOYMENT.md`. Set `MINIAPP_STORAGE_DIR` and
`MINIAPP_SIGNING_SECRET`, run the Prisma migration
`202610240002_mini_apps`, and keep the build storage in the private S3 bucket or
on a persistent volume. Builds are not reproducible from Git alone; back them
up with the database.

## Verification status

- Backend unit tests, full API smoke test, SDK tests and the Developer Center
  Playwright flow run in this repository.
- Flutter unit tests cover storage quotas, ZIP guards, checksum mismatch,
  cache/offline lookup, the loopback asset server, bridge permissions, schemas,
  duplicate ids, rate limits and disposal.
- Android WebView behavior has not been exercised on a physical device or
  emulator in this environment. iOS cannot be built or verified without macOS.
- The pre-existing golden test `reference_ui_test.dart` fails because its saved
  images predate the current renderer; it is unrelated to Mini Apps.
