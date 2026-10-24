# @qchat/miniapp-sdk

Typed JavaScript bridge for QChat Mini Apps. Every method returns a Promise,
has a timeout and rejects with a stable `QChatError` code.

The SDK never receives a QChat access token. The Flutter host validates the
manifest permissions and performs every privileged action (profile, media,
sharing, QChat API calls, storage) on the native side.

## Install

```bash
npm install @qchat/miniapp-sdk
```

Mini Apps are built as static assets and uploaded as a ZIP. The ZIP must contain
`qchat.manifest.json` at its root.

## Quick start

```ts
import { QChat, QChatError } from "@qchat/miniapp-sdk";

await QChat.showToast("Hello from my Mini App");

const app = await QChat.getAppInfo();
const system = await QChat.getSystemInfo();

try {
  const me = await QChat.getUserInfo(); // requires user.profile
  document.querySelector("#name")!.textContent = me?.nickname ?? "Guest";
} catch (error) {
  if (error instanceof QChatError && error.code === "PERMISSION_DENIED") {
    // The host did not grant user.profile.
  }
}
```

## Manifest

```json
{
  "schemaVersion": 1,
  "appId": "mp_0123456789abcdef",
  "name": "Demo",
  "version": "1.0.0",
  "entry": "index.html",
  "minRuntimeVersion": "1.0.0",
  "requestedPermissions": ["toast", "storage"]
}
```

`buildHash` is optional and ignored on upload: the server computes the SHA-256
of the ZIP and returns it with the build.

## Permissions

| Permission     | APIs                                             |
| -------------- | ------------------------------------------------ |
| `toast`        | `showToast`                                      |
| `user.profile` | `getUserInfo`, `request("/users/me")`, `/friends` |
| `media.choose` | `chooseImage`                                    |
| `share`        | `share`                                          |
| `storage`      | `getStorage`, `setStorage`, `removeStorage`      |
| `qchat.api`    | `request("/conversations")`                      |

`getAppInfo`, `getSystemInfo`, `navigateTo` and `closeMiniApp` need no
permission. The host still checks every call: declaring a permission in the
manifest is necessary but not sufficient.

## API

| Method                        | Result                    | Notes                                  |
| ----------------------------- | ------------------------- | -------------------------------------- |
| `getAppInfo()`                | `AppInfo`                 | app id, version, runtime, permissions  |
| `getUserInfo()`               | `UserInfo \| null`        | requires `user.profile`                |
| `showToast(message, options)` | `void`                    | max 200 characters                     |
| `chooseImage(options)`        | `ChosenImage`             | data URL, never a local file path      |
| `share(payload)`              | `{ shared: boolean }`     | text and/or HTTPS URL                  |
| `navigateTo(path)`            | `void`                    | same-origin relative path only         |
| `closeMiniApp()`              | `void`                    | returns to the QChat store             |
| `request(path, options)`      | `T`                       | allowlisted QChat API paths only       |
| `getStorage(key)`             | `T \| null`               | per-app namespace, JSON values         |
| `setStorage(key, value)`      | `void`                    | max 64 KB per value, host quota        |
| `removeStorage(key)`          | `void`                    |                                        |
| `getSystemInfo()`             | `SystemInfo`              | platform, locale, theme, screen, insets |

`QChat.request` currently allows only:

- `/users/me` — requires `user.profile`
- `/friends` — requires `user.profile`
- `/conversations` — requires `qchat.api`

The host strips query strings when checking the allowlist and rejects absolute
URLs, `..` segments and non-GET/POST/PUT/PATCH/DELETE methods.

## Errors

```ts
type QChatErrorCode =
  | "BRIDGE_UNAVAILABLE"
  | "TIMEOUT"
  | "CANCELLED"
  | "PERMISSION_DENIED"
  | "INVALID_ARGUMENT"
  | "NOT_SUPPORTED"
  | "NOT_FOUND"
  | "STORAGE_QUOTA_EXCEEDED"
  | "NETWORK_ERROR"
  | "HOST_ERROR";
```

Default timeouts: 15 s for most calls, 20 s for `request`, 60 s for
`chooseImage`. `dispose()` rejects every in-flight call with `CANCELLED`; the
host calls it when the Mini App closes.

## Bridge protocol

The host injects:

```js
window.QChatNative = {
  postMessage(json) {
    /* native channel */
  },
};
```

The SDK sends `{ id, method, params }` and listens for
`window.__QChatReceive(json)` with one of:

```json
{ "id": "…", "ok": true, "result": {} }
{ "id": "…", "ok": false, "error": { "code": "PERMISSION_DENIED", "message": "…" } }
```

A `qchat:message` `CustomEvent` with the same payload is also accepted. This
protocol is intentionally small so the Flutter WebView bridge can validate
request ids, schemas, permissions and timeouts without exposing native objects.

## Development

```bash
npm run typecheck
npm test
npm run build
```

The package is ESM-only and targets modern WebViews. Bundle it with Vite,
esbuild or another bundler; it is not intended to be imported directly by Node
at runtime.
