# ADR 009 — Service Runtime engine

- **Status:** ACCEPTED (device measurement `BLOCKED`)
- **Date:** 2026-11-27
- **Milestone:** M1
- **Supersedes:** nothing. Amends the engine note in ADR 001.

## Context

Section 4.1 requires an isolated JavaScript engine for the Service Runtime and an
explicit comparison of the Android options (QuickJS, V8, a platform sandbox),
covering isolation, performance, size, debugging, maintenance and license. The
same external contract must serve iOS in M8. Mini App logic must never run in
the View WebView (section 0.1 item 4), must not reach host files, credentials,
databases or native objects, and must provide the synchronous storage variants
of section 8.

The environment has no Android SDK, no NDK toolchain and no device, so this ADR
records the architectural decision and the documented evidence. Build size and
startup/`setData` timings are `BLOCKED` until M2 has a build and M6 has the
reference phone (section 9.1).

## Options

| Option | Isolation | Performance | Size | Debugging | Maintenance | License |
|---|---|---|---|---|---|---|
| **QuickJS** (embedded C interpreter) | Strong: no DOM, no host objects; explicit memory and stack limits | Interpreter, no JIT; adequate for page logic; exact numbers `BLOCKED` | Upstream describes a small interpreter (roughly a few hundred KiB per ABI); exact `.so` size `UNVERIFIED` until M2 | No Chrome DevTools; needs a QChat inspector over the bridge (M10) | Small upstream, slow release cadence; vendored source pinned by commit | MIT |
| **V8** | Strong if embedded, but a large API surface to restrict | JIT, fastest for heavy scripts | Large (tens of MB per ABI) | Excellent (Inspector protocol) | Very active, large security surface | BSD-3-Clause |
| **Platform sandbox: a second, hidden WebView** | Medium: another WebView process, but its own bridge and lifecycle; the boundary is easy to blur with the view | JIT where the platform allows it | No extra native binary | WebView debugging | Platform-owned | Platform terms |
| **JavaScriptCore** | Strong as a standalone context | Interpreter/JIT depending on platform | On iOS it is a system framework; bundling it on Android is large | Limited on iOS | Apple-owned | LGPL-2.1 (WebKit) |

Two platform facts decide the cross-platform answer:

1. **iOS does not allow a third-party JIT.** A JIT engine (V8, or JSC with JIT)
   cannot be shipped for iOS outside WebKit. Choosing V8 as the single engine
   would give Android and iOS different execution models, or force an
   interpreter-only build of a very large engine.
2. **Android has no system JavaScript engine outside a WebView.** A headless
   WebView is a second browser process, not a small embeddable engine, and it
   makes synchronous APIs, timeouts and per-app teardown harder to guarantee.

## Decision

Use **QuickJS on Android and the system JavaScriptCore on iOS**, behind one
engine interface in `packages/miniapp-service-runtime`:

- **Android:** vendored QuickJS source (MIT), built with the NDK for
  `arm64-v8a`, `armeabi-v7a` and `x86_64`, pinned by commit. The engine exposes
  only the QChat SDK globals; there is no host object, no file API and no
  network API inside the context.
- **iOS (M8):** `JSContext` from the system JavaScriptCore framework, with the
  same SDK and the same bridge messages. `JSExport` is not used to expose native
  objects; every host call is a serialized bridge request.
- **One contract:** `App`, `Page`, `Component`, `setData`, timers and the `wx.*`
  surface are implemented in JavaScript on top of a minimal host binding, so the
  two engines run identical SDK code.
- **Limits:** per-app heap and stack ceilings, a wall-clock timeout per script
  evaluation and a bounded bridge queue. A limit breach terminates the app with
  `RUNTIME_CRASH`, never the host.
- **Synchronous storage:** the sync variants are served from an in-memory cache
  that the host hydrates before `onLaunch` and writes through asynchronously.
  The engine never blocks on the host, which keeps a hung host from freezing the
  app and keeps the same behaviour on both platforms.

`flutter_js` (register row 13) is not adopted as the long-term engine wrapper:
it is a general-purpose bridge that exposes more than the contract needs. Its
QuickJS build inputs are a reference for M2; the dependency is removed with the
legacy runtime.

## Consequences

- Two engine builds to maintain, but one SDK and one bridge contract. The iOS
  side uses a system framework, so it adds no binary.
- No JIT: heavy scripts are slower than on V8. Page logic is small; the M6
  measurements decide whether this is a known limitation.
- The debugger is QChat-owned (M10), not Chrome DevTools. The bridge already
  carries request ids and errors, which the inspector reuses.
- Exact binary size, cold-start contribution and `setData` latency are
  `BLOCKED`; M2 records the build size and M6 records the device numbers in
  `STATUS.md` and `docs/compatibility.md`.
- The QuickJS source, its license text and the pinned commit are added to the
  third-party notices when it is vendored in M2.

## Evidence

- QuickJS upstream: `https://github.com/bellard/quickjs` (MIT), checked
  2026-11-27. The README describes a small embeddable interpreter; no size claim
  is copied as a measurement.
- V8: `https://v8.dev/` and the BSD-3-Clause license, checked 2026-11-27.
- JavaScriptCore: `https://developer.apple.com/documentation/javascriptcore`
  and the WebKit LGPL-2.1 license, checked 2026-11-27.
- Apple's JIT restriction: App Store Review Guidelines 2.5.2 and the WebKit
  documentation on JIT availability, checked 2026-11-27 (`docs/store-policy.md`).
- The M1 Node spike (`packages/miniapp-service-runtime`,
  `packages/miniapp-view-runtime`) proves the message flow and lifecycle, not
  engine performance.
