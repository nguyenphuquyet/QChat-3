# Mini App threat model

- **Milestone:** M6 (security assessment of the bridge and package handling)
- **Status:** `IN PROGRESS` — Node-verifiable threats are covered by tests; the
  Android WebView, QuickJS JNI, device TLS and device storage are `BLOCKED`
  (no SDK/NDK/phone). This document never treats a Node test as device proof.
- **Scope:** the new runtime only: `.qxpkg` handling, the Service Runtime, the
  View Runtime, the runtime bridge, per-app storage and `wx.request`. The legacy
  QApp runtime is out of scope and is removed in M11.

## 1. Assets

| Asset | Why it matters |
|---|---|
| Host files, credentials, database, native objects | A Mini App must never reach them (section 4.1) |
| Other Mini Apps' code and storage | Cross-app reads or writes break isolation |
| Package integrity and signing keys | A forged package runs attacker code; a leaked private key signs it |
| Page data and user input | Rendered as text, never as HTML or script |
| The bridge channel | A confused deputy: any extra method or origin is an attack surface |
| Network destinations and headers | Data exfiltration, credential leaks, SSRF |
| Device permissions | Camera, location, files, microphone |

## 2. Adversaries

| Adversary | Capability |
|---|---|
| **Malicious developer** | Ships any WXML/WXSS/JS, declares permissions, chooses URLs and domains |
| **Compromised build or signing service** | Can sign a package that the developer did not write |
| **Network attacker** | Modifies HTTP(S) traffic, DNS, proxies, captive portals |
| **Malicious page content** | Data values, URLs, event payloads, storage values |
| **Another installed Mini App** | Runs its own code and storage on the same device |
| **Local attacker with the device** | Reads app-private files if the OS or the app leaks them |
| **Host bug** | A missing check, a fallback, a wrong origin or a leaked id |

## 3. Threats and mitigations

### 3.1 Package handling

| # | Threat | Mitigation | Evidence |
|---|---|---|---|
| P1 | Forged manifest or files | Ed25519 over the canonical manifest; per-file SHA-256 and size; unknown key id rejected; detached `signature.ed25519` must equal the manifest signature | `packages/miniapp-compiler/src/package.ts`; `test/package.test.ts` ("wrong key", "tampered") |
| P2 | Path traversal or absolute path | `isSafePackagePath` on every entry and manifest path; `..`, backslashes, drive letters and empty segments rejected | `package.ts`; "unsafe paths" test |
| P3 | Executable or native library in a package | Extension allowlist; `.exe`, `.so`, `.dll`, `.wasm` and unknown types rejected | `package.ts`; "executables" test |
| P4 | Archive bomb or oversized archive | Archive, entry, total and entry-count limits; inflate output capped while inflating | `package.ts`; "oversized archive" test |
| P5 | ZIP64, encryption or symbolic link | ZIP64 rejected; encrypted entries rejected; symlink mode rejected | `test/package.test.ts` ("ZIP64, encrypted entries and symbolic links") |
| P6 | Duplicate or case-colliding entries | Lower-cased path set; a duplicate is rejected | `package.ts`; manifest duplicate-path test |
| P7 | Package built for another runtime | `minRuntimeVersion` gate before install | "newer runtime" test |
| P8 | Revoked or downgraded version | `PackageStore` refuses `PACKAGE_REVOKED` and `PACKAGE_DOWNGRADE_BLOCKED` unless policy allows | `install.ts`; "downgrade and revoked" test |
| P9 | Half-written install | Verify → staging → one rename → `state.json`; a failed state write restores the old directory | `install.ts`; install/rollback test |
| P10 | Device verifier differs from the reference | Fixed vectors and the same manifest/bundle format; the Dart/Android Ed25519 choice is still `UNVERIFIED` | ADR 008; `BLOCKED` |
| P11 | Compiler on the device | `build/view.json` is required; `loadInstalledPackage` refuses a missing or mismatched bundle | `build.ts`; `installed.test.ts` |

