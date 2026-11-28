/// Installs a verified `.qxpkg` into the layout the Android host reads.
///
/// ADR 008 §4: at most two verified versions per app, an atomic rename instead
/// of an in-place write, and a downgrade is refused unless the caller asks for
/// it. The directory itself comes from the host (`qchat/miniapp/installer`,
/// method `versionDir`), so the installer and the WebView can never disagree
/// about where a version lives.
library;

import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:crypto/crypto.dart';
import 'package:path/path.dart' as p;
import 'package:qchat_miniapp_webview/qchat_miniapp_webview.dart';

import 'miniapp_package.dart';

/// Resolves the installed version directory for an app and version.
typedef MiniAppVersionDir =
    Future<String> Function(String appId, String version);

/// What the installer wrote, for the screen that opens the page.
class MiniAppInstallResult {
  const MiniAppInstallResult({
    required this.appId,
    required this.version,
    required this.versionDir,
    required this.manifest,
    required this.installed,
  });

  final String appId;
  final String version;
  final String versionDir;
  final MiniAppManifest manifest;

  /// False when the same package was already installed and nothing was written.
  final bool installed;
}

/// Verifies, stages and atomically installs one package.
///
/// The installer is the only writer of the installed layout; the WebView only
/// reads it, and only after [install] returned.
class MiniAppInstaller {
  MiniAppInstaller({
    this.runtimeVersion = '1.0.0',
    this.trustedKeys = miniAppTrustedPackageKeys,
    MiniAppVersionDir? versionDir,
    this.keepVersions = 2,
  }) : _versionDir =
           versionDir ??
           ((appId, version) => MiniAppInstallPaths.versionDir(
             appId: appId,
             version: version,
           ));

  /// The host runtime version used for the `minRuntimeVersion` gate.
  final String runtimeVersion;

  /// Trusted signing keys by `keyId`; empty means every package is refused.
  final Map<String, String> trustedKeys;

  /// Verified versions kept per app (ADR 008 §4).
  final int keepVersions;

  final MiniAppVersionDir _versionDir;

  /// Read [file] and install it.
  Future<MiniAppInstallResult> installFile(
    File file, {
    bool allowDowngrade = false,
  }) async {
    if (!await file.exists()) {
      throw MiniAppPackageError(
        'PACKAGE_INSTALL_FAILED',
        'The package file is missing: ${file.path}',
      );
    }
    return install(await file.readAsBytes(), allowDowngrade: allowDowngrade);
  }

  /// Verify [bytes] and install them.
  ///
  /// Throws [MiniAppPackageError] with a registry code; a failed install leaves
  /// the previously installed version untouched.
  Future<MiniAppInstallResult> install(
    Uint8List bytes, {
    bool allowDowngrade = false,
  }) async {
    final package = await verifyMiniAppPackage(
      bytes,
      runtimeVersion: runtimeVersion,
      trustedKeys: trustedKeys,
    );
    final manifest = package.manifest;
    final fingerprint = packageFingerprint(package);

    final targetPath = await _versionDir(manifest.appId, manifest.version);
    final target = Directory(targetPath);
    final versionsDir = target.parent;
    await versionsDir.create(recursive: true);

    final existing = await _readMarker(target);
    if (existing != null) {
      if (existing['fingerprint'] == fingerprint) {
        return MiniAppInstallResult(
          appId: manifest.appId,
          version: manifest.version,
          versionDir: targetPath,
          manifest: manifest,
          installed: false,
        );
      }
      throw MiniAppPackageError(
        'PACKAGE_INSTALL_FAILED',
        'Another package is already installed as ${manifest.version}.',
      );
    }

    if (!allowDowngrade) {
      final newest = await _newestInstalled(versionsDir);
      if (newest != null &&
          compareMiniAppVersions(manifest.version, newest) < 0) {
        throw MiniAppPackageError(
          'PACKAGE_DOWNGRADE_BLOCKED',
          'Version ${manifest.version} is older than the installed $newest.',
        );
      }
    }

    final staging = Directory('$targetPath.staging');
    if (await staging.exists()) await staging.delete(recursive: true);
    try {
      await staging.create(recursive: true);
      final stagingRoot = p.canonicalize(staging.path);
      for (final entry in package.files.entries) {
        final path = p.joinAll(<String>[stagingRoot, ...entry.key.split('/')]);
        if (!p.isWithin(stagingRoot, path)) {
          throw MiniAppPackageError(
            'PACKAGE_UNSAFE_PATH',
            'A package file escapes the install directory: ${entry.key}',
          );
        }
        final file = File(path);
        await file.parent.create(recursive: true);
        await file.writeAsBytes(entry.value, flush: true);
      }
      await File(p.join(stagingRoot, 'install.json')).writeAsString(
        jsonEncode(<String, Object?>{
          'format': 'qchat-miniapp-install',
          'formatVersion': 1,
          'appId': manifest.appId,
          'version': manifest.version,
          'keyId': manifest.keyId,
          'fingerprint': fingerprint,
          'installedAt': DateTime.now().toUtc().toIso8601String(),
          'files': manifest.files.length,
        }),
        flush: true,
      );
      await staging.rename(targetPath);
    } catch (error) {
      if (await staging.exists()) {
        try {
          await staging.delete(recursive: true);
        } catch (_) {
          // The next install removes a stale staging directory anyway.
        }
      }
      if (error is MiniAppPackageError) rethrow;
      throw MiniAppPackageError(
        'PACKAGE_INSTALL_FAILED',
        'The package could not be written: $error',
      );
    }

    await _prune(versionsDir, keepVersion: manifest.version);
    return MiniAppInstallResult(
      appId: manifest.appId,
      version: manifest.version,
      versionDir: targetPath,
      manifest: manifest,
      installed: true,
    );
  }

