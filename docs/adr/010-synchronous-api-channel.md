# ADR 010 — Synchronous API channel and network transport seam

- **Status:** ACCEPTED (device timing `BLOCKED`)
- **Date:** 2026-11-28
- **Milestone:** M4
- **Supersedes:** nothing. Amends the synchronous-storage paragraph of ADR 009.

## Context

Section 8 lists synchronous storage (`wx.setStorageSync`, `wx.getStorageSync`,
`wx.removeStorageSync`, `wx.clearStorageSync`) and a synchronous system-info call
(`wx.getSystemInfoSync`). A synchronous API must return a value inside the same
engine call; it cannot be a `Promise`, because page code is written as
`var value = wx.getStorageSync(key)`. The asynchronous APIs (`wx.request`,
`wx.setStorage`, navigation, UI) must not block the engine and already travel as
`bridge.request` messages with an id and a `__qchatResponse` reply.

ADR 009 decided that synchronous storage is served from an in-memory cache that
the host hydrates before `onLaunch` and writes through asynchronously. It also
said "the engine never blocks on the host". Those two statements are only
compatible if the engine can read the cache without a host round trip. The M4
implementation instead gives the engine one synchronous host binding,
`__qchatHost.sync(method, paramsJson)`, which the host answers from its cache.
This ADR records that choice and its limits.

The network transport is also a host seam: the engine must never open a socket,
and the Android/iOS hosts must be able to supply their own HTTP stack. M4 needs a
single decision for both the synchronous channel and the transport injection so
M5/M8 do not invent a second path.

## Options

| Option | Synchronous result | Engine blocking | Host I/O in the call | Complexity |
|---|---|---|---|---|
| **A. Synchronous host binding** (`__qchatHost.sync`) | Direct return value | Only for the duration of the host function | Forbidden by contract; host reads an in-memory map | Low: one extra host function, one JSON parse |
| **B. Pre-hydrated engine cache** | Direct return value | None | None | Higher: the host must push every key into the engine before `onLaunch`, keep it in sync after writes from another page/process, and duplicate quota accounting |
| **C. Promise-only API** | Impossible | None | None | Breaks the WeChat signature; not an option |
| **D. Blocking bridge request** | Direct return value | Until the host answers | Possible if the host is careless | Deadlock risk: the host answers on the same thread that is waiting |

Option B is what ADR 009 described. It is sound, but it moves storage state into
the engine and makes multi-page and multi-process consistency the engine's
problem. Option A keeps one source of truth in the host and one cache in the
host, and the synchronous call is a function call plus a JSON parse. The cost is
that a hung host function freezes the engine for that call; the engine's
wall-clock limit bounds it, and the host contract forbids disk, network and
database work inside `sync`.

## Decision

**Use one synchronous host binding for the APIs that must return immediately.**

- The SDK calls `__qchatHost.sync(method, paramsJson)`. The host returns a JSON
  string shaped `{ "ok": true, "result": ... }` or
  `{ "ok": false, "error": { "code": "...", "message": "..." } }`.
- Only an allowlisted set of methods may use it: the four storage sync calls and
  `wx.getSystemInfoSync`. The SDK never sends a page handler, an event, a route
  or a `bridge.request` through this channel.
- The host answers from an in-memory per-app cache that is hydrated before
  `onLaunch`. A write updates the cache and enqueues the durable write; the
  synchronous call never performs disk, database or network I/O. This is the
  ADR 009 cache, read through one function instead of copied into the engine.
- A missing storage adapter or synchronous channel is `API_UNSUPPORTED`. There
  is no in-memory fallback in the runtime and no silent success.
- The channel validates the method name, parses the JSON arguments, rejects a
  non-object payload, and converts a thrown host error to `API_FAILED`. No host
  exception crosses into the engine.
- **Asynchronous APIs stay on `bridge.request`.** Navigation, `wx.request`,
  asynchronous storage, and the UI calls are request/response messages with a
  monotonic id; a response for an unknown id is rejected, never guessed.

**Use a network adapter seam for `wx.request`.**

- `packages/miniapp-service-runtime/src/network.ts` defines `NetworkAdapter`,
  `NetworkRequest`, `NetworkResponse` and `NetworkAdapterError`.
- The API host owns the policy: HTTPS only, exact or `*.domain` allowlist,
  no credentials in the URL, no non-default port, no `cookie`/`host` headers,
  method allowlist, response-size cap and timeout. The adapter only performs the
  request.
- Android and iOS install their own adapter in M5/M8. Node installs a `fetch`
  adapter for the harness. A host without an adapter returns `API_UNSUPPORTED`;
  it never opens a socket from the engine and never falls back to an in-memory
  response.

## Consequences

- The synchronous path is one host function, not a duplicated cache protocol.
  Android implements it as a QuickJS C function over JNI; iOS as a `JSContext`
  block; Node as a direct function. The same SDK source runs on all three.
- A host that does I/O inside `sync` can stall the engine. The contract, the
  code review and the M5 adapter must keep `sync` to a map lookup; the engine
  timeout is the backstop, not the design.
- ADR 009's sentence "the engine never blocks on the host" is amended to "the
  engine never blocks on host I/O". The storage cache still lives in the host;
  only the lookup crosses the boundary.
- `wx.request` policy is testable without a network: a recording adapter proves
  the request shape, and a missing adapter proves the honest failure. Device
  TLS, proxy and captive-portal behaviour remain M5/M8.
- Exact synchronous-call latency, storage-cache size and request overhead are
  `BLOCKED` until a device exists; M6 records them.

## Evidence

- `packages/miniapp-service-runtime/src/sdk.ts` — `syncCall`, the `wx` sync
  surface and the `bridge.request` path.
- `packages/miniapp-service-runtime/src/sdk-runtime.ts` — the `__qchatHost.sync`
  bridge, method/argument validation and the `SyncApiResult` shape.
- `packages/miniapp-service-runtime/src/api-host.ts` — `handleSync`, storage
  quota/key/corruption rules, `wx.getSystemInfoSync` field filtering and the
  request policy.
- `packages/miniapp-service-runtime/src/storage.ts` — `StorageAdapter` and the
  memory adapter.
- `packages/miniapp-service-runtime/src/network.ts` — `NetworkAdapter`,
  `NetworkAdapterError` and the Node `fetch` adapter.
- Tests: `test/api-host.test.ts` (13), `test/wx-sdk.test.ts` (9),
  `packages/miniapp-test-harness/test/host-api.test.ts` (4) and
  `packages/miniapp-test-harness/test/sample.test.ts` (9).
