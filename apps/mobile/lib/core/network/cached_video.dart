import 'package:video_player/video_player.dart';
import '../design_system/media_widgets.dart';
import 'client.dart';
import 'video_source_web.dart'
    if (dart.library.io) 'video_source_native.dart'
    as platform;

class CachedVideo {
  CachedVideo(this.controller, this.release);
  final VideoPlayerController controller;
  final Future<void> Function() release;
  Future<void> dispose() async {
    await controller.dispose();
    await release();
  }

  static Future<CachedVideo> load(
    QChatClient client,
    String id, {
    String extension = 'mp4',
  }) async {
    final bytes = await MediaCache.load(client, id);
    if (bytes == null) throw StateError('Media unavailable');
    final source = await platform.createVideoSource(bytes, extension);
    return CachedVideo(source.controller, source.release);
  }
}
