import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:qchat/features/miniapps/miniapp_storage.dart';

const _appId = 'mp_0123456789abcdef';

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
      final second = await MiniAppStorage.open(
        root.path,
        'mp_fedcba9876543210',
      );
      await first.set('key', 'first');
      await second.set('key', 'second');
      expect(await first.get('key'), 'first');
      expect(await second.get('key'), 'second');
    });
  });
}