  /// True when [version] of [appId] is installed and verified.
  Future<bool> isInstalled(String appId, String version) async {
    final path = await _versionDir(appId, version);
    return await _readMarker(Directory(path)) != null;
  }

  /// The installed versions of one app, newest first.
  Future<List<String>> installedVersions(String appId, String version) async {
    final versionsDir = Directory(await _versionDir(appId, version)).parent;
    if (!await versionsDir.exists()) return const <String>[];
    final versions = <String>[];
    await for (final entity in versionsDir.list()) {
      if (entity is! Directory) continue;
      final name = p.basename(entity.path);
      if (name.endsWith('.staging')) continue;
      if (await _readMarker(entity) == null) continue;
      versions.add(name);
    }
    versions.sort((left, right) => compareMiniAppVersions(right, left));
    return versions;
  }

  Future<Map<String, Object?>?> _readMarker(Directory dir) async {
    final marker = File(p.join(dir.path, 'install.json'));
    if (!await marker.exists()) return null;
    try {
      final value = jsonDecode(await marker.readAsString());
      if (value is! Map<String, Object?>) return null;
      if (value['format'] != 'qchat-miniapp-install') return null;
      return value;
    } on FormatException {
      return null;
    }
  }

  Future<String?> _newestInstalled(Directory versionsDir) async {
    if (!await versionsDir.exists()) return null;
    String? newest;
    await for (final entity in versionsDir.list()) {
      if (entity is! Directory) continue;
      final name = p.basename(entity.path);
      if (name.endsWith('.staging')) continue;
      if (await _readMarker(entity) == null) continue;
      if (newest == null || compareMiniAppVersions(name, newest) > 0) {
        newest = name;
      }
    }
    return newest;
  }

  /// Keep the just-installed version and the newest other one.
  Future<void> _prune(Directory versionsDir, {required String keepVersion}) async {
    final versions = <String>[];
    await for (final entity in versionsDir.list()) {
      if (entity is! Directory) continue;
      final name = p.basename(entity.path);
      if (name.endsWith('.staging')) {
        // A staging directory from a killed process is never a version.
        try {
          await entity.delete(recursive: true);
        } catch (_) {
          // Nothing depends on this cleanup succeeding.
        }
        continue;
      }
      if (name != keepVersion && await _readMarker(entity) == null) continue;
      versions.add(name);
    }
    versions.sort((left, right) => compareMiniAppVersions(right, left));
    final keep = <String>{keepVersion};
    for (final version in versions) {
      if (keep.length >= keepVersions) break;
      keep.add(version);
    }
    for (final version in versions) {
      if (keep.contains(version)) continue;
      try {
        await Directory(p.join(versionsDir.path, version)).delete(recursive: true);
      } catch (_) {
        // A version that cannot be removed stays readable but unlisted.
      }
    }
  }
}

/// A stable hash of what was installed: the manifest's identity and file list.
String packageFingerprint(VerifiedMiniAppPackage package) {
  final manifest = package.manifest;
  return sha256
      .convert(
        utf8.encode(
          canonicalJson(<String, Object?>{
            'appId': manifest.appId,
            'version': manifest.version,
            'keyId': manifest.keyId,
            'files': manifest.files
                .map((file) => <String, Object?>{
                  'path': file.path,
                  'sha256': file.sha256,
                })
                .toList(),
          }),
        ),
      )
      .toString();
}

/// Numeric semver comparison, as `compareVersions` in the compiler package.
int compareMiniAppVersions(String left, String right) {
  List<int> parse(String value) => value
      .split(RegExp(r'[.+-]'))
      .take(3)
      .map((part) => int.tryParse(part) ?? 0)
      .toList();
  final a = parse(left);
  final b = parse(right);
  for (var index = 0; index < 3; index += 1) {
    final leftPart = index < a.length ? a[index] : 0;
    final rightPart = index < b.length ? b[index] : 0;
    if (leftPart != rightPart) return leftPart.compareTo(rightPart);
  }
  return 0;
}
