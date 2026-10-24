import 'dart:convert';
import 'dart:io';

import 'package:archive/archive.dart';
import 'package:crypto/crypto.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:path/path.dart' as p;
import 'package:qchat/features/miniapps/miniapp_asset_server.dart';
import 'package:qchat/features/miniapps/miniapp_cache.dart';
import 'package:qchat/features/miniapps/miniapp_storage.dart';
import 'package:qchat/features/miniapps/models.dart';

const _appId = 'mp_0123456789abcdef';

List<int> packageBytes({
  String appId = _appId,
  String version = '1.0.0',
  String entry = 'index.html',
  Map<String, String> extra = const {},
}) {
  final manifest = jsonEncode({
    'schemaVersion': 1,
    'appId': appId,
    'name': 'Demo app',
    'version': version,
    'entry': entry,
    'minRuntimeVersion': '1.0.0',
    'requestedPermissions': ['toast', 'storage'],
  });
  final files = <String, String>{
    'index.html': '<!doctype html><title>Demo</title><p>Hello</p>',
    'qchat.manifest.json': manifest,
    ...extra,
  };
  final archive = Archive();
  for (final file in files.entries) {
    final bytes = utf8.encode(file.value);
    archive.addFile(ArchiveFile(file.key, bytes.length, bytes));
  }
  return ZipEncoder().encode(archive)!;
}

MiniAppBuild buildFor(
  List<int> bytes, {
  String version = '1.0.0',
  String url = '',
  String? digest,
}) {
  final manifest = jsonDecode(
    utf8.decode(
      ZipDecoder()
          .decodeBytes(bytes)
          .files
          .firstWhere((file) => file.name == 'qchat.manifest.json')
          .content as List<int>,
    ),
  ) as Map<String, dynamic>;
  return MiniAppBuild(
    appId: _appId,
    version: version,
    entry: 'index.html',
    sha256: digest ?? sha256.convert(bytes).toString(),
    size: bytes.length,
    minRuntimeVersion: '1.0.0',
    requestedPermissions: const ['toast', 'storage'],
    manifest: MiniAppManifest.fromJson(manifest),
    url: url,
  );
}

Future<HttpServer> serve(List<int> bytes) async {
  final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
  server.listen((request) {
    request.response.headers.contentType = ContentType.binary;
    request.response.add(bytes);
    request.response.close();
  });
  return server;
}

