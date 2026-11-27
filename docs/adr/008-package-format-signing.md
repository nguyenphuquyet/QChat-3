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
   - the source artifacts (compiled view bundle, service bundle, WXSS, assets);
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
6. **Errors:** documented codes (`PKG_SIGNATURE_INVALID`, `PKG_HASH_MISMATCH`,
   `PKG_UNSAFE_PATH`, `PKG_TOO_LARGE`, `PKG_FORMAT_UNSUPPORTED`,
   `PKG_REVOKED`, `PKG_DOWNGRADE_BLOCKED`).

`UNVERIFIED`: the Dart Ed25519 implementation. M5 evaluates `cryptography`
(pure Dart, Apache-2.0) or `pointycastle` (MIT) and records the choice and
license in the third-party notices; the format does not change either way.

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