### 3.2 Bridge and view

| # | Threat | Mitigation | Evidence |
|---|---|---|---|
| B1 | Foreign origin or frame calls the bridge | Android: `addWebMessageListener` with the exact asset origin; iOS: `WKScriptMessageHandler` with a frame-origin check. The host rejects any other origin. The client itself refuses a foreign binding and a second `start` | Contract tests reject a foreign app/session/page; `packages/miniapp-view-web/test/browser.test.ts`; device test is M6 |
| B2 | Page spoofs another app/session/page id | Every message is bound to the host-issued app, session and page; page ids are not trusted alone; the view checks the payload page id too | `packages/miniapp-contracts/test/bridge.test.ts`; `bridge-client.test.ts`; `miniapp-view-web/test/client.test.ts` |
| B3 | Arbitrary native method invocation | Allowlisted methods only; an unknown method is `BRIDGE_UNKNOWN_METHOD`; no reflective call | `bridge-client.ts`; `sdk-runtime.test.ts` |
| B4 | Oversized or malformed message | Size limit before JSON parsing, schema validation, unknown keys rejected, timeout and cancel | `bridge.test.ts`; `bridge-client.test.ts`; `miniapp-view-web/test/client.test.ts` |
| B5 | Data rendered as HTML or script | Typed render tree; text nodes only; WXML expressions never `eval`; no `innerHTML`; the bundle test rejects `innerHTML`, `outerHTML` and `document.write` | `miniapp-view-runtime`; `expression.test.ts`; `wxml-compiler.test.ts`; `miniapp-view-web/test/bundle.test.ts` |
| B6 | Page navigates the WebView to remote content | The view loads only the installed origin; the client has no `fetch`, `XMLHttpRequest` or `WebSocket`; navigation is the declared-route API, not the WebView | `api-host.test.ts`; `miniapp-view-web/test/bundle.test.ts`; device check M6 |
| B7 | Debug or file access in release | Remote debugging, file access, universal file access and mixed content disabled; no `addJavascriptInterface`; the client has no `eval` or `new Function` | ADR 011; `miniapp-view-web/test/bundle.test.ts`; device check M6 |
| B8 | Theme leak to a fixed-theme page | Host theme events are only allowed for `auto`; fixed pages get no event; the view applies only a resolved light/dark value and never reloads the tree | `manifest.test.ts`; `service.test.ts`; `miniapp-view-web/test/client.test.ts` |

### 3.3 Storage and network

| # | Threat | Mitigation | Evidence |
|---|---|---|---|
| S1 | One app reads another's storage | One directory per app id; the key is hashed for the file name; no path from the key | `install.ts`; "storage is isolated" test |
| S2 | Quota bypass | Quota checked before a write; a single value is capped; the adapter is the backstop | `install.ts`; quota test |
| S3 | Corrupt record silently reset | `STORAGE_CORRUPT` on read; no in-memory fallback | corruption test |
| S4 | Secret in logs | The runtime logs ids and error codes, not values; storage values and headers are not logged | Code review rule; no logger writes values |
| N1 | Plain HTTP or credential URL | HTTPS only; userinfo, non-default ports and fragments rejected | `api-host.test.ts` |
| N2 | Request to an undeclared host | Exact or `*.domain` allowlist; no wildcard at the top level | `api-host.test.ts` |
| N3 | Header injection or cookie leak | `cookie` and `host` headers rejected; headers are a fixed map | `api-host.test.ts` |
| N4 | Unbounded response or hang | Timeout and response-size cap; the engine never opens a socket | `api-host.test.ts`; `network.ts` |
| N5 | Missing adapter falls back to a fake | `API_UNSUPPORTED`; no in-memory response | `host-api.test.ts` |

### 3.4 Host and process

