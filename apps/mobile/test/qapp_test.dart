import 'dart:convert';
import 'dart:io';

import 'package:archive/archive.dart';
import 'package:crypto/crypto.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:path/path.dart' as p;
import 'package:qchat/features/miniapps/miniapp_cache.dart';
import 'package:qchat/features/miniapps/models.dart';
import 'package:qchat/features/miniapps/qapp/qapp_backend_native.dart';
import 'package:qchat/features/miniapps/qapp/qapp_js_types.dart';
import 'package:qchat/features/miniapps/qapp/qapp_tree.dart';

const _appId = 'mp_0123456789abcdef';
const _appJs = "console.log('native qapp');";

Map<String, List<int>> qappFiles({
  String appJs = _appJs,
  Map<String, List<int>> assets = const {},
  Map<String, dynamic>? manifestOverride,
  Map<String, dynamic>? permissionsOverride,
  List<Map<String, dynamic>>? metadataFilesOverride,
  Map<String, List<int>> extra = const {},
}) {
  final manifest = <String, dynamic>{
    'schemaVersion': 2,
    'format': 'qapp',
    'name': 'Demo native app',
    'version': '1.0.0',
    'entry': 'app.js',
    'sdkVersion': '1.0.0',
    'minRuntimeVersion': '1.0.0',
    'requestedPermissions': ['toast'],
    'networkDomains': [],
    ...?manifestOverride,
  };
  final permissions = <String, dynamic>{
    'requestedPermissions': manifest['requestedPermissions'],
    'networkDomains': manifest['networkDomains'],
    ...?permissionsOverride,
  };
  final appBytes = utf8.encode(appJs);
  final manifestBytes = utf8.encode(jsonEncode(manifest));
  final permissionBytes = utf8.encode(jsonEncode(permissions));
  final files = <Map<String, dynamic>>[
    {
      'path': 'app.js',
      'sha256': sha256.convert(appBytes).toString(),
      'size': appBytes.length,
    },
    {
      'path': 'manifest.json',
      'sha256': sha256.convert(manifestBytes).toString(),
      'size': manifestBytes.length,
    },
    {
      'path': 'permissions.json',
      'sha256': sha256.convert(permissionBytes).toString(),
      'size': permissionBytes.length,
    },
    for (final asset in assets.entries)
      {
        'path': 'assets/${asset.key}',
        'sha256': sha256.convert(asset.value).toString(),
        'size': asset.value.length,
      },
  ];
  final metadata = <String, dynamic>{
    'formatVersion': 1,
    'sdkVersion': '1.0.0',
    'version': '1.0.0',
    'entry': 'app.js',
    'builtAt': '2026-10-26T00:00:00.000Z',
    'appSha256': sha256.convert(appBytes).toString(),
    'files': metadataFilesOverride ?? files,
  };
  return {
    'manifest.json': manifestBytes,
    'app.js': appBytes,
    'permissions.json': permissionBytes,
    'metadata.json': utf8.encode(jsonEncode(metadata)),
    for (final asset in assets.entries) 'assets/${asset.key}': asset.value,
    ...extra,
  };
}

List<int> zipFiles(Map<String, List<int>> files) {
  final archive = Archive();
  for (final file in files.entries) {
    archive.addFile(ArchiveFile(file.key, file.value.length, file.value));
  }
  return ZipEncoder().encode(archive)!;
}

