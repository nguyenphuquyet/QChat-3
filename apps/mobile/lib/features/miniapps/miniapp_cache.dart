import 'dart:convert';
import 'dart:io';

import 'package:archive/archive.dart';
import 'package:crypto/crypto.dart';
import 'package:dio/dio.dart';
import 'package:path/path.dart' as p;
import 'package:uuid/uuid.dart';

import 'models.dart';

class MiniAppCacheException implements Exception {
  const MiniAppCacheException(this.code);

  final String code;

  @override
  String toString() => code;
}

class CachedMiniApp {
  const CachedMiniApp({
    required this.appId,
    required this.version,
    required this.sha256,
    required this.entry,
    required this.directory,
    required this.manifest,
    this.sdkVersion,
    this.format = 'qapp',
  });

  final String appId;
  final String version;
  final String sha256;
  final String entry;
  final String directory;
  final MiniAppManifest manifest;
  final String? sdkVersion;
  final String format;

  String get appJsPath => p.join(directory, 'app.js');
}

/// Downloads immutable ZIPs, verifies their SHA-256, unpacks them with path and
/// bomb guards, and keeps at most two versions per app for offline rollback.
class MiniAppCache {
  MiniAppCache(this.root);

  final String root;
  static const maxPackageBytes = 25 * 1024 * 1024;
  static const maxExpandedBytes = 80 * 1024 * 1024;
  static const maxEntries = 2000;
  static const _readyFile = 'qchat.cache.json';
  static const _blockedExtensions = {
    '.exe',
    '.dll',
    '.so',
    '.dylib',
    '.bat',
    '.cmd',
    '.ps1',
    '.sh',
    '.apk',
    '.jar',
    '.msi',
    '.scr',
    '.com',
    '.pkg',
    '.deb',
    '.rpm',
  };
  static const _qappCoreFiles = {
    'manifest.json',
    'app.js',
    'metadata.json',
    'permissions.json',
  };
  static const _qappAssetExtensions = {
    '.png',
    '.jpg',
    '.jpeg',
    '.webp',
    '.gif',
    '.svg',
    '.ttf',
    '.otf',
    '.woff',
    '.woff2',
    '.json',
    '.txt',
    '.mp3',
    '.wav',
    '.mp4',
  };

  String _appsDir(String appId) => p.join(root, 'apps', appId);

  /// Returns the newest installed version. Used when the network is down so a
  /// previously verified package can still open.
  Future<CachedMiniApp?> latest(String appId) async {
    final directory = Directory(_appsDir(appId));
    if (!await directory.exists()) return null;
    final candidates = <MapEntry<Directory, DateTime>>[];
    await for (final entity in directory.list()) {
      if (entity is! Directory) continue;
      try {
        candidates.add(MapEntry(entity, (await entity.stat()).modified));
      } catch (_) {}
    }
    candidates.sort((a, b) => b.value.compareTo(a.value));
    for (final candidate in candidates) {
      try {
        final ready = File(p.join(candidate.key.path, _readyFile));
        if (!await ready.exists()) continue;
        final json = jsonDecode(await ready.readAsString());
        if (json is! Map || json['appId'] != appId) continue;
        final manifest = json['manifest'];
        if (manifest is! Map) continue;
        final parsed = MiniAppManifest.fromJson(
          Map<String, dynamic>.from(manifest),
        );
        await _verifyQappDirectory(candidate.key, parsed);
        return CachedMiniApp(
          appId: appId,
          version: json['version']?.toString() ?? parsed.version,
          sha256: json['sha256']?.toString() ?? '',
          entry: parsed.entry,
          directory: candidate.key.path,
          manifest: parsed,
          format: parsed.format,
          sdkVersion: parsed.sdkVersion,
        );
      } catch (_) {
        continue;
      }
    }
    return null;
  }

