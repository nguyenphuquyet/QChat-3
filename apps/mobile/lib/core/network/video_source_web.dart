import 'dart:js_interop';
import 'dart:typed_data';
import 'package:video_player/video_player.dart';
import 'package:web/web.dart' as web;

Future<({VideoPlayerController controller, Future<void> Function() release})>
createVideoSource(Uint8List bytes) async {
  final url = web.URL.createObjectURL(
    web.Blob([bytes.toJS].toJS, web.BlobPropertyBag(type: 'video/mp4')),
  );
  return (
    controller: VideoPlayerController.networkUrl(Uri.parse(url)),
    release: () async => web.URL.revokeObjectURL(url),
  );
}
