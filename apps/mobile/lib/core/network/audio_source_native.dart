import 'dart:io';
import 'dart:typed_data';
import 'package:just_audio/just_audio.dart';

Future<({AudioSource source, Future<void> Function() release})>
createAudioSource(Uint8List bytes) async {
  final directory = await Directory.systemTemp.createTemp('qchat-audio-');
  final file = File('${directory.path}/voice.m4a');
  try {
    await file.writeAsBytes(bytes, flush: true);
    return (
      source: AudioSource.file(file.path),
      release: () async {
        if (await directory.exists()) await directory.delete(recursive: true);
      },
    );
  } catch (_) {
    await directory.delete(recursive: true);
    rethrow;
  }
}
