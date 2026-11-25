import 'dart:convert';
import 'dart:io';

import 'package:crypto/crypto.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:path/path.dart' as p;
import 'package:qchat/features/miniapps/miniapp_cache.dart';
import 'package:qchat/features/miniapps/models.dart';

String _sha256(List<int> bytes) => sha256.convert(bytes).toString();

void main() {
  late Directory root;

  setUp(() async {
    root = await Directory.systemTemp.createTemp('qchat-miniapp-cache-');
  });

  tearDown(() async {
    if (await root.exists()) await root.delete(recursive: true);
  });

  /// Writes the on-disk layout `install()` produces: the archive payload plus
  /// the package core files, `qchat.cache.json` included.
  Future<MiniAppBuild> writeInstalledApp({
    Map<String, String> extraFiles = const {},
  }) async {
    const appId = 'app_test';
    const version = '1.0.0';
    final archiveSha = List.filled(64, 'a').join();

    final indexHtml = utf8.encode('<!doctype html><html></html>');
    final appJs = utf8.encode('console.log("app");');
    final manifestJson = <String, dynamic>{
      'schemaVersion': 3,
      'format': 'webapp',
      'name': 'Test Mini App',
      'description': 'Cache verification fixture',
      'version': version,
      'entry': 'index.html',
      'minRuntimeVersion': '2.0.0',
      'requestedPermissions': ['toast'],
    };
    final metadataJson = <String, dynamic>{
      'formatVersion': 2,
      'version': version,
      'entry': 'index.html',
      'entrySha256': _sha256(indexHtml),
      'files': [
        {
          'path': 'assets/app.js',
          'sha256': _sha256(appJs),
          'size': appJs.length,
        },
        {
          'path': 'index.html',
          'sha256': _sha256(indexHtml),
          'size': indexHtml.length,
        },
      ],
    };

    final directory = Directory(
      p.join(root.path, 'apps', appId, '${version}_${archiveSha.substring(0, 8)}'),
    );
    await directory.create(recursive: true);

    Future<void> write(String name, List<int> bytes) async {
      final file = File(p.joinAll([directory.path, ...name.split('/')]));
      await file.parent.create(recursive: true);
      await file.writeAsBytes(bytes, flush: true);
    }

    await write('index.html', indexHtml);
    await write('assets/app.js', appJs);
    await write('manifest.json', utf8.encode(jsonEncode(manifestJson)));
    await write('metadata.json', utf8.encode(jsonEncode(metadataJson)));
    await write(
      'permissions.json',
      utf8.encode(jsonEncode({'requestedPermissions': ['toast']})),
    );
    await write(
      'qchat.cache.json',
      utf8.encode(
        jsonEncode({
          'appId': appId,
          'version': version,
          'sha256': archiveSha,
          'manifest': manifestJson,
        }),
      ),
    );
    for (final entry in extraFiles.entries) {
      await write(entry.key, utf8.encode(entry.value));
    }

    return MiniAppBuild(
      appId: appId,
      version: version,
      entry: 'index.html',
      sha256: archiveSha,
      size: 0,
      minRuntimeVersion: '2.0.0',
      requestedPermissions: const ['toast'],
      manifest: MiniAppManifest.fromJson(manifestJson),
      url: 'https://example.test/app.japp',
    );
  }

  test('manifest.json and permissions.json are not unexpected files', () async {
    final build = await writeInstalledApp();
    final cached = await MiniAppCache(root.path).find(build);
    expect(cached, isNotNull);
    expect(File(cached!.entryPath).existsSync(), isTrue);
  });

  test('an undeclared root file still fails the cache check', () async {
    final build = await writeInstalledApp(extraFiles: const {'notes.txt': 'x'});
    expect(await MiniAppCache(root.path).find(build), isNull);
  });
}
