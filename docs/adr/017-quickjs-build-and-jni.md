# ADR 017 — QuickJS build and JNI boundary

- **Status:** ACCEPTED (the native evaluation itself is `UNVERIFIED` until it
  runs on a device)
- **Date:** 2026-11-28
- **Milestone:** M2 host module 4
- **Refines:** ADR 009 (engine choice). The "pinned by commit" packaging note
  becomes "pinned by upstream release and SHA-256"; the engine choice and the
  limits are unchanged.

## Context

ADR 009 chose QuickJS for the Android Service Runtime and JavaScriptCore for
iOS, behind one engine interface. Host module 4 is the first real Android build:
until now `packages/miniapp-service-runtime` only ran in Node.

The build has to satisfy three constraints:

1. **Three ABIs.** Flutter ships `arm64-v8a`, `armeabi-v7a` and `x86_64`; the
   emulator and old phones are not optional test targets.
2. **No build-time surprise.** A `FetchContent`/`file(DOWNLOAD)` step makes every
   ABI configuration depend on `bellard.org`. The CI job that builds the debug
   APK must be reproducible and must work offline once the repo is cloned.
3. **One thread per runtime.** QuickJS is not thread safe. A `JSRuntime` must be
   created, evaluated and freed on the same thread, and the Dart side may call
   from any isolate.

## Decision

### Source

Vendor the upstream release **2026-06-04** under
`packages/qchat_miniapp_quickjs/android/src/main/cpp/quickjs/`.

- Tarball: `https://bellard.org/quickjs/quickjs-2026-06-04.tar.xz`
- SHA-256: `b376e839b322978313d929fd20663b11ba58b75df5a46c126dd19ea2fa70ad2a`
- License: MIT, `LICENSE` is part of the vendored tree.
- Only the interpreter is built: `quickjs.c`, `dtoa.c`, `libregexp.c`,
  `libunicode.c`, `cutils.c`. The CLI (`qjs.c`, `qjsc.c`), the test262 runner
  and `quickjs-libc.c` (the POSIX file/OS layer) are not compiled, because the
  service runtime must not expose either.

`VENDORED.md` in that directory records the origin, the hash and the exact file
list. Updating QuickJS is a straight replacement of those files plus a CI build;
there are no local patches to rebase.

### Build

`android/build.gradle.kts` declares `ndkVersion = "28.2.13676358"` (the same
version Flutter 3.47 pins for the app module, so one NDK serves both) and
`abiFilters` for the three ABIs. CMake builds `libqchat_quickjs.so` from
`qjs_jni.c` and the vendored sources with `-fwrapv`, `_GNU_SOURCE` and
`CONFIG_VERSION`. `libm` and `liblog` are the only system libraries.

### JNI boundary

`qjs_jni.c` exposes exactly three methods on
`com.qchat.miniapp.quickjs.QjsRuntime`:

| Method | Contract |
|---|---|
| `nativeCreate(memoryLimitBytes, stackSizeBytes)` | Allocate one `JSRuntime`/`JSContext`, set `JS_SetMemoryLimit`, `JS_SetMaxStackSize` and the interrupt handler. Returns `0` on failure; the Kotlin constructor throws. |
| `nativeEval(handle, source, filename, timeoutMs)` | Evaluate as a global script and return a JSON envelope. `JS_SetInterruptHandler` stops the script at the deadline. |
| `nativeDestroy(handle)` | Free the context, the runtime and the handle. |

The envelope keeps a script error distinct from a channel error:

```json
{"ok":true,"result":<json or null>}
{"ok":false,"error":{"name":"...","message":"...","stack":"..."}}
```

A thrown script, a timeout (`TimeoutError`), a non-serializable result
(`TypeError`) and an out-of-memory `InternalError` are all `ok:false` with a
successful channel reply. Only a broken runtime makes the channel fail.

JNI strings are UTF-16 while QuickJS is UTF-8. `qjs_jni.c` converts in both
directions instead of using `GetStringUTFChars`, whose CESU-8 output would turn
surrogate pairs into replacement characters.

### Kotlin and Dart

- `QjsRuntime` owns one `Executors.newSingleThreadExecutor()` named `qchat-qjs`
  and submits create/eval/destroy to it. `evalAsync` lets the channel return
  without blocking the platform thread; the reply is posted to the main looper.
- `MiniAppServiceChannel` (`qchat/miniapp/service`) owns a runtime registry and
  frees every runtime when the engine detaches. Unknown ids and non-positive
  limits are `SERVICE_INVALID_REQUEST`, a failed allocation is
  `SERVICE_START_FAILED`.
- `packages/qchat_miniapp_quickjs/lib` exposes `QjsRuntime.create`, `eval` and
  `close`, plus `QjsEvalResult`/`QjsError`. It contains no UI.
- Limits: 64 MiB heap, 1 MiB stack, 2 s default evaluation budget.

Module 4 deliberately adds **no host objects**. `wx.*`, `setData`, timers and
storage are bound in a later module through the ADR 010 channel; until then the
context sees only the ECMAScript builtins.

## Consequences

- The app grows by the three `.so` files. The exact per-ABI size is
  `UNVERIFIED` until the CI artifact is measured; it is recorded in
  `docs/compatibility.md` when a build exists.
- A new upstream release is a manual vendoring step. That is the price of a
  build that does not depend on a third-party host at configure time.
- The engine runs on its own thread, so a script cannot freeze the platform
  thread; a script that ignores the interrupt handler still stops at the
  deadline because QuickJS checks the handler between bytecodes.
- `System.loadLibrary` happens on first `QjsRuntime` construction, not in a
  companion initializer, so JVM unit tests that only read constants do not try
  to load an Android library.
- Device evidence (eval, timeout, memory limit, per-ABI size) stays
  `UNVERIFIED`/`BLOCKED` until the CI debug APK runs on a phone.
- The iOS half of the same channel is JavaScriptCore and is recorded in
  ADR 019. The envelope and method names here are the shared contract; the JNI,
  the vendored sources and the interrupt-based timeout are Android-only.

## Evidence

- Upstream tarball and license, downloaded 2026-11-28; SHA-256 above.
- `packages/miniapp-service-runtime` already runs the same SDK code on Node; the
  engine interface is unchanged.
- Build evidence: the Linux `Build debug APK and test the WebView host` job.
  A green build is `VERIFIED` for "the three ABIs compile and package", never
  for runtime behaviour.
