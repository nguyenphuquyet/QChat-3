import 'package:just_audio/just_audio.dart';
import '../design_system/media_widgets.dart';
import 'client.dart';
import 'audio_source_web.dart'
    if (dart.library.io) 'audio_source_native.dart'
    as platform;

/// Voice notes are fetched once and replayed from the local cache.
class CachedAudio {
  CachedAudio(this.source, this.release);
  final AudioSource source;
  final Future<void> Function() release;

  Future<void> dispose() => release();

  static Future<CachedAudio> load(QChatClient client, String id) async {
    final bytes = await MediaCache.load(client, id);
    if (bytes == null) throw StateError('Media unavailable');
    final created = await platform.createAudioSource(bytes);
    return CachedAudio(created.source, created.release);
  }
}