  Future<CachedMiniApp?> find(MiniAppBuild build) async {
    final directory = Directory(
      p.join(
        _appsDir(build.appId),
        '${build.version}_${build.sha256.substring(0, 8)}',
      ),
    );
    if (!await directory.exists()) return null;
    try {
      final ready = File(p.join(directory.path, _readyFile));
      if (!await ready.exists()) return null;
      final json = jsonDecode(await ready.readAsString());
      if (json is! Map) return null;
      final manifest = json['manifest'];
      if (json['appId'] != build.appId ||
          json['version'] != build.version ||
          json['sha256'] != build.sha256 ||
          manifest is! Map) {
        await directory.delete(recursive: true);
        return null;
      }
      final parsed = MiniAppManifest.fromJson(
        Map<String, dynamic>.from(manifest),
      );
      if (parsed.version != build.version || parsed.format != 'qapp') {
        await directory.delete(recursive: true);
        return null;
      }
      await _verifyQappDirectory(directory, parsed);
      return CachedMiniApp(
        appId: build.appId,
        version: build.version,
        sha256: build.sha256,
        entry: parsed.entry,
        directory: directory.path,
        manifest: parsed,
        format: parsed.format,
        sdkVersion: parsed.sdkVersion,
      );
    } catch (_) {
      return null;
    }
  }

  Future<CachedMiniApp> install(
    MiniAppBuild build, {
    void Function(String stage)? onStage,
  }) async {
    final existing = await find(build);
    if (existing != null) return existing;

    final tmpDir = Directory(p.join(root, 'tmp'));
    await tmpDir.create(recursive: true);
    final zipFile = File(p.join(tmpDir.path, '${const Uuid().v4()}.zip'));
    onStage?.call('download');
    try {
      final dio = Dio(
        BaseOptions(
          connectTimeout: const Duration(seconds: 10),
          receiveTimeout: const Duration(seconds: 60),
          followRedirects: true,
          maxRedirects: 3,
          validateStatus: (status) =>
              status != null && status >= 200 && status < 300,
        ),
      );
      final response = await dio.download(
        build.url,
        zipFile.path,
        options: Options(
          headers: const {'Accept': 'application/zip'},
          receiveTimeout: const Duration(seconds: 60),
        ),
      );
      final length = response.headers.value(Headers.contentLengthHeader);
      final expected = int.tryParse(length ?? '');
      if (expected != null && expected > maxPackageBytes) {
        throw const MiniAppCacheException('PACKAGE_TOO_LARGE');
      }
      final size = await zipFile.length();
      if (size <= 0 || size > maxPackageBytes) {
        throw const MiniAppCacheException('PACKAGE_TOO_LARGE');
      }
      if (build.size > 0 && size != build.size) {
        throw const MiniAppCacheException('PACKAGE_SIZE_MISMATCH');
      }

      onStage?.call('verify');
      final digest = await sha256.bind(zipFile.openRead()).first;
      if (digest.toString().toLowerCase() != build.sha256.toLowerCase()) {
        throw const MiniAppCacheException('CHECKSUM_MISMATCH');
      }

      onStage?.call('extract');
      final bytes = await zipFile.readAsBytes();
      final archive = ZipDecoder().decodeBytes(bytes, verify: true);
      if (archive.length > maxEntries) {
        throw const MiniAppCacheException('ZIP_TOO_MANY_ENTRIES');
      }
      int total = 0;
      for (final file in archive) {
        if (file.isSymbolicLink) {
          throw const MiniAppCacheException('ZIP_SYMLINK');
        }
        if (!file.isFile) continue;
        final name = _safeName(file.name);
        final extension = p.extension(name).toLowerCase();
        if (_blockedExtensions.contains(extension)) {
          throw const MiniAppCacheException('ZIP_EXECUTABLE');
        }
        total += file.size;
        if (total > maxExpandedBytes || total > bytes.length * 200) {
          throw const MiniAppCacheException('ZIP_BOMB');
        }
      }

      final target = Directory(
        p.join(
          _appsDir(build.appId),
          '${build.version}_${build.sha256.substring(0, 8)}',
        ),
      );
      final staging = Directory(
        p.join(tmpDir.path, 'extract-${const Uuid().v4()}'),
      );
      if (await staging.exists()) await staging.delete(recursive: true);
      await staging.create(recursive: true);
      final stagingRoot = p.normalize(staging.path);

      for (final file in archive) {
        if (!file.isFile) continue;
        final name = _safeName(file.name);
        final output = File(p.joinAll([staging.path, ...name.split('/')]));
        final normalized = p.normalize(output.path);
        if (!normalized.startsWith('$stagingRoot${p.separator}')) {
          throw const MiniAppCacheException('ZIP_PATH_TRAVERSAL');
        }
        await output.parent.create(recursive: true);
        await output.writeAsBytes(file.content as List<int>, flush: true);
      }

      final manifestFile = File(p.join(staging.path, 'manifest.json'));
      if (!await manifestFile.exists()) {
        throw const MiniAppCacheException('MANIFEST_MISSING');
      }
      final manifestJson = jsonDecode(await manifestFile.readAsString());
      if (manifestJson is! Map) {
        throw const MiniAppCacheException('MANIFEST_INVALID');
      }
      final manifest = MiniAppManifest.fromJson(
        Map<String, dynamic>.from(manifestJson),
      );
      if (manifest.version != build.version ||
          manifest.format != 'qapp' ||
          manifest.entry != 'app.js') {
        throw const MiniAppCacheException('MANIFEST_MISMATCH');
      }
      await _verifyQappDirectory(staging, manifest);

      await target.parent.create(recursive: true);
      if (await target.exists()) await target.delete(recursive: true);
      await staging.rename(target.path);
      await File(p.join(target.path, _readyFile)).writeAsString(
        jsonEncode({
          'appId': build.appId,
          'version': build.version,
          'sha256': build.sha256,
          'format': manifest.format,
          'sdkVersion': manifest.sdkVersion,
          'installedAt': DateTime.now().toUtc().toIso8601String(),
          'manifest': manifestJson,
        }),
        flush: true,
      );
      await _prune(build.appId, keep: target.path);
      return CachedMiniApp(
        appId: build.appId,
        version: build.version,
        sha256: build.sha256,
        entry: manifest.entry,
        directory: target.path,
        manifest: manifest,
        format: manifest.format,
        sdkVersion: manifest.sdkVersion,
      );
    } on MiniAppCacheException {
      rethrow;
    } catch (error) {
      throw MiniAppCacheException('INSTALL_FAILED');
    } finally {
      if (await zipFile.exists()) {
        try {
          await zipFile.delete();
        } catch (_) {}
      }
    }
  }

