import 'dart:convert';
import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:qchat/core/design_system/media_widgets.dart';
import 'package:qchat/core/network/client.dart';
import 'package:qchat/core/storage/database.dart';
import 'video_meta_test.dart' show header;

class CacheOnlyClient extends QChatClient {
  int requests = 0;
  @override
  Future<dynamic> get(String path, {bool cached = true}) async {
    requests++;
    throw StateError('Network must not be needed for cached media');
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  test(
    'video and image bytes survive memory eviction and avoid network',
    () async {
      final client = CacheOnlyClient()
        ..local = LocalDatabase.testing(NativeDatabase.memory());
      addTearDown(() async {
        client.dispose();
        await client.local!.close();
        MediaCache.clear();
      });
      final video = header(width: 1920, height: 1080);
      final image = base64Decode(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXfoAAAAASUVORK5CYII=',
      );
      await MediaCache.rememberMedia(
        'video',
        video,
        'video/mp4',
        local: client.local,
      );
      await MediaCache.rememberMedia(
        'image',
        image,
        'image/png',
        local: client.local,
      );
      MediaCache.clear();
      expect(await MediaCache.load(client, 'video'), video);
      expect(await MediaCache.load(client, 'image'), image);
      expect((await MediaCache.info(client, 'video'))?['width'], 1920);
      expect((await MediaCache.info(client, 'image'))?['mime'], 'image/png');
      expect(client.requests, 0);
    },
  );
}
