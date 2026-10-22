import 'dart:io';
import 'dart:typed_data';
import 'package:video_player/video_player.dart';

Future<({VideoPlayerController controller, Future<void> Function() release})>
createVideoSource(Uint8List bytes) async {
  final directory = await Directory.systemTemp.createTemp('qchat-video-');
  final file = File('${directory.path}/clip.mp4');
  try {
    await file.writeAsBytes(bytes, flush: true);
    return (
      controller: VideoPlayerController.file(file),
      release: () async {
        if (await directory.exists()) await directory.delete(recursive: true);
      },
    );
  } catch (_) {
    await directory.delete(recursive: true);
    rethrow;
  }
}
