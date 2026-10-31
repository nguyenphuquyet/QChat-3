import 'dart:typed_data';

import 'package:dio/dio.dart';

import '../../core/design_system/media_widgets.dart';
import '../../core/network/client.dart';

/// Uploads one piece of sticker artwork through the shared media pipeline and
/// returns its media id. The picture is remembered in the media cache straight
/// away, so the studio shows it without a second download.
Future<String> uploadStickerArtwork(
  QChatClient client,
  Uint8List bytes,
  String mime, {
  required String name,
}) async {
  final intent = await client.post('/media/upload-intent', {
    'name': name,
    'size': bytes.length,
    'mime': mime,
  });
  await Dio().put(
    intent['url'],
    data: bytes,
    options: Options(headers: {'Content-Type': mime}),
  );
  await client.post('/media/complete', {'mediaId': intent['id']});
  await MediaCache.rememberMedia(
    intent['id'],
    bytes,
    mime,
    local: client.local,
  );
  return intent['id'] as String;
}
