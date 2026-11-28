/// The `.qxpkg` verifier (ADR 008 §3, ADR 016).
///
/// A package is verified before a single byte of it reaches the installed
/// directory, the WebView or the service runtime. The order is fixed by ADR 008:
///
///   size → ZIP structure and limits → manifest schema → signature over the
///   manifest → per-file SHA-256 and size → path checks.
///
/// Nothing here writes to disk; [MiniAppInstaller] takes the verified bytes.
library;

import 'dart:convert';
import 'dart:typed_data';

import 'package:archive/archive.dart';
import 'package:crypto/crypto.dart';
import 'package:cryptography/cryptography.dart';

/// `manifest.json` and `signature.ed25519` at the archive root.
const miniAppManifestName = 'manifest.json';
const miniAppSignatureName = 'signature.ed25519';

const miniAppPackageFormat = 'qxpkg';
const miniAppPackageFormatVersion = 1;

/// The archive limits of ADR 008 §3, identical to
/// `packages/miniapp-compiler/src/package.ts`.
class MiniAppPackageLimits {
  const MiniAppPackageLimits({
    this.maxArchiveBytes = 48 * 1024 * 1024,
    this.maxEntryBytes = 32 * 1024 * 1024,
    this.maxTotalBytes = 32 * 1024 * 1024,
    this.maxEntries = 4096,
  });

  final int maxArchiveBytes;
  final int maxEntryBytes;
  final int maxTotalBytes;
  final int maxEntries;
}

const miniAppPackageLimits = MiniAppPackageLimits();

/// Extensions a package may contain. Executables, native libraries and nested
/// archives are rejected even when the manifest lists them.
const _allowedExtensions = <String>{
  'js', 'mjs', 'json', 'wxml', 'wxss', 'wxs', 'html', 'htm', 'css', 'map',
  'txt', 'md', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'svg', 'ico',
  'woff', 'woff2', 'ttf', 'otf', 'mp3', 'wav', 'mp4', 'webm', 'ed25519',
};

const _permissions = <String>{
  'camera', 'photoLibrary', 'microphone', 'location', 'clipboardRead',
  'clipboardWrite', 'scanCode', 'fileRead', 'fileWrite', 'network', 'storage',
};

const _colorSchemes = <String>{'light', 'dark', 'auto'};

final _appId = RegExp(r'^[a-z][a-z0-9]*(?:[.-][a-z0-9]+){1,7}$');
final _semver = RegExp(
  r'^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$',
);
final _sha256Hex = RegExp(r'^[0-9a-f]{64}$');

/// A package error, carrying a code from
/// `packages/miniapp-contracts/src/errors.ts` so the screen can show the same
/// string on every platform.
class MiniAppPackageError implements Exception {
  const MiniAppPackageError(this.code, this.message);

  final String code;
  final String message;

  @override
  String toString() => '$code: $message';
}

class MiniAppManifestFile {
  const MiniAppManifestFile({
    required this.path,
    required this.sha256,
    required this.bytes,
  });

  final String path;
  final String sha256;
  final int bytes;
}

class MiniAppManifest {
  const MiniAppManifest({
    required this.appId,
    required this.version,
    required this.name,
    required this.minRuntimeVersion,
    required this.entry,
    required this.pages,
    required this.permissions,
    required this.qxColorScheme,
    required this.files,
    required this.keyId,
  });

  final String appId;
  final String version;
  final String name;
  final String minRuntimeVersion;
  final String entry;
  final List<String> pages;
  final List<String> permissions;
  final String qxColorScheme;
  final List<MiniAppManifestFile> files;

  /// The `keyId` the package was signed with; the caller decides whether it is
  /// trusted, and an unknown id is never "the only key".
  final String keyId;
}

/// A package that passed every check, with the verified file bytes.
class VerifiedMiniAppPackage {
  const VerifiedMiniAppPackage({required this.manifest, required this.files});

  final MiniAppManifest manifest;

  /// Every file except `manifest.json` and `signature.ed25519`.
  final Map<String, Uint8List> files;

  /// `build/view.json`, the compiled view bundle the Android host reads.
  Uint8List get viewBundle => files['build/view.json']!;
}

/// Public keys the installer trusts, by `keyId`.
///
/// Empty until the signing service issues the production key (M10): an empty
/// map means every package fails with `PACKAGE_SIGNATURE_INVALID`, which is the
/// safe default, not a fallback. Tests pass the fixture key explicitly.
const miniAppTrustedPackageKeys = <String, String>{};

