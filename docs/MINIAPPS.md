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
| Native examples | `packages/miniapp-examples` | Hello World, counter, shell, env-demo, demo-kit, custom-kit, cafe and rap-pho built through the real compiler |
| Desktop IDE | `apps/miniapp-ide` | Tauri desktop Studio for editing, building, testing and inspecting qapp projects through the real CLI |
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
  "requestedPermissions": ["storage", "toast"]
}
```

- `entry` is always `app.js`; `format` is the internal format id `qapp`.
- Do not declare `appId`: the server assigns it from the app record.
- `metadata.json` records `formatVersion: 1`, the version, entry, `appSha256`
  and a `files` array of `{ path, sha256, size }`. Every payload file except
  `metadata.json` itself is listed. The device re-verifies these hashes and
  sizes on install and on every open.
- `permissions.json` repeats `requestedPermissions` and must match the manifest
  exactly.
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
| `network` | `fetch` to any HTTPS host |

`getAppInfo`, `getSystemInfo`, `navigateTo` and `closeMiniApp` need no
permission. Declaring a permission is necessary but not sufficient: the Flutter
host checks the granted permission on every call.

There is no host allowlist: once `network` is granted, `fetch` reaches any HTTPS
host. Requests are HTTPS-only (plain HTTP and URLs with embedded credentials are
rejected), redirects must stay on HTTPS, responses are capped at 1 MB, and the
host never attaches a QChat token.

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

Components: `View`, `Row`, `Column`, `Text`, `RichText`, `Link`, `Button`,
`Pressable`, `Image`, `Avatar`, `Icon`, `TextField`, `Checkbox`, `Switch`,
`Slider`, `ScrollView`, `ListView`, `GridView`, `Stack`, `Positioned`, `Spacer`,
`Divider`, `Badge`, `Tag`, `ActivityIndicator`, `SafeArea`, `AnimatedView`,
`CustomPaint`, `Modal`, `BottomSheet`, `Dialog`, `NavBar`, `TabBar` and `Page`.

`Text` renders a paragraph: `numberOfLines` truncates with an ellipsis and
`selectable` turns on native selection with a QChat copy bubble. `RichText` takes
`Text`, `Link` and plain strings as children and flattens them into one
paragraph, so mixed styles still wrap and align as a single run; it never
accepts HTML. `Link` draws an underlined label and reports `press` with
`{ type, href, external }`; an in-app `href` also goes through the host router
(the path is validated on the native side), while `external: true` only reports
the URL — opening another application is a privileged host API that is not wired
yet.

`Button` has `primary`, `secondary`, `outline`, `text` and `danger` variants,
`sm`/`md`/`lg` sizes, an optional `icon`, `loading` and `disabled`. `Divider`
takes `color`, `thickness`, `vertical` and a leading `inset`, and `Spacer`
clamps its `size` so a bad value cannot overflow the layout. `Badge` shows
`count` (capped at `max`, hidden at zero), a `dot`, or both over its `children`.
`Tag` has `neutral`, `success`, `warning`, `danger` and `info` tones, and
`Avatar` shows `src`, falls back to the initials of `name`, and is `circle` or
`rounded`.

Every component also honours the base props: `testID` becomes the widget key,
`accessibleLabel` becomes the semantics label, `pointerEvents: "none"` makes the
subtree ignore pointers, and `SafeArea` reads the real device insets (Flutter
consumes the padding it applies, so nesting it does not add the inset twice).

Hooks: `useState`, `useReducer`, `useRef`, `useMemo`, `useCallback`, `useEffect`,
`useLayoutEffect`, `useId`, `useLifecycle`, `createContext` and `useContext`.
Every component instance owns its own hook slots, keyed by its position in the
element tree plus its `key`, so a child component has real private state, a
keyed list keeps its state when it reorders, and `useEffect` cleanups run when a
child unmounts. All the `setState` calls made during one host event collapse
into a single render and a single revision sent to Dart. Hooks must still be
called unconditionally.

Events always arrive as one object so a handler can be written once:
`{ type, value, ... }`. `change`, `valueChange`, `submit` and `scroll` follow
this shape (`QappToggleEvent`, `QappNumberEvent`, `QappTextEvent`,
`QappScrollEvent`), and `press`, `longPress`, `close`, `confirm`, `back` and
`endReached` carry `{ type }`. `TextField.onInput` remains the low-level string
hook.

`Modal`, `BottomSheet` and `Dialog` are declarative: they render into the
current tree when `visible` is true and report `close`/`confirm`. `NavBar` and
`TabBar` are prebuilt screens: `NavBar` is built on the header standard below,
and `TabBar` takes a tab list plus the active tab and reports `change` with
`{ index, key, value }`. `TabBar.hideOnKeyboard` defaults to true: the host
shrinks the whole mini program when a field takes focus, so a bar that stayed
mounted would float in the middle of the screen right above the keys. The bar
comes back the moment the keyboard starts to retract, so it slides down with the
keys instead of popping in after they are gone (a 160 ms fade keeps the reveal
from flashing).

### The screen frame: `Page`

```tsx
<Page
  header={<NavBar title="Vé điện tử" showBack onBack={back} />}
  footer={<TabBar tabs={tabs} activeIndex={index} onChange={…} />}
  overlays={<Dialog visible={confirm} … />}
