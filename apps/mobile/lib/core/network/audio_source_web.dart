import 'dart:js_interop';
import 'dart:typed_data';
import 'package:just_audio/just_audio.dart';
import 'package:web/web.dart' as web;

Future<({AudioSource source, Future<void> Function() release})>
createAudioSource(Uint8List bytes) async {
  final url = web.URL.createObjectURL(
    web.Blob(
      [bytes.toJS].toJS,
      web.BlobPropertyBag(type: 'audio/mp4'),
    ),
  );
  return (
    source: AudioSource.uri(Uri.parse(url)),
    release: () async => web.URL.revokeObjectURL(url),
  );
}