/// Verify [bytes] and return the manifest and file bytes, or throw
/// [MiniAppPackageError].
///
/// [runtimeVersion] is the host runtime version used for the
/// `minRuntimeVersion` gate. [trustedKeys] maps `keyId` to a base64 Ed25519
/// public key.
Future<VerifiedMiniAppPackage> verifyMiniAppPackage(
  Uint8List bytes, {
  required String runtimeVersion,
  Map<String, String> trustedKeys = miniAppTrustedPackageKeys,
  MiniAppPackageLimits limits = miniAppPackageLimits,
}) async {
  if (bytes.isEmpty || bytes.length > limits.maxArchiveBytes) {
    throw const MiniAppPackageError(
      'PACKAGE_TOO_LARGE',
      'The package is empty or exceeds the archive limit.',
    );
  }

  final Archive archive;
  try {
    archive = ZipDecoder().decodeBytes(bytes, verify: true);
  } catch (error) {
    throw MiniAppPackageError(
      'PACKAGE_FORMAT_UNSUPPORTED',
      'The package is not a readable ZIP: $error',
    );
  }
  if (archive.files.length > limits.maxEntries) {
    throw const MiniAppPackageError(
      'PACKAGE_TOO_LARGE',
      'The package contains too many entries.',
    );
  }

  final entries = <String, Uint8List>{};
  var total = 0;
  for (final file in archive.files) {
    if (!file.isFile) continue;
    final name = file.name;
    if (!isSafePackagePath(name)) {
      throw MiniAppPackageError(
        'PACKAGE_UNSAFE_PATH',
        'The archive contains an unsafe path: $name',
      );
    }
    if (!isAllowedPackageFile(name)) {
      throw MiniAppPackageError(
        'PACKAGE_FORMAT_UNSUPPORTED',
        'The archive contains a file type a Mini App may not ship: $name',
      );
    }
    final content = file.content;
    if (content.length > limits.maxEntryBytes) {
      throw const MiniAppPackageError(
        'PACKAGE_TOO_LARGE',
        'A package file exceeds the per-file limit.',
      );
    }
    total += content.length;
    if (total > limits.maxTotalBytes) {
      throw const MiniAppPackageError(
        'PACKAGE_TOO_LARGE',
        'The package exceeds the total size limit.',
      );
    }
    if (entries.containsKey(name)) {
      throw MiniAppPackageError(
        'PACKAGE_FORMAT_UNSUPPORTED',
        'The archive lists $name twice.',
      );
    }
    entries[name] = content;
  }

  final manifestBytes = entries[miniAppManifestName];
  if (manifestBytes == null) {
    throw const MiniAppPackageError(
      'PACKAGE_FORMAT_UNSUPPORTED',
      'manifest.json is missing.',
    );
  }
  final signatureBytes = entries[miniAppSignatureName];
  if (signatureBytes == null) {
    throw const MiniAppPackageError(
      'PACKAGE_FORMAT_UNSUPPORTED',
      'signature.ed25519 is missing.',
    );
  }

  final Object? raw;
  try {
    raw = jsonDecode(utf8.decode(manifestBytes));
  } on FormatException catch (error) {
    throw MiniAppPackageError(
      'MANIFEST_INVALID',
      'manifest.json is not valid JSON: ${error.message}',
    );
  }
  if (raw is! Map<String, Object?>) {
    throw const MiniAppPackageError(
      'MANIFEST_INVALID',
      'manifest.json must be an object.',
    );
  }
  final manifest = _parseManifest(raw);
  final signatureValue = _signatureValue(raw);

  // The detached file is the copy a host reads before parsing the manifest; if
  // the two disagree, one of them was edited.
  if (signatureBytes.length != 64 ||
      base64Encode(signatureBytes) != base64Encode(base64Decode(signatureValue))) {
    throw const MiniAppPackageError(
      'PACKAGE_SIGNATURE_INVALID',
      'signature.ed25519 does not match the manifest signature.',
    );
  }

  final publicKey = trustedKeys[manifest.keyId];
  if (publicKey == null) {
    throw MiniAppPackageError(
      'PACKAGE_SIGNATURE_INVALID',
      'The signing key ${manifest.keyId} is not trusted.',
    );
  }
  final signable = Map<String, Object?>.from(raw)..remove('signature');
  final valid = await _verifyEd25519(
    utf8.encode(canonicalJson(signable)),
    signatureBytes,
    publicKey,
  );
  if (!valid) {
    throw const MiniAppPackageError(
      'PACKAGE_SIGNATURE_INVALID',
      'The package signature is not valid.',
    );
  }

  final content = <String, Uint8List>{};
  for (final entry in entries.entries) {
    if (entry.key == miniAppManifestName || entry.key == miniAppSignatureName) {
      continue;
    }
    content[entry.key] = entry.value;
  }
  if (content.length != manifest.files.length) {
    throw const MiniAppPackageError(
      'PACKAGE_HASH_MISMATCH',
      'The archive and the manifest list different files.',
    );
  }
  var verifiedTotal = 0;
  for (final file in manifest.files) {
    final actual = content[file.path];
    if (actual == null) {
      throw MiniAppPackageError(
        'PACKAGE_HASH_MISMATCH',
        'A manifest file is missing: ${file.path}',
      );
    }
    if (actual.length != file.bytes) {
      throw MiniAppPackageError(
        'PACKAGE_HASH_MISMATCH',
        'A file size does not match: ${file.path}',
      );
    }
    if (sha256.convert(actual).toString() != file.sha256) {
      throw MiniAppPackageError(
        'PACKAGE_HASH_MISMATCH',
        'A file hash does not match: ${file.path}',
      );
    }
    verifiedTotal += actual.length;
  }
  if (verifiedTotal > limits.maxTotalBytes) {
    throw const MiniAppPackageError(
      'PACKAGE_TOO_LARGE',
      'The package exceeds the total size limit.',
    );
  }

  if (!satisfiesRuntimeVersion(manifest.minRuntimeVersion, runtimeVersion)) {
    throw MiniAppPackageError(
      'PACKAGE_FORMAT_UNSUPPORTED',
      'The package needs runtime ${manifest.minRuntimeVersion} or newer; '
      'this host is $runtimeVersion.',
    );
  }

  return VerifiedMiniAppPackage(manifest: manifest, files: content);
}