MiniAppBuild qappBuild(
  List<int> bytes, {
  String version = '1.0.0',
  String url = '',
  List<String> permissions = const ['toast'],
  List<String> networkDomains = const [],
}) {
  final files = ZipDecoder().decodeBytes(bytes);
  final manifest =
      jsonDecode(
            utf8.decode(
              files.files
                      .firstWhere((file) => file.name == 'manifest.json')
                      .content
                  as List<int>,
            ),
          )
          as Map<String, dynamic>;
  return MiniAppBuild(
    appId: _appId,
    version: version,
    entry: 'app.js',
    sha256: sha256.convert(bytes).toString(),
    size: bytes.length,
    minRuntimeVersion: '1.0.0',
    requestedPermissions: permissions,
    manifest: MiniAppManifest.fromJson(manifest),
    url: url,
    format: 'qapp',
    sdkVersion: '1.0.0',
    networkDomains: networkDomains,
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
    root = await Directory.systemTemp.createTemp('qchat-qapp-test');
  });

  tearDown(() async {
    if (await root.exists()) await root.delete(recursive: true);
  });

  group('QappTree', () {
    test('parses components, events and text content', () {
      final tree = QappTree.fromJson({
        'v': 1,
        'appId': _appId,
        'revision': 3,
        'root': {
          'id': 'n0',
          'type': 'View',
          'props': {
            'style': {'flexDirection': 'row', 'gap': 8},
          },
          'children': [
            {
              'id': 'n0.0',
              'type': 'Text',
              'props': {},
              'children': [
                {
                  'id': 'n0.0.0',
                  'type': '#text',
                  'props': {'text': 'Hello '},
                },
                {
                  'id': 'n0.0.1',
                  'type': '#text',
                  'props': {'text': 'TSX'},
                },
              ],
            },
            {
              'id': 'n0.1',
              'type': 'Button',
              'props': {
                'variant': 'primary',
                '__events': ['press'],
              },
              'events': ['press'],
            },
          ],
        },
      });
      expect(tree.revision, 3);
      expect(tree.nodeCount, 5);
      expect(tree.root!.type, 'View');
      expect(tree.root!.children.first.type, 'Text');
      expect(qappTextContent(tree.root!.children.first), 'Hello TSX');
      expect(tree.root!.children[1].hasEvent('press'), isTrue);
    });

    test('rejects unknown components, events and node ids', () {
      Map<String, dynamic> tree(Object? node) => {
        'v': 1,
        'appId': _appId,
        'revision': 1,
        'root': node,
      };
      expect(
        () => QappTree.fromJson(
          tree({'id': 'n0', 'type': 'Script', 'props': {}}),
        ),
        throwsA(
          isA<QappTreeException>().having(
            (error) => error.code,
            'code',
            'UNSUPPORTED_COMPONENT',
          ),
        ),
      );
      expect(
        () => QappTree.fromJson(
          tree({
            'id': 'n0',
            'type': 'Button',
            'props': {},
            'events': ['launchMissiles'],
          }),
        ),
        throwsA(isA<QappTreeException>()),
      );
      expect(
        () => QappTree.fromJson(tree({'id': '', 'type': 'View', 'props': {}})),
        throwsA(isA<QappTreeException>()),
      );
    });
  });

  group('Qapp cache', () {
    test('installs a verified bundle with checksums and assets', () async {
      final files = qappFiles(
        assets: {
          'logo.png': [1, 2, 3, 4],
        },
      );
      final bytes = zipFiles(files);
      final server = await serve(bytes);
      addTearDown(server.close);
      final build = qappBuild(
        bytes,
        url: 'http://127.0.0.1:${server.port}/app.japp',
      );
      final cache = MiniAppCache(p.join(root.path, 'cache'));

      final installed = await cache.install(build);
      expect(installed.format, 'qapp');
      expect(installed.entry, 'app.js');
      expect(installed.sdkVersion, '1.0.0');
      expect(await File(installed.appJsPath).exists(), isTrue);
      expect(
        await File(p.join(installed.directory, 'assets', 'logo.png')).exists(),
        isTrue,
      );

      final found = await cache.find(build);
      expect(found, isNotNull);
      expect(found!.manifest.format, 'qapp');
    });

    test('rejects a bundle whose app.js does not match metadata', () async {
      final files = qappFiles();
      final metadata = jsonDecode(utf8.decode(files['metadata.json']!));
      metadata['appSha256'] = '0' * 64;
      files['metadata.json'] = utf8.encode(jsonEncode(metadata));
      final bytes = zipFiles(files);
      final server = await serve(bytes);
      addTearDown(server.close);
      final build = qappBuild(
        bytes,
        url: 'http://127.0.0.1:${server.port}/app.japp',
      );
      final cache = MiniAppCache(p.join(root.path, 'cache'));
      await expectLater(
        cache.install(build),
        throwsA(
          isA<MiniAppCacheException>().having(
            (error) => error.code,
            'code',
            'METADATA_MISMATCH',
          ),
        ),
      );
    });

    test('rejects an undeclared file beside the bundle', () async {
      final files = qappFiles(
        extra: {
          'assets/extra.png': [9, 9],
        },
      );
      final bytes = zipFiles(files);
      final server = await serve(bytes);
      addTearDown(server.close);
      final build = qappBuild(
        bytes,
        url: 'http://127.0.0.1:${server.port}/app.japp',
      );
      final cache = MiniAppCache(p.join(root.path, 'cache'));
      await expectLater(
        cache.install(build),
        throwsA(
          isA<MiniAppCacheException>().having(
            (error) => error.code,
            'code',
            'UNEXPECTED_FILE',
          ),
        ),
      );
    });

    test('detects a tampered cached bundle', () async {
      final bytes = zipFiles(qappFiles());
      final server = await serve(bytes);
      addTearDown(server.close);
      final build = qappBuild(
        bytes,
        url: 'http://127.0.0.1:${server.port}/app.japp',
      );
      final cache = MiniAppCache(p.join(root.path, 'cache'));
      final installed = await cache.install(build);
      await File(installed.appJsPath).writeAsString('// tampered');
      expect(await cache.find(build), isNull);
    });
  });

  group('Native backend', () {
    test('reads app.js and only allows assets/ paths', () async {
      final directory = Directory(p.join(root.path, 'app'));
      await directory.create(recursive: true);
      await File(p.join(directory.path, 'app.js')).writeAsString(_appJs);
      await Directory(p.join(directory.path, 'assets')).create();
      await File(p.join(directory.path, 'assets', 'a.txt')).writeAsString('hi');
      final backend = NativeQappBackend();
      expect(await backend.readAppJs(directory.path), _appJs);
      expect(
        utf8.decode((await backend.readAsset(directory.path, 'assets/a.txt'))!),
        'hi',
      );
      expect(await backend.readAsset(directory.path, '../secret.txt'), isNull);
      expect(await backend.readAsset(directory.path, 'app.js'), isNull);
    });
  });
  test('host response encodes errors without leaking a result', () {
    final response = const QappHostResponse.error('PERMISSION_DENIED', 'no');
    expect(response.toJson(), {
      'ok': false,
      'error': {'code': 'PERMISSION_DENIED', 'message': 'no'},
    });
  });

  test('legacy schemaVersion 1 packages are classified as webview', () {
    final manifest = MiniAppManifest.fromJson({
      'schemaVersion': 1,
      'name': 'Legacy',
      'version': '1.0.0',
      'entry': 'index.html',
      'requestedPermissions': ['toast'],
    });
    expect(manifest.format, 'webview');
    expect(manifest.entry, 'index.html');

    final build = MiniAppBuild.fromJson({
      'appId': _appId,
      'version': '1.0.0',
      'entry': 'index.html',
      'sha256': 'a' * 64,
      'size': 10,
      'minRuntimeVersion': '1.0.0',
      'requestedPermissions': ['toast'],
      'manifest': {
        'schemaVersion': 1,
        'name': 'Legacy',
        'version': '1.0.0',
        'entry': 'index.html',
      },
      'format': 'webview',
      'url': 'https://example.test/legacy.zip',
    });
    expect(build.format, 'webview');
  });
}
