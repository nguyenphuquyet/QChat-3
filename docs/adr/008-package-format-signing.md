# ADR 008 — Package format, hashing and signing

- **Status:** ACCEPTED
- **Date:** 2026-11-27
- **Milestone:** M0 (contract in M1, implementation M5)

## Context

Section 10 requires a versioned `.qxpkg` format with a manifest, a signature
verified against a trusted public key before execution, verification of every
file, atomic install, path-traversal and archive-bomb protection, rollback and
blocked revoked/downgraded versions. The legacy `.japp` format is removed.

## Decision

1. **Container:** `.qxpkg` is a ZIP (stored or deflated) with:
   - `manifest.json` — format version, app ID, version, minimum runtime version,
     entry, pages, permissions, default `qxColorScheme`, file list with SHA-256
     and size, signature metadata;
   - the source artifacts (`app.js`, `app.json`, `app.wxss`, every page's `.js`
     and `.wxml`, optional page `.json`/`.wxss`, assets);
   - `build/view.json` — the compiled view bundle: every page's compiled WXML
     template and compiled CSS in one versioned JSON document. A package without
     it is rejected by the manifest, so a host never has to compile on device;
   - `signature.ed25519` — a detached signature over the canonical manifest.
2. **Signature:** Ed25519 over the SHA-256 of the canonical manifest bytes.
   Public keys are pinned in the app and rotated through a key ID in the
   manifest. The private key lives only in the signing service, never in the app
   or the repository.
3. **Verification order (device):** size limit → ZIP structure and limits →
   manifest schema → signature over the manifest → per-file SHA-256/size →
   path/extension/executable checks → install into a staging directory → atomic
   rename → record the verified version.
4. **Install:** atomic rename, at most two verified versions per app, rollback to
   the previous verified version, refuse revoked versions and disallowed
   downgrades.
5. **Storage isolation:** one app-private directory per app ID; quotas; no
   cross-app reads.
6. **Errors:** the registry codes (`PACKAGE_SIGNATURE_INVALID`,
   `PACKAGE_HASH_MISMATCH`, `PACKAGE_UNSAFE_PATH`, `PACKAGE_TOO_LARGE`,
   `PACKAGE_FORMAT_UNSUPPORTED`, `PACKAGE_REVOKED`,
   `PACKAGE_DOWNGRADE_BLOCKED`, `PACKAGE_INSTALL_FAILED`); the registry is the
   single source of truth and ADR 008's earlier `PKG_*` spelling was a draft.

`UNVERIFIED`: the Dart/Android Ed25519 implementation. M5 fixed the Node
reference (OpenSSL Ed25519) and left the device verifier open: `cryptography`
(pure Dart, Apache-2.0) or `pointycastle` (MIT) in Dart, or a Kotlin verifier on
API 33+ with a fallback below it. The format does not change either way; the
choice is recorded with its license before the first device install (M6).

## Alternatives considered

1. **RSA-2048/SHA-256.** Widely supported, larger signatures and slower verify;
   Ed25519 is smaller and standard in modern toolchains.
2. **ECDSA P-256.** Comparable, but Ed25519 has a simpler, misuse-resistant
   implementation and deterministic signatures.
3. **Sign each file separately.** More granular but larger and slower; one
   manifest signature plus per-file hashes gives the same integrity and a clear
   verification order.
4. **No device verification, trust the server.** Rejected by section 10.

## Consequences and risks

- Key rotation and revocation need a key-ID list in the app; a lost key means an
  app update, so the signing service must back up and rotate deliberately.
- Canonical JSON must be specified exactly (key order, encoding) or signatures
  will differ across languages. The contract defines it and tests it with fixed
  vectors.
- ZIP handling is a known attack surface; the hardened reader and its tests are
  part of M5.

## Cost and effort to reverse

High after packages are published: changing the container or signature invalidates
every installed package and every stored build.