/// Canonical JSON: object keys sorted, no insignificant whitespace. Two
/// implementations must produce the same bytes or a signature verifies in one
/// place and not the other; `canonicalJson` in
/// `packages/miniapp-contracts/src/manifest.ts` is the other one.
String canonicalJson(Object? value) {
  if (value == null) return 'null';
  if (value is String || value is num || value is bool) return jsonEncode(value);
  if (value is List) {
    return '[${value.map(canonicalJson).join(',')}]';
  }
  if (value is Map) {
    final keys = value.keys.map((key) => key as String).toList()..sort();
    return '{${keys.map((key) => '${jsonEncode(key)}:${canonicalJson(value[key])}').join(',')}}';
  }
  throw ArgumentError.value(value, 'value', 'Canonical JSON cannot encode this value.');
}

/// True for a path the installer may write: relative, `/`-separated, no empty,
/// `.` or `..` segment, no backslash, drive letter or NUL.
bool isSafePackagePath(String value) {
  if (value.isEmpty || value.length > 512) return false;
  if (value.startsWith('/') || value.contains('\\') || value.contains('\u0000')) {
    return false;
  }
  if (RegExp(r'^[A-Za-z]:').hasMatch(value)) return false;
  final segments = value.split('/');
  return segments.every(
    (segment) => segment.isNotEmpty && segment != '.' && segment != '..',
  );
}

/// True when the extension is on the package allowlist.
bool isAllowedPackageFile(String path) {
  final name = path.split('/').last;
  if (name.isEmpty || name.startsWith('.')) return false;
  final dot = name.lastIndexOf('.');
  if (dot <= 0 || dot == name.length - 1) return false;
  return _allowedExtensions.contains(name.substring(dot + 1).toLowerCase());
}

/// Numeric semver comparison, as `satisfiesRuntime` in the contracts package.
bool satisfiesRuntimeVersion(String minimum, String current) {
  List<int> parse(String value) => value
      .split(RegExp(r'[.+-]'))
      .take(3)
      .map((part) => int.tryParse(part) ?? 0)
      .toList();
  final required = parse(minimum);
  final host = parse(current);
  for (var index = 0; index < 3; index += 1) {
    final left = index < required.length ? required[index] : 0;
    final right = index < host.length ? host[index] : 0;
    if (right > left) return true;
    if (right < left) return false;
  }
  return true;
}