>
  <ScrollView>…</ScrollView>
</Page>
```

`Page` is the frame every page should use: the header is a sibling above the
body, the footer a sibling below it, and the body gets exactly the space they
leave. It cannot be written the wrong way round — a `NavBar` painted inside a
`Stack` over a `height: "100%"` scroller looks correct until the page scrolls
and the first card slides under the header, because the body starts at y = 0.

The body is pinned inside the stack, so it fills the page whether it is a
`ScrollView`, a `ListView` or a plain `View`. Overlays are painted over the
whole page, header included, which is what a dialog barrier needs. A page with
no header or footer is just the body across the full screen.

A page that wants its own artwork under the top edge (a poster hero, a
transparent header that turns solid on scroll) still builds the `Stack` by hand:
`<Stack style={{ flex: 1 }}><ScrollView style={{ height: "100%" }} … />
<NavBar transparent … /></Stack>`, and gives the content enough top padding to
clear the header. `rap-pho`'s movie and discover screens are that shape; its
ticket screen and `demo-kit`'s tab shell use `Page`.

`ListView`/`GridView` load themselves. A frame carries only a window of items —
`initialCount` (60 by default) — plus the total count, so a thousand rows never
travel in one frame. When the user scrolls near the end the host reports
`endReached`; the framework reveals the next window of the same size and calls
`onEndReached` as well, so an app that pages its own data can load more at the
same time. A list nested inside another scroller cannot scroll on its own and
therefore never reports `endReached`: give it a bounded height, or use a
`ScrollView` with plain children.

### Header standard

Every screen in QChat uses one header: `QChatHeader`
(`apps/mobile/lib/core/design_system/qchat_header.dart`).

- The bar is `kQChatHeaderHeight` (44) tall under the status bar. The title is
  centred on the screen, `leading` and `trailing` are centred vertically on the
  same line, so a title, an icon and the capsule share one baseline no matter
  which of them is present.
- The title keeps a symmetric inset of `max(reserveLeading, reserveTrailing)`, so
  it stays screen-centred even when the two controls have different widths.
- `bottom` adds rows under the bar inside the same surface: a search field, tabs,
  a banner, a picture, anything. The header grows downwards and scrolls with the
  page instead of floating over it.
- The surface is solid by default, glass with `blur`, or fully see-through with
  `transparent`, which is what a mini program needs when its own artwork runs
  under the top edge. `border` draws the hairline.

The mini program control is `QChatCapsule`: one 87×32 pill with `•••` on the
left, a hairline divider and `◎` on the right. It is a frosted surface, not a
solid white block: a translucent tint (white in light mode, dark grey in dark
mode) over a 12 pt blur, so the page behind it shows through. The two halves are
independent tap targets, each with its own semantics label; the pill is always
centred on the header bar.

`NavBar` is `QChatHeader` for Mini Apps: `title`, `subtitle`, `showBack`,
`safeArea`, `reserveRight`, `transparent`, `blur`, `border` and `children`. Its
`children` are the lower rows, not title content, so a search field, a tab strip
or a banner grows the header downwards. `transparent` draws no surface at all;
`blur` frosts what is behind the header; `transparent` wins when both are set.
`border` defaults to true for a solid or blurred surface, so a white header does
not blend into the first white card under it; `border={false}` removes the
hairline. `reserveRight` defaults to `kQChatCapsuleWidth + 14` (101) so the title
never slides under the capsule the host floats on the right.

### JavaScript environment (QuickJS)

QuickJS is an ECMAScript engine: it is not a browser and not Node. It has no
`console`, no timers, no `URL`, no `TextEncoder`, no `AbortController`, no
`structuredClone` and no `Intl`. The SDK ships those pieces and an app opts in
once:

```tsx
import "@mna/qchat/env/auto"; // everything, one line
// or, when the app wants the result and the options:
import { installEnv } from "@mna/qchat/env";
const installed = installEnv({ locale: "vi-VN" });
```

`installEnv()` returns which parts it installed (`timers`, `console`,
`structuredClone`, `url`, `encoding`, `abort`, `intl`), can be told to skip any
of them, and never overwrites a global that already exists, so calling it twice
is harmless. The polyfills live in separate esbuild modules with no top-level
side effect, so a bundle only carries what the app imports. Measured in this
repository: an app that never mentions the environment adds 0 bytes, the `Intl`
subset about 10 KB and the whole environment about 26 KB to `app.js` (minified,
before gzip).

The globals keep their web names and behaviour:

| Global | Notes |
| --- | --- |
| `console`, `print` | `log`/`info`/`warn`/`error`/`debug`/`trace`. Arguments are formatted onto one line, huge lines are truncated, and every call becomes a host log entry with its level and, for an `Error` argument, the stack. |
| `setTimeout`, `clearTimeout`, `setInterval`, `clearInterval` | delays are floored, `0` or a negative or non-finite delay means "as soon as possible", an interval is at least 1 ms |
| `requestAnimationFrame`, `cancelAnimationFrame` | run on the next host tick; the callback receives the frame time |
| `queueMicrotask` | runs in the same tick, before any timer |
| `structuredClone` | data only: objects, arrays, `Date`, `RegExp`, `Map`, `Set`, `ArrayBuffer` and typed arrays; cycles are preserved; functions, symbols and class instances throw a `DataCloneError` |
| `URL`, `URLSearchParams` | parse, resolve relative references, and keep `url.searchParams` in sync with `url.search` and back |
| `TextEncoder`, `TextDecoder` | UTF-8 only; any other label throws a `RangeError` |
| `AbortController`, `AbortSignal` | `abort(reason)`, `reason`, `throwIfAborted()`, `addEventListener("abort")`, `AbortSignal.abort()`, `AbortSignal.timeout(ms)` (which needs the timers) |
| `Intl.NumberFormat`, `Intl.DateTimeFormat` | the subset below; `Number.prototype.toLocaleString` and the three `Date.prototype.toLocale*` methods are routed through it |

Two budgets keep a runaway app from owning the frame: at most 512 timers are
scheduled at once, and one host tick runs at most 500 callbacks, so a 1 ms
`setInterval` cannot stall the UI. A timer that throws is reported as an `error`
log line instead of killing the app. A bundle that type-checks against
`lib: ["ES2020"]` and these globals is exactly the bundle the compiler accepts:
the SDK ships the declarations in `types/qchat-env.d.ts`, and `qapp build`, `qapp
test` and the Studio add them, so `setTimeout`, `console`, `URL`, `TextEncoder`,
`structuredClone` and `AbortController` type-check without a DOM lib. Adding
`"DOM"` to `lib` produces a warning instead of a silent mismatch.

#### Intl subset

QuickJS has no ECMA-402, so the SDK ships a small `Intl` for the two locales
QChat supports:

| | |
| --- | --- |
| Locales | `vi-VN` and `en-US`. An unknown locale throws a `RangeError` instead of quietly formatting in a language the user cannot read. |
| `Intl.NumberFormat` | `decimal`, `percent`, `currency` (`currencyDisplay: "symbol"` or `"code"`, minor units from the locale table), `notation: "compact"`, `minimum/maximumFractionDigits`, `minimumIntegerDigits`, `signDisplay`, `useGrouping`, `formatToParts`, `resolvedOptions` |
| `Intl.DateTimeFormat` | `dateStyle`/`timeStyle`, the component options (`weekday`, `year`, `month`, `day`, `hour`, `minute`, `second`), `hour12`, `timeZone: "UTC"`, `formatToParts`, `resolvedOptions` |

Only `UTC` (or nothing, which means the device zone) is accepted as a
`timeZone`: a named zone would need the full IANA database, and silently
formatting in the wrong zone is worse than an error. On an engine that already
has a native `Intl` (JavaScriptCore on iOS does) the native implementation is
kept unless `forceIntl: true` is passed to `installEnv()`.

Timers have no clock of their own inside QuickJS. The JavaScript side keeps the
queue and asks the host how long to wait with
`__qchatNative.send("timer", { delayMs })`, where a negative delay means
"nothing is pending any more". The host answers by calling
`globalThis.__qchatTickTimers(nowMs)`, which runs everything due at that
timestamp. Flutter implements that with one `Timer`; the Node test harness
implements it with a virtual clock, so timer tests never wait for real time.

## UI contract

The component list, props, events, style keys, enums and permissions are
declared once in `packages/contracts/miniapp-ui.contract.json`. From it,
`corepack pnpm contract:generate` writes the TypeScript runtime tables, the
TypeScript prop interfaces' compile-time check, the Dart whitelists
(`qapp_contract.generated.dart`), the Studio Monaco typings and
`docs/miniapp-ui-reference.md`. `corepack pnpm test:qapp` fails when a generated
file is stale, and the generated `ui-contract.typing.ts` fails the TypeScript
build when a hand-written interface and the contract disagree, so the four
sides cannot drift apart. Adding a component, prop, event, style key or
permission means editing the contract and regenerating.

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
`dist/<slug>-<version>.japp`. The slug is ASCII: Vietnamese names are
transliterated (`Cà Phê Nhà` → `ca-phe-nha`). The `hello-world`, `counter`, `shell`,
`demo-kit`, `custom-kit`, `env-demo`, `cafe` and `rap-pho` examples in
`packages/miniapp-examples` are built this way; they are not hardcoded screens.
`cafe` is the header showcase and the most complete product flow: four tabs
(menu, orders, offers, account), two internal routes (`/drink/:id`, `/legal`),
a transparent header over the hero that turns glass and then solid while
scrolling, a second header with a search field and filter chips as lower rows,
a cart sheet with a tip slider and a points checkbox, a confirm dialog, seeded
order history with reorder/cancel, voucher claiming persisted through storage,
`CustomPaint` sparkline, `Intl` money formatting and a `setInterval` countdown.
`rap-pho` is the second complete product app and the dark-theme counterpart:
a cinema ticket booking flow with four tabs (discover, movies, tickets, account)
and three internal routes (`/movie/:id`, `/ticket/:code`, `/legal`). It keeps 30
movies in memory but pages the `ListView` 12 at a time through `endReached`,
draws a 72-seat `GridView` (8 rows × 9 columns, VIP rows E/F) with
`initialCount={72}`, books through a payment sheet that requires the terms
checkbox, and lands on a ticket page whose 21×21 QR code is three layered
`CustomPaint` paths. Its header shows all three surfaces: transparent over the
hero poster, blurred after the first screen, solid after the second; the movies
tab stacks search, genre and status rows under the title. No image assets are
shipped — posters are gradients plus a title initial — so the whole package is
four files.
`shell` is the reference four-tab app:
it owns a `NavBar` header and a `TabBar`, keeps a `TextField` and a `Switch` on
the home tab, persists the switch through storage and renders a long `ListView`
on the discover tab. `demo-kit` is the playground template: five tabs (overview,
UI kit, form, host API, debug), a pushed `/detail/...` route, one button per host
method, a shared log store, timers, `console.log`, `Intl`, storage round-trips
and every component and style key the contract allows. `custom-kit` is the
opposite exercise: a dark "Aurora" app whose entire UI is hand-drawn from
`View`, `Text`, `Pressable`, `ScrollView`, `Stack`, `Positioned`, `SafeArea` and
`CustomPaint` — an owned header, an owned four-tab bar, a bottom sheet, an
in-app toast, gradient cards, a ring gauge and a sparkline, plus 24 icons stored
as path strings. It never uses `NavBar`, `TabBar`, `Button`, `Switch`,
`Checkbox`, `Slider`, `Dialog` or `Icon`, so it shows what a Mini App can look
like without the host design system. `env-demo` imports the whole environment
and puts it on screen: `Intl` in both locales, `URL`, `TextEncoder`,
`structuredClone`, an aborted `AbortController` signal and four timers a real
host tick has to run.

The framework is built with
`corepack pnpm --filter @mna/qchat build`; the root `qapp` script runs that
compiled CLI. Framework tests run with `corepack pnpm test:qapp`, which first
checks the generated UI contract artifacts.

## Desktop IDE

`apps/miniapp-ide` (`@qchat/miniapp-ide`) is a Tauri v2 desktop Studio. It is a
native shell around the same Node CLI, not a second compiler and not a WebView
host:

- Monaco edits TSX with the SDK typings and a `manifest.json` schema.
- Project creation, build, typecheck, runtime test, validate and inspect call
  `qapp` directly; the artifact stays `dist/<slug>-<version>.japp`.
- `prepare:cli` copies the whole built SDK — subdirectories included, so
  `@mna/qchat/env` is part of the bundle — and the QuickJS declarations
  (`qchat-env.d.ts`) into both `src-tauri/resources/types` and
  `src-tauri/resources/qapp/types`. The compiler looks in both places, and
  `tauri.conf.json` ships both, because a Studio that loses the declarations
  type-checks every `console` and `setTimeout` as `Cannot find name 'console'`.
  A Studio built before the SDK copy existed rejects `import "@mna/qchat/env/auto"`
  with `QChat SDK module not found: env/auto`; re-running `prepare:cli` (or
  reinstalling the Studio) is the fix for both.
- `qapp dev` runs in the background and streams logs and the exit code over
  Tauri events (`qapp-dev-log`, `qapp-dev-exit`).
- The device panel shows the manifest, permissions, size and SHA-256 of the
  package. It does not render the app: real rendering happens in the Flutter
  QuickJS runtime.

```sh
corepack pnpm --filter @mna/qchat build
cd apps/miniapp-ide
corepack pnpm prepare:cli      # CLI + esbuild + TypeScript resources
corepack pnpm tauri dev        # requires Rust and the Tauri system deps
```

`corepack pnpm dev` runs the UI in a browser for layout work; filesystem, CLI
and dev-watcher actions are disabled there. `prepare:cli -- --with-node` bundles
a Node runtime so installers do not require a system Node. CI
(`.github/workflows/miniapp-ide.yml`) builds NSIS, DMG and DEB/AppImage
installers. See `apps/miniapp-ide/README.md` for detection order and details.

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
7. Draw no host header: the mini app owns the whole screen. The host only
   floats the transparent variant of the header standard, whose sole trailing
   control is the `QChatCapsule` (menu and close) on the top right. Reload and
   favorite live in that menu. `getSystemInfo()` reports `safeAreaTop` and
   `safeAreaBottom` so packages can keep their own content clear of the status
   bar, the navigation bar and the capsule.

The renderer:

1. Reads `app.js` and `assets/` from the verified cache directory. The native
   backend rejects traversal and oversized reads.
2. Creates a QuickJS runtime with `flutter_js`, XHR disabled and a 1 MB stack,
   installs the `globalThis.__qchatNative` JSON bridge, then evaluates `app.js`.
   Browser `fetch` and `XMLHttpRequest` do not exist; networking goes through the
   host.
3. JavaScript sends `{ id, method, params }` over a synchronous channel. The
   host answers asynchronously through `__qchatResolve(id, json)`, and pending
   promises are flushed with the QuickJS job queue. Timers use the same channel
   the other way round: `send("timer", { delayMs })` asks the host to wake the
   engine after that delay, Dart sets one `Timer` for it, and the wake calls
   `globalThis.__qchatTickTimers(nowMs)`. A negative delay cancels the pending
   wake, and disposing the runtime cancels it too. While a finger is dragging or
   the list is still flinging the host parks that wake, so no timer callback runs
   JavaScript on the UI thread in the middle of the animation; the pending delay
   resumes when the list comes to rest.
4. The app renders a serialized virtual tree
   (`{ v, appId, revision, root }`). Dart validates node ids, component types,
   event names, style keys and enum values, tree depth and node count, then maps
   it to real Flutter widgets. No HTML is loaded and no WebView is created. The
   JSON frame is parsed and applied at paint time, and while the content is
   moving the newest frame is kept and painted once the list stops: a render that
   landed mid-gesture would otherwise rebuild the tree under the animation.
5. Press, input, change, submit and scroll events are sent back to JavaScript.
   A state update re-renders the tree synchronously and sends a new revision.
6. The first successful frame reveals the app; a JavaScript error or invalid
   tree reports `APP_LOAD_FAILED` and `runtime_error` telemetry instead of
   showing a blank screen.
7. Reload disposes the runtime and evaluates the bundle again. Back pops the
   internal route stack first and only then closes the mini app.

The renderer implements flex layout (direction, wrap, grow, basis, `alignSelf`,
`alignContent`, per-axis gaps), spacing, colors, typography (align, decoration,
letter spacing, line count, style, bundled families), per-edge borders, corner
radii, box shadows, gradients, opacity, `zIndex`, `overflow`, `min/max`,
`aspectRatio`, absolute positioning, images, safe areas, scroll and lazy list
and grid views, stacks with positioned children, `Modal`/`BottomSheet`/
`Dialog`, `NavBar`/`TabBar`, simple animations and a declarative `CustomPaint`
path language. A style object is validated against the contract: an unknown key
or an unsupported enum value rejects the frame instead of being ignored. Two
rendering rules follow from Flutter itself: an edge the app never gave a width
paints nothing (a `BorderSide.none`, not a hairline), and a per-edge border is
clipped inside the rounded box rather than handed to Flutter together with the
corner radius, because Flutter only accepts that combination while every visible
edge shares one colour. The
validator keeps its 4000-node, depth-64 frame budget, and the host still checks
the event name, the node id and every permission. Arbitrary Dart or HTML is
never accepted from the package.

### Layout rules

These are the rules the renderer guarantees; each one is covered by a test in
`apps/mobile/test/qapp_components_test.dart`.

- A `Pressable` is a `View` with a tap handler. `flexDirection`,
  `justifyContent`, `alignItems`, `gap` and `flex` apply to its children exactly
  as they do on a `View`, so a cell stays a row and a label centres inside its
  button. (It used to force a column, which stacked every row and pushed a `−`/`+`
  glyph into a corner.)
- An item of a wrapping flex (`flexWrap: "wrap"`) is sized by its own content, so
  a chip keeps the width of its label instead of taking the whole row.
- `alignSelf: "stretch"` fills the parent's cross axis whenever that axis is
  bounded; on an unbounded axis the item keeps its own size.
- `alignContent` positions the runs of a wrapping flex.
- A `ScrollView` reports `onScroll` while the finger moves (one event per ~60 ms
  or 24 px, whichever comes first) and always on settle, so a header that swaps
  its surface with the offset tracks the page instead of jumping a second later.
  While the list is moving, a scroll frame is only handed to JavaScript when no
  render is already waiting: a render frame is painted at rest anyway, and
  running a whole render on the UI thread for every scroll frame is what made a
  drag or a bounce past the edge stutter. The newest offset is delivered when
  the list stops, so the final state is exact.
- `TextField` reports `focus` and `blur`; `Modal.animationType` (`none`, `fade`,
  `slide`) runs once when the overlay mounts.
- A `ListView`/`GridView` reports `endReached` once per window: within 240 px of
  the end, or right after the first layout when the content is shorter than the
  viewport. The latch is released when the window grows or when the user scrolls
  back up, so a list that cannot grow never repeats the event.
- `elevation` maps to one soft shadow when no `boxShadow` is given.
- `flexShrink` is accepted but not applied: Flutter never squeezes a child on its
  own, so a row that does not fit overflows instead of compressing. Give the
  flexible child `flex: 1` (and `numberOfLines` on its text) to share the space.
- The app view shrinks by the keyboard inset while the keyboard is open, so a
  `TextField` near the bottom is scrolled into view instead of staying under the
  keys. The inset is a `Padding` that is always there, even at zero: swapping it
  for the bare child remounted the whole mini program the moment the keyboard
  appeared, so every field lost its focus node and needed several taps before it
  stayed open. A `TabBar` steps aside while the keys are up
  (`hideOnKeyboard`, on by default) instead of floating above them, and returns
  as soon as the inset starts shrinking so it rides down with the keyboard.


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
corepack pnpm contract:generate        # regenerate typings from the UI contract
corepack pnpm --filter @mna/qchat build
corepack pnpm test:qapp
corepack pnpm qapp build --dir packages/miniapp-examples/hello-world
corepack pnpm qapp build --dir packages/miniapp-examples/counter
corepack pnpm qapp build --dir packages/miniapp-examples/shell
corepack pnpm qapp build --dir packages/miniapp-examples/demo-kit
corepack pnpm qapp build --dir packages/miniapp-examples/env-demo
corepack pnpm qapp build --dir packages/miniapp-examples/cafe
corepack pnpm qapp build --dir packages/miniapp-examples/rap-pho

# desktop Studio (requires Rust; browser-only UI: corepack pnpm dev)
cd apps/miniapp-ide
corepack pnpm prepare:cli
corepack pnpm tauri dev
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
- `corepack pnpm test:qapp` first runs `contract:check`, and the framework tests
  assert that the TypeScript runtime, the generated Dart whitelists and the
  Studio typings share one component, event, style and permission list. Adding a
  component or style key to only one side fails the run. `ui-contract.typing.ts`
  fails `pnpm typecheck` if a hand-written interface drifts from the contract.
- The hook and component suites run the compiled bundle through the same
  synchronous render/dispatch loop the device uses: child-owned state, effect
  cleanup on unmount, keyed reordering, context, layout effects, `useId`, event
  batching, the standardized event payloads, the new components and the
  `ListView` window. `shell` typechecks and packs through the real compiler.
- The Flutter side of this change (the style parser and renderer, the new
  components, the timer wake in `qapp_js_runtime_native.dart` and
  `apps/mobile/test/qapp_style_test.dart`, `qapp_components_test.dart` and the
  new timer case in `qapp_js_runtime_test.dart`) was written on a host without a
  Dart or Flutter SDK, so it was never compiled or run on that host.
  `.github/workflows/flutter.yml` is the authority: it runs `flutter analyze`
  and `flutter test` on Flutter 3.47.7. Its first run reported two analyzer
  errors (the flex child wrapper inferred as `_QappNodeView`) and five widget
  test failures; all seven are addressed here, but the fixes have not been
  re-run locally for the same missing-SDK reason. The timer case is the
  end-to-end one: it runs the compiled `env-demo` `.japp` in the real QuickJS
  bridge and expects the app's own `Timer` to wake the engine and reach
  `Timers: early,late` and `Ticks: 3`; it skips when the bundle or the flutter_js
  bridge library is missing, like the existing Hello World test.
- Flutter tests cover qapp tree parsing, cache checksum/metadata/permission
  enforcement, native backend path guards, renderer components and events, plus
  storage and bridge tests. `flutter analyze` was last run before the qapp work,
  so its clean result does not cover the Dart files added or changed since.
- Phase 1 (text, links, buttons, dividers, spacers, badges, tags, avatars and the
  base props) adds `primitives.test.ts`, which builds a real `.japp` through the
  compiler and runs it in the runtime: it asserts every new node type and prop,
  that an in-app `Link` asks the host router for its path, and that an external
  `Link` never does. The suite passes, `node_modules/typescript/bin/tsc
  --noEmit` is clean and `flutter analyze --no-pub` reports no issues. The new
  Flutter widget cases in `qapp_components_test.dart` pass locally (20/20 in
  that file). A full `flutter test` run has one pre-existing failure that this
  work does not touch: `reference_ui_test.dart` compares goldens on Windows
  only, and its committed PNGs predate the Material removal (`34af6e8`), so
  they show the old search field. The same test also hits
  `MissingPluginException` for the `record` plugin, which has no
  implementation in a host test binary. CI runs on Linux, skips the golden
  comparison and does not load that plugin, so both stay green there.
- The header standard is covered by `apps/mobile/test/qchat_header_test.dart`
  (capsule size, both halves tapping, one semantics button per half, the frosted
  translucent fill, the dot and ring geometry, title centred on the capsule
  line, a `bottom` row starting at 44, and the solid/glass/transparent surfaces)
  and by the `NavBar` cases in `qapp_components_test.dart` (centred title,
  children as lower rows, no surface when `transparent`, the glass surface when
  `blur`, and the default hairline of a solid surface). `components.test.ts`
  asserts that `transparent`, `blur` and `border` survive the compiler and the
  runtime. The same file covers the layout rules above: a `Pressable` row keeps
  its direction and `spaceBetween`, a glyph centres inside a fixed button, a
  wrapping row keeps each chip at its content width, `alignSelf: stretch` fills
  the cross axis, a `ScrollView` reports its offset mid-drag, `TextField`
  reports focus/blur and a `Modal` honours `animationType`. The windowed lists
  are covered on both sides: `components.test.ts` grows a `ListView` window on
  `endReached` and checks the app callback still runs, and
  `qapp_components_test.dart` checks the host reports `endReached` once per
  window, after the first layout of a list shorter than its viewport, and again
  for the next window.
  `qapp_components_test.dart` passes 36/36, `qchat_header_test.dart` 9/9, the
  framework suite 51/51 (including the Vietnamese package-slug test and the new
  `page.test.ts`), `tsc --noEmit` and `flutter analyze --no-pub` are clean. The
  three UI bugs reported after `rap-pho` have a regression test each: the keyboard
  inset keeps the focused field mounted (element identity, focus retained), a
  `TabBar` steps aside for the keyboard and can opt out, and a page body sits
  between the header and the footer instead of starting under the header.
  The `cafe` example
  builds, validates and passes `qapp test` (215 nodes, real cart → order →
  history flow checked with the harness). The `rap-pho` example builds,
  validates and passes `qapp test` (357 nodes); its harness test pages the movie
  list from 13 to 25 rows, opens a poster, picks a showtime and a free seat,
  accepts the terms and asserts the new ticket `RP4790` on `/ticket/:code`.
- The JavaScript environment runs in a real QuickJS engine in
  `packages/miniapp-framework/test/env-quickjs.test.ts`: the same bundle the
  device executes, with only `__qchatNative` and the timer protocol injected,
  reporting its `Intl`, `URL`, `TextEncoder`/`TextDecoder`, `structuredClone`,
  `AbortController`, `console` and timer results back over the host log channel.
  The environment demo app renders, updates through timers and is re-rendered
  from a real host tick in that engine. Timers are driven by a virtual clock, so
  the assertions are exact instead of timing-dependent.
- Environment size is measured, not assumed: `env-bundle.test.ts` bundles a
  fixture with no environment import, one that installs only `Intl` and one that
  installs everything, asserts which polyfills are present by their own error
  strings (`0` / `intl` / all seven) and prints the cost (about 10 KB for the
  `Intl` subset, 26 KB for the whole environment). A second fixture proves the
  same source does not compile without the SDK declarations while `qapp
  build`'s check accepts it with `lib: ["ES2020"]` and no DOM, and that adding
  the DOM lib is reported as a warning rather than silently accepted.
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
- The Studio frontend typechecks and builds (`typecheck`, `build:web` — the
  latter needs a raised `NODE_OPTIONS=--max-old-space-size`, the monaco chunk
  does not fit the default heap), and its bundled CLI resources compile
  `hello-world` into a real `.japp`. The packaged resources were exercised the
  way the Studio runs them: `prepare:cli`, then `create` and `build` of a
  scaffolded project through `apps/miniapp-ide/src-tauri/resources/qapp/cli.js`,
  which type-checks and packs a 14.5 KB `.japp` whose entry imports
  `@mna/qchat/env/auto`. `cargo check`, `tauri dev` and
  installer builds were not run locally because this host has no Rust toolchain;
  `.github/workflows/miniapp-ide.yml` performs those builds on Windows, macOS and
  Linux.
- Android/iOS device execution is still unverified: the runtime compiles and
  passes the host QuickJS test, but no emulator or physical device was
  available, and iOS requires macOS. Flutter web cannot run the qapp runtime
  because `flutter_js` has no web implementation; that target reports an
  unsupported path rather than silently falling back.
- The pre-existing golden test `reference_ui_test.dart` fails because its saved
  images predate the current renderer. It fails identically at clean `HEAD`
  (21.07% pixel diff), independently of the Mini App changes.