  /// A `.japp` is a compiled JS bundle, not a website. The manifest and
  /// metadata must agree, every declared file must match its SHA-256 and no
  /// undeclared file may live beside the bundle. This runs at install time and
  /// again whenever a cached copy is opened, so a modified cache is discarded.
  Future<void> _verifyQappDirectory(
    Directory directory,
    MiniAppManifest manifest,
  ) async {
    if (manifest.schemaVersion != 2 ||
        manifest.format != 'qapp' ||
        manifest.entry != 'app.js') {
      throw const MiniAppCacheException('MANIFEST_MISMATCH');
    }
    final appFile = File(p.join(directory.path, 'app.js'));
    if (!await appFile.exists() || await appFile.length() == 0) {
      throw const MiniAppCacheException('ENTRY_MISSING');
    }
    if (await appFile.length() > 4 * 1024 * 1024) {
      throw const MiniAppCacheException('ENTRY_TOO_LARGE');
    }
    final appHash = sha256.convert(await appFile.readAsBytes()).toString();

    final metadataFile = File(p.join(directory.path, 'metadata.json'));
    if (!await metadataFile.exists()) {
      throw const MiniAppCacheException('METADATA_MISSING');
    }
    final metadata = jsonDecode(await metadataFile.readAsString());
    if (metadata is! Map) {
      throw const MiniAppCacheException('METADATA_INVALID');
    }
    if (metadata['formatVersion'] != 1 ||
        metadata['version'] != manifest.version ||
        metadata['entry'] != 'app.js' ||
        metadata['appSha256'] != appHash) {
      throw const MiniAppCacheException('METADATA_MISMATCH');
    }
    final declared = metadata['files'];
    if (declared is! List || declared.isEmpty || declared.length > 600) {
      throw const MiniAppCacheException('METADATA_INVALID');
    }
    final expected = <String, ({int size, String sha})>{};
    for (final row in declared) {
      if (row is! Map) throw const MiniAppCacheException('METADATA_INVALID');
      final rawPath = row['path']?.toString() ?? '';
      final name = _safeRelative(rawPath);
      final size = row['size'];
      final hash = row['sha256']?.toString() ?? '';
      if (size is! int ||
          size < 0 ||
          !RegExp(r'^[a-f0-9]{64}$').hasMatch(hash)) {
        throw const MiniAppCacheException('METADATA_INVALID');
      }
      expected[name] = (size: size, sha: hash);
    }
    final appEntry = expected['app.js'];
    if (appEntry == null ||
        appEntry.sha != appHash ||
        appEntry.size != await appFile.length()) {
      throw const MiniAppCacheException('METADATA_MISMATCH');
    }
    for (final name in expected.keys) {
      if (_qappCoreFiles.contains(name)) continue;
      if (!name.startsWith('assets/') ||
          !_qappAssetExtensions.contains(p.extension(name).toLowerCase())) {
        throw const MiniAppCacheException('UNEXPECTED_FILE');
      }
    }

    final seen = <String>{};
    await for (final entity in directory.list(
      recursive: true,
      followLinks: false,
    )) {
      if (entity is Link) {
        throw const MiniAppCacheException('ZIP_SYMLINK');
      }
      if (entity is! File) continue;
      final name = p
          .relative(entity.path, from: directory.path)
          .replaceAll('\\', '/');
      if (name == _readyFile || name == 'metadata.json') continue;
      final row = expected[name];
      if (row == null) {
        throw const MiniAppCacheException('UNEXPECTED_FILE');
      }
      seen.add(name);
      if (await entity.length() != row.size) {
        throw const MiniAppCacheException('CACHE_CHECKSUM_MISMATCH');
      }
      final digest = sha256.convert(await entity.readAsBytes()).toString();
      if (digest != row.sha) {
        throw const MiniAppCacheException('CACHE_CHECKSUM_MISMATCH');
      }
    }
    if (!seen.containsAll(expected.keys)) {
      throw const MiniAppCacheException('FILE_MISSING');
    }

    final permissionsFile = File(p.join(directory.path, 'permissions.json'));
    if (!await permissionsFile.exists()) {
      throw const MiniAppCacheException('PERMISSIONS_MISSING');
    }
    final permissions = jsonDecode(await permissionsFile.readAsString());
    if (permissions is! Map) {
      throw const MiniAppCacheException('PERMISSIONS_INVALID');
    }
    final requested = permissions['requestedPermissions'];
    final domains = permissions['networkDomains'];
    if (requested is! List ||
        domains is! List ||
        !_sameStrings(
          requested.map((item) => item.toString()).toList(),
          manifest.requestedPermissions,
        ) ||
        !_sameStrings(
          domains.map((item) => item.toString()).toList(),
          manifest.networkDomains,
        )) {
      throw const MiniAppCacheException('PERMISSIONS_MISMATCH');
    }
  }

