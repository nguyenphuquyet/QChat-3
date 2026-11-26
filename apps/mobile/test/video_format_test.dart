import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:qchat/core/network/video_format.dart';

Uint8List bytes(List<int> head, {int size = 64}) =>
    Uint8List.fromList([...head, ...List.filled(size - head.length, 0)]);

void main() {
  test('an mp4 reads as mp4', () {
    final format = VideoClipFormat.sniff(
      bytes([0, 0, 0, 0x18, ...('ftypisom').codeUnits]),
    );
    expect(format.extension, 'mp4');
    expect(format.mime, 'video/mp4');
  });

  test('a QuickTime movie keeps its .mov extension', () {
    final format = VideoClipFormat.sniff(
      bytes([0, 0, 0, 0x14, ...('ftypqt  ').codeUnits]),
    );
    expect(format.extension, 'mov');
    expect(format.mime, 'video/quicktime');
  });

  test('a WebM clip is recognised by its EBML header', () {
    final format = VideoClipFormat.sniff(
      bytes([0x1a, 0x45, 0xdf, 0xa3, ...('webm').codeUnits]),
    );
    expect(format.extension, 'webm');
    expect(format.mime, 'video/webm');
  });

  test('a Matroska clip without the webm doctype reads as mkv', () {
    final format = VideoClipFormat.sniff(
      bytes([0x1a, 0x45, 0xdf, 0xa3, ...('matroska').codeUnits]),
    );
    expect(format.extension, 'mkv');
    expect(format.mime, 'video/x-matroska');
  });

  test('an AVI clip reads as avi', () {
    final format = VideoClipFormat.sniff(
      bytes([...('RIFF').codeUnits, 0, 0, 0, 0, ...('AVI ').codeUnits]),
    );
    expect(format.extension, 'avi');
    expect(format.mime, 'video/x-msvideo');
  });

  test('unknown bytes fall back to mp4 instead of failing playback', () {
    expect(VideoClipFormat.sniff(bytes([1, 2, 3])).extension, 'mp4');
  });
}
