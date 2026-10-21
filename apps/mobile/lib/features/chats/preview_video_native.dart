import 'dart:io';
import 'package:video_player/video_player.dart';

VideoPlayerController previewVideoController(String path) {
  final uri = Uri.tryParse(path);
  if (uri?.scheme == 'content') {
    return VideoPlayerController.contentUri(uri!);
  }
  return VideoPlayerController.file(
    uri?.scheme == 'file' ? File.fromUri(uri!) : File(path),
  );
}