  String _safeRelative(String raw) {
    final name = raw.replaceAll('\\', '/');
    if (name.isEmpty ||
        name.startsWith('/') ||
        name.contains(':') ||
        name.contains('\u0000')) {
      throw const MiniAppCacheException('ZIP_INVALID_NAME');
    }
    final parts = name.split('/');
    if (parts.any((part) => part.isEmpty || part == '.' || part == '..')) {
      throw const MiniAppCacheException('ZIP_INVALID_NAME');
    }
    return parts.join('/');
  }

  bool _sameStrings(List<String> a, List<String> b) {
    if (a.length != b.length) return false;
    for (var index = 0; index < a.length; index++) {
      if (a[index] != b[index]) return false;
    }
    return true;
  }

  String _safeName(String raw) {
    final name = raw.replaceAll('\\', '/');
    if (name.isEmpty ||
        name.startsWith('/') ||
        name.contains('\u0000') ||
        name.contains(':')) {
      throw const MiniAppCacheException('ZIP_INVALID_NAME');
    }
    final trimmed = name.endsWith('/')
        ? name.substring(0, name.length - 1)
        : name;
    final parts = trimmed.split('/');
    if (parts.any((part) => part.isEmpty || part == '.' || part == '..')) {
      throw const MiniAppCacheException('ZIP_INVALID_NAME');
    }
    return trimmed;
  }

  Future<void> _prune(String appId, {required String keep}) async {
    final directory = Directory(_appsDir(appId));
    if (!await directory.exists()) return;
    final entries = <MapEntry<Directory, DateTime>>[];
    await for (final entity in directory.list()) {
      if (entity is! Directory) continue;
      try {
        final stat = await entity.stat();
        entries.add(MapEntry(entity, stat.modified));
      } catch (_) {}
    }
    entries.sort((a, b) => b.value.compareTo(a.value));
    var kept = 0;
    for (final entry in entries) {
      if (entry.key.path == keep) {
        kept++;
        continue;
      }
      if (kept < 2) {
        kept++;
        continue;
      }
      try {
        await entry.key.delete(recursive: true);
      } catch (_) {}
    }
  }

  Future<void> remove(String appId) async {
    final directory = Directory(_appsDir(appId));
    if (await directory.exists()) await directory.delete(recursive: true);
  }
}