| # | Threat | Mitigation | Evidence |
|---|---|---|---|
| H1 | Mini App code reaches host objects | Engine exposes only SDK globals; no host object, file API or network API | `engine.test.ts`; ADR 009 |
| H2 | Runaway script freezes the app | Wall-clock limit per evaluation; a breach is `RUNTIME_CRASH` | `engine.test.ts`; device timing M6 |
| H3 | Sync call does disk or network work | ADR 010: `sync` is a map lookup; the host contract forbids I/O; timeout is the backstop | `sdk-runtime.test.ts`; code review |
| H4 | Page keeps running after close | `close` terminates the engine, clears timers, rejects calls, removes listeners | `service.test.ts`; `host.ts` |
| H5 | Permission used without a grant | Declared permissions are checked by the API host; OS permission is separate | `contracts.test.ts`; prompts are M7 |

## 4. Residual risks (not closed)

1. **Device WebView origin and message listener** are unverified. A host bug in
   the origin string or the listener scope would bypass B1/B7. The client
   refuses a foreign binding and a second `start` in Node, but M6 must test a
   foreign origin, a foreign frame and a closed page on a real WebView.
2. **Device Ed25519** is `UNVERIFIED`; a wrong implementation could accept a bad
   signature or reject a good one. Fixed vectors and a device test are required.
3. **QuickJS JNI** memory safety and teardown are unverified; a crash must
   terminate the app, not the host.
4. **TLS, proxy and captive portal** behaviour is unverified; the Node adapter
   proves policy, not the device stack.
5. **Storage durability** across process death and disk-full is unverified; a
   corrupt record is detected, not repaired.
6. **No fuzzing** of the ZIP reader, manifest parser or WXML parser yet.
7. **No rate limit** on bridge messages or storage writes in the Node reference;
   the device host must bound queues and per-app CPU.
8. **Signing key custody** is M9; a compromised signing service can sign a
   malicious package that passes every client check.
9. **`setData` cost in the WebView** is a full tree clone plus a diff per ops
   batch. It is portable and tested, but the 100 ms target on a low-end device is
   unmeasured; M6/M7 must profile it and replace it with a direct DOM patch if it
   misses.

## 5. Test map

| Area | Test file | What it proves |
|---|---|---|
| Package | `packages/miniapp-compiler/test/package.test.ts` | Signature, hashes, ZIP64/encryption/symlink, limits, install/rollback, revocation, storage |
| Manifest | `packages/miniapp-contracts/test/manifest.test.ts` | Schema, required files, page routes, signature shape |
| Bridge | `packages/miniapp-contracts/test/bridge.test.ts` | Envelope, size, binding, unknown keys |
| Bridge client | `packages/miniapp-service-runtime/test/bridge-client.test.ts` | Allowlist, ids, timeout, cancel, close |
| Engine | `packages/miniapp-service-runtime/test/engine.test.ts` | No host globals, no dynamic code, time limit |
| API policy | `packages/miniapp-service-runtime/test/api-host.test.ts` | Navigation, storage, request, UI, system info |
| View | `packages/miniapp-view-runtime/test/view.test.ts` | Typed tree, safe text, events, theme root, no `structuredClone` |
| View WebView client | `packages/miniapp-view-web/test/client.test.ts` | Binding, `seq`, tree/ops, theme, destroy, `catch` bubbling, oversized message |
| Browser seam | `packages/miniapp-view-web/test/browser.test.ts` | `__qchatView.start/receive/destroy`, missing root/channel, one start |
| Bundle | `packages/miniapp-view-web/test/bundle.test.ts` | No import/require/eval/Function/innerHTML/fetch; the committed bundle runs in `vm` |
| Installed run | `packages/miniapp-test-harness/test/installed.test.ts` | Verified package → bundle → render, bundle mismatch refused |

## 6. How to reproduce

```powershell
$env:NODE_OPTIONS="--max-old-space-size=2048"
pnpm test:miniapp
pnpm check:miniapp
```

Device items are reproduced only with an Android build and a phone; they are
listed in `STATUS.md` §5.4 and §13.6 and stay `BLOCKED` until then.
