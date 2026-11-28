# ADR 019 — iOS Service Runtime (JavaScriptCore)

- **Status:** ACCEPTED (the host is written in M7 module 6; the macOS build and
  every device claim are still open)
- **Date:** 2026-11-28
- **Milestone:** M8 (host module 6)
- **Implements:** the iOS half of ADR 009. Refines ADR 009's engine note and
  ADR 017's channel and envelope contract, which stay Android-specific in their
  build and JNI details.

## Context

ADR 009 chose QuickJS for Android and JavaScriptCore for iOS behind one engine
interface. Host module 4 wrote the Android side (`packages/qchat_miniapp_quickjs`
with the vendored QuickJS build and the `qchat/miniapp/service` channel). Module 6
is the iOS side: a Mini App's service code must run in an isolated JavaScript
engine on an iPhone, never in the page `WKWebView`, and the Dart API
(`QjsRuntime`) must not branch on the platform.

iOS has no way to ship QuickJS for free: a native engine would be a second build
system, a second set of ABIs and a larger IPA. JavaScriptCore is a system
framework, so the IPA carries no engine of its own and the app links only
`JavaScriptCore`.

Three properties of JavaScriptCore shape the decision:

1. There is **no public heap or stack ceiling**. `JSContext` exposes no
   equivalent of `JS_SetMemoryLimit` or `JS_SetMaxStackSize`.
2. There is **no interrupt handler**. `JSContext.evaluateScript` cannot be
   stopped from outside; `JSContextGroup` offers no public timeout either.
3. A `JSContext` may be used from any thread, but not by two threads at once.

## Decision

### 1. Module and channel

`packages/qchat_miniapp_quickjs/ios/qchat_miniapp_quickjs` is a Swift package
(`Package.swift`, iOS 15, links `JavaScriptCore`) that Flutter registers through
Swift Package Manager. The plugin class is `QchatQuickjsPlugin`, the same name
the Android entry declares, so `pubspec.yaml` has one plugin class per platform.

The channel is the same `qchat/miniapp/service` with the same three methods:

| Method | Arguments | Reply |
|---|---|---|
| `create` | `memoryLimitBytes`, `stackSizeBytes` | the runtime id |
| `eval` | `runtimeId`, `source`, `filename`, `timeoutMs` | the JSON envelope |
| `destroy` | `runtimeId` | `null` |

`SERVICE_INVALID_REQUEST` is the only channel error, as on Android. A thrown
script is a successful channel call with `ok: false`; only a malformed request
fails the channel.

### 2. Envelope

The envelope is byte-compatible with ADR 017:

```
{"ok":true,"result":<json>}
{"ok":false,"error":{"name":"...","message":"...","stack":"..."}}
```

- `JSON.stringify` is captured from the fresh context **before** any Mini App
  script runs, so a script that replaces `JSON.stringify` cannot change how its
  own result is encoded.
- `undefined`, a function or a symbol have no JSON form: the reply is
  `result: null`, matching `JS_JSONStringify` returning `undefined` on Android.
- A cycle, a `BigInt` or a throwing getter is `TypeError: The result cannot be
  represented as JSON.`, matching `JS_JSONStringify` failing on Android.
- A thrown value reports `name`, `message` and `stack` from the exception object;
  a thrown primitive has no such properties, so it becomes
  `Error: The script threw an error.` with an empty stack, exactly like the JNI
  `js_string_property` path.

### 3. One context, one queue

`MiniAppJSRuntime` owns one `JSContext` and one serial `DispatchQueue`
(`qchat-jsc`). Creating, evaluating and releasing happen on that queue, so the
Dart side may call from any isolate. JavaScriptCore's own locking would allow
more, but one queue keeps the lifetime rules identical to the Android
`qchat-qjs` thread and removes a whole class of races.

### 4. Limits

`create` accepts `memoryLimitBytes` and `stackSizeBytes` and validates that they
are positive, because the contract is shared. **iOS cannot enforce either**: the
values are recorded in the reply path but not applied. This is a documented
capability gap, not a silent fallback; the Dart doc says so and the device
evidence for heap behaviour stays `BLOCKED`.