Future<bool> _verifyEd25519(
  List<int> message,
  List<int> signature,
  String publicKeyBase64,
) async {
  try {
    final key = SimplePublicKey(
      base64Decode(publicKeyBase64),
      type: KeyPairType.ed25519,
    );
    return await Ed25519().verify(
      message,
      signature: Signature(signature, publicKey: key),
    );
  } catch (_) {
    // A verifier exception is a failed check, never a pass.
    return false;
  }
}

String _signatureValue(Map<String, Object?> raw) {
  final signature = raw['signature'];
  if (signature is! Map<String, Object?>) {
    throw const MiniAppPackageError('MANIFEST_INVALID', 'signature is malformed.');
  }
  final value = signature['value'];
  if (value is! String || value.isEmpty || value.length > 512) {
    throw const MiniAppPackageError(
      'MANIFEST_INVALID',
      'signature.value is required.',
    );
  }
  try {
    if (base64Decode(value).length != 64) {
      throw const MiniAppPackageError(
        'PACKAGE_SIGNATURE_INVALID',
        'An Ed25519 signature must be 64 bytes.',
      );
    }
  } on FormatException {
    throw const MiniAppPackageError(
      'PACKAGE_SIGNATURE_INVALID',
      'The signature is not base64.',
    );
  }
  return value;
}