void main() {
  late Directory root;

  setUp(() async {
    root = await Directory.systemTemp.createTemp('qchat-miniapp-test');
  });

  tearDown(() async {
    if (await root.exists()) await root.delete(recursive: true);
  });

  group('MiniAppStorage', () {
    test('stores JSON values per app and removes them', () async {
      final storage = await MiniAppStorage.open(root.path, _appId);
      await storage.set('counter', {'value': 2});
      expect(await storage.get('counter'), {'value': 2});
      await storage.remove('counter');
      expect(await storage.get('counter'), isNull);
    });

    test('rejects values over 64 KB', () async {
      final storage = await MiniAppStorage.open(root.path, _appId);
      await expectLater(
        storage.set('large', 'x' * (MiniAppStorage.maxValueBytes + 1)),
        throwsA(
          isA<MiniAppStorageException>().having(
            (error) => error.code,
            'code',
            'STORAGE_QUOTA_EXCEEDED',
          ),
        ),
      );
    });

    test('rejects an invalid app id', () async {
      await expectLater(
        MiniAppStorage.open(root.path, '../escape'),
        throwsA(
          isA<MiniAppStorageException>().having(
            (error) => error.code,
            'code',
            'INVALID_APP_ID',
          ),
        ),
      );
    });

    test('keeps two apps in separate files', () async {
      final first = await MiniAppStorage.open(root.path, _appId);
      final second = await MiniAppStorage.open(root.path, 'mp_fedcba9876543210');
      await first.set('key', 'first');
      await second.set('key', 'second');
      expect(await first.get('key'), 'first');
      expect(await second.get('key'), 'second');
    });
  });

  group('MiniAppCache', () {
    test('downloads, verifies, unpacks and finds a package', () async {
      final bytes = packageBytes();
      final server = await serve(bytes);
      addTearDown(server.close);
      final build = buildFor(
        bytes,
        url: 'http://127.0.0.1:${server.port}/app.zip',
      );
      final cache = MiniAppCache(p.join(root.path, 'cache'));

      final installed = await cache.install(build);
      expect(installed.version, '1.0.0');
      expect(installed.entry, 'index.html');
      expect(await File(p.join(installed.directory, 'index.html')).exists(), isTrue);

      final found = await cache.find(build);
      expect(found, isNotNull);
      expect(found!.sha256, build.sha256);
    });

    test('rejects a checksum mismatch', () async {
      final bytes = packageBytes();
      final server = await serve(bytes);
      addTearDown(server.close);
      final build = buildFor(
        bytes,
        url: 'http://127.0.0.1:${server.port}/app.zip',
        digest: '0' * 64,
      );
      final cache = MiniAppCache(p.join(root.path, 'cache'));
      await expectLater(
        cache.install(build),
        throwsA(
          isA<MiniAppCacheException>().having(
            (error) => error.code,
            'code',
            'CHECKSUM_MISMATCH',
          ),
        ),
      );
    });

    test('rejects path traversal entries', () async {
      final bytes = packageBytes(extra: {'../evil.txt': 'nope'});
      final server = await serve(bytes);
      addTearDown(server.close);
      final build = buildFor(
        bytes,
        url: 'http://127.0.0.1:${server.port}/app.zip',
      );
      final cache = MiniAppCache(p.join(root.path, 'cache'));
      await expectLater(
        cache.install(build),
        throwsA(
          isA<MiniAppCacheException>().having(
            (error) => error.code,
            'code',
            'ZIP_INVALID_NAME',
          ),
        ),
      );
    });

    test('rejects a manifest that does not match the build', () async {
      final bytes = packageBytes(appId: 'mp_fedcba9876543210');
      final server = await serve(bytes);
      addTearDown(server.close);
      final build = buildFor(
        bytes,
        url: 'http://127.0.0.1:${server.port}/app.zip',
      );
      final cache = MiniAppCache(p.join(root.path, 'cache'));
      await expectLater(
        cache.install(build),
        throwsA(
          isA<MiniAppCacheException>().having(
            (error) => error.code,
            'code',
            'MANIFEST_MISMATCH',
          ),
        ),
      );
    });

    test('latest returns an installed version when offline', () async {
      final first = packageBytes(version: '1.0.0');
      final firstServer = await serve(first);
      addTearDown(firstServer.close);
      final cache = MiniAppCache(p.join(root.path, 'cache'));
      await cache.install(
        buildFor(
          first,
          url: 'http://127.0.0.1:${firstServer.port}/a.zip',
        ),
      );
      await Future<void>.delayed(const Duration(milliseconds: 20));
      final second = packageBytes(version: '1.0.1');
      final secondServer = await serve(second);
      addTearDown(secondServer.close);
      await cache.install(
        buildFor(
          second,
          version: '1.0.1',
          url: 'http://127.0.0.1:${secondServer.port}/b.zip',
        ),
      );

      final latest = await cache.latest(_appId);
      expect(latest, isNotNull);
      expect(latest!.version, '1.0.1');
      expect(await cache.latest('mp_fedcba9876543210'), isNull);
    });
  });

  group('MiniAppAssetServer', () {
    test('serves the entry with a strict CSP from a loopback origin', () async {
      final directory = Directory(p.join(root.path, 'app'));
      await directory.create(recursive: true);
      await File(p.join(directory.path, 'index.html')).writeAsString(
        '<!doctype html><title>Hello</title>',
      );
      await File(p.join(directory.path, 'app.js')).writeAsString('console.log(1)');
      final server = MiniAppAssetServer(
        root: directory.path,
        entry: 'index.html',
        appId: _appId,
      );
      await server.start();
      addTearDown(server.close);
      expect(server.origin, startsWith('http://127.0.0.1:'));

      final client = HttpClient();
      addTearDown(client.close);
      final request = await client.getUrl(Uri.parse(server.url));
      final response = await request.close();
      final body = await response.transform(utf8.decoder).join();
      expect(response.statusCode, 200);
      expect(body, contains('Hello'));
      expect(
        response.headers.value('content-security-policy'),
        contains("default-src 'self'"),
      );
      expect(response.headers.value('x-qchat-miniapp'), _appId);

      final script = await client.getUrl(Uri.parse('${server.origin}/app.js'));
      final scriptResponse = await script.close();
      expect(scriptResponse.headers.contentType?.mimeType, 'text/javascript');

      final missing = await client.getUrl(
        Uri.parse('${server.origin}/missing.html'),
      );
      final missingResponse = await missing.close();
      expect(missingResponse.statusCode, 404);
    });
  });
}
