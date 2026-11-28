# ADR 016 — Ed25519 verification in the Dart installer

- **Status:** ACCEPTED
- **Date:** 2026-11-28
- **Milestone:** host module 3 (Android installer; the same Dart code runs on iOS)

## Context

ADR 008 fixed the `.qxpkg` container: a ZIP with `manifest.json`, the source
artifacts, `build/view.json` and `signature.ed25519`, where the signature is
Ed25519 over the canonical JSON of the manifest without its `signature` field.
It left one choice open:

> `UNVERIFIED`: the Dart/Android Ed25519 implementation. `cryptography` (pure
> Dart, Apache-2.0) or `pointycastle` (MIT) in Dart, or a Kotlin verifier on
> API 33+ with a fallback below it.

The installer that writes a package into
`<files>/miniapps/apps/<appId>/versions/<version>` is Dart
(`apps/mobile/lib/features/miniapps_host/`), because it must run before any
WebView or service runtime exists and on both platforms. Every verification
step of ADR 008 §3 has to happen there, in this order: size → ZIP structure →
manifest schema → signature → per-file SHA-256 → path checks → atomic install.

The Android host (module 1) is Kotlin, but it must not own the verifier: it
reads an installed directory that Dart has already verified, and the WebView
never sees a package before that.

## Decision

1. **Verifier:** `cryptography` 2.9.0 (Apache-2.0), pure Dart, imported by
   `apps/mobile/lib/features/miniapps_host/miniapp_package_verifier.dart` and
   nowhere else. It provides `Ed25519()` and `Sha256()` from one package, so the
   installer has no second crypto dependency.
2. **Signature check:** `Ed25519().verify(canonicalBytes, signature:
   Signature(base64Decode(manifest.signature.value), publicKey:
   SimplePublicKey(keyBytes, type: KeyPairType.ed25519)))`. A 64-byte signature
   is required before the call, and any thrown error becomes
   `PACKAGE_SIGNATURE_INVALID`; a verifier exception is never a pass.
3. **Canonical bytes:** the manifest is re-serialised by the Dart
   implementation of `canonicalJson` (object keys sorted, no insignificant
   whitespace, arrays in order), with the `signature` key removed. This mirrors
   `packages/miniapp-contracts/src/manifest.ts` exactly, and both sides are
   pinned by the fixed vectors in `packages/miniapp-compiler/test/package.test.ts`
   plus a Dart test that verifies a package the Node signer produced.
4. **Pinned keys:** a `const Map<String, String> trustedPackageKeys` maps
   `keyId` to a base64 Ed25519 public key. An unknown `keyId` is
   `PACKAGE_SIGNATURE_INVALID`, never "try the only key". The map starts with
   the test key used by the compiler fixtures; the production key arrives with
   the signing service (M10) and is rotated by an app release, as ADR 008 §4
   already states.
5. **No platform split:** no Kotlin/JNI verifier and no `java.security.Signature`
   path. One implementation, one behaviour, no API-33 branch, no NDK dependency
   for the installer.

## Alternatives considered

1. **`pointycastle` (MIT).** Also pure Dart and already transitive in some
   packages, but its Ed25519 surface is lower level (signer/verifier objects,
   ASN.1 encoders) and its SHA-256 must be wired separately. `cryptography`
   offers a smaller, harder-to-misuse API for the two operations the installer
   needs.
2. **Kotlin `java.security.Signature` on API 33+, Dart fallback below it.**
   Two verifiers with two failure modes, and the fallback still needs a Dart
   Ed25519 implementation, so it doubles the code without removing the
   dependency. Rejected.
3. **Verify on the server only.** Rejected by section 10: a device that trusts
   the transport can be pointed at a modified package.
4. **Sign each file separately.** Rejected in ADR 008; one manifest signature
   plus per-file hashes gives the same integrity.

## Consequences and risks

- `cryptography` is pure Dart: verification is slower than a native call
  (single-digit milliseconds for a 64-byte signature and a manifest under the
  8 MiB bundle limit), which is well inside the install budget.
- The canonical JSON implementation is now duplicated in TypeScript and Dart.
  The fixed vectors and the cross-language test are the contract; changing one
  side without the other fails the Dart test, not a device.
- The pinned-key map is app-shipped state. A lost signing key means an app
  release, exactly as ADR 008 warned; the signing service must keep the private
  key backed up and rotate through a new `keyId`.
- `cryptography` pulls `ffi` and `typed_data`; both are already in the app's
  dependency graph through Flutter itself, so the added weight is small.
