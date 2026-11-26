import 'dart:typed_data';

import 'package:dio/dio.dart';

import '../../core/design_system/media_widgets.dart';
import '../../core/media/media_fit.dart';
import '../../core/network/client.dart';

/// Uploads one piece of sticker artwork through the shared media pipeline and
/// returns its media id. The picture is remembered in the media cache straight
/// away, so the studio shows it without a second download.
///
/// The mime is read from the bytes, not taken on trust: the server compares an
/// upload's first bytes with the declared type and refuses a mismatch, and the
/// studio's PNG output does not always carry the format its source claimed.
Future<String> uploadStickerArtwork(
  QChatClient client,
  Uint8List bytes,
  String mime, {
  required String name,
}) async {
  final actual = imageMimeFromBytes(bytes) ?? mime;
  final intent = await client.post('/media/upload-intent', {
    'name': name,
    'size': bytes.length,
    'mime': actual,
  });
  await Dio().put(
    intent['url'],
    data: bytes,
    options: Options(headers: {'Content-Type': actual}),
  );
  await client.post('/media/complete', {'mediaId': intent['id']});
  await MediaCache.rememberMedia(
    intent['id'],
    bytes,
    actual,
    local: client.local,
  );
  return intent['id'] as String;
}