MiniAppManifest _parseManifest(Map<String, Object?> raw) {
  const allowed = <String>{
    'format', 'formatVersion', 'appId', 'version', 'name', 'minRuntimeVersion',
    'entry', 'pages', 'permissions', 'qxColorScheme', 'files', 'signature',
    'meta',
  };
  for (final key in raw.keys) {
    if (!allowed.contains(key)) {
      throw MiniAppPackageError(
        'MANIFEST_INVALID',
        'The manifest has an unknown key: $key',
      );
    }
  }
  if (raw['format'] != miniAppPackageFormat) {
    throw const MiniAppPackageError('MANIFEST_INVALID', 'format must be qxpkg.');
  }
  final formatVersion = raw['formatVersion'];
  if (formatVersion != miniAppPackageFormatVersion) {
    throw const MiniAppPackageError(
      'MANIFEST_VERSION_UNSUPPORTED',
      'The package format version is not supported.',
    );
  }

  final appId = raw['appId'];
  if (appId is! String || appId.length > 128 || !_appId.hasMatch(appId)) {
    throw const MiniAppPackageError('MANIFEST_INVALID', 'appId is invalid.');
  }
  final version = raw['version'];
  if (version is! String || !_isSemver(version)) {
    throw const MiniAppPackageError('MANIFEST_INVALID', 'version must be semver.');
  }
  final name = raw['name'];
  if (name is! String || name.isEmpty || name.length > 64) {
    throw const MiniAppPackageError('MANIFEST_INVALID', 'name is required.');
  }
  final minRuntimeVersion = raw['minRuntimeVersion'];
  if (minRuntimeVersion is! String || !_isSemver(minRuntimeVersion)) {
    throw const MiniAppPackageError(
      'MANIFEST_INVALID',
      'minRuntimeVersion must be semver.',
    );
  }

  final entry = raw['entry'];
  if (entry is! String || !_isSafeRoute(entry)) {
    throw const MiniAppPackageError(
      'MANIFEST_INVALID',
      'entry is not a safe route.',
    );
  }

  final pagesRaw = raw['pages'];
  if (pagesRaw is! List || pagesRaw.isEmpty || pagesRaw.length > 64) {
    throw const MiniAppPackageError(
      'MANIFEST_INVALID',
      'pages must contain 1-64 routes.',
    );
  }
  final pages = <String>[];
  for (final page in pagesRaw) {
    if (page is! String || !_isSafeRoute(page)) {
      throw const MiniAppPackageError(
        'MANIFEST_INVALID',
        'A page route is not safe.',
      );
    }
    if (pages.contains(page)) {
      throw const MiniAppPackageError(
        'MANIFEST_INVALID',
        'A page route is declared twice.',
      );
    }
    pages.add(page);
  }
  if (!pages.contains(entry)) {
    throw const MiniAppPackageError(
      'MANIFEST_INVALID',
      'entry is not one of the declared pages.',
    );
  }

  final permissionsRaw = raw['permissions'];
  if (permissionsRaw is! List) {
    throw const MiniAppPackageError(
      'MANIFEST_INVALID',
      'permissions must be a list.',
    );
  }
  final permissions = <String>[];
  for (final permission in permissionsRaw) {
    if (permission is! String || !_permissions.contains(permission)) {
      throw MiniAppPackageError(
        'MANIFEST_INVALID',
        'Unknown permission: $permission',
      );
    }
    if (permissions.contains(permission)) {
      throw MiniAppPackageError(
        'MANIFEST_INVALID',
        'A permission is declared twice: $permission',
      );
    }
    permissions.add(permission);
  }

  final qxColorScheme = raw['qxColorScheme'] ?? 'light';
  if (qxColorScheme is! String || !_colorSchemes.contains(qxColorScheme)) {
    throw const MiniAppPackageError(
      'MANIFEST_INVALID',
      'qxColorScheme is not a known scheme.',
    );
  }

  final filesRaw = raw['files'];
  if (filesRaw is! List || filesRaw.isEmpty || filesRaw.length > 4096) {
    throw const MiniAppPackageError(
      'MANIFEST_INVALID',
      'files must contain 1-4096 entries.',
    );
  }
  final files = <MiniAppManifestFile>[];
  final paths = <String>{};
  var total = 0;
  for (final item in filesRaw) {
    if (item is! Map<String, Object?>) {
      throw const MiniAppPackageError(
        'MANIFEST_INVALID',
        'A file entry is malformed.',
      );
    }
    for (final key in item.keys) {
      if (key != 'path' && key != 'sha256' && key != 'bytes') {
        throw MiniAppPackageError(
          'MANIFEST_INVALID',
          'A file entry has an unknown key: $key',
        );
      }
    }
    final path = item['path'];
    if (path is! String || !isSafePackagePath(path)) {
      throw const MiniAppPackageError(
        'PACKAGE_UNSAFE_PATH',
        'A file path is unsafe.',
      );
    }
    if (path == miniAppManifestName) {
      throw const MiniAppPackageError(
        'MANIFEST_INVALID',
        'manifest.json must not list itself.',
      );
    }
    final hash = item['sha256'];
    if (hash is! String || !_sha256Hex.hasMatch(hash)) {
      throw const MiniAppPackageError(
        'MANIFEST_INVALID',
        'A file hash is not SHA-256.',
      );
    }
    final size = item['bytes'];
    if (size is! int || size < 0 || size > 32 * 1024 * 1024) {
      throw const MiniAppPackageError(
        'MANIFEST_INVALID',
        'A file size is invalid.',
      );
    }
    if (!paths.add(path)) {
      throw MiniAppPackageError(
        'MANIFEST_INVALID',
        'A file path is listed twice: $path',
      );
    }
    total += size;
    files.add(MiniAppManifestFile(path: path, sha256: hash, bytes: size));
  }
  if (total > 32 * 1024 * 1024) {
    throw const MiniAppPackageError(
      'PACKAGE_TOO_LARGE',
      'The manifest lists more bytes than a package may contain.',
    );
  }

  // A declared page without its source, or a package without the compiled view
  // bundle, is a manifest error, never a runtime crash.
  for (final page in pages) {
    for (final extension in const ['js', 'wxml']) {
      final path = '$page.$extension';
      if (!paths.contains(path)) {
        throw MiniAppPackageError(
          'MANIFEST_INVALID',
          'A declared page is missing a source file: $path',
        );
      }
    }
  }
  for (final required in const ['app.js', 'app.json', 'build/view.json']) {
    if (!paths.contains(required)) {
      throw MiniAppPackageError(
        'MANIFEST_INVALID',
        'The package is missing $required.',
      );
    }
  }

  final signature = raw['signature'];
  if (signature is! Map<String, Object?> ||
      signature['algorithm'] != 'Ed25519') {
    throw const MiniAppPackageError(
      'MANIFEST_INVALID',
      'signature.algorithm must be Ed25519.',
    );
  }
  final keyId = signature['keyId'];
  if (keyId is! String || keyId.isEmpty || keyId.length > 64) {
    throw const MiniAppPackageError(
      'MANIFEST_INVALID',
      'signature.keyId is required.',
    );
  }

  return MiniAppManifest(
    appId: appId,
    version: version,
    name: name,
    minRuntimeVersion: minRuntimeVersion,
    entry: entry,
    pages: List.unmodifiable(pages),
    permissions: List.unmodifiable(permissions),
    qxColorScheme: qxColorScheme,
    files: List.unmodifiable(files),
    keyId: keyId,
  );
}

bool _isSemver(Object? value) =>
    value is String && value.length <= 64 && _semver.hasMatch(value);

bool _isSafeRoute(String value) =>
    isSafePackagePath(value) &&
    !value.contains('?') &&
    !value.contains('#') &&
    !value.endsWith('.json');