### 5. Timeout and poisoning

JavaScriptCore cannot interrupt a running script, so the timeout is enforced on
the channel side:

- `eval` schedules a timer for `timeoutMs` and submits the evaluation to the
  runtime queue.
- Whichever finishes first settles the call exactly once. If the timer wins, the
  reply is `TimeoutError: The script exceeded its time limit.` (the Android
  message) and the runtime is **poisoned**.
- A poisoned runtime reports `TimeoutError: The runtime exceeded a time limit and
  was discarded. Create a new runtime.` for every later `eval` instead of running
  code. The abandoned script keeps its context alive until it returns; `destroy`
  removes the runtime and replies at once, and the context is released on the
  queue when that script finally ends.
- Android keeps the runtime usable after an interrupt because
  `JS_SetInterruptHandler` stops the script. The difference is deliberate: on
  iOS the alternative would be to keep accepting work into a context that may
  never become idle.

The caller closes a timed-out runtime and creates a new one. A never-returning
script therefore costs one leaked context, not a permanently blocked channel.

### 6. Lifecycle

`MiniAppServiceHost` owns the runtime table for the engine and closes every
runtime in `dispose()`. `QchatQuickjsPlugin.detachFromEngine` calls it, so a hot
restart does not leave a `JSContext` behind. Replies from the timer and from the
evaluation are posted to the platform thread before `FlutterResult` is called.

### 7. Dynamic-code parity gap

The Node adapter (`packages/miniapp-service-runtime`) evaluates with
`codeGeneration: { strings: false, wasm: false }`, and its contract test asserts
that `eval` and `new Function` fail. Neither native engine currently removes
those globals: Android's JNI has no bootstrap step and JavaScriptCore exposes the
default context. `eval`/`Function` therefore still work on device.

This is a defense-in-depth gap, not a sandbox escape: the context has no host
objects, no filesystem, no network and no bridge, and `connect-src 'none'`
keeps the page side offline. It is recorded here, in `docs/compatibility.md` and
in `STATUS.md`, and closing it is a later engine-bootstrap task for both
platforms, not a claim of parity.

## Consequences

- Dart has one API (`QjsRuntime`) and one envelope parser for both platforms.
  The iOS plugin adds no Dart dependency and no native engine to the IPA.
- The macOS CI job proves the Swift package compiles and links. That is
  `VERIFIED` for "builds" only; evaluation, timeout, poisoning and memory
  behaviour on a real iPhone stay `UNVERIFIED`/`BLOCKED`.
- Memory and stack limits are contract-only on iOS. If a hard ceiling becomes a
  requirement, the options are a `JSC` C API wrapper with a custom allocator or
  shipping QuickJS on iOS; both are larger changes than this module.
- The spike's timeout script is a bounded busy loop, so the abandoned iOS thread
  exits on its own instead of spinning until the process ends.
- `eval`/`Function` parity with the Node adapter remains open on both native
  engines (section 7).

## Evidence

- `packages/qchat_miniapp_quickjs/ios/qchat_miniapp_quickjs/Package.swift` — the
  Swift package Flutter looks for.
- `Sources/qchat_miniapp_quickjs/MiniAppServiceEnvelope.swift` — the shared
  envelope, defaults and `TimeoutError` messages.
- `Sources/qchat_miniapp_quickjs/MiniAppJSRuntime.swift` — the context, the
  `qchat-jsc` queue, `JSON.stringify` capture, timeout and poisoning.
- `Sources/qchat_miniapp_quickjs/MiniAppServiceHost.swift` — the channel methods
  and request validation.
- `Sources/qchat_miniapp_quickjs/QchatQuickjsPlugin.swift` — registration and
  `detachFromEngine`.
- `packages/qchat_miniapp_quickjs/lib/src/qjs_runtime.dart` — the Dart contract
  and the documented differences.
- ADR 009 (engine choice), ADR 017 (Android build, JNI and envelope),
  ADR 018 (iOS page host).
